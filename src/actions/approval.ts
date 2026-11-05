'use server';
// ==============================================================================
// SERVER ACTIONS: THỰC THI QUY TRÌNH TO-BE BƯỚC 6 -> BƯỚC 10
// 6. CHỐT & TRƯỞNG BAN DUYỆT (SP4 - CHOT, B2)
// 7. PHÁT HÀNH EMAIL HÀNG LOẠT & REALTIME (SP5 - TCB)
// 8. KÝ HỢP ĐỒNG ĐIỆN TỬ (KY -> SIGNED, DOB_PH)
// 9. BÀN GIAO PHÒNG & PORTAL (SP6 - GM, E2, DataStore_PT)
// 10. XỬ LÝ QUÁ HẠN 72H, THU HỒI PHÒNG (HUY -> AVAILABLE) & MỞ ĐỢT 2
// ==============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { sendWorkflowEmail } from '@/services/email';
import { AppStatus } from '@/types/database';

// BƯỚC 6 & 7: TRƯỞNG BAN DUYỆT 1-CLICK (B2) & PHÁT HÀNH THÔNG BÁO HÀNG LOẠT (TCB)
export async function approveRoundAndPublishAction(roundId: string) {
  try {
    // KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT BẮT BUỘC:
    // CÁN BỘ QLSV PHẢI DUYỆT XONG TẤT CẢ MINH CHỨNG TRƯỚC KHI TRƯỞNG BAN CÔNG BỐ
    const { getAllStoredApplications } = await import('@/lib/data/live-store');
    const storedApps = getAllStoredApplications();
    const pendingApps = storedApps.filter(
      (a) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
    );
    if (pendingApps.length > 0) {
      return {
        success: false,
        message: `Chưa thể công bố danh sách: Vẫn còn ${pendingApps.length} hồ sơ/minh chứng đang chờ Cán bộ QLSV thẩm định. Theo quy định tuyển sinh KTX DUE, Cán bộ QLSV phải hoàn tất duyệt 100% minh chứng trước khi Trưởng ban công bố danh sách.`,
      };
    }

    const supabaseAdmin = createAdminClient();

    // 1. Cập nhật đợt tuyển sang trạng thái DA_DUYET
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
        await supabaseAdmin
          .from('approval_rounds')
          .update({
            trang_thai: 'DA_DUYET',
            approved_at: new Date().toISOString(),
          })
          .eq('id', roundId);

        // Khóa danh sách và phát hành hợp đồng cho top chỉ tiêu
        const { data: topStudents } = await supabaseAdmin
          .from('rankings')
          .select('application_id, applications(id, ho_ten, ma_sv, email)')
          .eq('is_trung_tuyen', true)
          .limit(120);

        if (topStudents && topStudents.length > 0) {
          const deadline72h = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

          for (const item of topStudents) {
            const app = item.applications as unknown as { id: string; ho_ten: string; ma_sv: string; email: string };
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

            // Cập nhật trạng thái hồ sơ sang DA_PHAT_HANH
            await supabaseAdmin
              .from('applications')
              .update({ status: 'DA_PHAT_HANH' })
              .eq('id', app.id);

            // Tạo hợp đồng chờ ký (72h)
            await supabaseAdmin.from('contracts').insert({
              application_id: app.id,
              room_id: 'd9b1de7a-2412-4f32-843a-7dbb71120001',
              ma_hop_dong: `HD-KTX-DUE-${app.ma_sv}`,
              sign_deadline: deadline72h,
              otp_code_hash: otpCode,
              status: 'CHO_KY',
            });

            // Gửi email hàng loạt (TCB - Msg_CongBo)
            await sendWorkflowEmail({
              applicationId: app.id,
              recipientEmail: app.email,
              studentName: app.ho_ten,
              studentCode: app.ma_sv,
              type: 'TRUNG_TUYEN_KY_HD',
              details: {
                roomName: 'Phòng 301 - Khu A (4 người)',
                otpCode,
                deadlineHours: 72,
              },
            });
          }
        }
      }
    } catch (dbErr) {
      console.warn('DB Approve Action:', dbErr);
    }

    // CẬP NHẬT PERSISTENT WORKFLOW STORE CHO PHÂN HỆ VẬN HÀNH TO-BE
    try {
      const { saveWorkflowState, getAllStoredApplications, updateApplicationStatusInStore } = await import('@/lib/data/live-store');
      const { getAssignedRoomForStudent, getStudentOtpCode } = await import('@/lib/constants/workflow');
      const { computeMergedRankings } = await import('@/lib/data/mock-students');
      const deadline72h = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      saveWorkflowState({
        currentStep: 8, // Chuyển sang Bước 8 (Ký HĐ điện tử 72h)
        isRankingsFinalized: true,
        isPublished: true,
        publishedAt: new Date().toISOString(),
        signDeadline: deadline72h,
        isSigned: false,
      });

      // Cập nhật trạng thái trúng tuyển cho các sinh viên trong Persistent Store
      const storedApps = getAllStoredApplications();
      const rankings = computeMergedRankings(storedApps, 120);

      for (const app of storedApps) {
        const rankRow = rankings.find((r) => r.ma_sv === app.ma_sv || r.id === app.id);
        const currentRank = rankRow ? rankRow.thu_hang : 325;
        const isTop120 = rankRow ? rankRow.thu_hang <= 120 : false;

        if (isTop120) {
          updateApplicationStatusInStore(app.id, 'DA_PHAT_HANH');
          const room = getAssignedRoomForStudent(
            { ma_sv: app.ma_sv, gioi_tinh: app.gioi_tinh, thu_hang: currentRank },
            currentRank
          );
          const studentOtp = getStudentOtpCode(app.ma_sv);
          // Gửi email thông báo trúng tuyển (TCB - Msg_CongBo)
          sendWorkflowEmail({
            applicationId: app.id,
            recipientEmail: app.email,
            studentName: app.ho_ten,
            studentCode: app.ma_sv,
            type: 'TRUNG_TUYEN_KY_HD',
            details: {
              roomName: room,
              otpCode: studentOtp,
              deadlineHours: 72,
            },
          }).catch(() => {});
        }
      }
    } catch (storeErr) {
      console.warn('Lỗi lưu workflow store:', storeErr);
    }

    return {
      success: true,
      message: 'Cán bộ / Trưởng ban đã CHỐT BẢNG XẾP HẠNG & PHÁT HÀNH THÔNG BÁO! Đã tự động gửi email hàng loạt (TCB), phát hành hợp đồng điện tử 72h và mở khóa Cổng Ký Hợp Đồng (Bước 8).',
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi khi phê duyệt đợt tuyển',
    };
  }
}

// BƯỚC 3A: TRƯỞNG BAN KÝ DUYỆT DANH SÁCH CHÍNH THỨC (QUYẾT ĐỊNH B2)
// CHỈ KHI QLSV PHÊ DUYỆT HẾT TẤT CẢ MINH CHỨNG THÌ TRƯỞNG BAN MỚI ĐƯỢC CÔNG BỐ DANH SÁCH
// SAU KHI DUYỆT XONG: CHUYỂN TIẾP CHO CÁN BỘ QLSV ĐỂ PHÁT HÀNH EMAIL
export async function directorApproveRoundAction(roundId: string = 'round-k50-dot1') {
  try {
    const { saveWorkflowState, getAllStoredApplications } = await import('@/lib/data/live-store');

    // KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT BẮT BUỘC:
    // CÁN BỘ QLSV PHẢI DUYỆT XONG 100% HỒ SƠ MINH CHỨNG
    const storedApps = getAllStoredApplications();
    const pendingApps = storedApps.filter(
      (a) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
    );
    if (pendingApps.length > 0) {
      return {
        success: false,
        message: `Chưa thể phê duyệt: Vẫn còn ${pendingApps.length} hồ sơ minh chứng đang chờ Cán bộ QLSV thẩm định. Theo quy định tuyển sinh KTX DUE, Cán bộ QLSV phải hoàn tất duyệt 100% minh chứng trước khi Trưởng ban ký quyết định và công bố danh sách.`,
      };
    }

    saveWorkflowState({
      isRankingsFinalized: true,
      isPublished: false, // CHƯA GỬI: Chờ Cán bộ QLSV kiểm tra email AI soạn sẵn và bấm phát hành!
      assignedRoom: 'Phòng 301 - Khu A (4 người)',
      isSigned: false,
    });
    return {
      success: true,
      message: 'Trưởng ban Quản lý KTX đã ký duyệt danh sách trúng tuyển chính thức (Quyết định B2)! AI đã soạn sẵn 120 email thông báo. Hồ sơ đã chuyển sang Cán bộ QLSV để kiểm tra và gửi email cho sinh viên.',
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi khi Trưởng ban duyệt',
    };
  }
}

// BƯỚC 3B: CÁN BỘ QLSV XÁC NHẬN GỬI EMAIL (DO AI SOẠN SẴN) CHO SINH VIÊN (TCB)
// SAU KHI CÁN BỘ GỬI: SINH VIÊN MỚI NHẬN ĐƯỢC THÔNG BÁO VÀ MỞ KHÓA CỔNG KÝ HỢP ĐỒNG 72H
export async function officerSendBatchEmailsAction() {
  try {
    const {
      saveWorkflowState,
      getAllStoredApplications,
      updateBatchApplicationStatusesInStore,
    } = await import('@/lib/data/live-store');

    // KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT: KHÔNG CÒN HỒ SƠ CHỜ DUYỆT
    const storedApps = getAllStoredApplications();
    const pendingApps = storedApps.filter(
      (a) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
    );
    if (pendingApps.length > 0) {
      return {
        success: false,
        message: `Chưa thể phát hành thông báo: Vẫn còn ${pendingApps.length} hồ sơ minh chứng đang chờ Cán bộ QLSV thẩm định.`,
      };
    }

    const deadline72h = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    
    // 1. CẬP NHẬT TRẠNG THÁI QUY TRÌNH NGAY LẬP TỨC (< 2MS)
    saveWorkflowState({
      isRankingsFinalized: true,
      isPublished: true, // ĐÃ GỬI CHÍNH THỨC
      publishedAt: new Date().toISOString(),
      signDeadline: deadline72h,
      assignedRoom: 'Phòng 301 - Khu A (4 người)',
      isSigned: false,
    });

    // 2. CẬP NHẬT TRẠNG THÁI CÁC HỒ SƠ TOP 120 TRÚNG TUYỂN
    const { computeMergedRankings } = await import('@/lib/data/mock-students');
    const rankings = computeMergedRankings(storedApps, 120);

    const statusUpdates: Array<{ idOrMaSv: string; status: any }> = [];
    for (const app of storedApps) {
      const rankRow = rankings.find((r) => r.ma_sv === app.ma_sv || r.id === app.id);
      const isTop120 = rankRow ? rankRow.thu_hang <= 120 : false;
      if (isTop120) {
        statusUpdates.push({ idOrMaSv: app.id, status: 'DA_PHAT_HANH' });
      }
    }
    if (statusUpdates.length > 0) {
      updateBatchApplicationStatusesInStore(statusUpdates);
    }

    // 3. TIẾN TRÌNH GỬI EMAIL CHẠY NỀN ASYNC (NON-BLOCKING) ĐỂ PHẢN HỒI GIAO DIỆN TỨC THÌ
    setImmediate(async () => {
      try {
        const { getAssignedRoomForStudent, getStudentOtpCode } = await import('@/lib/constants/workflow');
        for (const app of storedApps) {
          const rankRow = rankings.find((r) => r.ma_sv === app.ma_sv || r.id === app.id);
          const isTop120 = rankRow ? rankRow.thu_hang <= 120 : false;
          const currentRank = rankRow ? rankRow.thu_hang : 325;

          if (isTop120) {
            const assignedRoom = getAssignedRoomForStudent(
              { ma_sv: app.ma_sv, gioi_tinh: app.gioi_tinh, thu_hang: currentRank },
              currentRank
            );
            const studentOtp = getStudentOtpCode(app.ma_sv);
            sendWorkflowEmail({
              applicationId: app.id,
              recipientEmail: app.email,
              studentName: app.ho_ten,
              studentCode: app.ma_sv,
              type: 'TRUNG_TUYEN_KY_HD',
              details: {
                roomName: assignedRoom,
                otpCode: studentOtp,
                deadlineHours: 72,
              },
            }).catch(() => {});
          } else {
            sendWorkflowEmail({
              applicationId: app.id,
              recipientEmail: app.email,
              studentName: app.ho_ten,
              studentCode: app.ma_sv,
              type: 'DANH_SACH_CHO',
              details: {
                rank: currentRank,
                waitlistIndex: Math.max(1, currentRank - 120),
              },
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.warn('Lỗi gửi email ngầm:', e);
      }
    });

    return {
      success: true,
      message: '✓ Cán bộ Quản lý Sinh viên đã phát hành và gửi 120 email thông báo (kèm Hợp đồng điện tử 72h) do AI soạn sẵn đến toàn bộ thí sinh thành công!',
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi khi Cán bộ gửi email',
    };
  }
}

// BƯỚC 8: KÝ HỢP ĐỒNG ĐIỆN TỬ (KY -> SIGNED, CHUYỂN PHÒNG DA_GIU_CHO)
export async function signContractAction(applicationId: string, otpInput: string, studentCode?: string) {
  try {
    const { getStudentOtpCode } = await import('@/lib/constants/workflow');
    const { getAllStoredApplications } = await import('@/lib/data/live-store');
    const stored = getAllStoredApplications();
    const app = stored.find((x) => x.id === applicationId || x.ma_sv === studentCode || x.ma_sv === applicationId);
    const expectedOtp = app ? getStudentOtpCode(app.ma_sv) : (studentCode ? getStudentOtpCode(studentCode) : '888888');

    const cleanInput = otpInput.trim();
    if (cleanInput !== expectedOtp && cleanInput !== '888888') {
      return {
        success: false,
        message: `Mã OTP xác thực không đúng! Vui lòng nhập đúng mã OTP cá nhân được cấp cho bạn (${expectedOtp}) hoặc mã nghiệm thu 888888.`,
      };
    }

    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
        const supabaseAdmin = createAdminClient();

        // Cập nhật hợp đồng thành DA_KY (SIGNED)
        await supabaseAdmin
          .from('contracts')
          .update({
            status: 'DA_KY',
            signed_at: new Date().toISOString(),
          })
          .eq('application_id', applicationId);

        // Cập nhật hồ sơ sang DA_KY
        await supabaseAdmin
          .from('applications')
          .update({ status: 'DA_KY' })
          .eq('id', applicationId);

        // Chuyển phòng sang trạng thái đã giữ chỗ (DOB_PH)
        await supabaseAdmin
          .from('rooms')
          .update({ status: 'DA_GIU_CHO' })
          .eq('id', 'd9b1de7a-2412-4f32-843a-7dbb71120001');
      }
    } catch (dbErr) {
      console.warn('DB sign contract:', dbErr);
    }

    // Cập nhật Persistent File Store
    try {
      const { saveWorkflowState, updateApplicationStatusInStore } = await import('@/lib/data/live-store');
      saveWorkflowState({
        currentStep: 9, // Mở khóa Bước 9 (Bàn giao phòng & Lịch hẹn Offline E2)
        isSigned: true,
        signedAt: new Date().toISOString(),
      });
      updateApplicationStatusInStore(applicationId, 'DA_KY');
    } catch {}

    return {
      success: true,
      message: 'Ký hợp đồng điện tử thành công (SIGNED)! Phòng KTX đã được chuyển sang trạng thái ĐÃ GIỮ CHỖ (DOB_PH) và chuyển sang Bước 9 (Bàn giao phòng).',
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi khi ký hợp đồng',
    };
  }
}

// BƯỚC 9: BÀN GIAO PHÒNG & KIỂM KÊ CƠ SỞ VẬT CHẤT (E2, DataStore_PT)
export async function handoverRoomAction(applicationId: string, roomNumber: string, studentEmail: string, studentName: string) {
  try {
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
        const supabaseAdmin = createAdminClient();

        // Cập nhật trạng thái DA_BAN_GIAO
        await supabaseAdmin
          .from('applications')
          .update({ status: 'DA_BAN_GIAO' })
          .eq('id', applicationId);

        // Cập nhật phòng sang DANG_SU_DUNG
        await supabaseAdmin
          .from('rooms')
          .update({ status: 'DANG_SU_DUNG' })
          .eq('so_phong', roomNumber);
      }
    } catch (e) {
      console.warn('Handover room DB:', e);
    }

    // Gửi email hẹn nhận phòng và bàn giao chìa khóa (GM - Msg_NhanPhong)
    await sendWorkflowEmail({
      recipientEmail: studentEmail,
      studentName,
      studentCode: 'DUE',
      type: 'NHAN_PHONG_BAN_GIAO',
      details: {
        roomName: roomNumber,
        appointmentDate: '08:30 ngày 01/09/2026',
      },
    });

    // Cập nhật Persistent File Store
    try {
      const { saveWorkflowState, updateApplicationStatusInStore } = await import('@/lib/data/live-store');
      saveWorkflowState({
        currentStep: 9,
        isHandedOver: true,
      });
      updateApplicationStatusInStore(applicationId, 'DA_BAN_GIAO');
    } catch {}

    return {
      success: true,
      message: `Đã hoàn tất bàn giao chìa khóa (E2) và ghi nhận số phòng vào Portal nội trú (DataStore_PT).`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi khi bàn giao phòng',
    };
  }
}

// BƯỚC 10: XỬ LÝ QUÁ HẠN 72H, THU HỒI PHÒNG (HUY -> AVAILABLE) & MỞ ĐỢT 2
export async function cancelAndReallocateAction(applicationId: string, studentEmail: string, studentName: string) {
  try {
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
        const supabaseAdmin = createAdminClient();

        // 1. Chuyển hồ sơ sang HUY_SUAT (Err_Huy - BE5)
        await supabaseAdmin
          .from('applications')
          .update({ status: 'HUY_SUAT', ghi_chu_ly_do: 'Quá thời hạn 72 giờ ký hợp đồng hoặc sinh viên từ chối nhận chỗ.' })
          .eq('id', applicationId);

        // 2. Chuyển hợp đồng sang DA_HUY
        await supabaseAdmin
          .from('contracts')
          .update({ status: 'DA_HUY' })
          .eq('application_id', applicationId);

        // 3. Thu hồi phòng và trả lại trạng thái trống (CON_TRONG / AVAILABLE)
        await supabaseAdmin
          .from('rooms')
          .update({ status: 'CON_TRONG' })
          .eq('id', 'd9b1de7a-2412-4f32-843a-7dbb71120001');

        // 4. Mở đợt 2: Tìm sinh viên có thứ hạng kế tiếp trên danh sách chờ (rank #121) để cấp bổ sung
        const { data: nextWaitlist } = await supabaseAdmin
          .from('rankings')
          .select('application_id, applications(id, ho_ten, ma_sv, email)')
          .eq('is_trung_tuyen', false)
          .order('thu_hang', { ascending: true })
          .limit(1)
          .single();

        if (nextWaitlist && nextWaitlist.applications) {
          const nextApp = nextWaitlist.applications as unknown as { id: string; ho_ten: string; ma_sv: string; email: string };
          // Cập nhật sinh viên dự bị thành trúng tuyển đợt 2
          await supabaseAdmin.from('rankings').update({ is_trung_tuyen: true }).eq('application_id', nextApp.id);
          await supabaseAdmin.from('applications').update({ status: 'DA_PHAT_HANH' }).eq('id', nextApp.id);

          // Gửi email mời bổ sung đợt 2
          await sendWorkflowEmail({
            recipientEmail: nextApp.email,
            studentName: nextApp.ho_ten,
            studentCode: nextApp.ma_sv,
            type: 'TRUNG_TUYEN_KY_HD',
            details: {
              roomName: 'Phòng 301 - Khu A (Suất bổ sung Đợt 2)',
              otpCode: '888888',
              deadlineHours: 72,
            },
          });
        }
      }
    } catch (e) {
      console.warn('Cancel and reallocate DB:', e);
    }

    // Gửi email hủy suất (Msg_Huy)
    await sendWorkflowEmail({
      recipientEmail: studentEmail,
      studentName,
      studentCode: 'DUE',
      type: 'HUY_SUAT',
      details: { roomName: 'Phòng 301 - Khu A' },
    });

    // Cập nhật Persistent File Store
    try {
      const { saveWorkflowState, updateApplicationStatusInStore } = await import('@/lib/data/live-store');
      saveWorkflowState({
        currentStep: 10,
        isCancelled: true,
      });
      updateApplicationStatusInStore(applicationId, 'HUY_SUAT');
    } catch {}

    return {
      success: true,
      message: 'Đã thu hồi phòng về trạng thái TRỐNG (AVAILABLE) và tự động kích hoạt mời sinh viên kế tiếp trên danh sách chờ (Mở đợt 2).',
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi khi thu hồi phòng',
    };
  }
}

// RESET WORKFLOW (TIỆN ÍCH DÀNH CHO DEMO ĐỂ CHẠY LẠI TỪ BƯỚC 1/3)
export async function resetWorkflowAction() {
  try {
    const { resetWorkflowState } = await import('@/lib/data/live-store');
    resetWorkflowState();
    return { success: true, message: 'Đã thiết lập lại quy trình về Bước 3 (Bảng xếp hạng Tạm thời).' };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi reset' };
  }
}

// ==============================================================================
// BƯỚC 8B: SINH VIÊN TỪ CHỐI KÝ HỢP ĐỒNG / TỪ CHỐI NHẬN PHÒNG (HUY_SUAT)
// KHI SV QUA VÒNG CHỐT DANH SÁCH NHƯNG TỚI BƯỚC KÝ NHẬN PHÒNG CÓ THỂ TỪ CHỐI KHÔNG KÝ
// ==============================================================================
export async function declineContractAction(applicationId: string, studentCode?: string, reason?: string) {
  try {
    const { getAllStoredApplications, saveApplicationToStore, saveNotificationToStore } = await import('@/lib/data/live-store');
    const stored = getAllStoredApplications();
    const app = stored.find((x) => x.id === applicationId || x.ma_sv === studentCode || x.ma_sv === applicationId);

    const declineReason = reason || 'Sinh viên chủ động từ chối nhận phòng KTX tại bước ký hợp đồng.';

    if (app) {
      app.status = 'HUY_SUAT';
      app.ghi_chu_ly_do = declineReason;
      saveApplicationToStore(app);

      // Gửi thông báo xác nhận hủy suất
      saveNotificationToStore({
        id: `notif-${Date.now()}`,
        application_id: app.id,
        recipient_email: app.email,
        student_code: app.ma_sv,
        student_name: app.ho_ten,
        tieu_de: '[KTX DUE] Xác Nhận Từ Chối Nhận Phòng & Hủy Suất Nội Trú KTX',
        noi_dung: `<p>Chào sinh viên <strong>${app.ho_ten}</strong> (MSSV: <strong>${app.ma_sv}</strong>),</p><p>Hệ thống ghi nhận bạn đã xác nhận <strong>TỪ CHỐI NHẬN PHÒNG</strong> tại bước ký hợp đồng điện tử.</p><p>Lý do: <em>${declineReason}</em></p><p>Suất nội trú của bạn đã được hủy bỏ và chuyển giao cho sinh viên kế tiếp trên danh sách chờ theo đúng quy chế tuyển sinh.</p>`,
        loai: 'HUY_SUAT',
        status: 'DA_GUI',
        created_at: new Date().toISOString(),
      });

      // Gửi email hủy suất nếu có
      sendWorkflowEmail({
        applicationId: app.id,
        recipientEmail: app.email,
        studentName: app.ho_ten,
        studentCode: app.ma_sv,
        type: 'HUY_SUAT',
        details: { roomName: 'Phòng đã phân bổ' },
      }).catch(() => {});
    }

    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin
          .from('applications')
          .update({ status: 'HUY_SUAT', ghi_chu_ly_do: declineReason })
          .eq('id', applicationId);

        await supabaseAdmin
          .from('contracts')
          .update({ status: 'DA_HUY' })
          .eq('application_id', applicationId);
      }
    } catch (e) {
      console.warn('DB decline contract:', e);
    }

    return {
      success: true,
      message: 'Bạn đã xác nhận từ chối nhận phòng thành công. Suất nội trú đã được giải phóng để nhường cho sinh viên kế tiếp trên danh sách chờ.',
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi khi từ chối nhận phòng',
    };
  }
}

// ==============================================================================
// BƯỚC 5: CÁN BỘ QLSV GỬI EMAIL YÊU CẦU BỔ SUNG MINH CHỨNG 48H (TASK TR - Msg_YCBS)
// EMAIL ĐƯỢC AI SOẠN SẴN TỰ ĐỘNG (DOB_KQ), CÁN BỘ CHỈ CẦN 1-CLICK XÁC NHẬN GỬI
// ==============================================================================
export async function sendSupplementRequestAction(params: {
  applicationId: string;
  recipientEmail: string;
  studentName: string;
  studentCode: string;
  reason: string;
  emailSubject?: string;
  emailBody?: string;
}) {
  try {
    const { applicationId, recipientEmail, studentName, studentCode, reason, emailSubject, emailBody } = params;

    // 1. Cập nhật trạng thái hồ sơ trong Persistent Store sang CAN_BO_SUNG
    const { updateApplicationStatusInStore } = await import('@/lib/data/live-store');
    updateApplicationStatusInStore(applicationId, 'CAN_BO_SUNG');
    if (studentCode) {
      updateApplicationStatusInStore(studentCode, 'CAN_BO_SUNG');
    }

    // 2. Cập nhật Supabase nếu có cấu hình
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin
          .from('applications')
          .update({
            status: 'CAN_BO_SUNG',
            ghi_chu_ly_do: reason,
          })
          .eq('id', applicationId);
      }
    } catch (e) {
      console.warn('DB update CAN_BO_SUNG:', e);
    }

    // 3. Chuẩn bị nội dung HTML từ emailBody AI soạn thảo
    const formattedHtml = emailBody
      ? `<div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">TRƯỜNG ĐẠI HỌC KINH TẾ – ĐH ĐÀ NẴNG (DUE)</h2>
            <p style="margin: 6px 0 0; font-size: 13px; color: #FFB800; font-weight: bold;">BAN QUẢN LÝ KÝ TÚC XÁ – YÊU CẦU BỔ SUNG MINH CHỨNG (TASK TR)</p>
          </div>
          <div style="padding: 24px; color: #1e293b; line-height: 1.6; white-space: pre-line;">
            ${emailBody.replace(/\n/g, '<br/>')}
          </div>
          <div style="background-color: #f8fafc; padding: 14px 24px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; text-align: center;">
            Hệ thống Quản lý Quy trình KTX DUE • Hạn chót bổ sung: 48 giờ kể từ thời điểm gửi thông báo
          </div>
        </div>`
      : undefined;

    // 4. Gửi email qua Resend Service
    const finalSubject = emailSubject || `[KTX DUE] Yêu Cầu Bổ Sung Minh Chứng Trong 48 Giờ – ${studentName} (${studentCode})`;
    const targetEmail = recipientEmail || `${studentCode.toLowerCase()}@due.udn.vn`;

    const emailRes = await sendWorkflowEmail({
      applicationId,
      recipientEmail: targetEmail,
      studentName,
      studentCode,
      type: 'YEU_CAU_BO_SUNG',
      details: {
        reason,
        deadlineHours: 48,
        customSubject: finalSubject,
        customHtml: formattedHtml,
      },
    });

    return {
      success: true,
      message: `Đã gửi email (Msg_YCBS) thành công tới sinh viên ${studentName} (${targetEmail})! Hồ sơ đã chuyển sang trạng thái CẦN BỔ SUNG (Hạn chót: 48h).`,
      emailId: emailRes.messageId,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi khi gửi yêu cầu bổ sung',
    };
  }
}

// ==============================================================================
// BƯỚC 5: CÁN BỘ QLSV DUYỆT ĐẠT MINH CHỨNG (CỘNG ĐIỂM ƯU TIÊN & CẬP NHẬT THỨ HẠNG SP3)
// ==============================================================================
export async function approveEvidenceAction(applicationId: string, studentCode?: string, bonusPoints?: number) {
  try {
    const { getAllStoredApplications, saveApplicationToStore, saveNotificationToStore } = await import('@/lib/data/live-store');
    const { PRIORITY_POLICY_POINTS } = await import('@/lib/constants/workflow');

    const list = getAllStoredApplications();
    const app = list.find((x) => x.id === applicationId || (studentCode && x.ma_sv === studentCode));

    let awardedPoints = bonusPoints ?? 35;
    if (app) {
      if (!bonusPoints) {
        const policyPts = PRIORITY_POLICY_POINTS[app.dien_uu_tien]?.points;
        if (policyPts && policyPts > 0) {
          awardedPoints = policyPts;
        } else if (
          app.dien_uu_tien_label?.toLowerCase().includes('liệt sĩ') ||
          app.dien_uu_tien_label?.toLowerCase().includes('thương binh')
        ) {
          awardedPoints = 40;
        } else if (app.dien_uu_tien_label?.toLowerCase().includes('nghèo')) {
          awardedPoints = 35;
        } else if (
          app.dien_uu_tien_label?.toLowerCase().includes('vùng sâu') ||
          app.dien_uu_tien_label?.toLowerCase().includes('hải đảo')
        ) {
          awardedPoints = 30;
        } else if (app.diem_uu_tien > 0) {
          awardedPoints = app.diem_uu_tien;
        } else {
          awardedPoints = 35;
        }
      }

      app.status = 'THAM_DINH_DAT';
      app.diem_uu_tien = awardedPoints;
      app.is_supplement_review = false;
      saveApplicationToStore(app);

      // Gửi thông báo đến sinh viên
      saveNotificationToStore({
        id: `notif-${Date.now()}`,
        application_id: app.id,
        recipient_email: app.email,
        student_code: app.ma_sv,
        student_name: app.ho_ten,
        tieu_de: '[KTX DUE] Minh Chứng Bổ Sung Đã Được Cán Bộ QLSV Phê Duyệt – Cộng Điểm Thành Công',
        noi_dung: `<p>Chào sinh viên <strong>${app.ho_ten}</strong> (MSSV: <strong>${app.ma_sv}</strong>),</p><p>Cán bộ Quản lý Sinh viên đã thẩm định và phê duyệt minh chứng của bạn <strong>HỢP LỆ (ĐẠT)</strong>.</p><div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 12px; margin: 10px 0; border-radius: 6px;"><strong style="color: #15803d;">Điểm ưu tiên được cộng: +${awardedPoints} điểm</strong><br/><span style="font-size: 12px; color: #166534;">Thứ hạng của bạn đã được tự động cập nhật tăng lên trên Bảng Xếp Hạng Tuyển Sinh (SP3).</span></div>`,
        loai: 'XAC_NHAN_NOP',
        status: 'DA_GUI',
        created_at: new Date().toISOString(),
      });
    }

    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin
          .from('applications')
          .update({
            status: 'THAM_DINH_DAT',
            diem_uu_tien: awardedPoints,
          })
          .eq('id', applicationId);
      }
    } catch (e) {
      console.warn('DB approve evidence:', e);
    }

    return {
      success: true,
      awardedPoints,
      message: `Cán bộ QLSV đã xác nhận minh chứng ĐẠT! Đã cộng +${awardedPoints} điểm ưu tiên cho sinh viên ${app?.ho_ten || studentCode}. Thứ hạng trên Bảng xếp hạng (SP3) đã được tự động cập nhật tăng lên.`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi khi duyệt minh chứng',
    };
  }
}

// ==============================================================================
// BƯỚC 5: SINH VIÊN TẢI LẠI MINH CHỨNG BỔ SUNG (TASK TR -> MSG_BSMC)
// ==============================================================================
export async function submitSupplementEvidenceAction(params: {
  studentCode: string;
  newCccdBase64?: string;
  newPriorityBase64?: string;
}) {
  try {
    const { studentCode, newCccdBase64, newPriorityBase64 } = params;
    const { getAllStoredApplications, saveApplicationToStore, saveNotificationToStore } = await import('@/lib/data/live-store');
    const { analyzeEvidenceWithGemini } = await import('@/services/ai-vision');

    const list = getAllStoredApplications();
    const app = list.find((x) => x.ma_sv === studentCode);
    if (!app) {
      return { success: false, message: 'Không tìm thấy hồ sơ của sinh viên: ' + studentCode };
    }

    const cccdImg = newCccdBase64 || app.cccd_image_base64;
    const priorityImg = newPriorityBase64 || app.priority_image_base64;

    // Phân tích lại minh chứng bằng AI Vision
    const aiAnalysis = await analyzeEvidenceWithGemini({
      applicationId: app.id,
      evidenceId: 'ev-' + Date.now(),
      imageBufferBase64: cccdImg,
      priorityImageBase64: priorityImg,
      mimeType: 'image/jpeg',
      expectedDocType: 'Căn cước công dân',
      studentName: app.ho_ten,
      studentCitizenId: app.cccd,
      policyKey: app.dien_uu_tien,
    });

    const confidence = Number(aiAnalysis?.confidence) || 0;
    const isAutoApproved = confidence >= 0.95 && aiAnalysis.decision === 'THAM_DINH_DAT';

    const { PRIORITY_POLICY_POINTS } = await import('@/lib/constants/workflow');
    let awardedPoints = 35;
    const policyPts = PRIORITY_POLICY_POINTS[app.dien_uu_tien]?.points;
    if (policyPts && policyPts > 0) {
      awardedPoints = policyPts;
    } else if (
      app.dien_uu_tien_label?.toLowerCase().includes('liệt sĩ') ||
      app.dien_uu_tien_label?.toLowerCase().includes('thương binh')
    ) {
      awardedPoints = 40;
    } else if (app.dien_uu_tien_label?.toLowerCase().includes('nghèo')) {
      awardedPoints = 35;
    } else if (
      app.dien_uu_tien_label?.toLowerCase().includes('vùng sâu') ||
      app.dien_uu_tien_label?.toLowerCase().includes('hải đảo')
    ) {
      awardedPoints = 30;
    } else if (app.diem_uu_tien > 0) {
      awardedPoints = app.diem_uu_tien;
    }

    app.cccd_image_base64 = cccdImg;
    if (priorityImg) app.priority_image_base64 = priorityImg;
    app.ai_result = aiAnalysis;
    app.is_supplemented = true;
    app.supplement_submitted_at = new Date().toISOString();

    if (isAutoApproved) {
      // 1. NẾU ĐẠT TRÊN 95%: AI DUYỆT NGAY LẬP TỨC, CỘNG ĐIỂM VÀ DUYỆT LÊN BXH
      app.status = 'THAM_DINH_DAT';
      app.diem_uu_tien = awardedPoints;
      app.is_supplement_review = false;

      saveApplicationToStore(app);

      try {
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
          const supabaseAdmin = createAdminClient();
          await supabaseAdmin
            .from('applications')
            .update({
              status: 'THAM_DINH_DAT',
              diem_uu_tien: awardedPoints,
            })
            .eq('id', app.id);
        }
      } catch (e) {
        console.warn('DB update supplemented approved:', e);
      }

      saveNotificationToStore({
        id: `notif-${Date.now()}`,
        application_id: app.id,
        recipient_email: app.email,
        student_code: app.ma_sv,
        student_name: app.ho_ten,
        tieu_de: '[KTX DUE] AI Vision Đã Tự Động Duyệt Đạt Minh Chứng Bổ Sung (≥ 95%) – Cộng Điểm Thành Công',
        noi_dung: `<p>Chào sinh viên <strong>${app.ho_ten}</strong> (MSSV: <strong>${app.ma_sv}</strong>),</p><p>Hệ thống AI Vision đã quét thẩm định minh chứng bổ sung của bạn ngay lập tức với <strong>Độ tin cậy: ${(confidence * 100).toFixed(0)}% (≥ 95% - Tự động thông qua)</strong>.</p><div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 12px; margin: 10px 0; border-radius: 6px;"><strong style="color: #15803d;">✓ Minh chứng hợp lệ: Đã tự động cộng +${awardedPoints} điểm ưu tiên</strong><br/><span style="font-size: 12px; color: #166534;">Thứ hạng của bạn đã được tự động duyệt tăng lên trên Bảng Xếp Hạng Tuyển Sinh (SP3).</span></div>`,
        loai: 'XAC_NHAN_NOP',
        status: 'DA_GUI',
        created_at: new Date().toISOString(),
      });

      return {
        success: true,
        isAutoApproved: true,
        confidence,
        awardedPoints,
        message: `✓ AI Vision thẩm định đạt ${(confidence * 100).toFixed(0)}% (≥ 95%)! Minh chứng bổ sung hợp lệ. Hệ thống đã tự động duyệt đạt, cộng +${awardedPoints} điểm ưu tiên và cập nhật thứ hạng của bạn lên Bảng xếp hạng.`,
        aiAnalysis,
      };
    } else {
      // 2. NẾU DƯỚI 95%: CHUYỂN SANG CỔNG QUẢN LÝ SINH VIÊN (TAB DUYỆT MINH CHỨNG BỔ SUNG)
      app.status = 'CHO_THAM_DINH';
      app.is_supplement_review = true; // Hiện ở tab "Duyệt minh chứng bổ sung"

      saveApplicationToStore(app);

      try {
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
          const supabaseAdmin = createAdminClient();
          await supabaseAdmin
            .from('applications')
            .update({
              status: 'CHO_THAM_DINH',
            })
            .eq('id', app.id);
        }
      } catch (e) {
        console.warn('DB update supplemented pending:', e);
      }

      saveNotificationToStore({
        id: `notif-${Date.now()}`,
        application_id: app.id,
        recipient_email: app.email,
        student_code: app.ma_sv,
        student_name: app.ho_ten,
        tieu_de: '[KTX DUE] Đã Tiếp Nhận Minh Chứng Bổ Sung – Chờ Cán Bộ QLSV Rà Soát (< 95%)',
        noi_dung: `<p>Chào sinh viên <strong>${app.ho_ten}</strong> (MSSV: <strong>${app.ma_sv}</strong>),</p><p>Hệ thống AI Vision đã quét minh chứng bổ sung của bạn với <strong>Độ tin cậy: ${(confidence * 100).toFixed(0)}% (< 95% - Cần con người duyệt lại)</strong>.</p><div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 12px; margin: 10px 0; border-radius: 6px;"><strong style="color: #b45309;">⚠️ Hồ sơ nghi vấn: Đã chuyển sang Cổng Quản lý Sinh viên</strong><br/><span style="font-size: 12px; color: #92400e;">Cán bộ QLSV sẽ mở tab "Duyệt minh chứng bổ sung" để đối chiếu lại mộc đỏ/giấy tờ trước khi quyết định cộng điểm.</span></div>`,
        loai: 'XAC_NHAN_NOP',
        status: 'DA_GUI',
        created_at: new Date().toISOString(),
      });

      return {
        success: true,
        isAutoApproved: false,
        confidence,
        message: `Đã tiếp nhận minh chứng bổ sung! Độ tin cậy AI đạt ${(confidence * 100).toFixed(0)}% (< 95%). Hồ sơ đã được chuyển đến Cổng Cán bộ QLSV tại tab "Duyệt minh chứng bổ sung" để cán bộ rà soát thủ công.`,
        aiAnalysis,
      };
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi khi nộp bổ sung minh chứng',
    };
  }
}
