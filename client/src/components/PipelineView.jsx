import React, { useState } from 'react';
import { STATUS_STAGES, STATUS_LABELS, STATUS_COLORS, STATUS_ICONS } from '../utils/constants';
import StatusBadge from './StatusBadge';

export default function PipelineView({ applications = [], onStatusChange, onCardClick }) {
  const [draggedApp, setDraggedApp] = useState(null);

  const columns = STATUS_STAGES.map((stage) => ({
    stage,
    label: STATUS_LABELS[stage],
    icon: STATUS_ICONS[stage],
    color: STATUS_COLORS[stage],
    apps: applications.filter((app) => (app.status || 'draft') === stage),
  }));

  const handleDragStart = (e, app) => {
    setDraggedApp(app);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetStage) => {
    e.preventDefault();
    if (draggedApp && draggedApp.status !== targetStage) {
      onStatusChange?.(draggedApp.id || draggedApp._id, targetStage);
    }
    setDraggedApp(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full h-full overflow-x-auto overflow-y-hidden pb-6 custom-scrollbar">
      <div className="flex gap-6 min-w-max px-1 h-full items-start">
        {columns.map((col) => (
          <div
            key={col.stage}
            className="flex flex-col w-[320px] max-h-full bg-bw border-4 border-border rounded-base p-4 shadow-neo flex-shrink-0"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.stage)}
          >
            <div className="flex items-center gap-2 pb-3 mb-3 border-b-4 border-border font-bold uppercase tracking-wider flex-shrink-0">
              <span className="text-xl">{col.icon}</span>
              <span className="flex-1 text-sm">{col.label}</span>
              <span className="bg-neo-yellow px-2.5 py-0.5 rounded-full border-2 border-border shadow-neosm text-xs">
                {col.apps.length}
              </span>
            </div>

            <div className="flex flex-col gap-3 min-h-[50px] overflow-y-auto custom-scrollbar pr-2 pb-2">
              {col.apps.length === 0 ? (
                <div className="flex items-center justify-center h-full min-h-[100px] text-sm font-bold text-gray-400 uppercase tracking-wider p-8 border-2 border-dashed border-gray-300 rounded-base">
                  No items
                </div>
              ) : (
                col.apps.map((app) => (
                  <div
                    key={app.id || app._id}
                    className="card-neo cursor-move p-4 flex flex-col gap-1 active:shadow-neosm active:translate-x-1 active:translate-y-1"
                    draggable
                    onDragStart={(e) => handleDragStart(e, app)}
                    onClick={() => onCardClick?.(app)}
                  >
                    <div className="font-bold text-lg leading-tight truncate">
                      {app.company || app.recruiter?.company || 'Unknown Company'}
                    </div>
                    <div className="text-sm font-medium opacity-80 truncate">
                      {app.recruiterEmail || app.recruiter?.email || ''}
                    </div>
                    {(app.createdAt || app.sentAt) && (
                      <div className="text-xs font-bold uppercase mt-2 pt-2 border-t-2 border-border opacity-70">
                        {formatDate(app.sentAt || app.createdAt)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
