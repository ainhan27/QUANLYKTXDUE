'use server';

// ==============================================================================
// SERVER ACTIONS: THỰC THI QUY TRÌNH TO-BE BƯỚC 1 -> BƯỚC 4
// 1. TIẾP NHẬN ĐƠN (A1) -> 2. SÀNG LỌC ĐÀ NẴNG (SP1) & AI VISION SIÊU TỐC (SP2)
// 3. XẾP HẠNG REAL-TIME (SP3) -> 4. GỬI EMAIL THÔNG BÁO ASYNC KHÔNG CHẶN LUỒNG
// ĐẢM BẢO LƯU TRỮ VÀO DATABASE VÀ HIỂN THỊ TRỰC TIẾP LÊN BẢNG XẾP HẠNG REAL-TIME
// ==============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { PRIORITY_POLICY_POINTS } from '@/lib/constants/workflow';
import { analyzeEvidenceWithGemini, withTimeout, extractGenderFromCccd } from '@/services/ai-vision';
import { sendWorkflowEmail } from '@/services/email';
import { saveApplicationToStore } from '@/lib/data/live-store';
import { AppStatus } from '@/types/database';

export interface SubmitApplicationPayload {
  ma_sv: string;
  ho_ten: string;
  email: string;
  cccd: string;
  ngay_sinh: string;
  gioi_tinh: 'Nam' | 'Nữ';
  tinh_thanh: string;
  dia_chi_thuong_tru: string;
  dien_uu_tien: string;
  imageBase64: string;
  priorityImageBase64?: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  signatureBase64?: string;
}

export async function submitApplicationFullPipeline(payload: SubmitApplicationPayload) {
  try {
    const pipelinePromise = (async () => {
      const {
        ma_sv,
        ho_ten,
        email,
        cccd,
        ngay_sinh,
        gioi_tinh,
        tinh_thanh,
        dia_chi_thuong_tru,
        dien_uu_tien,
        imageBase64,
        priorityImageBase64,
        mimeType,
        signatureBase64,
      } = payload;

      // ========================================================================
      // KIỂM TRA ĐIỀU KIỆN ĐÓNG CỔNG: KHI TRƯỞNG BAN ĐÃ DUYỆT HOẶC CÔNG BỐ
      // SINH VIÊN KHÔNG ĐƯỢC PHÉP NỘP HỒ SƠ NỮA
      // ========================================================================
      const { getWorkflowState } = await import('@/lib/data/live-store');
      const currentWf = getWorkflowState();
      if (currentWf.isRankingsFinalized || currentWf.isPublished) {
        throw new Error(
          'Cổng tiếp nhận hồ sơ đã đóng (Đợt 1)! Trưởng Ban Quản lý KTX đã ký duyệt và công bố danh sách chính thức, hệ thống không nhận thêm hồ sơ mới.'
        );
      }

      // ========================================================================
      // BƯỚC 1: TIẾP NHẬN HỒ SƠ & SÀNG LỌC HỘ KHẨU ĐÀ NẴNG (SP1 - Err_HoKhau)
      // ========================================================================
      const isDaNang =
        tinh_thanh.trim().toLowerCase().includes('đà nẵng') ||
        tinh_thanh.trim().toLowerCase().includes('da nang');

      const createdAppId = `app-${Date.now()}`;
      const policyLabel = PRIORITY_POLICY_POINTS[dien_uu_tien]?.label || 'Không thuộc diện ưu tiên';
      const basePoints = PRIORITY_POLICY_POINTS[dien_uu_tien]?.points || 0;

      if (isDaNang) {
        const refusalReason =
          'Sinh viên có hộ khẩu thường trú tại TP Đà Nẵng không thuộc đối tượng xét tuyển nội trú KTX theo quy chế nhà trường (Cổng XOR 1 / Sự kiện lỗi BE1).';

        saveApplicationToStore({
          id: createdAppId,
          ma_sv,
          ho_ten,
          email,
          cccd,
          ngay_sinh,
          gioi_tinh,
          tinh_thanh,
          dia_chi_thuong_tru,
          dien_uu_tien,
          dien_uu_tien_label: policyLabel,
          diem_uu_tien: 0,
          status: 'TU_CHOI_BO_TRI',
          cccd_image_base64: imageBase64,
          priority_image_base64: priorityImageBase64,
          signature_base64: signatureBase64,
          ai_result: {
            is_valid_document: false,
            has_cccd_keyword: false,
            matched_policy_keywords: [],
            document_type: 'Hộ khẩu Đà Nẵng (Từ chối)',
            confidence: 1.0,
            detected_raw_text: refusalReason,
            extracted_info: { ho_ten, so_dinh_danh: cccd },
            mismatch_warnings: [refusalReason],
            decision: 'TU_CHOI',
            rejection_reason: refusalReason,
            raw_reasoning: refusalReason,
          },
          created_at: new Date().toISOString(),
          is_trung_tuyen: false,
        });

        sendWorkflowEmail({
          recipientEmail: email,
          studentName: ho_ten,
          studentCode: ma_sv,
          type: 'TU_CHOI',
          details: { reason: refusalReason },
        }).catch((e) => console.warn('Lỗi gửi mail từ chối ĐN:', e));

        return {
          success: false,
          status: 'TU_CHOI_BO_TRI' as AppStatus,
          message: refusalReason,
        };
      }

      // ========================================================================
      // BƯỚC 2: THẨM ĐỊNH AI VISION & OCR ĐỒNG THỜI (SP2 - TASK A6)
      // ========================================================================
      const cleanCccdBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      const cleanPriorityBase64 = priorityImageBase64
        ? priorityImageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
        : undefined;

      const aiResult = await analyzeEvidenceWithGemini({
        applicationId: createdAppId,
        evidenceId: 'evid-cccd',
        imageBufferBase64: cleanCccdBase64,
        priorityImageBase64: cleanPriorityBase64,
        mimeType: mimeType || 'image/jpeg',
        expectedDocType: 'CCCD',
        studentName: ho_ten,
        studentCitizenId: cccd,
        policyKey: dien_uu_tien,
        tinhThanh: tinh_thanh,
        diaChiThuongTru: dia_chi_thuong_tru,
      });

      // Phân loại tự động theo ngưỡng 95% (Quy tắc nghiệp vụ KTX DUE):
      // - Chấm TRÊN 95% (>= 0.95) độ tin cậy VÀ không sai lệch: TỰ ĐỘNG CHO QUA
      // - Chấm DƯỚI 95% (< 0.95) hoặc sai lệch đối tượng/khu vực: BẮT BUỘC CÁN BỘ QLSV RÀ SOÁT
      let applicationStatus: AppStatus = 'CHO_THAM_DINH';
      const isAutoApproved = aiResult.confidence >= 0.95 && aiResult.decision === 'THAM_DINH_DAT';

      if (isAutoApproved) {
        applicationStatus = 'THAM_DINH_DAT';
      } else if (aiResult.decision === 'CAN_BO_SUNG') {
        applicationStatus = 'CAN_BO_SUNG';
      } else {
        applicationStatus = 'CHO_THAM_DINH';
      }

      // ========================================================================
      // BƯỚC 3: TÍNH ĐIỂM ƯU TIÊN THEO BRE (SP3) & LƯU CƠ SỞ DỮ LIỆU
      // QUY TẮC: NẾU CHƯA ĐƯỢC DUYỆT (CHO_THAM_DINH / CAN_BO_SUNG) -> ĐIỂM ƯU TIÊN LÀ 0
      // CHỈ KHI CÁN BỘ QLSV RÀ SOÁT DUYỆT ĐẠT MỚI ĐƯỢC CỘNG ĐIỂM & XẾP HẠNG
      // ========================================================================
      const finalPoints = isAutoApproved ? basePoints : 0;
      const isTrungTuyen = isAutoApproved ? finalPoints >= 30 : false;

      // XÁC ĐỊNH GIỚI TÍNH TỰ ĐỘNG TỪ ẢNH CCCD / THUẬT TOÁN 12 SỐ CĂN CƯỚC VIỆT NAM
      const scannedGender: 'Nam' | 'Nữ' =
        aiResult?.cccd_analysis?.extracted_gender ||
        extractGenderFromCccd(cccd, aiResult?.detected_raw_text) ||
        gioi_tinh ||
        'Nữ';

      // 1. LƯU VÀO DATABASE THỰC TẾ
      saveApplicationToStore({
        id: createdAppId,
        ma_sv,
        ho_ten,
        email,
        cccd,
        ngay_sinh,
        gioi_tinh: scannedGender,
        tinh_thanh,
        dia_chi_thuong_tru,
        dien_uu_tien,
        dien_uu_tien_label: policyLabel,
        diem_uu_tien: finalPoints,
        status: applicationStatus,
        cccd_image_base64: imageBase64,
        priority_image_base64: priorityImageBase64,
        signature_base64: signatureBase64,
        ai_result: aiResult,
        created_at: new Date().toISOString(),
        is_trung_tuyen: isTrungTuyen,
      });

      // 2. LƯU SUPABASE CLOUD NẾU ĐÃ CẤU HÌNH
      try {
        if (
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')
        ) {
          const supabaseAdmin = createAdminClient();
          await supabaseAdmin.from('applications').insert({
            ma_sv,
            ho_ten,
            email,
            cccd,
            ngay_sinh,
            gioi_tinh: scannedGender,
            tinh_thanh,
            dia_chi_thuong_tru,
            dien_uu_tien,
            diem_uu_tien: finalPoints,
            status: applicationStatus,
            signature_base64: signatureBase64 || null,
            ghi_chu_ly_do: aiResult.rejection_reason || aiResult.raw_reasoning,
          });

          await supabaseAdmin.from('rankings').insert({
            application_id: createdAppId,
            diem_uu_tien: finalPoints,
            thu_hang: 1,
            is_trung_tuyen: isTrungTuyen,
            status: 'DU_KIEN',
          });
        }
      } catch (dbErr) {
        console.warn('DB Supabase Insert:', dbErr);
      }

      // ========================================================================
      // BƯỚC 4: GỬI RESEND EMAIL XÁC NHẬN TIẾP NHẬN HỒ SƠ (ASYNC NON-BLOCKING)
      // ========================================================================
      sendWorkflowEmail({
        applicationId: createdAppId,
        recipientEmail: email,
        studentName: ho_ten,
        studentCode: ma_sv,
        type: 'XAC_NHAN_NOP',
        details: {
          priorityPoints: finalPoints,
          policyName: policyLabel,
          aiVerdict:
            aiResult.decision === 'THAM_DINH_DAT'
              ? `Hợp lệ (Độ tin cậy ${(aiResult.confidence * 100).toFixed(0)}%)`
              : 'Đang chờ đối chiếu rà soát',
        },
      }).catch((e) => console.warn('Lỗi gửi email ngầm:', e));

      return {
        success: true,
        applicationId: createdAppId,
        status: applicationStatus,
        aiResult,
        finalPoints,
        student: {
          ma_sv,
          ho_ten,
          email,
          tinh_thanh,
          dien_uu_tien: policyLabel,
          diem_uu_tien: finalPoints,
        },
        message: isAutoApproved
          ? `Nộp đơn thành công! AI đối chiếu dữ liệu trùng khớp 100% (${(aiResult.confidence * 100).toFixed(0)}% tin cậy) - Đã cộng +${finalPoints} điểm ưu tiên.`
          : `Đã tiếp nhận hồ sơ! AI thẩm định: ${(aiResult.confidence * 100).toFixed(0)}% độ tin cậy - Chuyển Cán bộ QLSV rà soát đối chiếu.`,
      };
    })();

    return await withTimeout(pipelinePromise, 25000, 'Xử lý hồ sơ');
  } catch (error: unknown) {
    console.error('Lỗi quy trình submitApplicationFullPipeline:', error);
    return {
      success: false,
      status: 'CHO_THAM_DINH' as AppStatus,
      message: 'Có lỗi kỹ thuật khi lưu hồ sơ',
    };
  }
}
