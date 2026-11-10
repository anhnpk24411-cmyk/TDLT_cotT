# Đồng bộ thuyết minh v9 và mô phỏng nghiên cứu

Bảng B3.2 và B3.3 trong thuyết minh v9 được tạo bởi `research_reference/feeshock.py`, độc lập với engine TypeScript.

- Shopee tx: 4,91% (điều khoản 26/3/2026) → 6% (điều khoản 24/4/2026, hiệu lực 01/5/2026).
- Monte Carlo 5.000 lần, seed 2026; co giãn nền -1,5.
- Độ nhạy co giãn: -3 đến -8, lưới tăng giá 0–30%.
- 13/13 Python tests pass.
- Không chỉnh engine frontend trong đợt đồng bộ này; ứng dụng không tự nạp CSV nghiên cứu.
- Cần tạo bộ đối chứng deterministic chung (đơn hàng, phí giao dịch, hoàn, thuế), rồi mới so thống kê Monte Carlo giữa Python và TS.
- Số liệu là giả lập; cơ sở tính phí xử lý Shopee trong Python chưa tính đủ khuyến mãi và vận chuyển.
