'use client';

// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// MÀN HÌNH NỘP HỒ SƠ SINH VIÊN (BƯỚC 1 -> BƯỚC 2 TO-BE BPMN)
// GIAO DIỆN PRODUCTION THỰC TẾ:
// - FORM ĐỂ TRỐNG HOÀN TOÀN (BLANK FORM) - BẮT BUỘC NGƯỜI DÙNG TỰ ĐIỀN
// - TUYỆT ĐỐI KHÔNG CÓ NÚT TEST NHANH / MẪU
// - TÁCH 2 Ô UPLOAD ĐỘC LẬP: Ô 1 (CCCD) & Ô 2 (MINH CHỨNG CÓ DẤU MỘC ĐỎ)
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { PRIORITY_POLICY_POINTS } from '@/lib/constants/workflow';
import { submitApplicationFullPipeline } from '@/actions/application';

interface ApplicationFormProps {
  onSuccess?: (appId: string) => void;
}

export default function ApplicationForm({ onSuccess }: ApplicationFormProps) {
  // Trạng thái đóng mở đợt tuyển sinh
  const [isRoundClosed, setIsRoundClosed] = useState(false);

  useEffect(() => {
    const checkWorkflowStatus = async () => {
      try {
        const res = await fetch('/api/workflow');
        if (res.ok) {
          const data = await res.json();
          if (data.workflow?.isRankingsFinalized || data.workflow?.isPublished) {
            setIsRoundClosed(true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch workflow state:', err);
      }
    };
    checkWorkflowStatus();
  }, []);
  // FORM TRỐNG HOÀN TOÀN (PRODUCTION BLANK FORM)
  const [formData, setFormData] = useState({
    khoa: 'Khoa Quản trị Kinh doanh',
    ma_sv: '',
    ho_ten: '',
    cccd: '',
    ngay_sinh: '',
    gioi_tinh: 'Nữ' as 'Nam' | 'Nữ',
    tinh_thanh: '',
    dia_chi_thuong_tru: '',
    dien_uu_tien: 'KHONG',
    email: '',
  });

  // Ô 1: Ảnh CCCD (Bắt buộc)
  const [cccdPreview, setCccdPreview] = useState<string | null>(null);
  const [cccdFileName, setCccdFileName] = useState<string>('');

  // Ô 2: Ảnh Giấy tờ ưu tiên (Tùy chọn/Bắt buộc nếu có chính sách)
  const [priorityPreview, setPriorityPreview] = useState<string | null>(null);
  const [priorityFileName, setPriorityFileName] = useState<string>('');

  // Trạng thái xử lý
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStepText, setSubmitStepText] = useState('Đang xử lý...');
  const [submitMessage, setSubmitMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Cam đoan thông tin (Checkbox bắt buộc)
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Điểm ưu tiên dự kiến
  const currentPriorityPoints = PRIORITY_POLICY_POINTS[formData.dien_uu_tien]?.points || 0;

  // Cổng XOR 1: Sàng lọc hộ khẩu Đà Nẵng
  const isDaNangResident =
    formData.tinh_thanh.trim().toLowerCase().includes('đà nẵng') ||
    formData.tinh_thanh.trim().toLowerCase().includes('da nang');

  // Đổi khóa sinh viên
  const handleCohortChange = (newCohort: string) => {
    setFormData((prev) => ({
      ...prev,
      khoa: newCohort,
    }));
  };

  // Nén ảnh Canvas phía Client (Xử lý file thực tế của người dùng siêu tốc)
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 900;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.78));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Chọn file CCCD từ máy
  const handleCccdFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCccdFileName(file.name);
      const base64 = await compressImageFile(file);
      setCccdPreview(base64);
    }
  };

  // Chọn file Giấy tờ ưu tiên từ máy
  const handlePriorityFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPriorityFileName(file.name);
      const base64 = await compressImageFile(file);
      setPriorityPreview(base64);
    }
  };

  // Xóa ảnh đã chọn
  const removeCccdImage = () => {
    setCccdPreview(null);
    setCccdFileName('');
  };

  const removePriorityImage = () => {
    setPriorityPreview(null);
    setPriorityFileName('');
  };

  // ============================================================================
  // NỘP HỒ SƠ CHÍNH THỨC
  // ============================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage(null);
    setSubmitStepText('1. Đang kiểm tra hồ sơ...');

    // 1. Kiểm tra ảnh CCCD (Bắt buộc)
    if (!cccdPreview) {
      setSubmitMessage({
        type: 'error',
        text: 'Vui lòng chọn tải lên ảnh chụp Căn cước công dân (Ô 1 - Bắt buộc)!',
      });
      setIsSubmitting(false);
      return;
    }

    // 2. Kiểm tra minh chứng ưu tiên nếu chọn diện chính sách
    if (formData.dien_uu_tien !== 'KHONG' && !priorityPreview) {
      setSubmitMessage({
        type: 'error',
        text: `Bạn đã chọn diện ưu tiên "${PRIORITY_POLICY_POINTS[formData.dien_uu_tien]?.label}". Vui lòng tải lên ảnh Giấy tờ minh chứng có con dấu mộc đỏ ở Ô 2!`,
      });
      setIsSubmitting(false);
      return;
    }

    // 3. BẮT BUỘC TÍCH Ô CAM ĐOAN THÔNG TIN
    if (!isConfirmed) {
      setSubmitMessage({
        type: 'error',
        text: 'Vui lòng đánh dấu tích vào ô "Tôi xin cam đoan mọi thông tin..." trước khi nộp hồ sơ!',
      });
      setIsSubmitting(false);
      return;
    }

    // Timer cập nhật trạng thái mượt mà theo tiến trình
    const stepTimer = setInterval(() => {
      setSubmitStepText((prev) => {
        if (prev.startsWith('1.')) return '2. AI Vision đang thẩm định định danh CCCD...';
        if (prev.startsWith('2.')) return '3. Đang ghi nhận CSDL KTX & xếp hạng...';
        return prev;
      });
    }, 450);

    try {
      const signatureBase64 = 'XAC_NHAN_CAM_DOAN_DIEN_TU';

      // Tự động nhận diện giới tính theo quy chuẩn 12 số CCCD Việt Nam (Chữ số thứ 4: chẵn = Nam, lẻ = Nữ)
      const cleanDigits = formData.cccd.replace(/\D/g, '');
      let autoGender: 'Nam' | 'Nữ' = formData.gioi_tinh;
      if (cleanDigits.length >= 4) {
        const d = parseInt(cleanDigits[3], 10);
        if (!isNaN(d)) {
          autoGender = d % 2 === 0 ? 'Nam' : 'Nữ';
        }
      }

      const res = await submitApplicationFullPipeline({
        ma_sv: formData.ma_sv.trim(),
        ho_ten: formData.ho_ten.trim(),
        email: formData.email.trim(),
        cccd: formData.cccd.trim(),
        ngay_sinh: formData.ngay_sinh,
        gioi_tinh: autoGender,
        tinh_thanh: formData.tinh_thanh.trim(),
        dia_chi_thuong_tru: formData.dia_chi_thuong_tru.trim(),
        dien_uu_tien: formData.dien_uu_tien,
        imageBase64: cccdPreview,
        priorityImageBase64: priorityPreview || undefined,
        mimeType: 'image/jpeg',
        signatureBase64,
      });

      clearInterval(stepTimer);

      if (!res.success && res.status === 'TU_CHOI_BO_TRI') {
        setSubmitMessage({
          type: 'warning',
          text: `🚫 [TỪ CHỐI BỐ TRÍ]: ${res.message}`,
        });
        setIsSubmitting(false);
        return;
      }

      if (!res.success) {
        setSubmitMessage({
          type: 'error',
          text: res.message || 'Có lỗi xảy ra khi nộp hồ sơ. Vui lòng thử lại!',
        });
        setIsSubmitting(false);
        return;
      }

      setSubmitStepText('4. Đã lưu CSDL! Đang chuyển trang...');
      setSubmitMessage({
        type: 'success',
        text: `✓ ${res.message} Đang chuyển sang màn hình Theo Dõi Hồ Sơ...`,
      });

      // Lưu vào localStorage để Tracker và BXH nhận ngay lập tức
      if (typeof window !== 'undefined') {
        const studentPayload = {
          ma_sv: formData.ma_sv.trim(),
          ho_ten: formData.ho_ten.trim(),
          email: formData.email.trim(),
          cccd: formData.cccd.trim(),
          khoa: formData.khoa || 'Khoa Quản trị Kinh doanh',
          ngay_sinh: formData.ngay_sinh,
          gioi_tinh: autoGender,
          dia_chi_thuong_tru: formData.dia_chi_thuong_tru || (formData.tinh_thanh ? `${formData.tinh_thanh}` : 'Quảng Nam'),
          dien_uu_tien: PRIORITY_POLICY_POINTS[formData.dien_uu_tien]?.label || 'Không thuộc diện ưu tiên',
          diem_uu_tien: res.finalPoints ?? 0,
          status: res.status,
        };
        localStorage.setItem('last_submitted_student', JSON.stringify(studentPayload));
        localStorage.setItem('active_student_session_code', formData.ma_sv.trim());
        localStorage.setItem('student_page_tab', 'tracker');
        window.dispatchEvent(new CustomEvent('student_application_submitted', { detail: studentPayload }));
      }

      // Chuyển trang mượt mà
      if (res.success && res.applicationId && onSuccess) {
        setTimeout(() => {
          onSuccess(res.applicationId!);
        }, 300);
      }
    } catch (err: unknown) {
      clearInterval(stepTimer);
      setSubmitMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Lỗi hệ thống khi lưu hồ sơ.',
      });
      setIsSubmitting(false);
    }
  };

  if (isRoundClosed) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden space-y-6">
        <div className="bg-[#003366] px-6 py-4 text-white">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-rose-500 text-white rounded">
            Thông Báo Tuyển Sinh
          </span>
          <h2 className="text-lg font-bold mt-1">Cổng Đăng Ký Nội Trú Ký Túc Xá Đã Đóng</h2>
          <p className="text-xs text-blue-200">Đợt xét tuyển học kỳ I năm học 2026 – 2027</p>
        </div>

        <div className="p-8 text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
            !
          </div>
          <h3 className="text-xl font-bold text-slate-800">
            HẾT HẠN TIẾP NHẬN HỒ SƠ ĐĂNG KÝ
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Hội đồng Tuyển sinh KTX đã hoàn tất xét duyệt và công bố danh sách chính thức. Hệ thống hiện đã <strong>ngừng tiếp nhận hồ sơ mới</strong> cho đợt tuyển sinh này.
          </p>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 text-left space-y-1.5">
            <p className="font-bold">Dành cho sinh viên đã nộp hồ sơ trước đó:</p>
            <p>• Vui lòng chuyển sang tab <strong>&ldquo;Theo Dõi Tiến Trình & Hợp Đồng&rdquo;</strong> để tra cứu kết quả bố trí phòng và thực hiện ký hợp đồng điện tử trong thời hạn 72h.</p>
            <p>• Mọi thắc mắc vui lòng liên hệ trực tiếp Bộ phận Quản lý Sinh viên KTX DUE.</p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onSuccess && onSuccess('TRACKER')}
              className="px-6 py-2.5 bg-[#003366] text-[#FFB800] font-bold text-sm rounded-lg hover:bg-blue-900 shadow-sm transition"
            >
              Chuyển Sang Theo Dõi Tiến Trình & Kết Quả →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#072E54] via-[#0B4378] to-[#125FA9] px-5 py-3.5 text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center space-x-3">
            <div className="bg-white rounded-lg px-2.5 py-1 shadow-sm shrink-0 hidden sm:flex items-center">
              <img
                src="/images/due-logo.png"
                alt="Đại học Kinh tế - ĐH Đà Nẵng"
                className="h-8 w-auto object-contain"
              />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#F26422] text-white rounded">
                Tuyển Sinh 2026 - 2027
              </span>
              <h2 className="text-base sm:text-lg font-bold mt-1">Đăng Ký Nội Trú Ký Túc Xá DUE</h2>
              <p className="text-xs text-blue-200">
                Điền thông tin và tải ảnh giấy tờ để hệ thống AI thẩm định tự động
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Thông báo kết quả nộp */}
        {submitMessage && (
          <div
            className={`p-4 rounded-lg text-sm font-medium border transition-all ${
              submitMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : submitMessage.type === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {submitMessage.text}
          </div>
        )}

        {/* 1. THÔNG TIN SINH VIÊN (BLANK FORM) */}
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200">
            1. Thông Tin Sinh Viên
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mã Sinh Viên (DUE) *</label>
              <input
                type="text"
                required
                placeholder="Nhập Mã sinh viên (MSSV)..."
                value={formData.ma_sv}
                onChange={(e) => setFormData({ ...formData, ma_sv: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Họ và Tên *</label>
              <input
                type="text"
                required
                placeholder="Nhập đầy đủ họ và tên..."
                value={formData.ho_ten}
                onChange={(e) => setFormData({ ...formData, ho_ten: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email Cá Nhân (Nhận Thông Báo) *</label>
              <input
                type="email"
                required
                placeholder="email@example.com..."
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium text-blue-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Số Căn Cước Công Dân (12 số) *</label>
              <input
                type="text"
                required
                maxLength={12}
                placeholder="04820400XXXX (12 chữ số)..."
                value={formData.cccd}
                onChange={(e) => setFormData({ ...formData, cccd: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày Sinh *</label>
              <input
                type="date"
                required
                value={formData.ngay_sinh}
                onChange={(e) => setFormData({ ...formData, ngay_sinh: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tỉnh / Thành Thường Trú *</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Quảng Nam, Quảng Trị, Gia Lai..."
                value={formData.tinh_thanh}
                onChange={(e) => setFormData({ ...formData, tinh_thanh: e.target.value })}
                className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:outline-none ${
                  isDaNangResident
                    ? 'border-red-500 bg-red-50 text-red-900 focus:ring-red-500'
                    : 'border-slate-300 focus:ring-blue-600'
                }`}
              />
            </div>
          </div>

          {isDaNangResident && (
            <div className="mt-3 p-3 bg-red-50 border-l-4 border-red-600 rounded text-xs text-red-700">
              <strong>⚠️ LƯU Ý QUY CHẾ:</strong> Sinh viên có hộ khẩu thường trú tại TP Đà Nẵng không thuộc đối tượng xét tuyển nội trú KTX. Hồ sơ nộp sẽ bị tự động từ chối.
            </div>
          )}

          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Địa Chỉ Thường Trú Chi Tiết *</label>
            <input
              type="text"
              required
              placeholder="Nhập số nhà, thôn/xã, quận/huyện, tỉnh thành chi tiết..."
              value={formData.dia_chi_thuong_tru}
              onChange={(e) => setFormData({ ...formData, dia_chi_thuong_tru: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* 2. DIỆN ƯU TIÊN CHÍNH SÁCH */}
        <div>
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              2. Đăng Ký Diện Ưu Tiên Chính Sách
            </h3>
            <span className="text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
              Điểm cộng dự kiến: +{currentPriorityPoints} điểm
            </span>
          </div>

          <select
            value={formData.dien_uu_tien}
            onChange={(e) => setFormData({ ...formData, dien_uu_tien: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50 font-medium"
          >
            {Object.entries(PRIORITY_POLICY_POINTS).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label} (+{val.points} điểm)
              </option>
            ))}
          </select>

          {/* HƯỚNG DẪN CHI TIẾT THEO DIỆN ƯU TIÊN ĐÃ CHỌN (CHỐNG GIAN LẬN ĐỐI TƯỢNG / KHU VỰC) */}
          <div className="mt-3 p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-1.5 text-blue-950">
            <div className="font-bold flex items-center justify-between">
              <span>Yêu cầu minh chứng cho: {PRIORITY_POLICY_POINTS[formData.dien_uu_tien]?.label}</span>
              <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-mono font-bold">
                +{currentPriorityPoints} điểm
              </span>
            </div>
            {formData.dien_uu_tien === 'CON_THUONG_BINH_LIET_SI' && (
              <p className="text-[11px] text-slate-700 leading-relaxed">
                • <strong>Giấy tờ bắt buộc:</strong> Bằng Tổ quốc ghi công, Giấy chứng nhận Thương binh/Bệnh binh (Hạng 1-4) do Phòng LĐTBXH hoặc cơ quan có thẩm quyền cấp, có <strong>con dấu mộc đỏ</strong>.<br/>
                • <em>Lưu ý: Giấy tờ hộ nghèo hoặc giấy tờ khác sẽ bị AI phát hiện xung đột và chuyển sang Cán bộ QLSV rà soát.</em>
              </p>
            )}
            {formData.dien_uu_tien === 'HO_NGHEO_CAN_NGHEO' && (
              <p className="text-[11px] text-slate-700 leading-relaxed">
                • <strong>Giấy tờ bắt buộc:</strong> Giấy chứng nhận hộ nghèo / hộ cận nghèo năm 2026 hoặc sổ hộ nghèo còn hiệu lực do UBND cấp xã/phường xác nhận, có <strong>con dấu mộc đỏ</strong>.<br/>
                • <em>Lưu ý: Không chấp nhận giấy xác nhận hoàn cảnh khó khăn tự viết không có xác nhận của UBND.</em>
              </p>
            )}
            {formData.dien_uu_tien === 'VUNG_SAU_XA_HAI_DAO' && (
              <p className="text-[11px] text-slate-700 leading-relaxed">
                • <strong>Khu vực áp dụng:</strong> Xã/thôn thuộc Khu vực 1, xã bãi ngang ven biển hoặc hải đảo (Cù Lao Chàm, Lý Sơn, Tây Giang, Nam Trà My...).<br/>
                • <strong>Giấy tờ bắt buộc:</strong> Giấy xác nhận thông tin về cư trú (CT07) hoặc giấy xác nhận thường trú tại xã ĐBKK do UBND cấp, có <strong>mộc đỏ</strong>.
              </p>
            )}
            {formData.dien_uu_tien === 'DAN_TOC_THIEU_SO' && (
              <p className="text-[11px] text-slate-700 leading-relaxed">
                • <strong>Đối tượng áp dụng:</strong> Sinh viên là người dân tộc thiểu số thường trú tại vùng khó khăn.<br/>
                • <strong>Giấy tờ bắt buộc:</strong> Bản sao Giấy khai sinh hoặc Giấy xác nhận của cơ quan thẩm quyền thể hiện thành phần dân tộc và nơi thường trú, có <strong>mộc đỏ</strong>.
              </p>
            )}
            {formData.dien_uu_tien === 'NGOAI_TINH_XA' && (
              <p className="text-[11px] text-slate-700 leading-relaxed">
                • <strong>Khu vực áp dụng:</strong> Thường trú tại các tỉnh có cự ly &gt; 200km so với TP. Đà Nẵng (Quảng Bình, Quảng Trị, Thừa Thiên Huế, Quảng Ngãi, Bình Định, Gia Lai, Đắk Lắk...).<br/>
                • <em>Lưu ý: Tỉnh Quảng Nam có cự ly &lt; 100km giáp ranh Đà Nẵng không thuộc diện này. AI Vision sẽ tự động đối chiếu địa chỉ thường trú.</em>
              </p>
            )}
            {formData.dien_uu_tien === 'KHONG' && (
              <p className="text-[11px] text-slate-700 leading-relaxed">
                • Hồ sơ xét tuyển tiêu chuẩn không cộng điểm ưu tiên. Bạn chỉ cần tải lên ảnh CCCD rõ nét ở Ô 1.
              </p>
            )}
            <div className="text-[10px] text-slate-500 pt-1 border-t border-blue-200/60 italic">
              * Hệ thống AI Vision đối chiếu tự động ảnh minh chứng với diện ưu tiên và khu vực bạn khai báo. Nếu phát hiện sai lệch diện hoặc khu vực, độ tin cậy sẽ dưới 30% và hồ sơ phải chờ Cán bộ QLSV rà soát thủ công.
            </div>
          </div>
        </div>

        {/* 3. TÁCH BIỆT 2 Ô UPLOAD HỒ SƠ */}
        <div>
          <div className="pb-2 border-b border-slate-200 mb-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              3. Tải Lên Hồ Sơ (CCCD &amp; Minh Chứng Ưu Tiên)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ô 1: ẢNH CĂN CƯỚC CÔNG DÂN (BẮT BUỘC) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 uppercase">
                    Ô 1: Ảnh CCCD *
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900">
                    Bắt buộc
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Chụp rõ mặt trước hoặc gắn chip. Không yêu cầu dấu đỏ.
                </p>

                <div className="mt-2.5">
                  <input
                    type="file"
                    id="cccd-file-input"
                    accept="image/*"
                    onChange={handleCccdFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="cccd-file-input"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-4 cursor-pointer bg-white transition"
                  >
                    <svg className="w-6 h-6 text-blue-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-bold text-blue-800">
                      {cccdFileName ? `Đã chọn: ${cccdFileName}` : 'Chọn ảnh CCCD'}
                    </span>
                    <span className="text-[10px] text-slate-400">JPG, PNG, WEBP</span>
                  </label>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg bg-white p-2 min-h-[120px] flex items-center justify-center relative">
                {cccdPreview ? (
                  <div className="relative text-center w-full">
                    <img
                      src={cccdPreview}
                      alt="Xem trước CCCD"
                      className="max-h-28 object-contain rounded shadow-xs mx-auto"
                    />
                    <button
                      type="button"
                      onClick={removeCccdImage}
                      className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 text-xs shadow"
                      title="Xóa ảnh"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs italic">Chưa chọn ảnh CCCD</span>
                )}
              </div>
            </div>

            {/* Ô 2: ẢNH GIẤY TỜ XÁC NHẬN DIỆN ƯU TIÊN */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 uppercase">
                    Ô 2: Giấy Tờ Ưu Tiên
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    formData.dien_uu_tien === 'KHONG' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {formData.dien_uu_tien === 'KHONG' ? 'Tùy chọn' : 'Bắt buộc'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Giấy chứng nhận hộ nghèo, thương binh... Yêu cầu có mộc đỏ.
                </p>

                <div className="mt-2.5">
                  <input
                    type="file"
                    id="priority-file-input"
                    accept="image/*"
                    onChange={handlePriorityFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="priority-file-input"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-lg p-4 cursor-pointer bg-white transition"
                  >
                    <svg className="w-6 h-6 text-amber-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs font-bold text-amber-900">
                      {priorityFileName ? `Đã chọn: ${priorityFileName}` : 'Chọn ảnh Giấy ưu tiên'}
                    </span>
                    <span className="text-[10px] text-slate-400">JPG, PNG, WEBP</span>
                  </label>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg bg-white p-2 min-h-[120px] flex items-center justify-center relative">
                {priorityPreview ? (
                  <div className="relative text-center w-full">
                    <img
                      src={priorityPreview}
                      alt="Xem trước ưu tiên"
                      className="max-h-28 object-contain rounded shadow-xs mx-auto"
                    />
                    <button
                      type="button"
                      onClick={removePriorityImage}
                      className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 text-xs shadow"
                      title="Xóa ảnh"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs italic">
                    {formData.dien_uu_tien === 'KHONG' ? 'Không đăng ký diện ưu tiên' : 'Chưa chọn giấy tờ ưu tiên'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4. CAM ĐOAN THÔNG TIN */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <label
            htmlFor="confirm-checkbox"
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
              isConfirmed
                ? 'bg-blue-50/70 border-[#003366] text-slate-900 shadow-xs'
                : 'bg-white border-slate-300 hover:border-slate-400 text-slate-700'
            }`}
          >
            <input
              type="checkbox"
              id="confirm-checkbox"
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-[#003366] rounded border-slate-300 focus:ring-[#003366] cursor-pointer accent-[#003366] flex-shrink-0"
              required
            />
            <div className="text-xs sm:text-sm select-none">
              <span className="font-bold text-slate-900">
                Tôi xin cam đoan các thông tin kê khai và ảnh minh chứng là chính xác và trung thực.
              </span>
            </div>
          </label>
        </div>

        {/* NÚT SUBMIT */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-500">
            {!isConfirmed ? (
              <span className="text-amber-600 font-medium">
                * Chưa tích cam đoan thông tin (Nút nộp đang khóa)
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">
                ✓ Đã xác nhận cam đoan thông tin hợp lệ
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !isConfirmed}
            className={`w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-extrabold text-white shadow-md transition-all flex items-center justify-center space-x-2 ${
              isSubmitting
                ? 'bg-blue-800 cursor-wait'
                : !isConfirmed
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : isDaNangResident
                ? 'bg-red-600 hover:bg-red-700 hover:shadow-lg'
                : 'bg-[#F26422] hover:bg-[#D94F12] hover:shadow-lg shadow-orange-500/25'
            }`}
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>
              {isSubmitting
                ? submitStepText
                : !isConfirmed
                ? 'Vui Lòng Tích Cam Đoan Để Nộp'
                : isDaNangResident
                ? 'Nộp Đơn (Sẽ Bị Từ Chối Do Hộ Khẩu Đà Nẵng)'
                : 'Xác Nhận Nộp Hồ Sơ Đăng Ký Nội Trú'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
