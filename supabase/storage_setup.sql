-- ==============================================================================
-- CẤU HÌNH SUPABASE STORAGE CHO MINH CHỨNG NỘI TRÚ (PRIVATE BUCKET)
-- ==============================================================================

-- 1. TẠO PRIVATE BUCKET 'evidences'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evidences',
    'evidences',
    false, -- Private bucket (Bắt buộc dùng Signed URL, không public URL)
    10485760, -- 10MB tối đa
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 2. THIẾT LẬP CHÍNH SÁCH STORAGE RLS CHO BUCKET 'evidences'

-- Chính sách 2.1: Sinh viên được quyền upload file vào thư mục mang mã ID của chính mình
CREATE POLICY "Evidences Storage: SV uploads to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'evidences' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Chính sách 2.2: Sinh viên chỉ được xem và tải file của chính mình
CREATE POLICY "Evidences Storage: SV views own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'evidences' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Chính sách 2.3: Cán bộ QLSV, Hành chính và Trưởng ban được quyền xem toàn bộ minh chứng để thẩm định
CREATE POLICY "Evidences Storage: Staff views all files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'evidences'
    AND public.get_current_role() IN ('QLSV', 'HC', 'TB')
);
