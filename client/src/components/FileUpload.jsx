import React, { useRef, useState } from 'react';

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
      <div className="card-neo bg-bw border-4 flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="text-4xl">📄</div>
          <div className="flex flex-col min-w-0">
            <span className="font-black text-lg truncate">{currentFile.name || currentFile.filename || 'Uploaded file'}</span>
            {currentFile.size && (
              <span className="font-bold opacity-70 text-sm">{formatSize(currentFile.size)}</span>
            )}
          </div>
        </div>
        <button className="btn-neo btn-neo-red px-3 py-1 flex-shrink-0" onClick={onRemove}>
          ✕ Remove
        </button>
      </div>
    );
  }

  return (
    <div
      className={`card-neo border-4 p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors relative overflow-hidden ${dragOver ? 'bg-neo-yellow/20 border-dashed border-neo-yellow' : 'bg-bw border-dashed hover:bg-gray-50'} ${uploading ? 'pointer-events-none' : ''}`}
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
        className="hidden"
      />
      <div className="flex flex-col items-center gap-2 z-10 relative">
        <div className="text-5xl mb-2">{icon || '📁'}</div>
        <div className="text-xl font-black">{label || 'Drop your file here'}</div>
        <div className="font-bold opacity-70">
          or <span className="text-neo-blue underline">browse</span> to choose
        </div>
        {accept && (
          <div className="mt-2 text-sm font-bold uppercase tracking-widest bg-gray-100 px-3 py-1 rounded border-2 border-border">
            Accepted: {accept.split(',').map(t => t.trim().replace('.', '').toUpperCase()).join(', ')}
          </div>
        )}
      </div>

      {uploading && (
        <div className="absolute inset-0 bg-bw/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-xs h-4 bg-gray-200 border-2 border-border rounded-full overflow-hidden mb-2 relative">
            <div
              className="h-full bg-neo-green transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-black text-lg">{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  );
}
