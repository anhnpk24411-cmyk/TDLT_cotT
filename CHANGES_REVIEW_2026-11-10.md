# Rà soát tích hợp 10/11/2026

## Đã sửa
1. `src/App.tsx`: cảnh báo rõ dữ liệu giả lập trên giao diện, bao gồm việc IndexedDB không tự cập nhật dữ liệu cũ.
2. `src/db/seed_data.ts`: bỏ 3 URL nguồn giả (`synthetic_01`…), gắn rõ demo thuế 1 tỷ không phải luật năm 2024, và nhấn mạnh biểu phí demo không phải phí thực.
3. `src/views/AssumptionsView.tsx`: cảnh báo cách diễn giải chính sách giả lập.
4. `research_reference/`: lưu `feeshock.py`, `test_feeshock.py`, 5 CSV để tái lập nghiên cứu độc lập; có bảng khác biệt hai engine.
5. `README.md`: ghi rõ phương án tích hợp và giới hạn.

## Cần làm tiếp trước khi công bố nghiên cứu
- Pháp lý: đối chiếu quy định thuế từ nguồn chính thức, cập nhật engine web theo phiên bản thời gian (không lấy 2024 làm minh họa cho luật 2026).
- Hiệu chỉnh: bổ sung dữ liệu seller thật đã ẩn danh, nhật ký tăng phí có ngày và URL nguồn chính thức. Không sử dụng sự kiện `fe-01..03` để ước lượng lambda như thể là lịch sử thật.
- Hai engine chưa tương đương: Python chạy 5 seller năm, shocks theo sàn uniform; web chạy order-line, shocks chung triangular. Cần bộ kiểm thử chéo với cùng đầu vào và công thức nếu muốn dùng CSV làm golden data.
- Phần 2026 trong `feeshock.py` có các giả định cần kiểm chứng; không tự động cập nhật mức phí live.

## Kiểm tra
- `python test_feeshock.py`: 13/13 PASS.
- `tsc --noEmit`: PASS trên bản source này.
- `npm test`, `npm run build`: **CHƯA XÁC NHẬN**; ZIP ban đầu chứa node_modules macOS nên Rollup Linux không nạp được native binary. Tại máy của bạn, xóa `node_modules` rồi `npm ci`, `npm test`, `npm run build`.

## Cách đưa vào dự án Antigravity
Sao lưu bản đang dùng, chép `src/`, `research_reference/`, `README.md` và `CHANGES_REVIEW_2026-11-10.md` từ ZIP này vào thư mục dự án. Không chép `node_modules`. Chạy `npm ci`, `npm test`, `npm run build`, `npm run dev`. Dữ liệu IndexedDB là của trình duyệt cũ nên backup CSV trước khi chủ động reset demo.
