import { NextRequest, NextResponse } from 'next/server';
import { getNotificationsForStudent, getAllStoredNotifications } from '@/lib/data/live-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentCode = searchParams.get('studentCode') || searchParams.get('ma_sv') || '';
    const email = searchParams.get('email') || '';

    let data;
    if (studentCode) {
      data = getNotificationsForStudent(studentCode);
      // Nếu tìm theo studentCode không thấy hoặc ít, thử thêm email
      if (email && data.length === 0) {
        data = getNotificationsForStudent(email);
      }
    } else if (email) {
      data = getNotificationsForStudent(email);
    } else {
      data = getAllStoredNotifications();
    }

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
