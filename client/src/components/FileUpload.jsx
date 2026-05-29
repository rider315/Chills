import React, { useRef, useState } from 'react';
import './FileUpload.css';

export default function FileUpload({ accept, onUpload, label, icon, currentFile, onRemove }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(interval); return 90; }
        return p + Math.random() * 15;
      });
    }, 150);

    try {
      await onUpload(file);
      setProgress(100);
    } catch (err) {
      console.error(err);
    } finally {
      clearInterval(interval);
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 500);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleChange = (e) => {
    const file = e.target.files[0];
    handleFile(file);
    e.target.value = '';
  };

  if (currentFile) {
    return (
      <div className="file-upload__preview glass-card">
        <div className="file-upload__file-icon">📄</div>
        <div className="file-upload__file-info">
          <span className="file-upload__file-name">{currentFile.name || currentFile.filename || 'Uploaded file'}</span>
          {currentFile.size && (
            <span className="file-upload__file-size">{formatSize(currentFile.size)}</span>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onRemove}>
          ✕ Remove
        </button>
      </div>
    );
  }

  return (
    <div
      className={`file-upload ${dragOver ? 'file-upload--drag-over' : ''} ${uploading ? 'file-upload--uploading' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="file-upload__input"
      />
      <div className="file-upload__content">
        <div className="file-upload__icon">{icon || '📁'}</div>
        <div className="file-upload__label">{label || 'Drop your file here'}</div>
        <div className="file-upload__hint">
          or <span className="file-upload__browse">browse</span> to choose
        </div>
        {accept && (
          <div className="file-upload__formats">
            Accepted: {accept.split(',').map(t => t.trim().replace('.', '').toUpperCase()).join(', ')}
          </div>
        )}
      </div>

      {uploading && (
        <div className="file-upload__progress-wrapper">
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="file-upload__progress-text">{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  );
}
