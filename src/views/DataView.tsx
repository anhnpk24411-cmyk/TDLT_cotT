import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database.ts';
import { seedDemoData, clearAllData } from '../db/seed_data.ts';
import { ProductSchema } from '../engine/types.ts';
import { formatVND } from '../utils/formatters.ts';
import {
  parseRawCsv,
  guessColumnMapping,
  parseAndValidateOrders,
  generateCsvTemplate,
  ColumnMapping,
  CsvParseResult,
} from '../utils/csv_parser.ts';
import { AssumptionsPanel } from '../components/common/AssumptionsPanel.tsx';
import {
  Upload,
  Download,
  Trash2,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle,
  Sparkles,
} from 'lucide-react';

export const DataView: React.FC = () => {
  const products = useLiveQuery(() => db.products.toArray()) ?? [];
  const ordersCount = useLiveQuery(() => db.orders.count()) ?? 0;
  const feeSchedules = useLiveQuery(() => db.fee_schedules.toArray()) ?? [];
  const taxPolicy = useLiveQuery(() => db.tax_policies.filter((p) => p.is_active).first());

  // Manual product form state
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [cogs, setCogs] = useState('');
  const [price, setPrice] = useState('');
  const [productError, setProductError] = useState<string | null>(null);

  // CSV Import state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    channel: '',
    sku: '',
    quantity: '',
    gross_revenue: '',
    discount: '',
    returned: '',
    shipping_cost_seller: '',
    ads_cost_allocated: '',
    other_cost: '',
  });
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Loading synthetic demo data
  const handleLoadSynthetic = async () => {
    if (
      window.confirm(
        'Tải dữ liệu mẫu SYNTHETIC? Các thông số biểu phí và lịch sử là giả lập tham khảo, bạn cần đối chiếu lại với hợp đồng thực tế.'
      )
    ) {
      await seedDemoData(true);
      setImportStatus('Đã nạp thành công 120 đơn hàng mẫu SYNTHETIC và danh mục sản phẩm!');
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('CẢNH BÁO: Xoá toàn bộ dữ liệu trên trình duyệt của bạn?')) {
      await clearAllData();
      setImportStatus('Đã xoá sạch dữ liệu cục bộ.');
    }
  };

  // Handle manual product submission
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductError(null);

    const cogsNum = parseFloat(cogs);
    const priceNum = parseFloat(price);

    const newProd = {
      sku: sku.trim(),
      name: name.trim(),
      category: category.trim(),
      cost_of_goods: isNaN(cogsNum) ? 0 : cogsNum,
      price: isNaN(priceNum) ? 0 : priceNum,
    };

    const parsed = ProductSchema.safeParse(newProd);
    if (!parsed.success) {
      setProductError(parsed.error.issues[0].message);
      return;
    }

    try {
      await db.products.put(parsed.data);
      setSku('');
      setName('');
      setCategory('');
      setCogs('');
      setPrice('');
      setImportStatus(`Đã thêm sản phẩm: ${parsed.data.name} (${parsed.data.sku})`);
    } catch (err: any) {
      setProductError(err.message || 'Lỗi khi lưu sản phẩm vào IndexedDB.');
    }
  };

  // Handle CSV file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseRawCsv(text);
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);

      const guessed = guessColumnMapping(parsed.headers);
      setMapping(guessed);

      // Instant preview evaluation
      const validation = parseAndValidateOrders(parsed.headers, parsed.rows, guessed);
      setParseResult(validation);
    };
    reader.readAsText(file);
  };

  // Handle Mapping change
  const handleMappingChange = (field: keyof ColumnMapping, val: string) => {
    const newMapping = { ...mapping, [field]: val };
    setMapping(newMapping);
    if (csvHeaders.length > 0 && csvRows.length > 0) {
      const validation = parseAndValidateOrders(csvHeaders, csvRows, newMapping);
      setParseResult(validation);
    }
  };

  // Commit valid CSV orders to DB
  const handleCommitImport = async () => {
    if (!parseResult || parseResult.validOrders.length === 0) return;

    try {
      await db.orders.bulkAdd(parseResult.validOrders);
      setImportStatus(
        `Nhập thành công ${parseResult.validOrders.length} đơn hàng vào cơ sở dữ liệu IndexedDB!`
      );
      setParseResult(null);
    } catch (err: any) {
      alert(`Lỗi khi nhập dữ liệu: ${err.message}`);
    }
  };

  // Download template
  const handleDownloadTemplate = () => {
    const csvContent = generateCsvTemplate();
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mau_nhap_don_hang.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Quản Lý Dữ Liệu & Nhập Đơn Hàng (Data Ingestion)
          </h2>
          <p className="text-xs text-slate-500">
            Dữ liệu được lưu trữ an toàn trong IndexedDB của trình duyệt. Không gửi dữ liệu lên server.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSynthetic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Nạp Dữ liệu Mẫu (SYNTHETIC)
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xoá Sạch
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{importStatus}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportStatus(null)}
            className="text-emerald-700 font-bold hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* CSV Import Section */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
              Nhập Đơn Hàng từ File CSV
            </h3>
            <p className="text-xs text-slate-500">
              Hỗ trợ file xuất từ Shopee, TikTok Shop, Lazada hoặc file tổng hợp kế toán của bạn.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Tải File Mẫu (.csv)
          </button>
        </div>

        {/* Upload Box */}
        <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/20">
          <Upload className="w-8 h-8 text-blue-600 mb-2" />
          <span className="text-xs font-semibold text-slate-800">
            Kéo thả hoặc nhấp để chọn file CSV đơn hàng
          </span>
          <span className="text-[11px] text-slate-400 mt-1">
            Hỗ trợ phân cách dấu phẩy (,) hoặc chấm phẩy (;)
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Column Mapping & Error Preview */}
        {parseResult && (
          <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Khớp Cột Dữ Liệu (Column Mapping)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              {(
                [
                  ['date', 'Ngày đơn hàng'],
                  ['channel', 'Kênh bán sàn'],
                  ['sku', 'Mã SKU (*)'],
                  ['quantity', 'Số lượng'],
                  ['gross_revenue', 'Doanh thu gốc (*)'],
                  ['discount', 'Giảm giá/Voucher'],
                  ['returned', 'Hàng hoàn'],
                  ['shipping_cost_seller', 'Phí ship chịu'],
                  ['ads_cost_allocated', 'Chi phí Ads'],
                  ['other_cost', 'Chi phí khác'],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {label}
                  </label>
                  <select
                    value={mapping[field]}
                    onChange={(e) => handleMappingChange(field, e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800"
                  >
                    <option value="">-- Bỏ qua --</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Validation Feedback */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-emerald-700 font-bold font-mono-num">
                  ✓ {parseResult.validOrders.length} dòng hợp lệ
                </span>
                {parseResult.errors.length > 0 && (
                  <span className="text-red-600 font-bold font-mono-num">
                    ⚠ {parseResult.errors.length} dòng lỗi
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={parseResult.validOrders.length === 0}
                className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Lưu {parseResult.validOrders.length} đơn hàng vào DB
              </button>
            </div>

            {/* Error table if any */}
            {parseResult.errors.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1 max-h-40 overflow-y-auto">
                <span className="font-bold text-red-800 block">Danh sách lỗi phát hiện:</span>
                {parseResult.errors.map((err, i) => (
                  <div key={i} className="text-red-700">
                    Dòng {err.rowIndex}: Trường <code className="font-mono">{err.field}</code> -{' '}
                    {err.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Product Form & Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-blue-700" />
            Thêm Sản Phẩm Mới
          </h3>
          <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
            {productError && (
              <div className="p-2.5 rounded bg-red-50 text-red-700 border border-red-200">
                {productError}
              </div>
            )}
            <div>
              <label className="block text-slate-600 font-medium mb-1">Mã SKU (*)</label>
              <input
                type="text"
                placeholder="VD: AO-THUN-01"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Tên sản phẩm (*)</label>
              <input
                type="text"
                placeholder="VD: Áo Thun Nam Cotton"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Danh mục ngành hàng (*)</label>
              <input
                type="text"
                placeholder="VD: Thời trang nam"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Giá vốn COGS (₫)</label>
                <input
                  type="number"
                  placeholder="85000"
                  value={cogs}
                  onChange={(e) => setCogs(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 font-mono-num"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Giá niêm yết (₫)</label>
                <input
                  type="number"
                  placeholder="200000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 font-mono-num"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full mt-2 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold cursor-pointer shadow-xs transition-colors"
            >
              Lưu Sản Phẩm
            </button>
          </form>
        </div>

        {/* Product Catalog List */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Danh Mục Sản Phẩm ({products.length})
            </h3>
            <span className="text-xs text-slate-500 font-mono-num">
              Tổng số đơn hàng hiện có: {ordersCount}
            </span>
          </div>
          {products.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-8">
              Chưa có sản phẩm nào. Nhấp "Nạp Dữ liệu Mẫu (SYNTHETIC)" ở góc trên để nạp dữ liệu minh họa.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Tên sản phẩm</th>
                    <th className="p-2">Danh mục</th>
                    <th className="p-2 text-right">Giá vốn (COGS)</th>
                    <th className="p-2 text-right">Giá bán</th>
                    <th className="p-2 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-num">
                  {products.map((p) => (
                    <tr key={p.sku} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-900">{p.sku}</td>
                      <td className="p-2 font-sans text-slate-800">{p.name}</td>
                      <td className="p-2 font-sans text-slate-600">{p.category}</td>
                      <td className="p-2 text-right text-slate-600">{formatVND(p.cost_of_goods)}</td>
                      <td className="p-2 text-right text-slate-900 font-bold">
                        {formatVND(p.price)}
                      </td>
                      <td className="p-2 text-center font-sans">
                        <button
                          type="button"
                          onClick={() => db.products.delete(p.sku)}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Persistent Assumptions Panel on result page */}
      <AssumptionsPanel feeSchedules={feeSchedules} taxPolicy={taxPolicy} />
    </div>
  );
};
