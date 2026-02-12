import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  ConnectionState,
  TranscriptionResult,
  ControlMessage,
  ServerStatus,
} from '../types/index.ts';

interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  connectionState: ConnectionState;
  sendAudio: (data: ArrayBuffer) => void;
  sendControl: (message: ControlMessage) => void;
  lastResult: TranscriptionResult | null;
  lastError: string | null;
  serverStatus: ServerStatus | null;
  reconnectAttempt: number;
  connect: () => void;
  disconnect: () => void;
}

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

export function useWebSocket({
  url,
  autoConnect = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(
    null,
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    intentionalCloseRef.current = false;
    setConnectionState('connecting');
    setLastError(null);

    try {
      const wsUrl = `${url}/ws/audio`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        setConnectionState('connected');
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          if (typeof event.data === 'string') {
            const message = JSON.parse(event.data) as {
              type: string;
              payload: unknown;
            };
            switch (message.type) {
              case 'result':
                setLastResult(message.payload as TranscriptionResult);
                break;
              case 'status':
                setServerStatus(message.payload as ServerStatus);
                break;
              case 'error':
                setLastError(
                  (message.payload as { message: string }).message ||
                    'Unknown server error',
                );
                break;
            }
          }
        } catch {
          setLastError('Failed to parse server message');
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!intentionalCloseRef.current) {
          setConnectionState('disconnected');
          // Exponential backoff reconnect
          const delay = Math.min(
            BASE_RECONNECT_DELAY *
              Math.pow(2, reconnectAttemptRef.current),
            MAX_RECONNECT_DELAY,
          );
          reconnectAttemptRef.current += 1;
          setReconnectAttempt(reconnectAttemptRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setConnectionState('disconnected');
        }
      };

      ws.onerror = () => {
        setConnectionState('error');
        setLastError('WebSocket connection error');
      };

      wsRef.current = ws;
    } catch {
      setConnectionState('error');
      setLastError('Failed to create WebSocket connection');
    }
  }, [url]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState('disconnected');
  }, [clearReconnectTimer]);

  const sendAudio = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const sendControl = useCallback((message: ControlMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'control', payload: message }),
      );
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [autoConnect, connect, clearReconnectTimer]);

  return {
    connectionState,
    sendAudio,
    sendControl,
    lastResult,
    lastError,
    serverStatus,
    reconnectAttempt,
    connect,
    disconnect,
  };
}
