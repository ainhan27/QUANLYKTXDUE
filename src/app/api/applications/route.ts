// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// API ROUTE: LẤY DANH SÁCH HỒ SƠ ĐÃ NỘP & ĐỒNG BỘ BẢNG XẾP HẠNG REAL-TIME
// ĐỒNG BỘ TỰ ĐỘNG GIỮA SUPABASE CLOUD VÀ BỘ NHỚ LOCAL STORE
// ==============================================================================

import { NextResponse } from 'next/server';
import { getAllStoredApplications, deleteApplicationFromStore } from '@/lib/data/live-store';
import { createAdminClient } from '@/lib/supabase/admin';
import { PRIORITY_POLICY_POINTS } from '@/lib/constants/workflow';

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
          const enriched = data.map((app: any) => {
            let cccdImg = app.cccd_image_base64;
            let priorityImg = app.priority_image_base64;
            if (app.file_url) {
              try {
                if (app.file_url.startsWith('{')) {
                  const parsed = JSON.parse(app.file_url);
                  cccdImg = cccdImg || parsed.cccd;
                  priorityImg = priorityImg || parsed.priority;
                } else if (app.file_url.startsWith('data:')) {
                  cccdImg = cccdImg || app.file_url;
                }
              } catch {}
            }
            return {
              ...app,
              dien_uu_tien_label:
                app.dien_uu_tien_label ||
                PRIORITY_POLICY_POINTS[app.dien_uu_tien]?.label ||
                (app.dien_uu_tien && app.dien_uu_tien !== 'KHONG'
                  ? app.dien_uu_tien
                  : 'Không thuộc diện ưu tiên chính sách'),
              cccd_image_base64: cccdImg,
              priority_image_base64: priorityImg,
            };
          });
          return NextResponse.json({ success: true, data: enriched, source: 'supabase' });
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

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id, ma_sv, cccd } = body;

    if (!id && !ma_sv && !cccd) {
      return NextResponse.json({ success: false, error: 'Thiếu định danh hồ sơ để xóa' }, { status: 400 });
    }

    // 1. Xóa trong Supabase nếu có
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      try {
        const supabase = createAdminClient();
        const isUuid = (val: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        if (id && isUuid(id)) {
          await supabase.from('applications').delete().eq('id', id);
        } else if (cccd) {
          await supabase.from('applications').delete().eq('cccd', cccd);
        } else if (ma_sv) {
          await supabase.from('applications').delete().eq('ma_sv', ma_sv);
        }
      } catch (sbErr) {
        console.warn('Lỗi xóa trên Supabase:', sbErr);
      }
    }

    // 2. Xóa trong local store
    if (id) deleteApplicationFromStore(id);
    if (ma_sv) deleteApplicationFromStore(ma_sv);
    if (cccd) deleteApplicationFromStore(cccd);

    return NextResponse.json({ success: true, message: 'Đã xóa hồ sơ thành công' });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Lỗi xóa hồ sơ' },
      { status: 500 }
    );
  }
}
