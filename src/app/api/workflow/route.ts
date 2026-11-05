// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// API ROUTE ĐIỀU PHỐI TIẾN TRÌNH QUY TRÌNH 10 BƯỚC (WORKFLOW DISPATCHER)
// LIÊN THÔNG REAL-TIME GIỮA BXH (BƯỚC 3) -> BƯỚC 6 -> 7 -> 8 -> 9 -> 10
// ==============================================================================

import { NextResponse } from 'next/server';
import {
  getWorkflowState,
  saveWorkflowState,
  resetWorkflowState,
  addDirectorDirectiveToStore,
  dismissDirectorDirectiveInStore,
} from '@/lib/data/live-store';

export async function GET() {
  try {
    const state = getWorkflowState();
    const { getAllStoredApplications } = await import('@/lib/data/live-store');
    const storedApps = getAllStoredApplications();
    const pendingApps = storedApps.filter(
      (a) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
    );
    return NextResponse.json({
      success: true,
      workflow: state,
      pendingEvidenceCount: pendingApps.length,
      pendingStudents: pendingApps.map((a) => ({
        id: a.id,
        ma_sv: a.ma_sv,
        ho_ten: a.ho_ten,
        status: a.status,
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Lỗi lấy trạng thái quy trình' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'reset') {
      const reset = resetWorkflowState();
      return NextResponse.json({ success: true, workflow: reset });
    }

    if (action === 'approve_all_pending') {
      const { getAllStoredApplications, saveApplicationToStore } = await import('@/lib/data/live-store');
      const apps = getAllStoredApplications();
      apps.forEach((a) => {
        if (a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG') {
          a.status = 'THAM_DINH_DAT';
          if (!a.diem_uu_tien || a.diem_uu_tien === 0) a.diem_uu_tien = 35;
          saveApplicationToStore(a);
        }
      });
      return NextResponse.json({ success: true, count: apps.length });
    }

    if (action === 'return_to_officer') {
      // XOR 3: Trưởng ban gửi thông báo trả về điều chỉnh cho Cán bộ QLSV
      const reason = body.reason || 'Trưởng ban KTX yêu cầu bộ phận QLSV rà soát điều chỉnh lại cơ cấu chỉ tiêu và hồ sơ minh chứng.';
      const updated = addDirectorDirectiveToStore({
        type: 'TRA_VE',
        title: 'Trưởng Ban KTX Yêu Cầu Điều Chỉnh Danh Sách (XOR 3)',
        message: reason,
        sender: 'ThS. Nguyễn Văn Quản – Trưởng Ban Quản lý KTX',
      });
      saveWorkflowState({
        isRankingsFinalized: false,
        isPublished: false,
      });
      return NextResponse.json({ success: true, workflow: getWorkflowState() });
    }

    if (action === 'dismiss_directive') {
      const directiveId = body.directiveId;
      const updated = dismissDirectorDirectiveInStore(directiveId);
      return NextResponse.json({ success: true, workflow: updated });
    }

    if (action === 'approve_by_director') {
      // KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT: CÁN BỘ QLSV PHẢI DUYỆT XONG TẤT CẢ MINH CHỨNG
      const { getAllStoredApplications } = await import('@/lib/data/live-store');
      const storedApps = getAllStoredApplications();
      const pendingApps = storedApps.filter(
        (a) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
      );
      if (pendingApps.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Chưa thể phê duyệt: Vẫn còn ${pendingApps.length} hồ sơ minh chứng đang chờ Cán bộ QLSV thẩm định. Cán bộ QLSV phải duyệt xong tất cả các minh chứng mới được công bố danh sách.`,
            pendingCount: pendingApps.length,
          },
          { status: 400 }
        );
      }

      // BƯỚC 3A: Trưởng ban ký duyệt danh sách chính thức (isRankingsFinalized = true, isPublished = false)
      addDirectorDirectiveToStore({
        type: 'PHE_DUYET',
        title: 'Trưởng Ban KTX Đã Ký Duyệt Quyết Định B2 – Chuyển QLSV Phát Hành Email',
        message:
          'Trưởng ban Quản lý KTX đã ký quyết định phê duyệt danh sách chính thức (B2). Hệ thống AI đã soạn sẵn 120 email trúng tuyển kèm Hợp đồng điện tử. Đề nghị Cán bộ QLSV kiểm tra các dự thảo và bấm xác nhận phát hành gửi đến cho toàn bộ sinh viên.',
        sender: 'ThS. Nguyễn Văn Quản – Trưởng Ban Quản lý KTX',
      });
      const updated = saveWorkflowState({
        isRankingsFinalized: true,
        isPublished: false,
        assignedRoom: 'Phòng 301 - Khu A (4 người)',
        isSigned: false,
      });
      return NextResponse.json({ success: true, workflow: updated });
    }

    if (action === 'send_by_officer') {
      // BƯỚC 3B: Cán bộ QLSV gửi email AI soạn sẵn cho sinh viên (isPublished = true)
      const deadline72h = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const updated = saveWorkflowState({
        isRankingsFinalized: true,
        isPublished: true,
        publishedAt: new Date().toISOString(),
        signDeadline: deadline72h,
        assignedRoom: 'Phòng 301 - Khu A (4 người)',
        isSigned: false,
      });
      return NextResponse.json({ success: true, workflow: updated });
    }

    if (action === 'finalize') {
      // KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT: CÁN BỘ QLSV PHẢI DUYỆT XONG TẤT CẢ MINH CHỨNG
      const { getAllStoredApplications } = await import('@/lib/data/live-store');
      const storedApps = getAllStoredApplications();
      const pendingApps = storedApps.filter(
        (a) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
      );
      if (pendingApps.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Chưa thể công bố danh sách: Vẫn còn ${pendingApps.length} hồ sơ minh chứng đang chờ Cán bộ QLSV thẩm định. Cán bộ QLSV phải duyệt xong tất cả các minh chứng mới được công bố danh sách.`,
            pendingCount: pendingApps.length,
          },
          { status: 400 }
        );
      }

      // BƯỚC 6 & 7: Chốt Bảng xếp hạng & Phát hành hàng loạt (gộp nếu cần)
      const deadline72h = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const updated = saveWorkflowState({
        isRankingsFinalized: true,
        isPublished: true,
        publishedAt: new Date().toISOString(),
        signDeadline: deadline72h,
        assignedRoom: 'Phòng 301 - Khu A (4 người)',
        isSigned: false,
      });
      return NextResponse.json({ success: true, workflow: updated });
    }

    if (action === 'sign') {
      // BƯỚC 8: Sinh viên Ký hợp đồng điện tử (SIGNED)
      const updated = saveWorkflowState({
        currentStep: 9,
        isSigned: true,
        signedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, workflow: updated });
    }

    if (action === 'handover') {
      // BƯỚC 9: Bàn giao phòng & chìa khóa
      const updated = saveWorkflowState({
        currentStep: 9,
        isHandedOver: true,
      });
      return NextResponse.json({ success: true, workflow: updated });
    }

    if (action === 'cancel') {
      // BƯỚC 10: Xử lý quá hạn 72h / Thu hồi phòng & Mở đợt 2
      const updated = saveWorkflowState({
        currentStep: 10,
        isCancelled: true,
      });
      return NextResponse.json({ success: true, workflow: updated });
    }

    // Default patch
    if (body.patch) {
      const updated = saveWorkflowState(body.patch);
      return NextResponse.json({ success: true, workflow: updated });
    }

    return NextResponse.json({ success: true, workflow: getWorkflowState() });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Lỗi xử lý quy trình' },
      { status: 500 }
    );
  }
}
