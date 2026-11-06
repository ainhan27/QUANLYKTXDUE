// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// API ROUTE: LẤY DANH SÁCH HỒ SƠ ĐÃ NỘP & ĐỒNG BỘ BẢNG XẾP HẠNG REAL-TIME
// ĐỒNG BỘ TỰ ĐỘNG GIỮA SUPABASE CLOUD VÀ BỘ NHỚ LOCAL STORE
// ==============================================================================

import { NextResponse } from 'next/server';
import { getAllStoredApplications } from '@/lib/data/live-store';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Nếu có cấu hình Supabase Cloud -> Ưu tiên lấy trực tiếp từ CSDL tập trung
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from('applications')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return NextResponse.json({ success: true, data, source: 'supabase' });
        }
      } catch (sbErr) {
        console.warn('Lỗi kết nối Supabase, tự động chuyển về fallback local:', sbErr);
      }
    }

    // 2. Fallback bộ nhớ lưu trữ file nội bộ
    const list = getAllStoredApplications();
    return NextResponse.json({ success: true, data: list, source: 'local' });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Lỗi lấy dữ liệu' },
      { status: 500 }
    );
  }
}
