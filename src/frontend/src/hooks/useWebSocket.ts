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
  onRemoteToggle?: () => void;
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
  onRemoteToggle,
}: UseWebSocketOptions): UseWebSocketReturn {
  const onRemoteToggleRef = useRef(onRemoteToggle);
  onRemoteToggleRef.current = onRemoteToggle;
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
            // Backend sends flat messages: { type, ...data } (no payload wrapper)
            const message = JSON.parse(event.data) as Record<string, unknown>;
            switch (message.type) {
              case 'result':
                setLastResult(message as unknown as TranscriptionResult);
                break;
              case 'status':
                // Only update serverStatus for full status messages (with gpu info),
                // not state-change messages like {type:"status", state:"ready"}
                if ('current_model' in message || 'gpu' in message) {
                  setServerStatus(message as unknown as ServerStatus);
                }
                break;
              case 'control':
                console.log('[BACON] Control message received:', message);
                if ((message as Record<string, unknown>).action === 'toggle') {
                  console.log('[BACON] Calling onRemoteToggle, ref exists:', !!onRemoteToggleRef.current);
                  onRemoteToggleRef.current?.();
                }
                break;
              case 'error':
                setLastError(
                  (message.message as string) || 'Unknown server error',
                );
                break;
            }
          }
        } catch {
          setLastError('Failed to parse server message');
        }
      };

      ws.onclose = () => {
        // Ignore close events from superseded WebSocket instances
        // (prevents StrictMode double-mount race condition where
        // old WS onclose clobbers wsRef pointing to new WS)
        if (wsRef.current !== ws) return;

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
        // Ignore errors from superseded WebSocket instances
        if (wsRef.current !== ws) return;
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
      // Backend expects flat: { type: 'start' }, { type: 'stop' }, { type: 'cancel' }
      wsRef.current.send(
        JSON.stringify({ type: message.action }),
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
