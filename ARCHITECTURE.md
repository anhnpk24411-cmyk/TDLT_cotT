# ARCHITECTURE.md: Fee-Shock & Tax Threshold Simulator + Policy Radar
**Tên giao diện:** Radar Lợi Nhuận Người Bán  
**Mục tiêu:** Hệ thống hỗ trợ ra quyết định (Decision-Support MVP) cho nhà bán hàng thương mại điện tử nhỏ tại Việt Nam.

---

## 1. Tổng Quan Kiến Trúc Hệ Thống (System Overview)

Hệ thống được thiết kế theo mô hình **Local-First, Browser-Only Architecture**, bảo mật tối đa dữ liệu kinh doanh của người bán bằng cách thực thi 100% việc tính toán, lưu trữ và mô phỏng trực tiếp trên trình duyệt của người dùng. Không có backend tập trung:

```
+-------------------------------------------------------------------------------+
|                             CLIENT BROWSER (UI)                               |
|  [Overview] [Data] [Profit] [Simulator] [Tax Threshold] [Radar] [Suggestions] |
+---------------------------------------+---------------------------------------+
                                        |
               +------------------------+-----------------------+
               |                                                |
               v                                                v
    +----------------------+                        +----------------------+
    |    WEB WORKER POOL   |                        |   DEXIE / INDEXEDDB  |
    | (Monte Carlo Engine) |                        | (Products, Orders,   |
    |  - 10,000 runs       |                        |  FeeSchedules,       |
    |  - Poisson + Triang  |                        |  TaxPolicies, Runs)  |
    +----------+-----------+                        +----------+-----------+
               |                                                |
               +------------------------+-----------------------+
                                        |
                                        v
                    +---------------------------------------+
                    |        PURE CALCULATION ENGINE        |
                    |   (/src/engine - Zero UI Dependencies)|
                    | - Profit & Fee Resolution             |
                    | - Multi-channel Tax Liability         |
                    | - Resilience Metrics (VaR95, CVaR95)  |
                    | - Bisection Fee Tolerance Solver      |
                    | - Mulberry32 Seeded PRNG              |
                    +---------------------------------------+
```

---

## 2. Các Công Thức Cốt Lõi (Core Mathematical Formulas)

Mọi phép tính trong `/src/engine` là **pure functions**, độc lập hoàn toàn với React, DOM hay bất kỳ thư viện UI nào.

### 2.1. Lợi Nhuận Trước Thuế (Net Profit Before Tax)
Đối với từng dòng đơn hàng ($i$):
$$\text{net\_revenue}_i = \begin{cases} 0 & \text{nếu đơn bị hoàn trả (returned = true)} \\ \max(0, \text{gross\_revenue}_i - \text{discount}_i) & \text{ngược lại} \end{cases}$$

$$\text{COGS}_i = \begin{cases} 0 & \text{nếu đơn bị hoàn trả (hàng hoàn về kho)} \\ \text{unit\_cost}_i \times \text{quantity}_i & \text{ngược lại} \end{cases}$$

$$\text{platform\_fees}_i = \text{commission\_fee}_i + \text{payment\_fee}_i + \text{service\_fee}_i + \sum \text{program\_fees}_i$$

Trong đó, các tỷ lệ phí được phân giải động từ bản ghi `FeeSchedule` có hiệu lực tại ngày phát sinh đơn hàng:
$$\text{FeeSchedule}_{\text{active}} = \arg\max_{s} \{ s.\text{effective\_from} \mid s.\text{platform} = \text{channel}_i \land s.\text{effective\_from} \le \text{date}_i \}$$

Lợi nhuận gộp toàn shop trước thuế:
$$\text{NetProfitBeforeTax} = \sum_{i} \left( \text{net\_revenue}_i - \text{COGS}_i - \text{platform\_fees}_i - \text{shipping\_seller}_i - \text{ads}_i - \text{other}_i \right)$$

### 2.2. Doanh Thu Đa Kênh & Ngưỡng Thuế ($R$)
Theo quy định quản lý thuế hộ/cá nhân kinh doanh, doanh thu tính thuế $R$ **bắt buộc là tổng doanh thu trên toàn bộ các sàn và kênh bán**, không bao giờ tính riêng rẽ theo từng sàn:
$$R = \sum_{c \in \text{Channels}} \text{Revenue}_c$$

Quy tắc biên ngưỡng (mặc định $\le$):
$$\text{isAboveThreshold} = \begin{cases} R > \text{threshold} & \text{với quy tắc } \le \\ R \ge \text{threshold} & \text{với quy tắc } < \end{cases}$$

Nghĩa vụ thuế phát sinh (Tax Liability):
$$\text{TaxLiability} = \begin{cases} 0 & \text{nếu } \neg\text{isAboveThreshold} \\ \sum_{k} R_k \times (\text{vat\_rate}_k + \text{pit\_rate}_k) & \text{nếu } \text{isAboveThreshold} \end{cases}$$

### 2.3. Quyết Toán Bù Trừ Thuế Sàn (Tax Settlement & Withholding)
Số thuế sàn TMĐT đã khấu trừ tại nguồn:
$$W = \sum_{j} \text{withholding\_amount}_j$$

Số tiền quyết toán cuối năm:
$$\text{Settlement} = \text{TaxLiability} - W$$
- Nếu $\text{Settlement} > 0$: Người bán **phải nộp thêm**.
- Nếu $\text{Settlement} < 0$: Người bán **được hoàn thuế hoặc bù trừ sang kỳ tính thuế tiếp theo**.
- Tuyệt đối không tính trùng lặp số thuế sàn đã trích nộp tại nguồn.

### 2.4. Vách Đá Lợi Nhuận Sau Thuế (Tax Cliff)
Khi vượt ngưỡng, shop chịu thêm chi phí tuân thủ hóa đơn điện tử và chữ ký số ($\text{ComplianceCost}_{\text{above}}$):
$$\text{AfterTaxProfit} = \text{NetProfitBeforeTax} - \text{TaxLiability} - \begin{cases} \text{ComplianceCost}_{\text{above}} & \text{nếu } \text{isAboveThreshold} \\ 0 & \text{ngược lại} \end{cases}$$
Sự xuất hiện đột ngột của $\text{ComplianceCost}_{\text{above}}$ và nghĩa vụ thuế tạo ra bước sụt giảm thẳng đứng (**Cliff**) trên đường cong lợi nhuận.

---

## 3. Các Chỉ Số Sức Chống Chịu Tài Chính (Resilience Metrics)

Trong mô phỏng Monte Carlo ($N = 10.000$ lần lặp):

1. **Lợi Nhuận Kỳ Vọng ($E[\text{Profit}]$):**
   $$E[\text{Profit}] = \frac{1}{N} \sum_{k=1}^N \text{Profit}_k$$

2. **Xác Suất Thua Lỗ ($P(\text{loss})$):**
   $$P(\text{loss}) = \frac{1}{N} \sum_{k=1}^N \mathbb{I}(\text{Profit}_k < 0)$$

3. **Giá Trị Rủi Ro $\text{VaR}_{95}$ (Value at Risk - Phân vị thứ 5):**
   Ngưỡng lợi nhuận sao cho xác suất lợi nhuận rơi xuống dưới ngưỡng này không quá 5%:
   $$\text{VaR}_{95} = Q(0.05, \{ \text{Profit}_k \})$$

4. **Tổn Thất Dự Kiến $\text{CVaR}_{95}$ (Conditional VaR / Expected Shortfall):**
   Mức lợi nhuận trung bình trong 5% kịch bản tồi tệ nhất xảy ra:
   $$\text{CVaR}_{95} = E[\text{Profit}_k \mid \text{Profit}_k \le \text{VaR}_{95}]$$

5. **Tỷ Lệ Giữ Lợi Nhuận (Profit Retention Ratio):**
   $$\text{RetentionRatio} = \frac{E[\text{Profit}]}{\text{BaselineProfit}}$$
   Được xử lý an toàn với các cờ trạng thái (`VALID`, `BASELINE_ZERO_OR_NEGATIVE`, `BOTH_NEGATIVE`).

6. **Biên Chịu Phí Tối Đa (Fee Tolerance via Bisection):**
   Mức tăng phí hoa hồng tối đa $\Delta \in [0, 1.0]$ sao cho lợi nhuận kỳ vọng của shop vừa chạm mức 0 (hòa vốn). Thuật toán chia đôi (Bisection) giải phương trình:
   $$f(\Delta) = \text{EvaluateProfit}(\Delta) = 0$$
   Với các trạng thái đầu ra rõ ràng:
   - `SOLVED`: Tìm thấy nghiệm $\Delta$ trong khoảng sai số $10^{-4}$ hoặc $\le 100$ đ.
   - `ALREADY_NEGATIVE`: Lợi nhuận gốc đã âm; không thể chịu thêm bất kỳ mức tăng phí nào.
   - `NO_LIMIT_FOUND`: Ngay cả khi tăng $+100$ pp phí sàn, shop vẫn có lãi.

---

## 4. Kiến Trúc Radar Chính Sách (Policy Radar Pipeline)

Quy trình bán tự động, con người ở vị trí trung tâm phê duyệt (Human-in-the-loop):

1. **Ingest (Tiếp nhận):** Dán văn bản thông báo hoặc nạp file text (.txt/.md).
2. **Extractor Adapters:**
   - `RuleExtractor`: Dùng biểu thức chính quy tiếng Việt (Regex), xử lý 100% offline, không cần API Key hay mạng.
   - `LlmExtractor`: Gọi trực tiếp LLM (Gemini, Claude, GPT) từ trình duyệt bằng API key của người dùng với Temperature = 0 và schema JSON nghiêm ngặt.
   - `MockExtractor`: Dành cho kiểm thử và demo.
3. **Deterministic Verifier (Thẩm định tất định):**
   - Coi nội dung văn bản là dữ liệu thô không an toàn (Prompt-injection safe).
   - Kiểm tra `source_span.text` nguyên văn trong văn bản gốc.
   - Kiểm tra giá trị số và ngày tháng xuất hiện trong đoạn trích.
   - Kiểm tra đối soát giá trị cũ `old_value` với phiên bản sàn hiện hành. Nếu lệch, đánh dấu `needs_attention: true`.
4. **Split-Review UI:** Cửa sổ kép (văn bản tô sáng đoạn trích bên trái, bảng bản ghi bên phải). Cho phép Approve, Edit, Reject, Undo.
5. **Data-Driven Versioning:**
   - Khi Approve: Tạo một bản ghi mới `FeeSchedule` hoặc `TaxPolicyVersion` với `origin = "radar"` và liên kết `radar_record_id`.
   - **Tuyệt đối không ghi đè dữ liệu cũ**. Lịch sử biểu phí được bảo toàn nguyên vẹn.
6. **Financial Impact Calculation:** Tính ngay lập tức tác động lên doanh thu và lợi nhuận 12 tháng qua.

---

## 5. Các Quyết Định Kiến Trúc (Architecture Decision Records - ADRs)

### ADR-01: Kiến Trúc Browser-Only (Không Backend)
- **Bối cảnh:** Dữ liệu doanh thu, giá vốn và tỷ suất lợi nhuận của người bán là thông tin kinh doanh cực kỳ nhạy cảm.
- **Quyết định:** Chạy 100% logic trên trình duyệt, lưu vào IndexedDB qua thư viện Dexie.
- **Hệ quả:** Người bán không lo lộ dữ liệu lên server bên thứ ba; ứng dụng hoạt động offline mượt mà.

### ADR-02: Bring-Your-Own (BYO) API Key cho LlmExtractor
- **Bối cảnh:** Cần khả năng trích xuất thông minh của LLM nhưng không muốn duy trì backend proxy tốn kém và quản lý key tập trung.
- **Quyết định:** Người dùng tự nhập API Key (Gemini, OpenAI, Anthropic), lưu trong IndexedDB của trình duyệt.
- **Hệ quả:** Đi kèm cảnh báo rõ ràng về bảo mật client-side; khuyến nghị dùng key giới hạn hạn mức.

### ADR-03: Chính Sách Bất Biến (Immutable Versioning)
- **Bối cảnh:** Luật thuế và biểu phí sàn thay đổi liên tục theo thời gian; các đơn hàng cũ phải được tính theo biểu phí đúng ngày đặt đơn.
- **Quyết định:** Không bao giờ ghi đè (`UPDATE`) bản ghi phí; mỗi thay đổi tạo một phiên bản mới với `effective_from`.
- **Hệ quả:** Cho phép tính đúng tỷ lệ phí ngay cả khi sàn thay đổi biểu phí giữa năm tài chính.

### ADR-04: Tách Biệt Tuyệt Đối Engine Tính Toán Khỏi UI
- **Bối cảnh:** Dễ dàng kiểm thử tự động, tái sử dụng và kiểm định toán học.
- **Quyết định:** Thư mục `/src/engine` chỉ chứa TypeScript thuần và Zod schemas, cấm import React, CSS hay DOM.
- **Hệ quả:** Đạt 100% test coverage trên các công thức cốt lõi. Có thể port sang backend Node.js hoặc Python trong tương lai mà không phải sửa một dòng công thức nào.

### ADR-05: Chạy Mô Phỏng Monte Carlo Trên Web Worker
- **Bối cảnh:** Chạy 10.000 kịch bản ngẫu nhiên có thể chiếm dụng CPU từ 500ms đến 2000ms, gây giật lag hoặc treo giao diện người dùng.
- **Quyết định:** Đưa toàn bộ vòng lặp mô phỏng vào Web Worker (`simulator.worker.ts`), gửi báo cáo tiến độ % theo thời gian thực và hỗ trợ dừng/hủy (`CANCEL`).
- **Hệ quả:** Giao diện người dùng luôn mượt mà ở mức 60 FPS.

---

## 6. Các Giới Hạn Cần Lưu Ý (Limitations)

1. **Lưu trữ cục bộ trình duyệt (Browser Storage):** Dữ liệu được lưu trong IndexedDB của trình duyệt hiện tại. Nếu người dùng xóa cache/dữ liệu duyệt web hoặc đổi thiết bị, dữ liệu sẽ không tự động đồng bộ (cần xuất/nhập CSV để sao lưu).
2. **Bảo mật khóa API:** Khóa API của LLM nằm trong bộ nhớ trình duyệt client. Người dùng không nên dùng khóa API sản xuất có hạn mức tín dụng lớn.
3. **Độ chính xác của bộ trích xuất:** Khả năng trích xuất phụ thuộc vào chất lượng văn bản thông báo và mô hình AI được sử dụng. Con người luôn là mắt xích thẩm định và quyết định cuối cùng.
4. **Gợi ý thích ứng là Heuristic:** Các kịch bản thích ứng được sinh bằng tìm kiếm lưới thực nghiệm (Grid Search), không tính đến các yếu tố vĩ mô phức tạp như hành vi đối thủ cạnh tranh hoặc độ co giãn chéo của cầu.
5. **Tuyên bố miễn trừ trách nhiệm pháp lý:** Ứng dụng là công cụ tham khảo hỗ trợ ra quyết định kinh doanh, **không thay thế cho tư vấn pháp lý, kế toán hay đại lý thuế chuyên nghiệp**. Luôn kiểm chứng với các nghị định và thông tư hiện hành.

