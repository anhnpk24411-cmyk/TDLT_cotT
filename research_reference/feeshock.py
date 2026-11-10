"""
Mô phỏng lợi nhuận thực nhận + cú sốc phí sàn + điểm gãy thuế (DỮ LIỆU GIẢ LẬP).
Mọi tham số nằm trong CONFIG; tham số nào chưa được đối chiếu với nguồn chính thức đều ghi rõ trong cột 'nguon'.
Chạy: python3 feeshock.py   -> in kết quả + ghi CSV vào thư mục results/
"""
import numpy as np, pandas as pd, os, json
SEED = 2026
rng = np.random.default_rng(SEED)
def reseed(seed=SEED):
    """Đặt lại bộ sinh số ngẫu nhiên để mỗi hàm chạy tái lập được, không phụ thuộc thứ tự gọi."""
    global rng; rng = np.random.default_rng(seed)
os.makedirs("results", exist_ok=True)

# ---------------- 1. THAM SỐ PHÍ (sau cú sốc 5/2026; 'pre' = trước cú sốc) ----------------
# nguon: V = có trong bài báo/trang đã đọc (vẫn phải đối chiếu biểu phí chính thức của sàn); A = giả định của nhóm, PHẢI thay bằng số thật
FEES = {
 "Shopee": dict(
    commission={"thoi_trang":10.31,"my_pham":11.78,"thuc_pham":8.84,"phu_kien_dt":6.87},   # V: MISA eShop (hiệu lực 1/7/2025, khoảng giữa dải)
    commission_shock_pp=1.0,            # A: báo chí nói Shopee tăng hoa hồng 23/5/2026 nhưng KHÔNG nêu %
    tx_pre=4.91, tx_post=6.0,          # V: điều khoản Shopee 26/3/2026 4,91%; phiên bản 24/4 hiệu lực 01/5/2026 6%; giả định cơ sở phí = doanh thu giao
    service_pre=4.0, service_post=5.5,  # V: Voucher Xtra 4% -> 5,5% (Tuổi Trẻ, 5/2026); tỷ lệ tham gia xem svc_prob
    svc_prob=0.6,                       # A
    fixed_vnd_pre=0, fixed_vnd_post=0),
 "TikTok": dict(
    commission={"thoi_trang":14.0,"my_pham":17.8,"thuc_pham":9.0,"phu_kien_dt":9.0},        # V: dải 9%-17,8% (Tuổi Trẻ); gán theo ngành là A
    commission_shock_pp=3.5,            # A: mức tăng ~3-4 điểm % (tổng hợp báo chí)
    tx_pre=5.0, tx_post=6.0,            # V: 6% từ 9/5/2026 (MISA); mức trước đó là A
    service_pre=0.0, service_post=0.0, svc_prob=0.0,
    fixed_vnd_pre=3000, fixed_vnd_post=3000),  # V: 3.000đ/đơn từ 27/10/2025
 "Lazada": dict(
    commission={"thoi_trang":8.8,"my_pham":11.78,"thuc_pham":8.0,"phu_kien_dt":4.9},        # V: dải 4,9-11,78% (MISA); gán theo ngành là A
    commission_shock_pp=0.0,
    tx_pre=5.0, tx_post=6.0,            # V: phí xử lý 5% -> 6% (Tuổi Trẻ)
    service_pre=0.0, service_post=0.0, svc_prob=0.0,
    fixed_vnd_pre=0, fixed_vnd_post=3000),     # V: phí hạ tầng 3.000đ/đơn
}
# Cú sốc ngẫu nhiên: tần suất thông báo/năm (A: đếm thô từ báo chí 2025-2026, n nhỏ) và độ lớn (A)
SHOCK = {"Shopee":dict(lam=1.0),"TikTok":dict(lam=1.2),"Lazada":dict(lam=0.6)}
SHOCK_SIZE = dict(comm_pp=(1.0,4.0), tx_pp=(0.5,1.5), fixed_vnd=(0,3000))   # A: U(a,b)

# ---------------- 2. HỒ SƠ NGƯỜI BÁN GIẢ LẬP (A: toàn bộ là giả định minh họa) ----------------
SELLERS = {
 "S1 Thời trang (gần ngưỡng 1 tỷ)": dict(nganh="thoi_trang",P=250_000,cogs=0.52,ads=0.09,ret=0.07,rev=1.01e9,mix={"TikTok":.5,"Shopee":.4,"Lazada":.1}),
 "S2 Mỹ phẩm":                  dict(nganh="my_pham",   P=180_000,cogs=0.45,ads=0.12,ret=0.03,rev=600e6,mix={"TikTok":.6,"Shopee":.4}),
 "S3 Thực phẩm khô":            dict(nganh="thuc_pham", P=120_000,cogs=0.66,ads=0.05,ret=0.02,rev=400e6,mix={"Shopee":.7,"TikTok":.2,"Lazada":.1}),
 "S4 Phụ kiện điện tử":         dict(nganh="phu_kien_dt",P=400_000,cogs=0.72,ads=0.06,ret=0.04,rev=1.5e9,mix={"Shopee":.5,"Lazada":.3,"TikTok":.2}),
 "S5 Thời trang biên mỏng (TikTok)": dict(nganh="thoi_trang",P=180_000,cogs=0.55,ads=0.12,ret=0.08,rev=700e6,mix={"TikTok":.8,"Shopee":.2}),
}
SHIP_RETURN = 20_000; RECOVER = 0.85; ELASTICITY = -1.5   # A

# ---------------- 3. MÔ HÌNH LỢI NHUẬN ----------------
def fee_state(platform, nganh, post=True):
    f = FEES[platform]
    return dict(comm=f["commission"][nganh] + (0 if post else -f["commission_shock_pp"]),
                tx=f["tx_post"] if post else f["tx_pre"],
                svc=(f["service_post"] if post else f["service_pre"])*f["svc_prob"],
                fixed=f["fixed_vnd_post"] if post else f["fixed_vnd_pre"])

def month_profit(units, price, s, state):
    """Lợi nhuận trước thuế của 1 kênh trong 1 tháng. units = số đơn đặt; state = dict phí (đơn vị % và VND/đơn)."""
    delivered = units*(1-s["ret"]); rev = delivered*price
    fees = rev*(state["comm"]+state["tx"]+state["svc"])/100 + delivered*state["fixed"]
    cogs = delivered*s["cogs"]*s["P"]   # giá vốn/đơn cố định theo giá gốc (không đổi khi tăng giá bán)
    ads = rev*s["ads"]
    ret_cost = units*s["ret"]*(SHIP_RETURN+(1-RECOVER)*s["cogs"]*s["P"])
    return rev - cogs - fees - ads - ret_cost, rev

def annual_profit(s, states_by_month, g=0.0, noise=None):
    """states_by_month[ch][m] = dict phí. g = % tăng giá bán; cầu co giãn ELASTICITY."""
    price = s["P"]*(1+g); tot = rev_tot = 0.0
    for ch, share in s["mix"].items():
        base_units = s["rev"]*share/s["P"]/12
        for m in range(12):
            u = base_units*(1+g)**ELASTICITY*(noise[m] if noise is not None else 1)
            p, r = month_profit(u, price, s, states_by_month[ch][m]); tot += p; rev_tot += r
    return tot, rev_tot

def static_states(s, post=True, extra_comm_pp=0.0, only=None):
    """only=None: cộng thêm extra_comm_pp điểm % hoa hồng cho MỌI kênh; only='TikTok': chỉ cho kênh đó."""
    out = {}
    for ch in s["mix"]:
        st = fee_state(ch, s["nganh"], post)
        if only is None or ch == only: st["comm"] += extra_comm_pp
        out[ch] = [st]*12
    return out

def tolerance_pp(s, only=None, hi=200.0):
    """Số điểm % hoa hồng tăng thêm (mọi kênh hoặc 1 kênh) để LN năm về 0 — bisection.
    LƯU Ý: khi tăng ở MỌI kênh, kết quả ~ biên LN (đồng nhất thức, vì phí tỷ lệ theo doanh thu)."""
    lo = 0.0
    for _ in range(70):
        mid = (lo+hi)/2
        if annual_profit(s, static_states(s, True, mid, only))[0] > 0: lo = mid
        else: hi = mid
    return lo

def draw_shocks(s, lam_mult=1.0, size_mult=1.0):
    """lam_mult/size_mult = nhân tần suất và độ lớn cú sốc (kịch bản căng, stress)."""
    out = {}
    for ch in s["mix"]:
        st0 = fee_state(ch, s["nganh"], True); seq = []; cur = dict(st0)
        n = rng.poisson(SHOCK[ch]["lam"]*lam_mult); months = sorted(rng.integers(0,12,n))
        ev = {}
        for mo in months:
            d = dict(comm=size_mult*rng.uniform(*SHOCK_SIZE["comm_pp"]), tx=size_mult*rng.uniform(*SHOCK_SIZE["tx_pp"]),
                     fixed=size_mult*rng.choice([0,SHOCK_SIZE["fixed_vnd"][1]],p=[.7,.3]))
            ev.setdefault(mo,[]).append(d)
        for m in range(12):
            for d in ev.get(m,[]):
                cur["comm"]+=d["comm"]; cur["tx"]+=d["tx"]; cur["fixed"]+=d["fixed"]
            seq.append(dict(cur))
        out[ch] = seq
    return out

# ---------------- 4. THUẾ (đã đối chiếu cấu trúc với NĐ 68/2026, NĐ 141/2026 qua các nguồn thứ cấp; PHẢI đối chiếu văn bản gốc) ----------------
# V: hàng hóa — VAT 1% trên toàn bộ doanh thu; TNCN 0,5% x (doanh thu - ngưỡng); doanh thu 1-3 tỷ được chọn TNCN 15% x thu nhập tính thuế;
#    3-50 tỷ bắt buộc 17% x thu nhập; >50 tỷ 20%. A: LN trước thuế của mô hình dùng làm "thu nhập tính thuế"; sàn khấu trừ tạm 1,5% trên 100% doanh thu.
TAX = dict(theta_old=500e6, theta_new=1e9,   # NĐ 68/2026: 500tr; NĐ 141/2026: 1 tỷ (2 phiên bản chính sách)
           vat_goods=0.01, pit_goods=0.005, theta2=3e9,
           pit_income_rates=((3e9,0.15),(50e9,0.17),(float("inf"),0.20)))
def pit_income_rate(R):
    for cap, r in TAX["pit_income_rates"]:
        if R <= cap: return r
def tax_final(R, profit, theta, method="auto"):
    """Nghĩa vụ năm. R = doanh thu năm cộng gộp mọi kênh. R<=theta: 0.
    VAT = 1%*R. TNCN: theo doanh thu = 0,5%*(R-theta) hoặc theo thu nhập = rate(R)*LN; R>3 tỷ bắt buộc theo thu nhập."""
    if R <= theta: return 0.0, "mien"
    vat = TAX["vat_goods"]*R
    pit_rev = TAX["pit_goods"]*(R-theta)
    pit_inc = pit_income_rate(R)*max(profit,0)
    if R > TAX["theta2"]: return vat+pit_inc, "thu_nhap"
    if method=="rev": return vat+pit_rev, "doanh_thu"
    if method=="inc": return vat+pit_inc, "thu_nhap"
    return (vat+pit_rev,"doanh_thu") if pit_rev<=pit_inc else (vat+pit_inc,"thu_nhap")
def withheld(R, share_on_platform=1.0):
    return (TAX["vat_goods"]+TAX["pit_goods"])*R*share_on_platform   # A: sàn khấu trừ tạm 1,5% trên mọi đơn

# ---------------- 5. CHẠY ----------------
GRID_POLICY = np.arange(0,0.101,0.01)     # mức tăng giá chính sách tối đa 10%
GRID_WIDE   = np.arange(0,0.301,0.01)     # lưới rộng để phát hiện nghiệm chạm trần
NOISE_W = np.array([0.9,0.9,0.95,1,1,1,1,1,1.05,1.1,1.25,1.2])
def month_noise():
    nz = rng.lognormal(0,0.2,12)*NOISE_W; return nz/nz.mean()

def run(n_sim=5000):
    reseed(SEED); rows=[]; mc_rows=[]
    for name,s in SELLERS.items():
        pre,Rpre = annual_profit(s, static_states(s,False)); post,Rpost = annual_profit(s, static_states(s,True))
        main = max(s["mix"], key=s["mix"].get)
        tol_all = tolerance_pp(s); tol_main = tolerance_pp(s, only=main)
        paths=[]; stress=[]
        for _ in range(n_sim):
            st=draw_shocks(s); nz=month_noise()
            paths.append([annual_profit(s,st,g,nz)[0] for g in GRID_POLICY])
            st2=draw_shocks(s,2.0,2.0); stress.append(annual_profit(s,st2,0.0,month_noise())[0])
        P=np.array(paths); stress=np.array(stress); profs=P[:,0]
        q=np.quantile(profs,0.05); cvar=profs[profs<=q].mean()
        qs=np.quantile(stress,0.05); cvs=stress[stress<=qs].mean()
        # điều chỉnh giá CHỌN TRƯỚC (ex-ante): chọn g trên nửa đầu, đánh giá trên nửa sau (out-of-sample)
        h=n_sim//2; k=P[:h].mean(axis=0).argmax(); uplift=P[h:,k].mean()-P[h:,0].mean()
        rows.append(dict(nguoi_ban=name,doanh_thu_dat_hang_trieu=round(s["rev"]/1e6),doanh_thu_giao_trieu=round(Rpost/1e6),
            LN_truoc_soc_GIA_DINH_trieu=round(pre/1e6,1),LN_sau_soc_5_2026_trieu=round(post/1e6,1),
            bien_LN_truoc_pct=round(100*pre/Rpre,1),bien_LN_sau_pct=round(100*post/Rpost,1),
            ty_le_duy_tri_LN_pct=round(100*post/pre,1) if pre>0 else None,
            nguong_chiu_dung_toan_kenh_diem_pct=round(tol_all,2),
            kenh_chinh=main,nguong_chiu_dung_kenh_chinh_diem_pct=round(tol_main,2)))
        mc_rows.append(dict(nguoi_ban=name,LN_ky_vong_trieu=round(profs.mean()/1e6,1),
            P_LN_am_pct=round(100*(profs<0).mean(),1),VaR5_trieu=round(q/1e6,1),CVaR5_trieu=round(cvar/1e6,1),
            CVaR5_tren_ky_vong_pct=round(100*cvar/profs.mean(),1),
            STRESS_x2_LN_ky_vong_trieu=round(stress.mean()/1e6,1),STRESS_x2_P_LN_am_pct=round(100*(stress<0).mean(),1),
            STRESS_x2_CVaR5_trieu=round(cvs/1e6,1),
            g_chon_truoc_pct=round(100*GRID_POLICY[k]),g_cham_tran=bool(k==len(GRID_POLICY)-1),
            uplift_ngoai_mau_do_nhay_trieu=round(uplift/1e6,1)))
    a,b=pd.DataFrame(rows),pd.DataFrame(mc_rows)
    a.to_csv("results/kq1_loi_nhuan_nguong_chiu_dung.csv",index=False); b.to_csv("results/kq2_monte_carlo.csv",index=False)
    return a,b

def _cliff_profile(s, R_list, theta):
    out=[]
    for R0 in R_list:
        s2=dict(s,rev=R0/(1-s["ret"])); p,R=annual_profit(s2,static_states(s2,True))
        R=round(R)   # tránh sai số dấu phẩy động làm doanh thu đúng bằng ngưỡng bị coi là vượt ngưỡng
        t,m=tax_final(R,p,theta); w=withheld(R)
        out.append(dict(R=R,p=p,t=t,w=w,m=m))
    return out

def tax_break():
    """Điểm gãy thuế cho S1: quét doanh thu 0,4-1,3 tỷ (bước 10tr) với 2 phiên bản chính sách, và tính 'mức rơi' + 'doanh thu bù' quanh từng ngưỡng."""
    s=SELLERS["S1 Thời trang (gần ngưỡng 1 tỷ)"]; out=[]; summ=[]
    for theta,label in [(TAX["theta_old"],"NĐ68 (500tr)"),(TAX["theta_new"],"NĐ141 (1 tỷ)")]:
        for d in _cliff_profile(s, np.arange(0.4e9,1.3001e9,10e6), theta):
            out.append(dict(phien_ban=label,doanh_thu_trieu=round(d["R"]/1e6),LN_truoc_thue_trieu=round(d["p"]/1e6,1),
                thue_cuoi_nam_trieu=round(d["t"]/1e6,1),thue_san_khau_tru_tam_trieu=round(d["w"]/1e6,1),
                chenh_lech_phai_nop_them_hoac_hoan_trieu=round((d["t"]-d["w"])/1e6,1),
                LN_sau_thue_trieu=round((d["p"]-d["t"])/1e6,1),phuong_phap=d["m"],
                khau_tru_tren_LN_pct=round(100*d["w"]/d["p"],1) if d["p"]>0 else None))
        at = _cliff_profile(s,[theta],theta)[0]; base=at["p"]-at["t"]          # đúng bằng ngưỡng: miễn
        fine=_cliff_profile(s, theta+np.arange(1e6,300e6,1e6), theta)
        just=fine[0]; after_just=just["p"]-just["t"]
        rec=next((f for f in fine if f["p"]-f["t"]>=base),None)
        summ.append(dict(phien_ban=label,moc_trieu=theta/1e6,LN_sau_thue_tai_nguong_trieu=round(base/1e6,1),
            LN_sau_thue_ngay_tren_trieu=round(after_just/1e6,1),muc_roi_trieu=round((base-after_just)/1e6,1),
            doanh_thu_bu_duoc_trieu=round(rec["R"]/1e6) if rec else None,
            doanh_thu_them_can_trieu=round((rec["R"]-theta)/1e6) if rec else None,
            doanh_thu_them_can_pct_nguong=round(100*(rec["R"]-theta)/theta,1) if rec else None,
            khau_tru_tam_giu_tai_nguong_trieu=round(at["w"]/1e6,1),khau_tru_tren_LN_pct=round(100*at["w"]/at["p"],1)))
    df=pd.DataFrame(out); df.to_csv("results/kq3_diem_gay_thue.csv",index=False)
    sm=pd.DataFrame(summ); sm.to_csv("results/kq3b_tom_tat_diem_gay.csv",index=False)
    return df,sm

def elasticity_sensitivity():
    """Độ nhạy của việc điều chỉnh giá theo độ co giãn cầu. Lưới rộng 0-30%: nếu g tối ưu = 30% => nghiệm chạm trần (mô hình không giới hạn được)."""
    global ELASTICITY
    out=[]; keep=ELASTICITY
    for e in (-3.0,-4.0,-5.0,-6.0,-7.0,-8.0):
        ELASTICITY=e
        for name,s in SELLERS.items():
            st=static_states(s,True); base=annual_profit(s,st)[0]
            best=max(((annual_profit(s,st,g)[0],g) for g in GRID_WIDE))
            cap10=max(((annual_profit(s,st,g)[0],g) for g in GRID_POLICY))
            out.append(dict(do_co_gian=e,nguoi_ban=name,g_toi_uu_luoi_rong_pct=round(100*best[1]),cham_tran_30pct=bool(round(100*best[1])==30),
                uplift_luoi_rong_trieu=round((best[0]-base)/1e6,1),g_toi_uu_tran10_pct=round(100*cap10[1]),uplift_tran10_trieu=round((cap10[0]-base)/1e6,1)))
    ELASTICITY=keep
    df=pd.DataFrame(out); df.to_csv("results/kq4_nhay_do_co_gian.csv",index=False); return df

if __name__=="__main__":
    pd.set_option("display.width",260,"display.max_columns",40)
    a,b=run(); print("\n== KQ1: lợi nhuận trước(giả định)/sau cú sốc 5/2026 + ngưỡng chịu đựng phí ==\n",a.to_string(index=False))
    print("\n== KQ2: Monte Carlo 5.000 lần + STRESS x2 + điều chỉnh giá chọn trước (ngoài mẫu) ==\n",b.to_string(index=False))
    reseed(SEED); e=elasticity_sensitivity()
    print("\n== KQ4: độ nhạy điều chỉnh giá (uplift lưới rộng 0-30%) ==\n",e.pivot(index="nguoi_ban",columns="do_co_gian",values="uplift_luoi_rong_trieu").to_string())
    print("\n   nghiệm chạm trần 30%:\n",e.pivot(index="nguoi_ban",columns="do_co_gian",values="cham_tran_30pct").to_string())
    df,sm=tax_break(); print("\n== KQ3b: tóm tắt điểm gãy thuế (S1) ==\n",sm.T.to_string())
