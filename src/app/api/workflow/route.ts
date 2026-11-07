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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function syncWorkflowStateToSupabase(state: any) {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();
      await supabase.from('notifications').insert({
        loai: 'SYSTEM_WORKFLOW_STATE',
        tieu_de: 'round-k50-dot1',
        noi_dung: JSON.stringify(state),
        status: 'SYSTEM',
        recipient_email: 'system@due.edu.vn',
      });
    } catch (e) {
      console.warn('Lỗi sync workflow state to Supabase:', e);
    }
  }
}

export async function GET() {
  try {
    let state = getWorkflowState();
    let storedApps: any[] = [];

    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabase = createAdminClient();

        // 1. Đọc trạng thái workflow từ CSDL tập trung Supabase (chống lệch state giữa các serverless container)
        const { data: wfRows } = await supabase
          .from('notifications')
          .select('noi_dung')
          .eq('loai', 'SYSTEM_WORKFLOW_STATE')
          .order('created_at', { ascending: false })
          .limit(1);

        if (wfRows && wfRows.length > 0 && wfRows[0].noi_dung) {
          try {
            const parsed = JSON.parse(wfRows[0].noi_dung);
            state = { ...state, ...parsed };
          } catch {}
        }

        const { data } = await supabase.from('applications').select('*');
        if (data && data.length > 0) {
          storedApps = data;
        }
      } catch (err) {
        console.warn('Lỗi đọc Supabase trong workflow GET:', err);
      }
    }

    if (storedApps.length === 0) {
      const { getAllStoredApplications } = await import('@/lib/data/live-store');
      storedApps = getAllStoredApplications();
    }

    const pendingApps = storedApps.filter(
      (a: any) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
    );
    const approvedApps = storedApps.filter(
      (a: any) =>
        a.status === 'THAM_DINH_DAT' ||
        a.status === 'DA_XEP_HANG' ||
        a.status === 'DA_PHAT_HANH' ||
        a.status === 'DA_KY'
    );
    return NextResponse.json({
      success: true,
      workflow: state,
      pendingEvidenceCount: pendingApps.length,
      approvedEvidenceCount: approvedApps.length,
      totalEvidenceCount: storedApps.length,
      pendingStudents: pendingApps.map((a: any) => ({
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
      await syncWorkflowStateToSupabase(reset);
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

      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) {
        try {
          const { createAdminClient } = await import('@/lib/supabase/admin');
          const supabase = createAdminClient();
          await supabase
            .from('applications')
            .update({ status: 'THAM_DINH_DAT', diem_uu_tien: 35 })
            .in('status', ['CHO_THAM_DINH', 'CAN_BO_SUNG']);
        } catch (e) {
          console.warn('Lỗi cập nhật Supabase trong approve_all_pending:', e);
        }
      }

      return NextResponse.json({ success: true, count: apps.length });
    }

    if (action === 'approve_evidence') {
      const { applicationId, studentCode, points } = body;
      const pts = Number(points) || 35;
      const { getAllStoredApplications, saveApplicationToStore } = await import('@/lib/data/live-store');
      const apps = getAllStoredApplications();
      const target = apps.find((a) => a.id === applicationId || (studentCode && a.ma_sv === studentCode));
      if (target) {
        target.status = 'THAM_DINH_DAT';
        target.diem_uu_tien = pts;
        saveApplicationToStore(target);
      }

      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) {
        try {
          const { createAdminClient } = await import('@/lib/supabase/admin');
          const supabase = createAdminClient();
          if (studentCode) {
            await supabase
              .from('applications')
              .update({ status: 'THAM_DINH_DAT', diem_uu_tien: pts })
              .or(`id.eq.${applicationId},ma_sv.eq.${studentCode}`);
          } else {
            await supabase
              .from('applications')
              .update({ status: 'THAM_DINH_DAT', diem_uu_tien: pts })
              .eq('id', applicationId);
          }
        } catch (e) {
          console.warn('Lỗi cập nhật Supabase trong approve_evidence:', e);
        }
      }

      return NextResponse.json({ success: true, message: 'Đã lưu quyết định duyệt vào database' });
    }

    if (action === 'return_to_officer') {
      // Trưởng ban gửi thông báo trả về điều chỉnh cho Cán bộ QLSV
      const reason = body.reason || 'Trưởng ban KTX yêu cầu bộ phận QLSV rà soát điều chỉnh lại cơ cấu chỉ tiêu và hồ sơ minh chứng.';
      const updated = addDirectorDirectiveToStore({
        type: 'TRA_VE',
        title: 'Trưởng Ban KTX Yêu Cầu Cán Bộ Rà Soát Điều Chỉnh Danh Sách',
        message: reason,
        sender: 'ThS. Nguyễn Văn Quản – Trưởng Ban Quản lý KTX',
      });
      const wfState = saveWorkflowState({
        isRankingsFinalized: false,
        isPublished: false,
      });
      await syncWorkflowStateToSupabase(wfState);
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
      let storedApps: any[] = [];
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) {
        try {
          const { createAdminClient } = await import('@/lib/supabase/admin');
          const supabase = createAdminClient();
          const { data } = await supabase.from('applications').select('*');
          if (data && data.length > 0) storedApps = data;
        } catch {}
      }
      if (storedApps.length === 0) {
        storedApps = getAllStoredApplications();
      }

      const pendingApps = storedApps.filter(
        (a: any) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
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
        title: 'Trưởng Ban KTX Đã Ký Quyết Định Phê Duyệt Danh Sách Chính Thức (Quyết Định B2)',
        message:
          'Trưởng ban Quản lý KTX đã ký quyết định phê duyệt danh sách trúng tuyển chính thức Đợt 1 (Quyết định B2). Quyết định đã ban hành và có hiệu lực thi hành.',
        sender: 'ThS. Nguyễn Văn Quản – Trưởng Ban Quản lý KTX',
      });
      const updated = saveWorkflowState({
        isRankingsFinalized: true,
        isPublished: false,
        assignedRoom: 'Phòng 301 - Khu A (4 người)',
        isSigned: false,
      });
      await syncWorkflowStateToSupabase(updated);
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
      await syncWorkflowStateToSupabase(updated);
      return NextResponse.json({ success: true, workflow: updated });
    }

    if (action === 'finalize') {
      // KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT: CÁN BỘ QLSV PHẢI DUYỆT XONG TẤT CẢ MINH CHỨNG
      const { getAllStoredApplications } = await import('@/lib/data/live-store');
      let storedApps: any[] = [];
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) {
        try {
          const { createAdminClient } = await import('@/lib/supabase/admin');
          const supabase = createAdminClient();
          const { data } = await supabase.from('applications').select('*');
          if (data && data.length > 0) storedApps = data;
        } catch {}
      }
      if (storedApps.length === 0) {
        storedApps = getAllStoredApplications();
      }

      const pendingApps = storedApps.filter(
        (a: any) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
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
      await syncWorkflowStateToSupabase(updated);
      return NextResponse.json({ success: true, workflow: updated });
    }

    if (action === 'sign') {
      // BƯỚC 8: Sinh viên Ký hợp đồng điện tử (SIGNED)
      const studentCode = body.studentCode || body.ma_sv || body.applicationId;
      if (studentCode) {
        const { updateApplicationStatusInStore } = await import('@/lib/data/live-store');
        updateApplicationStatusInStore(studentCode, 'DA_KY');

        if (
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id') &&
          process.env.SUPABASE_SERVICE_ROLE_KEY
        ) {
          try {
            const { createAdminClient } = await import('@/lib/supabase/admin');
            const supabase = createAdminClient();
            await supabase
              .from('applications')
              .update({ status: 'DA_KY', updated_at: new Date().toISOString() })
              .or(`ma_sv.eq.${studentCode},id.eq.${studentCode}`);
            await supabase
              .from('contracts')
              .update({ status: 'DA_KY', signed_at: new Date().toISOString() })
              .or(`application_id.eq.${studentCode}`);
          } catch (e) {
            console.warn('Lỗi sync sign status lên Supabase:', e);
          }
        }
      }

      const updated = saveWorkflowState({
        currentStep: 9,
        isSigned: true,
        signedAt: new Date().toISOString(),
      });
      await syncWorkflowStateToSupabase(updated);
      return NextResponse.json({ success: true, workflow: updated });
    }

    if (action === 'handover') {
      // BƯỚC 9: Bàn giao phòng & chìa khóa
      const updated = saveWorkflowState({
        currentStep: 9,
        isHandedOver: true,
      });
      await syncWorkflowStateToSupabase(updated);
      return NextResponse.json({ success: true, workflow: updated });
    }

    if (action === 'cancel') {
      // BƯỚC 10: Xử lý quá hạn 72h / Thu hồi phòng & Mở đợt 2
      const updated = saveWorkflowState({
        currentStep: 10,
        isCancelled: true,
      });
      await syncWorkflowStateToSupabase(updated);
      return NextResponse.json({ success: true, workflow: updated });
    }

    // Default patch
    if (body.patch) {
      const updated = saveWorkflowState(body.patch);
      await syncWorkflowStateToSupabase(updated);
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
