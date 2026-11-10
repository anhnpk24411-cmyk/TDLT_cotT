import feeshock as F, numpy as np

def test_mot_don_tinh_tay():
    # TikTok, thời trang, giá 250.000đ, không hoàn: tay = 250000-112500(vốn 45%)-35000(HH 14%)-15000(GD 6%)-3000(đơn)-20000(QC 8%)=64.500
    s=dict(nganh="thoi_trang",P=250_000,cogs=0.45,ads=0.08,ret=0.0)
    st=F.fee_state("TikTok","thoi_trang",True)
    p,r=F.month_profit(1,250_000,s,st); assert abs(p-64_500)<1e-6 and r==250_000

def test_hoan_hang_tinh_tay():
    # 10 đơn đặt, hoàn 10%: giao 9 -> DT 2.250.000; vốn 9*125.000; phí 15%; QC 10%; hoàn = 10*0,1*(20.000+0,15*125.000)=38.750 -> LN 523.750
    s=dict(P=250_000,cogs=0.5,ads=0.10,ret=0.10); st=dict(comm=10,tx=5,svc=0,fixed=0)
    p,r=F.month_profit(10,250_000,s,st); assert abs(r-2_250_000)<1e-6 and abs(p-523_750)<1e-6

def test_nguong_toan_kenh_la_dong_nhat_thuc_voi_bien_LN():
    # ĐỒNG NHẤT THỨC (không phải phát hiện): phí tỷ lệ theo doanh thu nên thêm x điểm hoa hồng ở mọi kênh -> biên LN giảm đúng x điểm
    s=F.SELLERS["S2 Mỹ phẩm"]; p,r=F.annual_profit(s,F.static_states(s,True))
    a,_=F.annual_profit(s,F.static_states(s,True,100*p/r)); assert abs(a)<1e5
    assert abs(F.tolerance_pp(s)-100*p/r)<0.05

def test_nguong_theo_kenh_lon_hon_toan_kenh():
    s=F.SELLERS["S3 Thực phẩm khô"]; main=max(s["mix"],key=s["mix"].get)
    t_all=F.tolerance_pp(s); t_ch=F.tolerance_pp(s,only=main)
    assert t_ch>t_all                                   # chỉ 1 kênh tăng thì chịu được nhiều điểm hơn
    assert abs(F.annual_profit(s,F.static_states(s,True,t_ch,only=main))[0])<1e5

def test_thue_diem_gay():
    th=1e9; assert F.tax_final(th,1,th)[0]==0
    assert abs(F.tax_final(th+1,1e8,th,"rev")[0]-F.TAX["vat_goods"]*th)<1e3   # nhảy VAT = 1%*ngưỡng

def test_dung_bang_nguong_la_mien_va_vuot_1_dong_la_chiu():
    th=1e9; assert F.tax_final(th,5e7,th)[0]==0 and F.tax_final(th+1e6,5e7,th)[0]>0

def test_khau_tru_tam_hoan_khi_duoi_nguong():
    R=9e8; assert F.tax_final(R,1e8,1e9)[0]==0 and F.withheld(R)>0

def test_khau_tru_lon_hon_nghia_vu_thi_duoc_hoan():
    R=1.2e9; t,_=F.tax_final(R,1e8,1e9,"rev"); assert F.withheld(R)>t and abs(t-(0.01*R+0.005*(R-1e9)))<1

def test_thue_suat_thu_nhap_theo_bac():
    assert F.pit_income_rate(2e9)==0.15 and F.pit_income_rate(4e9)==0.17 and F.pit_income_rate(60e9)==0.20
    t,m=F.tax_final(4e9,3e8,1e9); assert m=="thu_nhap" and abs(t-(0.01*4e9+0.17*3e8))<1   # >3 tỷ bắt buộc theo thu nhập, 17%

def test_cong_gop_da_kenh():
    s=F.SELLERS["S1 Thời trang (gần ngưỡng 1 tỷ)"]; _,R=F.annual_profit(s,F.static_states(s,True))
    assert abs(R-s["rev"]*(1-s["ret"]))<1          # doanh thu giao = tổng 3 kênh, không bị tính lặp hay mất kênh

def test_tai_lap_theo_seed():
    s=F.SELLERS["S5 Thời trang biên mỏng (TikTok)"]
    F.reseed(7); a=F.draw_shocks(s); F.reseed(7); b=F.draw_shocks(s); assert a==b

def test_stress_nang_hon_binh_thuong():
    s=F.SELLERS["S5 Thời trang biên mỏng (TikTok)"]; F.reseed(3)
    base=np.mean([F.annual_profit(s,F.draw_shocks(s))[0] for _ in range(300)])
    st=np.mean([F.annual_profit(s,F.draw_shocks(s,2,2))[0] for _ in range(300)]); assert st<base

def test_doanh_thu_dung_1_ty_khong_bi_tinh_thue_do_sai_so():
    s=F.SELLERS["S1 Thời trang (gần ngưỡng 1 tỷ)"]
    d=F._cliff_profile(s,[1e9],1e9)[0]; assert d["t"]==0 and d["m"]=="mien"

if __name__=="__main__":
    n=0
    for k,f in list(globals().items()):
        if k.startswith("test_"): f(); n+=1; print("OK",k)
    print(f"{n} test pass")
