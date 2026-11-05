// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// DỊCH VỤ GỬI EMAIL THÔNG BÁO TỰ ĐỘNG THEO QUY TRÌNH TO-BE 10 BƯỚC (RESEND API)
// ==============================================================================

import { Resend } from 'resend';
import { NotificationType } from '@/types/database';
import { createAdminClient } from '@/lib/supabase/admin';
import { saveNotificationToStore } from '@/lib/data/live-store';

const resendApiKey = process.env.RESEND_API_KEY || '';

interface SendWorkflowEmailParams {
  applicationId?: string;
  recipientEmail: string;
  studentName: string;
  studentCode: string;
  type: NotificationType | 'XAC_NHAN_NOP' | 'NHAN_PHONG_BAN_GIAO';
  details?: {
    reason?: string;
    deadlineHours?: number;
    roomName?: string;
    otpCode?: string;
    priorityPoints?: number;
    policyName?: string;
    aiVerdict?: string;
    appointmentDate?: string;
    rank?: number;
    waitlistIndex?: number;
    customSubject?: string;
    customHtml?: string;
  };
}

export async function sendWorkflowEmail(params: SendWorkflowEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { applicationId, recipientEmail, studentName, studentCode, type, details } = params;

  let subject = '';
  let htmlContent = '';

  switch (type) {
    // BƯỚC 1 & 4: XÁC NHẬN NỘP ĐƠN & DRAFT EMAIL TỰ ĐỘNG
    case 'XAC_NHAN_NOP':
      subject = `[KTX DUE] Xác Nhận Nộp Hồ Sơ Đăng Ký Nội Trú – MSSV: ${studentCode}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">TRƯỜNG ĐẠI HỌC KINH TẾ – ĐH ĐÀ NẴNG (DUE)</h2>
            <p style="margin: 6px 0 0; font-size: 13px; color: #FFB800; font-weight: bold;">BAN QUẢN LÝ KÝ TÚC XÁ – XÁC NHẬN TIẾP NHẬN HỒ SƠ</p>
          </div>
          <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
            <p>Kính gửi sinh viên <strong>${studentName}</strong> (Mã SV: <strong>${studentCode}</strong>),</p>
            <p>Hệ thống KTX DUE đã tiếp nhận thành công hồ sơ đăng ký nội trú của bạn vào cơ sở dữ liệu (DataStore_HS).</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin: 16px 0;">
              <h4 style="margin: 0 0 10px; color: #003366; font-size: 14px;">THÔNG TIN ĐĂNG KÝ:</h4>
              <p style="margin: 4px 0; font-size: 13px;">• Diện ưu tiên: <strong>${details?.policyName || 'Theo khai báo'}</strong></p>
              <p style="margin: 4px 0; font-size: 13px;">• Điểm ưu tiên dự kiến: <strong style="color: #1d4ed8;">${details?.priorityPoints ?? 0} điểm</strong></p>
              <p style="margin: 4px 0; font-size: 13px;">• Kết quả quét AI Vision: <strong>${details?.aiVerdict || 'Đang thẩm định'}</strong></p>
            </div>

            <p style="font-size: 13px; color: #475569;">
              Hồ sơ của bạn đã được chuyển vào <strong>Bảng Xếp Hạng Tạm Thời (SP3)</strong>. Bảng xếp hạng cập nhật liên tục theo thời gian thực (Real-time).
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px;">
              Email này được tạo tự động từ Hệ thống Quản lý Quy trình KTX DUE. Vui lòng không phản hồi trực tiếp vào địa chỉ này.
            </p>
          </div>
        </div>
      `;
      break;

    // BƯỚC 2: TỪ CHỐI BỐ TRÍ (XOR 1 - HỘ KHẨU ĐÀ NẴNG)
    case 'TU_CHOI':
      subject = `[KTX DUE] Thông Báo Kết Quả Xét Duyệt – Từ Chối Bố Trí Ở KTX (MSSV: ${studentCode})`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">BAN QUẢN LÝ KÝ TÚC XÁ – ĐH KINH TẾ ĐÀ NẴNG</h2>
            <p style="margin: 5px 0 0; font-size: 12px; color: #FFB800;">THÔNG BÁO TỪ CHỐI BỐ TRÍ NỘI TRÚ (Msg_TuChoi)</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>Chào bạn <strong>${studentName}</strong> (MSSV: <strong>${studentCode}</strong>),</p>
            <p>Ban Quản lý KTX rất tiếc phải thông báo hồ sơ của bạn không thuộc diện xét duyệt nội trú trong đợt tuyển này.</p>
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0; border-radius: 4px;">
              <strong>Lý do:</strong> ${details?.reason || 'Sinh viên có hộ khẩu thường trú tại TP Đà Nẵng theo quy chế không được bố trí nội trú KTX.'}
            </div>
            <p style="font-size: 13px; color: #64748b;">Mọi thắc mắc vui lòng liên hệ Bộ phận Hành chính KTX DUE qua email: ktx@due.edu.vn.</p>
          </div>
        </div>
      `;
      break;

    // BƯỚC 5: YÊU CẦU BỔ SUNG MINH CHỨNG (Msg_YCBS)
    case 'YEU_CAU_BO_SUNG':
      subject = details?.customSubject || `[KTX DUE] Yêu Cầu Bổ Sung Minh Chứng Trong 48 Giờ – Hồ Sơ ${studentCode}`;
      htmlContent = details?.customHtml || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">BAN QUẢN LÝ KÝ TÚC XÁ – ĐH KINH TẾ ĐÀ NẴNG</h2>
            <p style="margin: 5px 0 0; font-size: 12px; color: #FFB800;">YÊU CẦU BỔ SUNG MINH CHỨNG (Msg_YCBS)</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>Chào bạn <strong>${studentName}</strong> (MSSV: <strong>${studentCode}</strong>),</p>
            <p>Bộ phận Quản lý Sinh viên đã thẩm định minh chứng ưu tiên của bạn và nhận thấy cần bổ sung:</p>
            <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 12px; margin: 16px 0; border-radius: 4px;">
              <strong>Yêu cầu:</strong> ${details?.reason || 'Ảnh chụp bị mờ con dấu hoặc chưa rõ thẻ CCCD.'}<br/>
              <strong>Thời hạn ân hạn:</strong> <span style="color: #c2410c; font-weight: bold;">48 giờ</span> kể từ khi nhận được email này.
            </div>
            <p>Vui lòng đăng nhập cổng thông tin để tải lại minh chứng hợp lệ. Quá thời hạn trên, hồ sơ sẽ tự động chuyển sang trạng thái <em>KHÔNG ĐƯỢC XÉT</em>.</p>
          </div>
        </div>
      `;
      break;

    // BƯỚC 7 & 8: THÔNG BÁO TRÚNG TUYỂN & HỢP ĐỒNG ĐIỆN TỬ (Msg_CongBo)
    case 'TRUNG_TUYEN_KY_HD':
      subject = `[KTX DUE] Chúc Mừng Bạn Đã Trúng Tuyển – Ký Hợp Đồng KTX Trong 72 Giờ`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">BAN QUẢN LÝ KÝ TÚC XÁ – ĐH KINH TẾ ĐÀ NẴNG</h2>
            <p style="margin: 5px 0 0; font-size: 12px; color: #FFB800;">KẾT QUẢ XÉT TUYỂN & HỢP ĐỒNG ĐIỆN TỬ (Msg_CongBo)</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>Chúc mừng sinh viên <strong>${studentName}</strong> (MSSV: <strong>${studentCode}</strong>),</p>
            <p>Trưởng ban Quản lý KTX đã ký duyệt danh sách trúng tuyển chính thức. Bạn được phân bổ:</p>
            <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 16px; margin: 16px 0; border-radius: 8px; text-align: center;">
              <span style="font-size: 13px; color: #166534;">PHÒNG NỘI TRÚ ĐƯỢC CẤP:</span><br/>
              <strong style="font-size: 22px; color: #15803d;">${details?.roomName || 'Phòng 301 - Khu A'}</strong>
            </div>
            <p><strong>Hiệu lực ký hợp đồng:</strong> Trong vòng <strong>72 giờ</strong>. Vui lòng đăng nhập và nhập mã OTP bên dưới để hoàn tất:</p>
            <div style="text-align: center; margin: 20px 0;">
              <span style="background-color: #003366; color: white; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                Mã OTP Ký Hợp Đồng: ${details?.otpCode || '888888'}
              </span>
            </div>
          </div>
        </div>
      `;
      break;

    // KẾT QUẢ XÉT TUYỂN ĐỢT 1: DANH SÁCH CHỜ (DÀNH CHO THÍ SINH CÓ THỨ HẠNG > 120)
    case 'DANH_SACH_CHO':
      subject = `[KTX DUE] Kết Quả Tuyển Sinh Đợt 1 – Danh Sách Chờ (Thứ hạng #${details?.rank ?? 121})`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">BAN QUẢN LÝ KÝ TÚC XÁ – ĐH KINH TẾ ĐÀ NẴNG</h2>
            <p style="margin: 5px 0 0; font-size: 12px; color: #FFB800;">THÔNG BÁO KẾT QUẢ TUYỂN SINH – DANH SÁCH CHỜ</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>Kính gửi sinh viên <strong>${studentName}</strong> (MSSV: <strong>${studentCode}</strong>),</p>
            <p>Hội đồng Tuyển sinh Ký túc xá DUE thông báo kết quả xét tuyển nội trú Đợt 1:</p>
            <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 16px; margin: 16px 0; border-radius: 8px; text-align: center;">
              <span style="font-size: 13px; color: #92400e; font-weight: bold;">KẾT QUẢ XÉT TUYỂN ĐỢT 1:</span><br/>
              <strong style="font-size: 18px; color: #b45309;">DANH SÁCH CHỜ (DỰ BỊ THỨ #${details?.waitlistIndex ?? ((details?.rank ?? 121) - 120)})</strong>
              <div style="font-size: 12px; color: #78350f; margin-top: 4px;">Thứ hạng tổng trên BXH: #${details?.rank ?? 121} / 358 thí sinh</div>
            </div>
            <p>Chỉ tiêu đợt 1 có <strong>120 chỗ</strong> đã được phân bổ cho 120 thí sinh có điểm ưu tiên cao nhất. Suất nội trú chưa được phân bổ cho bạn trong đợt tuyển này.</p>
            <p style="font-size: 13px; color: #475569;">Trong trường hợp thí sinh trúng tuyển đợt 1 không hoàn tất ký hợp đồng trong 72 giờ hoặc hủy suất, hệ thống sẽ tự động xét duyệt và mời các thí sinh trong Danh sách chờ theo đúng thứ tự ưu tiên.</p>
          </div>
        </div>
      `;
      break;

    // BƯỚC 9: HẸN LỊCH NHẬN PHÒNG & NỘP MINH CHỨNG OFFLINE (Msg_NhanPhong)
    case 'NHAN_PHONG_BAN_GIAO':
      subject = `[KTX DUE] Thư Hẹn Nhận Phòng & Bàn Giao Chìa Khóa KTX (MSSV: ${studentCode})`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">BAN QUẢN LÝ KÝ TÚC XÁ – ĐH KINH TẾ ĐÀ NẴNG</h2>
            <p style="margin: 5px 0 0; font-size: 12px; color: #FFB800;">LỊCH HẸN BÀN GIAO PHÒNG (Msg_NhanPhong)</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>Chào sinh viên <strong>${studentName}</strong>,</p>
            <p>Hợp đồng của bạn đã được ghi nhận trạng thái <strong>SIGNED</strong>. Lịch bàn giao cơ sở vật chất phòng <strong>${details?.roomName || 'Phòng 301'}</strong>:</p>
            <ul>
              <li>Thời gian nhận phòng: <strong>${details?.appointmentDate || 'Từ 08:00 đến 17:00 ngày 01/09/2026'}</strong></li>
              <li>Địa điểm: Văn phòng Quản lý KTX – Số 71 Ngũ Hành Sơn, Đà Nẵng</li>
              <li>Hồ sơ mang theo: Bản gốc CCCD và Bản gốc Giấy xác nhận đối tượng ưu tiên để đối chiếu Offline (E2).</li>
            </ul>
          </div>
        </div>
      `;
      break;

    // BƯỚC 10: HỦY SUẤT & THU HỒI PHÒNG (Msg_Huy)
    case 'HUY_SUAT':
      subject = `[KTX DUE] Thông Báo Hủy Suất Ở KTX – Chuyển Suất Cho Danh Sách Đợt 2`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">BAN QUẢN LÝ KÝ TÚC XÁ – ĐH KINH TẾ ĐÀ NẴNG</h2>
            <p style="margin: 5px 0 0; font-size: 12px; color: #FFB800;">THÔNG BÁO HỦY SUẤT (Msg_Huy)</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>Chào bạn <strong>${studentName}</strong>,</p>
            <p>Do quá thời hạn 72 giờ ký hợp đồng hoặc sinh viên gửi yêu cầu từ chối, suất nội trú tại phòng <strong>${details?.roomName || ''}</strong> đã được thu hồi và chuyển trạng thái về <strong>AVAILABLE</strong> để xét bổ sung đợt 2 cho danh sách chờ.</p>
          </div>
        </div>
      `;
      break;

    default:
      subject = `[KTX DUE] Cập Nhật Hồ Sơ ${studentCode}`;
      htmlContent = `<p>Hồ sơ của bạn đã được cập nhật trạng thái mới.</p>`;
  }

  // THỰC THI GỬI EMAIL QUA RESEND
  try {
    let sentSuccess = false;
    let messageId = `mock-${Date.now()}`;

    if (resendApiKey && resendApiKey.length > 20 && !resendApiKey.includes('re_123456789')) {
      const resend = new Resend(resendApiKey);
      const fromEmail = process.env.EMAIL_FROM || 'KTX DUE <onboarding@resend.dev>';
      const result = await resend.emails.send({
        from: fromEmail,
        to: recipientEmail,
        subject,
        html: htmlContent,
      });

      if (!result.error && result.data) {
        sentSuccess = true;
        messageId = result.data.id;
      } else {
        console.warn('Lỗi trả về từ Resend API:', result.error);
      }
    } else {
      console.log(`[RESEND EMAIL MOCK/DEV]: Gửi tới: ${recipientEmail} | Tiêu đề: ${subject}`);
      sentSuccess = true;
    }

    // GHI NHẬN VÀO BỘ NHỚ LƯU TRỮ THỰC TẾ (PERSISTENT DATA STORE - DATA/SENT_NOTIFICATIONS.JSON)
    try {
      saveNotificationToStore({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        application_id: applicationId,
        recipient_email: recipientEmail,
        student_code: studentCode,
        student_name: studentName,
        tieu_de: subject,
        noi_dung: htmlContent,
        loai: type,
        status: 'DA_GUI',
        created_at: new Date().toISOString(),
        deadline_hours: details?.deadlineHours,
      });
    } catch (saveErr) {
      console.warn('Lỗi lưu notification vào JSON store:', saveErr);
    }

    // GHI NHẬN VÀO CSDL SUPABASE NẾU CÓ CẤU HÌNH
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin.from('notifications').insert({
          application_id: applicationId || null,
          recipient_email: recipientEmail,
          tieu_de: subject,
          noi_dung: htmlContent,
          loai: type as NotificationType,
          kenh: 'EMAIL',
          status: sentSuccess ? 'DA_GUI' : 'LOI',
          sent_at: new Date().toISOString(),
        });
      }
    } catch (dbErr) {
      console.warn('Lưu notification vào DB:', dbErr);
    }

    return { success: sentSuccess, messageId };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Lỗi khi gửi email:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
