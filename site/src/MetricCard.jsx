import React from 'react';

function MetricCard({ title, value, subtitle, icon, trend }) {
  return (
    <div className="metric-card">
      <div className="metric-card-header">
        {icon && <div className="metric-icon">{icon}</div>}
        <h3 className="metric-title">{title}</h3>
      </div>
      <div className="metric-value">{value}</div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      {trend && (
        <div className={`metric-trend ${trend.direction}`}>
          {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.text}
        </div>
      )}
    </div>
  );
}

export default MetricCard;
