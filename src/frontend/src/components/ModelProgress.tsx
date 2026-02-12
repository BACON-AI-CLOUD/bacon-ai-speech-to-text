import type { ModelDownloadProgress } from '../types/index.ts';
import './ModelProgress.css';

interface ModelProgressProps {
  progress: ModelDownloadProgress | null;
}

export function ModelProgress({ progress }: ModelProgressProps) {
  if (!progress || !progress.downloading) return null;

  return (
    <div className="model-progress">
      <div className="model-progress__header">
        <span className="model-progress__label">
          Downloading model: <strong>{progress.modelName}</strong>
        </span>
        <span className="model-progress__percent">{progress.percentage}%</span>
      </div>
      <div className="model-progress__bar-bg">
        <div
          className="model-progress__bar-fill"
          style={{ width: `${Math.min(100, progress.percentage)}%` }}
        />
      </div>
    </div>
  );
}
