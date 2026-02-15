import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../useWebSocket.ts';

// WebSocket readyState constants
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSED = 3;

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = WS_CONNECTING;
  static OPEN = WS_OPEN;
  static CLOSING = 2;
  static CLOSED = WS_CLOSED;

  static instances: MockWebSocket[] = [];

  readyState: number = WS_CONNECTING;
  binaryType = '';
  url: string;

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;

  sent: unknown[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.readyState = WS_CLOSED;
    if (this.onclose) this.onclose();
  }

  // Test helpers
  simulateOpen() {
    this.readyState = WS_OPEN;
    if (this.onopen) this.onopen();
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) this.onmessage({ data });
  }

  simulateError() {
    if (this.onerror) this.onerror();
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('starts with disconnected state when autoConnect is false', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8765', autoConnect: false }),
    );

    expect(result.current.connectionState).toBe('disconnected');
    expect(MockWebSocket.instances.length).toBe(0);
  });

  it('connects automatically when autoConnect is true', () => {
    renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8765', autoConnect: true }),
    );

    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toBe('ws://localhost:8765/ws/audio');
  });

  it('transitions to connected state on open', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8765', autoConnect: true }),
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.connectionState).toBe('connected');
  });

  it('transitions to error state on WebSocket error', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8765', autoConnect: true }),
    );

    act(() => {
      MockWebSocket.instances[0].simulateError();
    });

    expect(result.current.connectionState).toBe('error');
  });

  it('parses transcription result messages', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8765', autoConnect: true }),
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    const testResult = {
      text: 'hello world',
      confidence: 0.95,
      language: 'en',
      duration: 1.5,
      segments: [],
      timestamp: Date.now(),
    };

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({ type: 'result', ...testResult }),
      );
    });

    expect(result.current.lastResult).toMatchObject(testResult);
  });

  it('parses error messages from server', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8765', autoConnect: true }),
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage(
        JSON.stringify({
          type: 'error',
          message: 'Model not found',
        }),
      );
    });

    expect(result.current.lastError).toBe('Model not found');
  });

  it('attempts reconnection on unexpected close', () => {
    renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8765', autoConnect: true }),
    );

    expect(MockWebSocket.instances.length).toBe(1);

    // Simulate unexpected close
    act(() => {
      MockWebSocket.instances[0].close();
    });

    // Advance past reconnection delay (1000ms base)
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // A new WebSocket instance should have been created
    expect(MockWebSocket.instances.length).toBe(2);
  });

  it('does not reconnect on intentional disconnect', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8765', autoConnect: true }),
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.disconnect();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Only the original instance should exist
    expect(MockWebSocket.instances.length).toBe(1);
    expect(result.current.connectionState).toBe('disconnected');
  });

  it('sends control messages as JSON', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8765', autoConnect: true }),
    );

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      result.current.sendControl({ action: 'start', model: 'base' });
    });

    const lastSent = MockWebSocket.instances[0].sent[0] as string;
    const parsed = JSON.parse(lastSent);
    expect(parsed.type).toBe('start');
  });
});
