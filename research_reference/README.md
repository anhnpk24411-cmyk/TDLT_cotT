# FeeShock — phiên bản mô phỏng tham chiếu Shopee 2026

- Sao chép `feeshock.py` và `test_feeshock.py` từ mã nghiên cứu đã cung cấp.
- Thay đúng một tham số phí xử lý giao dịch Shopee: `tx_pre=4.91`, `tx_post=6.0`; không điều chỉnh tỷ lệ hoa hồng hoặc các giả định người bán khác.
- Điều khoản Shopee phiên bản ngày 26/3/2026, Điều 16.3: 4,91%: https://help.shopee.vn/portal/4/article/77474-
- Điều khoản Shopee phiên bản ngày 24/4/2026, hiệu lực 01/5/2026, Điều 16.3: 6%: https://help.shopee.vn/portal/4/article/206856-
- Điều khoản tính trên cơ sở tiền hàng có điều chỉnh khuyến mãi và phí vận chuyển người mua trả. Engine Python chưa có đầy đủ trường dữ liệu và chỉ lấy doanh thu giao làm đại diện cho cơ sở tính phí. Do đó đây là mô phỏng thay tỷ lệ phí, **không phải phí thực tế đã đối soát**.
- Thay lưới kiểm tra độ co giãn từ tập gốc bằng dải `(-3,-4,-5,-6,-7,-8)`; 5.000 lượt mô phỏng tại seed 2026 với độ co giãn cơ sở vẫn là -1,5, nên P(lỗ) trong B3.2 không phải P(lỗ) khi thay đổi độ co giãn.
- Chạy tại thư mục này: `python test_feeshock.py` và `python feeshock.py` (cần numpy, pandas). Đã thực thi: 13/13 test pass.
- Mã Python và CSV là **benchmark độc lập**. Không import thẳng vào frontend React/TypeScript. Không mặc định các kết quả thống kê khớp với website đang có engine Monte Carlo riêng.
- Vẫn là dữ liệu giả lập: hồ sơ người bán, lambda Poisson, biên độ cú sốc, độ co giãn, phần lớn biểu phí chưa được hiệu chỉnh đầy đủ. Tránh suy rộng ra người bán Việt Nam.
