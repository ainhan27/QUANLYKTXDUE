-- ==============================================================================
-- DỰ ÁN HỌC PHẦN MIS3047 - QUẢN LÝ QUY TRÌNH KINH DOANH (BPM)
-- ĐẠI HỌC KINH TẾ ĐÀ NẴNG (DUE) - NHÓM 4
-- ĐỀ TÀI: HỆ THỐNG XÉT DUYỆT HỒ SƠ ĐĂNG KÝ NỘI TRÚ KÝ TÚC XÁ (KTX)
-- TẬP LỆNH SQL KHỞI TẠO CƠ SỞ DỮ LIỆU & ROW LEVEL SECURITY (RLS) TRÊN SUPABASE
-- ==============================================================================

-- 1. BẬT CÁC EXTENSION CẦN THIẾT
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ĐỊNH NGHĨA CÁC KIỂU ENUM THEO BPMN
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('SV', 'HC', 'QLSV', 'TB');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_status') THEN
        CREATE TYPE app_status AS ENUM (
            'DA_NOP',             -- Sinh viên vừa nộp form online
            'DA_TIEP_NHAN',        -- Hệ thống tự động tiếp nhận ghi nhận
            'TU_CHOI_BO_TRI',     -- Bị từ chối do Hộ khẩu Đà Nẵng (XOR 1)
            'CHO_THAM_DINH',      -- Đang chờ AI hoặc cán bộ thẩm định minh chứng
            'CAN_BO_SUNG',        -- Minh chứng chưa đạt, yêu cầu bổ sung trong 48h
            'THAM_DINH_DAT',      -- Minh chứng đã được duyệt (AI hoặc QLSV duyệt)
            'KHONG_DUOC_XET',     -- Quá hạn mà không bổ sung minh chứng
            'DA_XEP_HANG',        -- Đã tính điểm ưu tiên và xếp thứ hạng dự kiến
            'DA_CHOT',            -- QLSV đã chốt danh sách theo chỉ tiêu
            'DA_DUYET',           -- Trưởng ban đã duyệt thông qua (XOR 3)
            'BI_TRA_VE',          -- Trưởng ban trả về yêu cầu QLSV điều chỉnh
            'DA_PHAT_HANH',       -- Đã khóa danh sách và phát hành kết quả + HĐ điện tử
            'DA_KY',              -- Sinh viên đã ký hợp đồng bằng OTP (XOR 4)
            'HUY_SUAT',           -- Suất bị hủy (SV từ chối hoặc quá 72h không ký)
            'DA_BAN_GIAO'         -- Hoàn tất nhận bàn giao phòng KTX
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evidence_status') THEN
        CREATE TYPE evidence_status AS ENUM (
            'DA_TAI_LEN', 'DA_RA_SOAT', 'DAT', 'CAN_BO_SUNG', 'DA_BO_SUNG'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status') THEN
        CREATE TYPE room_status AS ENUM (
            'CON_TRONG', 'DA_GIU_CHO', 'DANG_SU_DUNG', 'DAY'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status') THEN
        CREATE TYPE contract_status AS ENUM (
            'CHO_KY', 'DA_KY', 'DA_HUY'
        );
    END IF;
END $$;

-- ==============================================================================
-- 3. TẠO CÁC BẢNG DỮ LIỆU CHÍNH (TABLE DEFINITIONS)
-- ==============================================================================

-- BẢNG 3.1: PROFILES (HỒ SƠ TÀI KHOẢN NGƯỜI DÙNG LIÊN KẾT VỚI SUPABASE AUTH)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    ho_ten TEXT NOT NULL,
    so_dien_thoai TEXT,
    role user_role NOT NULL DEFAULT 'SV',
    ma_dinh_danh TEXT, -- Mã sinh viên (nếu SV) hoặc Mã cán bộ
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- BẢNG 3.2: ROOMS (QUẢN LÝ KHO PHÒNG VÀ CHỖ Ở KTX)
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    so_phong TEXT NOT NULL UNIQUE,
    khu TEXT NOT NULL, -- Khu A, Khu B, Khu C...
    loai_phong TEXT NOT NULL DEFAULT 'Tieu chuan (4 nguoi)',
    tong_cho INT NOT NULL DEFAULT 4,
    cho_da_o INT NOT NULL DEFAULT 0,
    status room_status NOT NULL DEFAULT 'CON_TRONG',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- BẢNG 3.3: APPLICATIONS (HỒ SƠ ĐĂNG KÝ NỘI TRÚ CỦA SINH VIÊN)
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ma_sv TEXT NOT NULL UNIQUE,
    ho_ten TEXT NOT NULL,
    email TEXT,
    cccd TEXT NOT NULL,
    ngay_sinh DATE NOT NULL,
    gioi_tinh TEXT NOT NULL,
    tinh_thanh TEXT NOT NULL, -- Tiêu chí lọc XOR 1 (Đà Nẵng -> TU_CHOI_BO_TRI)
    dia_chi_thuong_tru TEXT NOT NULL,
    dien_uu_tien TEXT NOT NULL DEFAULT 'KHONG', -- CON_THUONG_BINH, HO_NGHEO, VUNG_SAU_XA, NGOAI_TINH...
    diem_uu_tien NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    status app_status NOT NULL DEFAULT 'DA_NOP',
    assigned_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    file_url TEXT,
    signature_base64 TEXT,
    ghi_chu_ly_do TEXT,
    han_bo_sung TIMESTAMPTZ, -- Ân hạn 48h nếu cần bổ sung
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- BẢNG 3.4: EVIDENCES (FILE MINH CHỨNG TẢI LÊN LƯU TẠI STORAGE BUCKET)
CREATE TABLE IF NOT EXISTS public.evidences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL, -- Đường dẫn file trong Private Supabase Storage bucket 'evidences'
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- CCCD_MAT_TRUOC, GIAY_XAC_NHAN_UU_TIEN...
    lan_nop INT NOT NULL DEFAULT 1,
    status evidence_status NOT NULL DEFAULT 'DA_TAI_LEN',
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- BẢNG 3.5: AI_LOGS / AI_REVIEWS (NHẬT KÝ VÀ KẾT QUẢ THẨM ĐỊNH AI VISION)
CREATE TABLE IF NOT EXISTS public.ai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    evidence_id UUID REFERENCES public.evidences(id) ON DELETE SET NULL,
    model_name TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
    confidence NUMERIC(4,3) NOT NULL, -- Điểm tin cậy từ 0.000 đến 1.000
    ket_luan TEXT NOT NULL, -- HOP_LE, NGHI_VAN, TU_CHOI_ANH_LA
    loai_giay_to_phat_hien TEXT,
    trich_xuat_thong_tin JSONB DEFAULT '{}'::jsonb,
    ly_do_chi_tiet TEXT,
    payload_json JSONB DEFAULT '{}'::jsonb,
    loi_api BOOLEAN NOT NULL DEFAULT false,
    so_lan_thu INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- BẢNG 3.6: MANUAL_REVIEWS (CÁN BỘ QLSV RÀ SOÁT MINH CHỨNG THỦ CÔNG)
CREATE TABLE IF NOT EXISTS public.manual_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    evidence_id UUID REFERENCES public.evidences(id) ON DELETE SET NULL,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
    ket_qua TEXT NOT NULL, -- DAT, CAN_BO_SUNG, TU_CHOI
    ly_do TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- BẢNG 3.7: APPROVAL_ROUNDS (ĐỢT XÉT DUYỆT VÀ CHỐT CHỈ TIÊU CỦA TRƯỞNG BAN)
CREATE TABLE IF NOT EXISTS public.approval_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ten_dot TEXT NOT NULL, -- Ví dụ: Đợt xét tuyển K50 Đợt 1
    chi_tieu INT NOT NULL DEFAULT 100,
    trang_thai TEXT NOT NULL DEFAULT 'DANG_XET_DUYET', -- DANG_XET_DUYET, DA_CHOT, DA_DUYET, BI_TRA_VE, DA_KHOA
    approved_by UUID REFERENCES public.profiles(id),
    ghi_chu_tra_ve TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    approved_at TIMESTAMPTZ
);

-- BẢNG 3.8: RANKINGS (BẢNG XẾP HẠNG ĐIỂM ƯU TIÊN REAL-TIME)
CREATE TABLE IF NOT EXISTS public.rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID REFERENCES public.approval_rounds(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    diem_uu_tien NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    thu_hang INT NOT NULL,
    is_trung_tuyen BOOLEAN NOT NULL DEFAULT false, -- Nằm trong chỉ tiêu phòng
    status TEXT NOT NULL DEFAULT 'DU_KIEN', -- DU_KIEN, DA_CHOT
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- BẢNG 3.9: CONTRACTS (HỢP ĐỒNG ĐIỆN TỬ VÀ KÝ OTP TRONG 72H)
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id),
    ma_hop_dong TEXT NOT NULL UNIQUE,
    sign_deadline TIMESTAMPTZ NOT NULL, -- Hạn chót 72h
    otp_code_hash TEXT, -- Lưu SHA256 mã OTP gửi qua email
    status contract_status NOT NULL DEFAULT 'CHO_KY',
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- BẢNG 3.10: NOTIFICATIONS (NHẬT KÝ THÔNG BÁO VÀ GỬI EMAIL TỰ ĐỘNG)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    tieu_de TEXT NOT NULL,
    noi_dung TEXT NOT NULL,
    loai TEXT NOT NULL, -- XAC_NHAN_NOP, YEU_CAU_BO_SUNG, TU_CHOI, TRUNG_TUYEN_KY_HD, HUY_SUAT
    kenh TEXT NOT NULL DEFAULT 'EMAIL',
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, DA_GUI, LOI
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- BẢNG 3.11: AUDIT_LOGS (GHI NHẬT KÝ KIỂM TOÁN MỌI THAY ĐỔI THEO YÊU CẦU MÔN HỌC)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE, AI_REVIEW, APPROVE, REJECT
    entity_name TEXT NOT NULL,
    entity_id UUID,
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 4. TẠO INDEXES TỐI ƯU HIỆU NĂNG CHO CÁC TRUY VẤN REAL-TIME & TRA CỨU
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_apps_student_id ON public.applications(student_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_apps_ma_sv ON public.applications(ma_sv);
CREATE INDEX IF NOT EXISTS idx_evidences_app_id ON public.evidences(application_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_app_id ON public.ai_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_rankings_round_rank ON public.rankings(round_id, thu_hang);
CREATE INDEX IF NOT EXISTS idx_contracts_app_id ON public.contracts(application_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);

-- ==============================================================================
-- 5. FUNCTION & TRIGGER: TỰ ĐỘNG TẠO PROFILE KHI ĐĂNG KÝ SUPABASE AUTH
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role_val public.user_role;
    user_name TEXT;
    student_code TEXT;
BEGIN
    -- Lấy role từ raw_user_meta_data (mặc định là 'SV' nếu không truyền)
    user_role_val := COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'SV'::public.user_role);
    user_name := COALESCE(new.raw_user_meta_data->>'ho_ten', split_part(new.email, '@', 1));
    student_code := new.raw_user_meta_data->>'ma_dinh_danh';

    INSERT INTO public.profiles (id, email, ho_ten, so_dien_thoai, role, ma_dinh_danh)
    VALUES (
        new.id,
        new.email,
        user_name,
        new.raw_user_meta_data->>'so_dien_thoai',
        user_role_val,
        student_code
    )
    ON CONFLICT (id) DO UPDATE
    SET ho_ten = EXCLUDED.ho_ten,
        role = EXCLUDED.role,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kích hoạt trigger trên auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 6. HÀM HỖ TRỢ KIỂM TRA ROLE ĐỂ ÁP DỤNG ROW LEVEL SECURITY (RLS)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS public.user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==============================================================================
-- 7. THIẾT LẬP ROW LEVEL SECURITY (RLS) - BẢO MẬT PHÂN QUYỀN CHUẨN 4 ROLES
-- ==============================================================================

-- BẬT RLS TRÊN TẤT CẢ CÁC BẢNG
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- CHÍNH SÁCH CHO BẢNG PROFILES
-- ------------------------------------------------------------------------------
-- Người dùng xem profile của chính mình; Cán bộ (HC, QLSV, TB) được xem danh sách profile
CREATE POLICY "Profiles: Users see own profile or staff see all"
ON public.profiles FOR SELECT
USING (
    auth.uid() = id OR public.get_current_role() IN ('HC', 'QLSV', 'TB')
);

-- Người dùng tự cập nhật thông tin cá nhân của mình
CREATE POLICY "Profiles: Users update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- CHÍNH SÁCH CHO BẢNG APPLICATIONS (HỒ SƠ ĐĂNG KÝ)
-- ------------------------------------------------------------------------------
-- Sinh viên chỉ xem hồ sơ của mình; Cán bộ xem toàn bộ
CREATE POLICY "Apps: SV sees own application, Staff sees all"
ON public.applications FOR SELECT
USING (
    student_id = auth.uid() OR public.get_current_role() IN ('HC', 'QLSV', 'TB')
);

-- Sinh viên nộp hồ sơ mới (chỉ nộp cho chính mình)
CREATE POLICY "Apps: SV inserts own application"
ON public.applications FOR INSERT
WITH CHECK (
    student_id = auth.uid()
);

-- Sinh viên sửa hồ sơ khi ở trạng thái bổ sung; Cán bộ QLSV và Trưởng ban cập nhật trạng thái
CREATE POLICY "Apps: SV updates when editable, Staff updates per workflow"
ON public.applications FOR UPDATE
USING (
    (student_id = auth.uid() AND status IN ('DA_NOP', 'CAN_BO_SUNG'))
    OR public.get_current_role() IN ('QLSV', 'TB', 'HC')
)
WITH CHECK (
    (student_id = auth.uid() AND status IN ('DA_NOP', 'CAN_BO_SUNG', 'CHO_THAM_DINH'))
    OR public.get_current_role() IN ('QLSV', 'TB', 'HC')
);

-- ------------------------------------------------------------------------------
-- CHÍNH SÁCH CHO BẢNG EVIDENCES (MINH CHỨNG)
-- ------------------------------------------------------------------------------
-- SV xem minh chứng của mình; QLSV và HC xem để thẩm định
CREATE POLICY "Evidences: SV views own, Staff views all"
ON public.evidences FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id = evidences.application_id
        AND (a.student_id = auth.uid() OR public.get_current_role() IN ('QLSV', 'HC', 'TB'))
    )
);

-- SV được tải lên minh chứng cho hồ sơ của mình
CREATE POLICY "Evidences: SV inserts own evidence"
ON public.evidences FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id = evidences.application_id
        AND a.student_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- CHÍNH SÁCH CHO BẢNG AI_LOGS
-- ------------------------------------------------------------------------------
-- Sinh viên chỉ xem kết luận; Cán bộ xem toàn bộ log kỹ thuật
CREATE POLICY "AI Logs: SV views conclusion for own app, Staff sees all"
ON public.ai_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id = ai_logs.application_id
        AND (a.student_id = auth.uid() OR public.get_current_role() IN ('QLSV', 'TB'))
    )
);

-- Service Role / Server Action insert AI logs
CREATE POLICY "AI Logs: Insertable by authenticated backend"
ON public.ai_logs FOR INSERT
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- CHÍNH SÁCH CHO BẢNG RANKINGS (BẢNG XẾP HẠNG REALTIME)
-- ------------------------------------------------------------------------------
-- Cho phép tất cả người dùng đã đăng nhập (hoặc công khai) xem bảng xếp hạng dự kiến
CREATE POLICY "Rankings: Visible to all authenticated users"
ON public.rankings FOR SELECT
TO authenticated
USING (true);

-- Chỉ Cán bộ QLSV và TB được tính toán/cập nhật bảng xếp hạng
CREATE POLICY "Rankings: Manageable by QLSV"
ON public.rankings FOR ALL
USING (public.get_current_role() IN ('QLSV', 'TB'));

-- ------------------------------------------------------------------------------
-- CHÍNH SÁCH CHO BẢNG ROOMS & CONTRACTS
-- ------------------------------------------------------------------------------
CREATE POLICY "Rooms: Read-only for authenticated users"
ON public.rooms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Rooms: Manageable by Staff"
ON public.rooms FOR ALL
USING (public.get_current_role() IN ('QLSV', 'TB', 'HC'));

-- Hợp đồng: SV chỉ xem và ký hợp đồng của mình
CREATE POLICY "Contracts: SV views and signs own contract"
ON public.contracts FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id = contracts.application_id
        AND (a.student_id = auth.uid() OR public.get_current_role() IN ('QLSV', 'TB', 'HC'))
    )
);

CREATE POLICY "Contracts: SV signs contract"
ON public.contracts FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id = contracts.application_id
        AND a.student_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- CHÍNH SÁCH CHO BẢNG NOTIFICATIONS & AUDIT_LOGS
-- ------------------------------------------------------------------------------
CREATE POLICY "Notifications: Users see own notifications"
ON public.notifications FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.applications a
        WHERE a.id = notifications.application_id
        AND (a.student_id = auth.uid() OR public.get_current_role() IN ('QLSV', 'TB', 'HC'))
    )
);

CREATE POLICY "Audit Logs: Only Staff can view"
ON public.audit_logs FOR SELECT
USING (public.get_current_role() IN ('QLSV', 'TB', 'HC'));

CREATE POLICY "Audit Logs: Insertable by system"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- ==============================================================================
-- 8. KÍCH HOẠT SUPABASE REALTIME CHO CÁC BẢNG THEO DÕI TRỰC TIẾP
-- ==============================================================================
-- Thêm rankings và applications vào publication Realtime
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rankings;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_rounds;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- BẬT REPLICA IDENTITY FULL ĐỂ REALTIME NHẬN ĐẦY ĐỦ DỮ LIỆU CŨ VÀ MỚI
ALTER TABLE public.rankings REPLICA IDENTITY FULL;
ALTER TABLE public.applications REPLICA IDENTITY FULL;
ALTER TABLE public.approval_rounds REPLICA IDENTITY FULL;
