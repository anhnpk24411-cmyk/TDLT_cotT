import React from 'react';
import {
  LayoutDashboard,
  Database,
  TrendingUp,
  Activity,
  Receipt,
  Radio,
  Lightbulb,
  FileCheck,
  Sliders,
  X,
  Zap,
} from 'lucide-react';

export type ScreenId =
  | 'overview'
  | 'data'
  | 'profit'
  | 'simulator'
  | 'tax'
  | 'radar'
  | 'adaptation'
  | 'evaluation'
  | 'assumptions';

interface SidebarProps {
  currentScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  isOpenMobile: boolean;
  onToggleMobile: () => void;
}

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.ReactNode;
  highlight?: boolean; // for simulator — the star feature
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onSelectScreen,
  isOpenMobile,
  onToggleMobile,
}) => {
  const navItems: NavItem[] = [
    { id: 'overview',    label: 'Tổng quan',          icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { id: 'data',        label: 'Dữ liệu',             icon: <Database className="w-[18px] h-[18px]" /> },
    { id: 'profit',      label: 'Lợi nhuận',           icon: <TrendingUp className="w-[18px] h-[18px]" /> },
    { id: 'simulator',   label: 'Mô phỏng phí',        icon: <Activity className="w-[18px] h-[18px]" />, highlight: true },
    { id: 'tax',         label: 'Ngưỡng thuế',         icon: <Receipt className="w-[18px] h-[18px]" /> },
    { id: 'radar',       label: 'Radar chính sách',    icon: <Radio className="w-[18px] h-[18px]" /> },
    { id: 'adaptation',  label: 'Gợi ý thích ứng',    icon: <Lightbulb className="w-[18px] h-[18px]" /> },
    { id: 'evaluation',  label: 'Đánh giá',            icon: <FileCheck className="w-[18px] h-[18px]" /> },
    { id: 'assumptions', label: 'Giả định & Phiên bản',icon: <Sliders className="w-[18px] h-[18px]" /> },
  ];

  const handleSelect = (id: ScreenId) => {
    onSelectScreen(id);
    if (isOpenMobile) onToggleMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(26,39,68,0.55)', backdropFilter: 'blur(2px)' }}
          onClick={onToggleMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-60 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#1a2744' }}
      >
        {/* Logo Area */}
        <div className="flex items-center justify-between px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b6fe8 0%, #60a5fa 100%)' }}
            >
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white leading-tight tracking-tight">Radar Lợi Nhuận</h1>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Người Bán E-commerce</p>
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden p-1 rounded-lg cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onClick={onToggleMobile}
            aria-label="Đóng menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${
                  item.highlight && !isActive
                    ? 'ring-1'
                    : ''
                }`}
                style={
                  isActive
                    ? {
                        background: 'linear-gradient(90deg, rgba(59,111,232,0.9) 0%, rgba(96,165,250,0.7) 100%)',
                        color: 'white',
                        boxShadow: '0 2px 8px rgba(59,111,232,0.4)',
                      }
                    : item.highlight
                    ? {
                        background: 'rgba(59,111,232,0.12)',
                        color: '#93c5fd',
                      }
                    : {
                        color: 'rgba(255,255,255,0.55)',
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    if (item.highlight) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,111,232,0.12)';
                      (e.currentTarget as HTMLButtonElement).style.color = '#93c5fd';
                    } else {
                      (e.currentTarget as HTMLButtonElement).style.background = '';
                      (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)';
                    }
                  }
                }}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="text-[13px]">{item.label}</span>
                {item.highlight && (
                  <span
                    className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md tracking-wider"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(59,111,232,0.3)',
                      color: isActive ? 'white' : '#93c5fd',
                    }}
                  >
                    MC
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              v1.0 · Local-first
            </span>
            <span
              className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold"
              style={{ background: 'rgba(59,111,232,0.25)', color: '#93c5fd' }}
            >
              IndexedDB
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
