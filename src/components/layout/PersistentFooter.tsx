import React from 'react';
import { AlertCircle, Lock } from 'lucide-react';

export const PersistentFooter: React.FC = () => {
  return (
    <footer
      className="mt-8 py-3.5 px-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs"
      style={{
        borderTop: '1px solid rgba(59,111,232,0.1)',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
        <span className="font-semibold" style={{ color: '#374151' }}>
          Công cụ tham khảo, không thay thế tư vấn thuế.
        </span>
        <span className="hidden md:inline" style={{ color: '#d1d5db' }}>|</span>
        <span className="hidden md:inline" style={{ color: '#9ca3af' }}>
          Đối chiếu nghị định, thông tư Bộ Tài chính và biểu phí thực tế trên kênh bán.
        </span>
      </div>
      <div className="flex items-center gap-1.5 font-mono" style={{ color: '#9ca3af' }}>
        <Lock className="w-3 h-3" style={{ color: '#10b981' }} />
        <span>100% Browser · IndexedDB</span>
      </div>
    </footer>
  );
};
