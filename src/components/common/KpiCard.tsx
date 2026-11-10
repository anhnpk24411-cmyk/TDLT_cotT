import React from 'react';

interface KpiCardProps {
  title: string;
  value: string;
  subtext?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  badge?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  accentColor?: string; // e.g. '#3b6fe8'
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtext,
  trend,
  icon,
  badge,
  variant = 'default',
  accentColor,
}) => {
  const accent = accentColor ?? {
    default: '#3b6fe8',
    warning: '#f59e0b',
    danger: '#ef4444',
    success: '#10b981',
  }[variant];

  return (
    <div
      className="bg-white rounded-2xl p-5 relative overflow-hidden group"
      style={{ boxShadow: '0 1px 4px rgba(26,39,68,0.07), 0 0 0 1px rgba(59,111,232,0.07)' }}
    >
      {/* Accent top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: accent }}
      />

      {/* Icon badge + badge label */}
      <div className="flex items-start justify-between mb-3">
        {icon ? (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accent}18` }}
          >
            <span style={{ color: accent }}>{icon}</span>
          </div>
        ) : (
          <div />
        )}
        {badge && (
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg"
            style={{ background: `${accent}15`, color: accent }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>
        {title}
      </p>

      {/* Value */}
      <p className="text-2xl font-bold font-mono-num leading-tight" style={{ color: '#1a2744' }}>
        {value}
      </p>

      {/* Subtext / trend */}
      {(subtext || trend) && (
        <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: '#94a3b8' }}>
          {trend && (
            <span
              className="font-semibold px-1.5 py-0.5 rounded-md"
              style={{
                color: trend.isPositive ? '#10b981' : '#ef4444',
                background: trend.isPositive ? '#10b98115' : '#ef444415',
              }}
            >
              {trend.value}
            </span>
          )}
          {subtext && <span>{subtext}</span>}
        </div>
      )}
    </div>
  );
};
