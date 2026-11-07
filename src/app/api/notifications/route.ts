import { NextRequest, NextResponse } from 'next/server';
import { getNotificationsForStudent, getAllStoredNotifications } from '@/lib/data/live-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentCode = searchParams.get('studentCode') || searchParams.get('ma_sv') || '';
    const email = searchParams.get('email') || '';
    const studentName = searchParams.get('studentName') || searchParams.get('ho_ten') || '';

    let data: any[] = [];
    if (studentCode) {
      data = getNotificationsForStudent(studentCode, studentName);
      // Nếu tìm theo studentCode không thấy hoặc ít, thử thêm email
      if (email && data.length === 0) {
        data = getNotificationsForStudent(email, studentName);
      }
    } else if (email) {
      data = getNotificationsForStudent(email, studentName);
    } else {
      data = getAllStoredNotifications();
    }

    // Đồng bộ thêm các thông báo từ CSDL Supabase Cloud (nếu có cấu hình)
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabase = createAdminClient();
        let query = supabase
          .from('notifications')
          .select('*')
          .neq('status', 'SYSTEM')
          .order('created_at', { ascending: false });

        if (studentCode && email) {
          query = query.or(`recipient_email.eq.${email},noi_dung.ilike.%${studentCode}%,tieu_de.ilike.%${studentCode}%`);
        } else if (studentCode) {
          query = query.or(`noi_dung.ilike.%${studentCode}%,tieu_de.ilike.%${studentCode}%`);
        } else if (email) {
          query = query.eq('recipient_email', email);
        }

        const { data: sbNotifs } = await query;
        if (sbNotifs && sbNotifs.length > 0) {
          const cleanName = studentName.toLowerCase().trim();
          for (const sn of sbNotifs) {
            // Lọc nếu nội dung hoặc tiêu đề gửi cho người khác
            if (cleanName && sn.noi_dung) {
              const nd = sn.noi_dung.toLowerCase();
              if (nd.includes('kính gửi sinh viên') || nd.includes('chào sinh viên') || nd.includes('chào bạn')) {
                const studentTokens = cleanName.split(/\s+/).filter(Boolean);
                const hasName = studentTokens.some((t) => nd.includes(t));
                if (!hasName) continue;
              }
            }

            const exists = data.some(
              (d) =>
                d.id === sn.id ||
                (d.tieu_de === sn.tieu_de && Math.abs(new Date(d.created_at).getTime() - new Date(sn.created_at).getTime()) < 60000)
            );
            if (!exists) {
              data.unshift({
                id: sn.id,
                application_id: sn.application_id,
                recipient_email: sn.recipient_email,
                student_code: studentCode,
                student_name: studentName,
                tieu_de: sn.tieu_de,
                noi_dung: sn.noi_dung,
                loai: sn.loai,
                status: sn.status || 'DA_GUI',
                created_at: sn.created_at || sn.sent_at,
              });
            }
          }
        }
      } catch (sbErr) {
        console.warn('Lỗi đọc Supabase notifications:', sbErr);
      }
    }

    // Sắp xếp thông báo mới nhất lên đầu
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi khi lấy danh sách thông báo' },
      { status: 500 }
    );
  }
}
