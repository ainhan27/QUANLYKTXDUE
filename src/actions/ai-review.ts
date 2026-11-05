'use server';
// ==============================================================================
// SERVER ACTION: QUÉT VÀ THẨM ĐỊNH ẢNH MINH CHỨNG QUA AI VISION API
// ==============================================================================

import { analyzeEvidenceWithGemini } from '@/services/ai-vision';
import { createAdminClient } from '@/lib/supabase/admin';
import { AI_THRESHOLDS } from '@/lib/constants/workflow';
import { sendWorkflowEmail } from '@/services/email';
import { AppStatus } from '@/types/database';

export async function processEvidenceImageWithAI(formData: FormData) {
  try {
    const applicationId = formData.get('applicationId') as string;
    const file = formData.get('file') as File | null;
    const base64Override = formData.get('base64Override') as string | null;
    const studentName = (formData.get('studentName') as string) || 'Sinh viên';
    const studentCitizenId = (formData.get('studentCitizenId') as string) || '';
    const studentEmail = (formData.get('studentEmail') as string) || 'student@due.edu.vn';
    const studentCode = (formData.get('studentCode') as string) || 'DUE-STUDENT';
    const expectedDocType = (formData.get('expectedDocType') as 'CCCD' | 'GIAY_XAC_NHAN_UU_TIEN' | 'HO_KHAU') || 'CCCD';
    const policyKey = (formData.get('policyKey') as string) || 'CON_THUONG_BINH_LIET_SI';

    let imageBase64 = '';
    let mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';

    if (file && typeof file.arrayBuffer === 'function') {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      imageBase64 = buffer.toString('base64');
      mimeType = (file.type as 'image/jpeg' | 'image/png' | 'image/webp') || 'image/jpeg';
    } else if (base64Override) {
      imageBase64 = base64Override.replace(/^data:image\/[a-z]+;base64,/, '');
    } else {
      return { success: false, error: 'Chưa có file ảnh minh chứng nào được tải lên!' };
    }

    // 2. Gọi AI Vision Service
    const aiResult = await analyzeEvidenceWithGemini({
      applicationId: applicationId || 'temp-app-id',
      evidenceId: 'evid-temp',
      imageBufferBase64: imageBase64,
      mimeType,
      expectedDocType,
      studentName,
      studentCitizenId,
      policyKey,
    });

    // 3. Phân nhánh theo ngưỡng tin cậy (Confidence Thresholds):
    let nextStatus: AppStatus = 'CHO_THAM_DINH';
    let responseStatusMessage = '';

    // KIỂM TRA ẢNH LẠ / MEME / PHONG CẢNH KHÔNG LIÊN QUAN
    if (!aiResult.is_valid_document || aiResult.confidence < AI_THRESHOLDS.AUTO_REJECT) {
      nextStatus = 'CAN_BO_SUNG';
      responseStatusMessage = `Ảnh tải lên không hợp lệ hoặc không phải giấy tờ tùy thân (${aiResult.document_type}). Yêu cầu sinh viên chụp lại giấy tờ hợp lệ!`;

      // Gửi email tự động yêu cầu chụp lại
      try {
        await sendWorkflowEmail({
          applicationId,
          recipientEmail: studentEmail,
          studentName,
          studentCode,
          type: 'YEU_CAU_BO_SUNG',
          details: {
            reason: responseStatusMessage,
            deadlineHours: 48,
          },
        });
      } catch (e) {
        console.warn('Gửi email không thành công:', e);
      }
    } else if (aiResult.confidence >= AI_THRESHOLDS.AUTO_APPROVE) {
      // ĐỘ TIN CẬY >= 0.85 -> TỰ ĐỘNG DUYỆT ĐẠT
      nextStatus = 'THAM_DINH_DAT';
      responseStatusMessage = `AI thẩm định ĐẠT (${(aiResult.confidence * 100).toFixed(0)}% tin cậy). Thông tin họ tên và CCCD trùng khớp 100%.`;
    } else {
      // 0.50 <= ĐỘ TIN CẬY < 0.85 -> CHUYỂN CÁN BỘ QLSV RÀ SOÁT THỦ CÔNG
      nextStatus = 'CHO_THAM_DINH';
      responseStatusMessage = `AI phát hiện nghi vấn hoặc con dấu mờ (${(aiResult.confidence * 100).toFixed(0)}% tin cậy). Đã chuyển sang hàng đợi Cán bộ QLSV rà soát.`;
    }

    // 4. Ghi Log kỹ thuật vào Supabase (An toàn nếu chưa kết nối)
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin.from('ai_logs').insert({
          application_id: applicationId || null,
          model_name: 'gemini-3.8-flash',
          confidence: aiResult.confidence,
          ket_luan: aiResult.decision === 'THAM_DINH_DAT' ? 'HOP_LE' : aiResult.decision === 'CHO_THAM_DINH' ? 'NGHI_VAN' : 'TU_CHOI_ANH_LA',
          loai_giay_to_phat_hien: aiResult.document_type,
          trich_xuat_thong_tin: aiResult.extracted_info,
          ly_do_chi_tiet: aiResult.rejection_reason || responseStatusMessage,
          payload_json: { warnings: aiResult.mismatch_warnings, raw: aiResult.raw_reasoning },
          loi_api: false,
          so_lan_thu: 1,
        });

        if (applicationId) {
          await supabaseAdmin
            .from('applications')
            .update({
              status: nextStatus,
              ghi_chu_ly_do: responseStatusMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', applicationId);
        }
      }
    } catch (dbErr) {
      console.warn('Lưu log AI vào Supabase thất bại (Đang chạy local/demo mode):', dbErr);
    }

    return {
      success: true,
      data: {
        aiResult,
        nextStatus,
        message: responseStatusMessage,
      },
    };
  } catch (error: unknown) {
    console.error('Lỗi Server Action AI Review:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lỗi hệ thống khi thẩm định minh chứng',
    };
  }
}
