-- ==============================================================================
-- DỰ ÁN HỌC PHẦN MIS3047 - QUẢN LÝ QUY TRÌNH KINH DOANH (BPM)
-- ĐẠI HỌC KINH TẾ ĐÀ NẴNG (DUE) - NHÓM 4
-- TẬP LỆNH CHÈN DỮ LIỆU MẪU 350 SINH VIÊN (K47 - K51) ĐỂ GIẢNG VIÊN CHẤM BÀI
-- ==============================================================================

DO $$
DECLARE
    sv1_id UUID := '11111111-1111-1111-1111-111111111111';
    sv2_id UUID := '22222222-2222-2222-2222-222222222222';
    sv3_id UUID := '33333333-3333-3333-3333-333333333333';
    sv4_id UUID := '44444444-4444-4444-4444-444444444444';
    hc_id  UUID := '55555555-5555-5555-5555-555555555555';
    qlsv_id UUID := '66666666-6666-6666-6666-666666666666';
    tb_id  UUID := '77777777-7777-7777-7777-777777777777';
    
    round_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    
    room_a301 UUID := 'd9b1de7a-2412-4f32-843a-7dbb71120001';
    room_a302 UUID := 'd9b1de7a-2412-4f32-843a-7dbb71120002';
    room_a303 UUID := 'd9b1de7a-2412-4f32-843a-7dbb71120003';
    room_b201 UUID := 'd9b1de7a-2412-4f32-843a-7dbb71120004';

    -- Biến vòng lặp sinh 350 sinh viên
    i INT;
    v_cohort TEXT;
    v_major TEXT;
    v_ma_sv TEXT;
    v_ho_ten TEXT;
    v_tinh TEXT;
    v_policy TEXT;
    v_points NUMERIC(5,2);
    v_app_id UUID;
    v_is_accepted BOOLEAN;

    arr_first TEXT[] := ARRAY['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
    arr_mid   TEXT[] := ARRAY['Văn', 'Thị', 'Hoàng', 'Minh', 'Đức', 'Quốc', 'Thu', 'Thảo', 'Phương', 'Bảo', 'Gia', 'Hồng', 'Thành', 'Tuấn', 'Ngọc'];
    arr_last  TEXT[] := ARRAY['An', 'Bình', 'Cường', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hạnh', 'Huy', 'Khoa', 'Linh', 'Long', 'Mai', 'Nam', 'Nhi', 'Phúc', 'Quân', 'Sơn', 'Tâm', 'Thảo', 'Thịnh', 'Trang', 'Trí', 'Trung', 'Tú', 'Uyên', 'Việt', 'Vy', 'Xuân', 'Yến'];
    arr_prov  TEXT[] := ARRAY['Quảng Nam', 'Quảng Trị', 'Thừa Thiên Huế', 'Quảng Bình', 'Quảng Ngãi', 'Bình Định', 'Phú Yên', 'Khánh Hòa', 'Kon Tum', 'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Lâm Đồng', 'Nghệ An', 'Hà Tĩnh', 'Thanh Hóa'];
    arr_cohort TEXT[] := ARRAY['47K', '48K', '49K', '50K', '51K'];
    arr_major TEXT[] := ARRAY['01', '02', '11', '12', '14', '18', '21', '25', '30'];
BEGIN

    -- 1. TẠO CÁC TÀI KHOẢN MẪU CHO 4 VAI TRÒ
    INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES
        (sv1_id, 'authenticated', 'authenticated', 'an.nguyen@due.edu.vn', crypt('MatKhau123@', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"SV","ho_ten":"Nguyễn Văn An","ma_dinh_danh":"50K21.001"}', now(), now()),
        (sv2_id, 'authenticated', 'authenticated', 'nam.le@due.edu.vn', crypt('MatKhau123@', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"SV","ho_ten":"Lê Hoàng Nam","ma_dinh_danh":"49K21.042"}', now(), now()),
        (sv3_id, 'authenticated', 'authenticated', 'thanh.tran@due.edu.vn', crypt('MatKhau123@', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"SV","ho_ten":"Trần Văn Thành","ma_dinh_danh":"51K21.099"}', now(), now()),
        (sv4_id, 'authenticated', 'authenticated', 'linh.pham@due.edu.vn', crypt('MatKhau123@', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"SV","ho_ten":"Phạm Thùy Linh","ma_dinh_danh":"48K11.023"}', now(), now()),
        (hc_id, 'authenticated', 'authenticated', 'hanhchinh.ktx@due.edu.vn', crypt('MatKhau123@', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"HC","ho_ten":"Nguyễn Thị Mai (CB Hành chính)","ma_dinh_danh":"CB-HC01"}', now(), now()),
        (qlsv_id, 'authenticated', 'authenticated', 'qlsv.ktx@due.edu.vn', crypt('MatKhau123@', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"QLSV","ho_ten":"Trần Văn Bình (CB QLSV)","ma_dinh_danh":"CB-QL01"}', now(), now()),
        (tb_id, 'authenticated', 'authenticated', 'truongban.ktx@due.edu.vn', crypt('MatKhau123@', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role":"TB","ho_ten":"TS. Lê Đình Trọng (Trưởng ban KTX)","ma_dinh_danh":"CB-TB01"}', now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- 2. ĐỒNG BỘ BẢNG PROFILES
    INSERT INTO public.profiles (id, email, ho_ten, role, ma_dinh_danh)
    VALUES
        (sv1_id, 'an.nguyen@due.edu.vn', 'Nguyễn Văn An', 'SV', '50K21.001'),
        (sv2_id, 'nam.le@due.edu.vn', 'Lê Hoàng Nam', 'SV', '49K21.042'),
        (sv3_id, 'thanh.tran@due.edu.vn', 'Trần Văn Thành', 'SV', '51K21.099'),
        (sv4_id, 'linh.pham@due.edu.vn', 'Phạm Thùy Linh', 'SV', '48K11.023'),
        (hc_id, 'hanhchinh.ktx@due.edu.vn', 'Nguyễn Thị Mai (CB Hành chính)', 'HC', 'CB-HC01'),
        (qlsv_id, 'qlsv.ktx@due.edu.vn', 'Trần Văn Bình (CB QLSV)', 'QLSV', 'CB-QL01'),
        (tb_id, 'truongban.ktx@due.edu.vn', 'TS. Lê Đình Trọng (Trưởng ban KTX)', 'TB', 'CB-TB01')
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role, ho_ten = EXCLUDED.ho_ten;

    -- 3. KHỞI TẠO PHÒNG VÀ ĐỢT TUYỂN
    INSERT INTO public.rooms (id, so_phong, khu, loai_phong, tong_cho, cho_da_o, status)
    VALUES
        (room_a301, 'Phòng 301', 'Khu A', 'Phòng tiêu chuẩn 4 người', 4, 2, 'CON_TRONG'),
        (room_a302, 'Phòng 302', 'Khu A', 'Phòng tiêu chuẩn 4 người', 4, 3, 'CON_TRONG'),
        (room_a303, 'Phòng 303', 'Khu A', 'Phòng tiêu chuẩn 4 người', 4, 4, 'DAY'),
        (room_b201, 'Phòng 201', 'Khu B', 'Phòng tiêu chuẩn 4 người', 4, 1, 'CON_TRONG')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.approval_rounds (id, ten_dot, chi_tieu, trang_thai, approved_by)
    VALUES
        (round_id, 'Xét tuyển nội trú KTX Năm học 2026-2027 (K47 - K51)', 120, 'DA_CHOT', tb_id)
    ON CONFLICT (id) DO NOTHING;

    -- 4. VÒNG LẶP SINH DỮ LIỆU ĐỦ 350 SINH VIÊN (K47 - K51)
    FOR i IN 1..350 LOOP
        v_cohort := arr_cohort[1 + (i % 5)];
        v_major  := arr_major[1 + ((i * 3) % 9)];
        v_ma_sv  := v_cohort || v_major || '.' || LPAD(i::text, 3, '0');
        v_ho_ten := arr_first[1 + (i % 15)] || ' ' || arr_mid[1 + ((i * 2) % 15)] || ' ' || arr_last[1 + ((i * 7) % 30)];
        v_tinh   := arr_prov[1 + (i % 16)];

        -- Phân bổ điểm ưu tiên
        IF i <= 30 THEN
            v_policy := 'CON_THUONG_BINH_LIET_SI';
            v_points := 40.00;
        ELSIF i <= 90 THEN
            v_policy := 'HO_NGHEO_CAN_NGHEO';
            v_points := 35.00;
        ELSIF i <= 150 THEN
            v_policy := 'VUNG_SAU_XA_HAI_DAO';
            v_points := 30.00;
        ELSIF i <= 230 THEN
            v_policy := 'DAN_TOC_THIEU_SO';
            v_points := 25.00;
        ELSIF i <= 300 THEN
            v_policy := 'NGOAI_TINH_XA';
            v_points := 20.00;
        ELSE
            v_policy := 'KHONG';
            v_points := 0.00;
        END IF;

        v_is_accepted := (i <= 120); -- Chỉ tiêu 120 chỗ
        v_app_id := ('55000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::UUID;

        -- Chèn Application
        INSERT INTO public.applications (
            id, student_id, ma_sv, ho_ten, cccd, ngay_sinh, gioi_tinh, tinh_thanh, 
            dia_chi_thuong_tru, dien_uu_tien, diem_uu_tien, status, ghi_chu_ly_do
        ) VALUES (
            v_app_id, sv1_id, v_ma_sv, v_ho_ten, ('04820' || LPAD(i::text, 7, '0')), 
            '2005-01-01', CASE WHEN i % 2 = 0 THEN 'Nữ' ELSE 'Nam' END, v_tinh, 
            ('Địa chỉ thường trú số ' || i || ', ' || v_tinh), v_policy, v_points, 
            CASE WHEN i <= 120 THEN 'THAM_DINH_DAT'::public.app_status ELSE 'DA_XEP_HANG'::public.app_status END,
            'Hồ sơ hợp lệ trong đợt xét tuyển 350 sinh viên.'
        ) ON CONFLICT (id) DO NOTHING;

        -- Chèn Ranking tương ứng
        INSERT INTO public.rankings (
            id, round_id, application_id, diem_uu_tien, thu_hang, is_trung_tuyen, status
        ) VALUES (
            ('66000000-0000-0000-0000-' || LPAD(i::text, 12, '0'))::UUID,
            round_id, v_app_id, v_points, i, v_is_accepted, 'DA_CHOT'
        ) ON CONFLICT (id) DO NOTHING;

    END LOOP;

    -- 5. THÊM RIÊNG CÁC CA ĐẶC THÙ (ĐÀ NẴNG BỊ TỪ CHỐI, HỢP ĐỒNG 72H)
    -- Ca Hộ khẩu Đà Nẵng -> XOR 1 Từ chối
    INSERT INTO public.applications (
        id, student_id, ma_sv, ho_ten, cccd, ngay_sinh, gioi_tinh, tinh_thanh, 
        dia_chi_thuong_tru, dien_uu_tien, diem_uu_tien, status, ghi_chu_ly_do
    ) VALUES (
        '20000000-0000-0000-0000-000000000002', sv3_id, '51K21.099', 'Trần Văn Thành', '048204002222', 
        '2006-05-20', 'Nam', 'Đà Nẵng', 'Số 45 Lê Duẩn, Quận Hải Châu, TP Đà Nẵng', 
        'KHONG', 0.00, 'TU_CHOI_BO_TRI', 
        '[XOR 1 TỪ CHỐI]: Sinh viên có hộ khẩu thường trú tại TP Đà Nẵng không thuộc đối tượng xét tuyển KTX.'
    ) ON CONFLICT (id) DO NOTHING;

    -- Ca Hợp đồng điện tử ký OTP trong 72h
    INSERT INTO public.contracts (
        id, application_id, room_id, ma_hop_dong, sign_deadline, otp_code_hash, status
    ) VALUES (
        'c4000000-0000-0000-0000-000000000004', 
        '55000000-0000-0000-0000-000000000002', 
        room_a301, 
        'HD-KTX-2026-49K21.042', 
        now() + interval '72 hours', 
        '888888',
        'CHO_KY'
    ) ON CONFLICT (id) DO NOTHING;

END $$;
