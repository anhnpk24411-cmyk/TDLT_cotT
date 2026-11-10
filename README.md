# Radar Lợi Nhuận Người Bán (Seller Profit Radar)
> **Fee-Shock & Tax Threshold Simulator + Policy Radar for Vietnamese E-Commerce Sellers**

Hệ thống hỗ trợ ra quyết định tài chính (Decision-Support MVP) dành cho nhà bán hàng nhỏ trên các sàn thương mại điện tử (Shopee, TikTok Shop, Lazada) tại Việt Nam.

---

## 🚀 Tính Năng Chính (Core Features)

1. **Minh Bạch Lợi Nhuận Thực Tế (Profit View):**
   - Bóc tách toàn bộ các tầng chi phí dễ bị lãng quên: Phí thanh toán, phí cố định, phí dịch vụ (Freeship/Voucher Xtra), chi phí quảng cáo Ads, phí vận chuyển người bán chịu và chi phí hàng hoàn.
   - Biểu đồ thác nước (Waterfall Chart) trực quan từ Doanh thu gốc $\rightarrow$ Doanh thu thuần $\rightarrow$ Giá vốn hàng bán (COGS) $\rightarrow$ Phí sàn $\rightarrow$ Lợi nhuận trước thuế.

2. **Mô Phỏng Sốc Phí Sàn Monte Carlo (Fee-Shock Simulator):**
   - Chạy 10.000 kịch bản ngẫu nhiên tách biệt trên **Web Worker** không gây đơ giao diện.
   - Mô hình toán học: Tần suất tăng phí $\sim \text{Poisson}(\lambda)$, biên độ sốc $\sim \text{Triangular}(\min, \text{mode}, \max)$, bất định chi phí Ads và tỷ lệ hoàn hàng.
   - Hạt giống PRNG `mulberry32` đảm bảo **kết quả tái lập 100%** (cùng seed + inputs $\rightarrow$ cùng kết quả).
   - Đo lường chỉ số rủi ro đuôi: $E[\text{Profit}]$, $P(\text{loss})$, $\text{VaR}_{95}$ (5th percentile), $\text{CVaR}_{95}$ (Expected Shortfall), Tỷ lệ giữ lợi nhuận ($\text{Retention Ratio}$) và **Biên chịu phí tối đa ($\text{Fee Tolerance}$)** qua thuật toán chia đôi Bisection.
   - **Bảng Hiệu Chuẩn Lịch Sử (Calibration Panel):** Ước lượng $\lambda$ và phân phối từ lịch sử sự kiện tăng phí thực tế (`FeeEvent`) của người bán; không bao giờ bịa đặt lịch sử.

3. **Mô Đun Ngưỡng Thuế & Biểu Đồ Vách Đá (Tax Cliff Simulator):**
   - Quy tắc pháp lý: Doanh thu tính thuế $R$ bắt buộc là **tổng doanh thu hợp nhất trên toàn bộ các kênh bán** của cá nhân kinh doanh trong năm tài chính.
   - **Biểu đồ Vách Đá (Tax Cliff Curve):** Trực quan hóa bước sụt giảm đột ngột của lợi nhuận sau thuế khi chạm ngưỡng 1 tỷ VND do chi phí tuân thủ hóa đơn điện tử + thuế khoán.
   - Đánh dấu tọa độ shop hiện tại (ReferenceDot) trên đường cong sau thuế.
   - **Quyết toán bù trừ thuế:** Phân định rõ thuế phát sinh vs. Thuế đã khấu trừ tại nguồn theo sàn; xử lý trường hợp hoàn thuế/bù trừ khi số khấu trừ lớn hơn nghĩa vụ.

4. **Radar Chính Sách Bán Hàng (Policy Radar):**
   - **Quy trình bán tự động (Human-in-the-loop):** Tiếp nhận thông báo $\rightarrow$ Trích xuất $\rightarrow$ Thẩm định tất định $\rightarrow$ Người bán duyệt $\rightarrow$ Tạo phiên bản mới $\rightarrow$ Xem ngay tác động tài chính.
   - **3 Bộ trích xuất (Extractors):**
     - `RuleExtractor`: Xử lý 100% offline bằng Regex tiếng Việt không cần mạng hay API key.
     - `LlmExtractor`: Tích hợp Google Gemini, Anthropic Claude, OpenAI với API Key do người dùng tự cung cấp (BYO Key) lưu an toàn tại máy client.
     - `MockExtractor`: Dành cho kiểm thử và demo ngoại tuyến.
   - **Deterministic Verifier:** Đảm bảo mọi giá trị số trích xuất đều có trích dẫn nguyên văn trong văn bản gốc; kiểm tra ngày tháng hợp lệ; đối soát giá trị cũ với biểu phí sàn hiện hành.
   - **Split-Review UI:** Cửa sổ kép (văn bản tô sáng đoạn trích bên trái, bảng duyệt bản ghi bên phải). Duyệt tạo phiên bản mới (`origin="radar"`), **không bao giờ ghi đè phiên bản cũ**.

5. **Gợi Ý Thích Ứng (Adaptation Suggestions):**
   - Khám phá không gian giải pháp heuristic: Tối ưu giá bán, tiết giảm chi phí quảng cáo Ads, điều chuyển cơ cấu giữa các kênh bán để khôi phục lợi nhuận dưới ràng buộc an toàn $P(\text{loss})$.

6. **Bộ Công Cụ Đánh Giá Nghiên Cứu (Research Evaluation):**
   - **Nhật ký kịch bản (Scenario Run Logs):** Lưu vết toàn bộ lần chạy mô phỏng, xuất file CSV ẩn danh phục vụ nghiên cứu thực nghiệm.
   - **Khảo sát SUS chuẩn (System Usability Scale):** Bảng hỏi 10 câu chuẩn quốc tế, tự động tính điểm (0-100), phân hạng A/B/C/D/F và bách phân vị.
   - **Radar Benchmark Suite:** Thử nghiệm đối soát độ chính xác của các Extractor trên tập dữ liệu chuẩn vàng (Gold Standard), đo lường Precision, Recall, F1-Score theo từng trường, tỷ lệ cần sửa thủ công và độ trễ xử lý; xuất báo cáo CSV.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

- **Giao diện:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts.
- **Dữ liệu & Xác thực Schema:** Zod v4, Dexie (IndexedDB) + dexie-react-hooks.
- **Mô phỏng đa luồng:** HTML5 Web Worker (`simulator.worker.ts`).
- **Kiểm thử tự động:** Vitest (12 test suites, 52/52 unit tests passed).
- **Kiến trúc:** Local-First, Browser-Only, Không Backend, Không theo dõi dữ liệu người dùng.

---

## 💻 Cài Đặt & Chạy Ứng Dụng (Setup & Run)

### 1. Yêu Cầu Môi Trường
- Node.js >= 18.0.0
- Trình duyệt hiện đại hỗ trợ Web Workers và IndexedDB (Chrome, Firefox, Safari, Edge).

### 2. Cài Đặt Phụ Thuộc
```bash
npm install
```

### 3. Chạy Kiểm Thử Đầy Đủ (Unit Tests)
```bash
npm test
```

### 4. Khởi Động Môi Trường Phát Triển (Development Server)
```bash
npm run dev
```
Mở trình duyệt tại địa chỉ hiển thị trên terminal (thường là `http://localhost:5173`).

### 5. Đóng Gói Ứng Dụng (Production Build)
```bash
npm run build
```
Bản build tĩnh tối ưu sẽ được tạo trong thư mục `dist/`, sẵn sàng triển khai trên bất kỳ dịch vụ hosting tĩnh nào (Vercel, Netlify, Cloudflare Pages, GitHub Pages).

---

## ⚠️ Giới Hạn Cần Lưu Ý (Limitations)

- **Lưu trữ cục bộ:** Dữ liệu được lưu trong IndexedDB của trình duyệt máy người dùng. Hãy sử dụng tính năng xuất file CSV để sao lưu định kỳ.
- **Bảo mật khóa API:** Khóa API của LLM được lưu trong bộ nhớ trình duyệt client. Khuyến nghị chỉ sử dụng các khóa API có giới hạn hạn mức chi tiêu.
- **Gợi ý mang tính tham khảo:** Các phương án thích ứng được sinh bằng thuật toán Heuristic, người bán cần kết hợp kiến thức ngành hàng và sức mua thực tế của khách hàng.
- **Tuyên bố pháp lý:** *"Công cụ tham khảo, không thay thế tư vấn thuế."* Luôn đối chiếu với các quy định pháp luật và thông tư hiện hành của cơ quan thuế nhà nước.


## Đối chứng nghiên cứu và lưu ý dữ liệu (bổ sung)

Các file Python và CSV của thuyết minh được giữ trong thư mục `research_reference/` **để kiểm tra và tái lập riêng**, không tham gia tính toán trực tiếp của website. Xem `research_reference/README.md` để biết khác biệt mô hình. Dữ liệu demo trong `src/db/seed_data.ts` là **giả lập**; không dùng làm bằng chứng thực nghiệm hoặc kết luận pháp lý. Khi đã có dữ liệu cũ trong IndexedDB, cập nhật source code sẽ không tự sửa dữ liệu đã lưu; chỉ reset demo nếu muốn xóa dữ liệu hiện tại (nhớ sao lưu trước).
# TDLT_cotT
