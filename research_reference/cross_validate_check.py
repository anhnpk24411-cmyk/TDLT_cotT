"""
Script đối chiếu công thức lợi nhuận và thuế giữa Python và TypeScript.
Chạy trên 5 test case xác định chuẩn (deterministic).
Output: research_reference/cross_validate_cases.json — làm golden fixtures cho unit tests.
"""
import json, os

def generate_golden_cases():
    cases = []

    # CASE 1: Đơn hàng thời trang TikTok Shop (không hoàn trả)
    # Gross: 250.000, Qty: 1, Discount: 0
    # COGS: 130.000, Ads: 22.500, Other: 3.000, Ship: 0
    # Phí sàn TikTok 5/2026: comm=14%, tx=6%, svc=0%, fixed=3.000đ
    gross_1 = 250_000
    qty_1 = 1
    comm_1 = gross_1 * 0.14        # 35.000
    tx_1 = gross_1 * 0.06          # 15.000
    svc_1 = 0
    fixed_1 = 3_000
    total_fee_1 = comm_1 + tx_1 + svc_1 + fixed_1  # 53.000
    cogs_1 = 130_000
    ads_1 = 22_500
    other_1 = 3_000
    ship_1 = 0
    net_profit_1 = gross_1 - cogs_1 - total_fee_1 - ads_1 - ship_1 - other_1  # 41.500

    cases.append({
        "case_id": "CASE1_tiktok_fashion_delivered",
        "description": "Đơn hàng thời trang TikTok Shop giao thành công, áp dụng biểu phí 05/2026",
        "inputs": {
            "channel": "TikTok Shop",
            "gross_revenue": gross_1,
            "quantity": qty_1,
            "cost_of_goods": cogs_1,
            "commission_rate": 0.14,
            "payment_rate": 0.06,
            "service_rate": 0.0,
            "fixed_fee_per_order": fixed_1,
            "ads_cost_allocated": ads_1,
            "shipping_cost_seller": ship_1,
            "other_cost": other_1,
            "returned": False
        },
        "expected": {
            "net_revenue": gross_1,
            "cogs": cogs_1,
            "commission_fee": comm_1,
            "payment_fee": tx_1,
            "fixed_fee": fixed_1,
            "total_platform_fees": total_fee_1,
            "net_profit_before_tax": net_profit_1,
            "profit_margin": net_profit_1 / gross_1
        }
    })

    # CASE 2: Đơn hàng bị hoàn trả (Returned = True)
    # Gross: 180.000, Qty: 1, COGS: 80.000, Phí ship hoàn: 20.000, Đóng gói: 3.000
    # Nguyên tắc: net_revenue = 0, cogs = 0 (hàng về kho), phí sàn = 0
    gross_2 = 180_000
    ship_2 = 20_000
    other_2 = 3_000
    net_profit_2 = 0 - 0 - 0 - 0 - ship_2 - other_2  # -23.000

    cases.append({
        "case_id": "CASE2_returned_order",
        "description": "Đơn hàng bị hoàn trả: doanh thu thực = 0, giá vốn = 0, phí sàn = 0, chỉ chịu phí ship và đóng gói",
        "inputs": {
            "channel": "Shopee",
            "gross_revenue": gross_2,
            "quantity": 1,
            "cost_of_goods": 80_000,
            "shipping_cost_seller": ship_2,
            "other_cost": other_2,
            "returned": True
        },
        "expected": {
            "net_revenue": 0,
            "cogs": 0,
            "total_platform_fees": 0,
            "net_profit_before_tax": net_profit_2
        }
    })

    # CASE 3: Nghĩa vụ thuế vượt ngưỡng 1 tỷ (1,2 tỷ đồng)
    # R = 1.200.000.000. Ngưỡng = 1.000.000.000 (Quy tắc <=).
    # VAT = 1% x 1,2 tỷ = 12 triệu. TNCN = 0,5% x 1,2 tỷ = 6 triệu. Tổng thuế = 18 triệu.
    # Khấu trừ tạm thu của sàn (1,5%): 18 triệu. Số thuế quyết toán = 18tr - 18tr = 0.
    # Chi phí tuân thủ hóa đơn điện tử: 12 triệu. LN trước thuế: 180 triệu. LN sau thuế: 180 - 18 - 12 = 150 triệu.
    rev_3 = 1_200_000_000
    pre_tax_3 = 180_000_000
    vat_3 = rev_3 * 0.01
    pit_3 = rev_3 * 0.005
    tax_3 = vat_3 + pit_3
    withheld_3 = 18_000_000
    comp_cost_3 = 12_000_000
    post_tax_3 = pre_tax_3 - tax_3 - comp_cost_3

    cases.append({
        "case_id": "CASE3_tax_above_threshold",
        "description": "Thuế trên ngưỡng 1 tỷ: VAT 1% + TNCN 0,5%, khấu trừ tạm sàn 1,5%, chi phí tuân thủ 12 triệu",
        "inputs": {
            "aggregate_revenue": rev_3,
            "threshold": 1_000_000_000,
            "pre_tax_profit": pre_tax_3,
            "withheld": withheld_3,
            "compliance_cost": comp_cost_3
        },
        "expected": {
            "is_above_threshold": True,
            "vat_amount": vat_3,
            "pit_amount": pit_3,
            "total_tax_liability": tax_3,
            "settlement_amount": tax_3 - withheld_3,
            "after_tax_profit": post_tax_3
        }
    })

    # CASE 4: Nghĩa vụ thuế dưới ngưỡng 1 tỷ (920 triệu đồng - Vùng cảnh báo 92%)
    rev_4 = 920_000_000
    pre_tax_4 = 110_000_000

    cases.append({
        "case_id": "CASE4_tax_below_threshold_near_cliff",
        "description": "Thuế dưới ngưỡng (920 triệu, tỷ lệ 92% >= 90%): Miễn thuế, kích hoạt cảnh báo tiệm cận vách đá",
        "inputs": {
            "aggregate_revenue": rev_4,
            "threshold": 1_000_000_000,
            "pre_tax_profit": pre_tax_4
        },
        "expected": {
            "is_above_threshold": False,
            "total_tax_liability": 0,
            "ratio_to_threshold": 0.92,
            "close_to_threshold_warning": True,
            "after_tax_profit": pre_tax_4
        }
    })

    # CASE 5: Ngưỡng chịu đựng tăng phí (Tolerance)
    # Shop có doanh thu 1.000.000, LN trước thuế 150.000 (biên 15%).
    # Vì mọi chi phí khác cố định, mức tăng phí tối đa trước khi hòa vốn chính là 15 điểm phần trăm (+15 pp).
    cases.append({
        "case_id": "CASE5_tolerance_bisection",
        "description": "Ngưỡng chịu đựng tăng phí toàn kênh bằng thuật toán chia đôi Bisection",
        "inputs": {
            "gross_revenue": 1_000_000,
            "baseline_profit": 150_000,
            "current_commission": 0.10
        },
        "expected": {
            "state": "SOLVED",
            "tolerance_pp": 15.0
        }
    })

    out_path = os.path.join(os.path.dirname(__file__), "cross_validate_cases.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(cases, f, ensure_ascii=False, indent=2)
    print(f"✅ Đã tạo {len(cases)} golden cases tại {out_path}")

if __name__ == "__main__":
    generate_golden_cases()

