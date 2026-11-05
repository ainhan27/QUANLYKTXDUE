// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// API ROUTE: LẤY DANH SÁCH HỒ SƠ ĐÃ NỘP & ĐỒNG BỘ BẢNG XẾP HẠNG REAL-TIME
// ==============================================================================

import { NextResponse } from 'next/server';
import { getAllStoredApplications } from '@/lib/data/live-store';

export async function GET() {
  try {
    const list = getAllStoredApplications();
    return NextResponse.json({ success: true, data: list });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Lỗi lấy dữ liệu' },
      { status: 500 }
    );
  }
}
