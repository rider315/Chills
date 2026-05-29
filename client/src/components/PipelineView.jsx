import React, { useState } from 'react';
import { STATUS_STAGES, STATUS_LABELS, STATUS_COLORS, STATUS_ICONS } from '../utils/constants';
import StatusBadge from './StatusBadge';
import './PipelineView.css';

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
    <div className="pipeline">
      <div className="pipeline__columns">
        {columns.map((col) => (
          <div
            key={col.stage}
            className="pipeline__column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.stage)}
          >
            <div className="pipeline__column-header" style={{ borderColor: col.color.text }}>
              <span className="pipeline__column-icon">{col.icon}</span>
              <span className="pipeline__column-label">{col.label}</span>
              <span className="pipeline__column-count">{col.apps.length}</span>
            </div>

            <div className="pipeline__column-body">
              {col.apps.length === 0 ? (
                <div className="pipeline__empty">
                  <span className="text-xs text-muted">No items</span>
                </div>
              ) : (
                col.apps.map((app) => (
                  <div
                    key={app.id || app._id}
                    className="pipeline__card glass-card"
                    draggable
                    onDragStart={(e) => handleDragStart(e, app)}
                    onClick={() => onCardClick?.(app)}
                  >
                    <div className="pipeline__card-company">
                      {app.company || app.recruiter?.company || 'Unknown Company'}
                    </div>
                    <div className="pipeline__card-email">
                      {app.recruiterEmail || app.recruiter?.email || ''}
                    </div>
                    {(app.createdAt || app.sentAt) && (
                      <div className="pipeline__card-date">
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
