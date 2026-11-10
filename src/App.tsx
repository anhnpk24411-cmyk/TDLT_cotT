import React, { useState, useEffect } from 'react';
import { Sidebar, ScreenId } from './components/layout/Sidebar.tsx';
import { PersistentFooter } from './components/layout/PersistentFooter.tsx';
import { OverviewView } from './views/OverviewView.tsx';
import { DataView } from './views/DataView.tsx';
import { ProfitView } from './views/ProfitView.tsx';
import { SimulatorView } from './views/SimulatorView.tsx';
import { TaxView } from './views/TaxView.tsx';
import { RadarView } from './views/RadarView.tsx';
import { AdaptationView } from './views/AdaptationView.tsx';
import { EvaluationView } from './views/EvaluationView.tsx';
import { AssumptionsView } from './views/AssumptionsView.tsx';
import { seedDemoData } from './db/seed_data.ts';
import { Menu } from 'lucide-react';

const PAGE_TITLES: Record<ScreenId, string> = {
  overview: 'Tổng quan',
  data: 'Dữ liệu',
  profit: 'Lợi nhuận',
  simulator: 'Mô phỏng phí',
  tax: 'Ngưỡng thuế',
  radar: 'Radar chính sách',
  adaptation: 'Gợi ý thích ứng',
  evaluation: 'Đánh giá',
  assumptions: 'Giả định & Phiên bản',
};

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    seedDemoData(false).catch(console.error);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: '#eef0fb' }}
    >
      {/* Sidebar */}
      <Sidebar
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        isOpenMobile={isMobileMenuOpen}
        onToggleMobile={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Main content — offset for sidebar */}
      <div className="lg:pl-60 flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header
          className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30"
          style={{
            background: '#1a2744',
            boxShadow: '0 2px 12px rgba(26,39,68,0.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-xl cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
              aria-label="Mở menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="font-bold text-sm text-white tracking-tight">
              Radar Lợi Nhuận Người Bán
            </span>
          </div>
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg font-mono"
            style={{ background: 'rgba(59,111,232,0.3)', color: '#93c5fd' }}
          >
            MVP-VN
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          <div role="note" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">
            <strong>Lưu ý nghiên cứu:</strong> Bộ dữ liệu khởi tạo và biểu phí mặc định là <strong>GIẢ LẬP</strong>, không phải dữ liệu khảo sát hay biểu phí pháp lý đã xác minh. Kết quả trên màn hình chỉ mang tính minh họa, trừ khi bạn đã nhập dữ liệu và phiên bản chính sách có nguồn kiểm chứng. Dữ liệu trình duyệt đã lưu từ trước không tự đổi khi cập nhật mã.
          </div>
          {/* Page heading */}
          <div className="mb-6">
            <h2
              className="text-xl font-bold tracking-tight"
              style={{ color: '#1a2744' }}
            >
              {PAGE_TITLES[currentScreen]}
            </h2>
            <div className="mt-1 h-0.5 w-8 rounded-full" style={{ background: '#3b6fe8' }} />
          </div>

          {currentScreen === 'overview'    && <OverviewView onNavigate={setCurrentScreen} />}
          {currentScreen === 'data'        && <DataView />}
          {currentScreen === 'profit'      && <ProfitView />}
          {currentScreen === 'simulator'   && <SimulatorView />}
          {currentScreen === 'tax'         && <TaxView />}
          {currentScreen === 'radar'       && <RadarView />}
          {currentScreen === 'adaptation'  && <AdaptationView onNavigateToSimulator={() => setCurrentScreen('simulator')} />}
          {currentScreen === 'evaluation'  && <EvaluationView />}
          {currentScreen === 'assumptions' && <AssumptionsView />}
        </main>

        <PersistentFooter />
      </div>
    </div>
  );
};
