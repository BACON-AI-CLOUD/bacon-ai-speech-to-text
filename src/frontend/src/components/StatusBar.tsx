import type { ConnectionState, ServerStatus } from '../types/index.ts';
import './StatusBar.css';

interface StatusBarProps {
  connectionState: ConnectionState;
  serverStatus: ServerStatus | null;
  reconnectAttempt?: number;
}

function connectionLabel(state: ConnectionState, reconnectAttempt: number): string {
  switch (state) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return reconnectAttempt > 0
        ? `Reconnecting (attempt ${reconnectAttempt})...`
        : 'Connecting...';
    case 'disconnected':
      return 'Disconnected';
    case 'error':
      return 'Error';
  }
}

export function StatusBar({ connectionState, serverStatus, reconnectAttempt = 0 }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-bar__connection">
        <span className={`status-dot status-dot--${connectionState}`} />
        <span className="status-bar__label">{connectionLabel(connectionState, reconnectAttempt)}</span>
      </div>

      {connectionState === 'disconnected' && (
        <span className="status-bar__hint">Backend offline - run ./start.sh to start</span>
      )}

      {serverStatus && (
        <>
          <div className="status-bar__divider" />
          <div className="status-bar__model">
            Model: <strong>{serverStatus.current_model}</strong>
          </div>
          <div className="status-bar__divider" />
          <div className="status-bar__gpu">
            GPU:{' '}
            {serverStatus.gpu?.available ? (
              <span className="status-bar__gpu--available">
                {serverStatus.gpu.name} ({serverStatus.gpu.vram_gb}GB)
              </span>
            ) : (
              <span className="status-bar__gpu--unavailable">CPU only</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
