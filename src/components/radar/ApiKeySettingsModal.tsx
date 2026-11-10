import React, { useState, useEffect } from 'react';
import { db } from '../../db/database.ts';
import { LlmConfig, LlmProvider } from '../../radar/types.ts';
import { Key, ShieldAlert, Check, X } from 'lucide-react';

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (config: LlmConfig) => void;
}

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [provider, setProvider] = useState<LlmProvider>('gemini');
  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<string>('gemini-1.5-flash');
  const [baseUrl, setBaseUrl] = useState<string>('');

  useEffect(() => {
    db.settings.get('llm_config').then((setting) => {
      if (setting && setting.value) {
        const val: LlmConfig = setting.value;
        setProvider(val.provider || 'gemini');
        setApiKey(val.apiKey || '');
        setModel(val.model || '');
        setBaseUrl(val.baseUrl || '');
      }
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const config: LlmConfig = {
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
    };

    await db.settings.put({
      key: 'llm_config',
      value: config,
    });

    onSaved(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base">Cấu Hình API Key Cho LlmExtractor</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Warning */}
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Cảnh báo bảo mật khóa API (Client-side):</p>
            <p>
              Khóa API được lưu cục bộ trong bộ nhớ trình duyệt (IndexedDB) của bạn và gọi trực tiếp từ client. Không bao giờ dùng khóa có hạn mức quá cao hoặc dùng chung trên máy tính công cộng.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mô hình AI / Nhà cung cấp</label>
            <select
              value={provider}
              onChange={(e) => {
                const p = e.target.value as LlmProvider;
                setProvider(p);
                if (p === 'gemini') setModel('gemini-1.5-flash');
                else if (p === 'openai') setModel('gpt-4o-mini');
                else if (p === 'anthropic') setModel('claude-3-5-haiku-latest');
              }}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5"
            >
              <option value="gemini">Google Gemini (Khuyên dùng: gemini-1.5-flash)</option>
              <option value="openai">OpenAI (gpt-4o-mini / gpt-4o)</option>
              <option value="anthropic">Anthropic (Claude 3.5 Haiku)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Nhập khóa API (AIzaSy... / sk-...)"
              required
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tên Model (Tùy chọn)</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Mặc định theo nhà cung cấp"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Base URL Tùy Chỉnh (Tùy chọn)</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="Để trống nếu dùng URL chính thức"
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-xs cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Lưu cấu hình
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

