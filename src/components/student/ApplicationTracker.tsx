'use client';

// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// THEO DÕI TIẾN TRÌNH VẬN HÀNH QUY TRÌNH TO-BE (BPMN)
// CÁ NHÂN HÓA TIẾN TRÌNH THEO TỪNG SINH VIÊN (CHỈ HIỆN CÁC BƯỚC THỰC TẾ)
// HỢP ĐỒNG ĐIỆN TỬ CHÍNH QUY, TRANG TRỌNG, ĐẦY ĐỦ ĐIỀU KHOẢN PHÁP LÝ (ZERO EMOJI)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppStatus } from '@/types/database';
import { STATUS_METADATA, getAssignedRoomForStudent, getStudentOtpCode } from '@/lib/constants/workflow';
import { getStudentRankInfo } from '@/lib/data/mock-students';
import StudentLoginModal from '@/components/student/StudentLoginModal';
import {
  signContractAction,
  resetWorkflowAction,
  submitSupplementEvidenceAction,
  declineContractAction,
} from '@/actions/approval';

interface ApplicationTrackerProps {
  initialStatus?: AppStatus;
}

export default function ApplicationTracker({ initialStatus = 'CHO_THAM_DINH' }: ApplicationTrackerProps) {
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [studentInfo, setStudentInfo] = useState({
    ho_ten: '',
    ma_sv: '',
    cccd: '',
    dien_uu_tien: '',
    diem_uu_tien: 0,
    email: '',
    khoa: 'Khoa Quản trị Kinh doanh',
    dia_chi_thuong_tru: '',
    so_dien_thoai: '',
    gioi_tinh: 'Nữ',
    status: 'CHO_THAM_DINH' as AppStatus,
    aiConfidence: 0.35,
  });

  const [studentRank, setStudentRank] = useState<number>(325);
  const [totalStudents, setTotalStudents] = useState<number>(358);
  const [searchMaSv, setSearchMaSv] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [allApplications, setAllApplications] = useState<any[]>([]);

  // HỘP THƯ THÔNG BÁO VÀ TẢI BỔ SUNG MINH CHỨNG
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);
  const [newCccdBase64, setNewCccdBase64] = useState<string | null>(null);
  const [newPriorityBase64, setNewPriorityBase64] = useState<string | null>(null);
  const [isSubmittingSupplement, setIsSubmittingSupplement] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('Không còn nhu cầu ở nội trú KTX');

  // TRẠNG THÁI QUY TRÌNH LIÊN THÔNG TỰ ĐỘNG
  const [workflowState, setWorkflowState] = useState<{
    currentStep: number;
    isRankingsFinalized: boolean;
    isPublished: boolean;
    isSigned?: boolean;
    isHandedOver?: boolean;
    isCancelled?: boolean;
    assignedRoom?: string;
  }>({
    currentStep: 3,
    isRankingsFinalized: false,
    isPublished: false,
    assignedRoom: 'Phòng 301 - Khu A (4 người)',
  });

  const [otpInput, setOtpInput] = useState('888888');
  const [agreeContract, setAgreeContract] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null);

  // ĐỒNG BỘ TRẠNG THÁI QUY TRÌNH TỪ SERVER (CHỈ CẬP NHẬT KHI CÓ THAY ĐỔI TRÁNH RE-RENDER GIẬT LAG)
  const fetchWorkflow = async () => {
    try {
      const res = await fetch('/api/workflow');
      const json = await res.json();
      if (json.success && json.workflow) {
        setWorkflowState((prev) => {
          if (
            prev.currentStep === json.workflow.currentStep &&
            prev.isRankingsFinalized === json.workflow.isRankingsFinalized &&
            prev.isPublished === json.workflow.isPublished
          ) {
            return prev; // Giữ nguyên object reference, tránh re-render giật giao diện
          }
          return json.workflow;
        });
      }
    } catch {}
  };

  // ĐỒNG BỘ DANH SÁCH THÔNG BÁO TỪ CÁN BỘ (IN-APP INBOX)
  const fetchNotifications = async (maSv?: string, email?: string) => {
    try {
      const code = maSv || studentInfo.ma_sv;
      const mail = email || studentInfo.email;
      if (!code && !mail) return;
      const res = await fetch(`/api/notifications?studentCode=${encodeURIComponent(code)}&email=${encodeURIComponent(mail)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setNotifications((prev) => {
          if (prev.length === json.data.length && JSON.stringify(prev) === JSON.stringify(json.data)) {
            return prev; // Giữ nguyên mảng cũ, tránh re-render giật giao diện
          }
          return json.data;
        });
      }
    } catch {}
  };

  // HÀM CHUYỂN ĐỔI HỒ SƠ SINH VIÊN HIỂN THỊ (CỐ ĐỊNH PHIÊN KHÔNG NHẢY TÀI KHOẢN)
  const applyStudent = (app: any, list: any[] = allApplications) => {
    if (!app) return;
    const finalStatus: AppStatus = app.status || 'CHO_THAM_DINH';
    const confidence: number =
      app.ai_result?.confidence ??
      app.aiConfidence ??
      (finalStatus === 'THAM_DINH_DAT' ? 0.98 : 0.35);

    const resolved = {
      ho_ten: app.ho_ten || '',
      ma_sv: app.ma_sv || '',
      cccd: app.cccd || '',
      dien_uu_tien: app.dien_uu_tien_label || app.dien_uu_tien || 'Không thuộc diện ưu tiên',
      diem_uu_tien: app.diem_uu_tien ?? 0,
      email: app.email || (app.ma_sv ? `${app.ma_sv.toLowerCase()}@due.udn.vn` : ''),
      khoa: app.khoa || '50K - Quản trị Kinh doanh',
      dia_chi_thuong_tru: app.dia_chi_thuong_tru || 'Quảng Nam',
      so_dien_thoai: app.so_dien_thoai || '0905123456',
      gioi_tinh: app.gioi_tinh || 'Nữ',
      status: finalStatus,
      aiConfidence: confidence,
    };
    setStudentInfo(resolved);
    setStatus(finalStatus);
    const rankInfo = getStudentRankInfo(app.ma_sv, list);
    setStudentRank(rankInfo.rank);
    setTotalStudents(rankInfo.total);
    fetchNotifications(app.ma_sv, app.email);
    try {
      localStorage.setItem('last_submitted_student', JSON.stringify(resolved));
      localStorage.setItem('active_student_session_code', app.ma_sv);
      // Bắn sự kiện đồng bộ với nhãn _source: 'tracker' để tránh tự trigger vòng lặp
      window.dispatchEvent(new CustomEvent('student_session_changed', { detail: { ...resolved, _source: 'tracker' } }));
    } catch {}
  };

  // Nạp thông tin sinh viên thực tế vừa submit từ CSDL hoặc localStorage
  useEffect(() => {
    fetchWorkflow();
    fetchNotifications();

    // 0. Khôi phục ngay từ localStorage để tránh chớp trạng thái khi reload trang
    try {
      const lastRaw = localStorage.getItem('last_submitted_student');
      if (lastRaw) {
        const parsed = JSON.parse(lastRaw);
        if (parsed && (parsed.ma_sv || parsed.ho_ten)) {
          setStudentInfo((prev) => ({ ...prev, ...parsed }));
          if (parsed.status) {
            setStatus(parsed.status);
          }
        }
      }
    } catch {}

    const handleOpenLogin = () => setShowLoginModal(true);
    window.addEventListener('open_student_login_modal', handleOpenLogin);

    // 1. Fetch danh sách từ API CSDL thực tế
    fetch('/api/applications')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setAllApplications(json.data);

          let target = null;
          try {
            // Ưu tiên 1: Mã sinh viên đã được khóa trong active_student_session_code
            const activeCode = localStorage.getItem('active_student_session_code');
            if (activeCode) {
              target = json.data.find((x: any) => x.ma_sv === activeCode);
            }
            // Ưu tiên 2: Hồ sơ lưu trong last_submitted_student
            if (!target) {
              const lastRaw = localStorage.getItem('last_submitted_student');
              if (lastRaw) {
                const parsed = JSON.parse(lastRaw);
                target = json.data.find((x: any) => x.ma_sv === parsed.ma_sv || x.ho_ten === parsed.ho_ten);
              }
            }
          } catch {}

          // Áp dụng hồ sơ nếu người dùng đã đăng nhập hoặc nộp đơn
          if (target) {
            applyStudent(target, json.data);
          }
        }
      })
      .catch((err) => console.warn('Lỗi nạp dữ liệu tracker:', err));

    // HÀM ĐỒNG BỘ TỨC THÌ KHI CÁN BỘ DUYỆT MINH CHỨNG (INSTANT REFRESH 0MS)
    const refreshImmediately = () => {
      fetchWorkflow();
      const currentCode = localStorage.getItem('active_student_session_code');
      fetch('/api/applications')
        .then((r) => r.json())
        .then((j) => {
          if (j.success && Array.isArray(j.data)) {
            setAllApplications(j.data);
            let targetCode = currentCode;
            if (!targetCode) {
              try {
                const raw = localStorage.getItem('last_submitted_student');
                if (raw) {
                  const parsed = JSON.parse(raw);
                  targetCode = parsed.ma_sv;
                }
              } catch {}
            }
            if (targetCode) {
              const found = j.data.find((x: any) => x.ma_sv === targetCode);
              if (found) {
                const newStatus = found.status || 'CHO_THAM_DINH';
                setStatus((prev) => (prev !== newStatus ? newStatus : prev));
                setStudentInfo((prev) => {
                  if (
                    prev.status === newStatus &&
                    prev.diem_uu_tien === (found.diem_uu_tien ?? prev.diem_uu_tien) &&
                    prev.gioi_tinh === (found.gioi_tinh || prev.gioi_tinh || 'Nữ') &&
                    prev.ho_ten === found.ho_ten &&
                    prev.ma_sv === found.ma_sv
                  ) {
                    return prev;
                  }
                  return {
                    ...prev,
                    status: newStatus,
                    gioi_tinh: found.gioi_tinh || prev.gioi_tinh || 'Nữ',
                    diem_uu_tien: found.diem_uu_tien ?? prev.diem_uu_tien,
                    aiConfidence: found.ai_result?.confidence ?? prev.aiConfidence,
                  };
                });
                const rankInfo = getStudentRankInfo(found.ma_sv, j.data);
                setStudentRank((prev) => (prev !== rankInfo.rank ? rankInfo.rank : prev));
                setTotalStudents((prev) => (prev !== rankInfo.total ? rankInfo.total : prev));
              }
            }
          }
        })
        .catch(() => {});
    };

    // 1. Kênh BroadcastChannel đồng bộ cross-tab tức thì 0ms
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('ktx_sync');
      bc.onmessage = () => {
        refreshImmediately();
      };
    }

    // 2. Lắng nghe chuyển tab quay lại (visibilitychange & window focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshImmediately();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', refreshImmediately);

    // 3. Polling dự phòng 5s (nhẹ nhàng, không giật/nhảy trang)
    const interval = setInterval(() => {
      refreshImmediately();
    }, 5000);

    // Lắng nghe sự kiện nộp hồ sơ mới từ form (chỉ kích hoạt khi form submit đơn mới)
    const handleStudentSubmitted = (e: any) => {
      fetch('/api/applications')
        .then((res) => res.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setAllApplications(json.data);
            const detailCode = e.detail?.ma_sv || e.detail?.studentCode;
            const detailName = e.detail?.ho_ten || e.detail?.studentName;
            const found = json.data.find(
              (x: any) =>
                (detailCode && x.ma_sv === detailCode) ||
                x.id === e.detail?.applicationId ||
                (detailName && x.ho_ten === detailName)
            );
            if (found) {
              applyStudent(found, json.data);
            }
          }
        })
        .catch(() => {});
    };

    // Lắng nghe sự kiện đổi/đăng xuất phiên sinh viên từ Navbar
    const handleSessionChanged = (e: any) => {
      if (!e.detail) {
        setStudentInfo({
          ho_ten: '',
          ma_sv: '',
          cccd: '',
          dien_uu_tien: '',
          diem_uu_tien: 0,
          email: '',
          khoa: 'Khoa Quản trị Kinh doanh',
          dia_chi_thuong_tru: '',
          so_dien_thoai: '',
          gioi_tinh: 'Nữ',
          status: 'CHO_THAM_DINH',
          aiConfidence: 0.35,
        });
        setNotifications([]);
        setStatus('CHO_THAM_DINH');
      } else {
        // Tránh vòng lặp phản hồi nếu chính tracker phát ra sự kiện
        if (e.detail._source === 'tracker') return;
        applyStudent(e.detail);
      }
    };

    window.addEventListener('student_application_submitted', handleStudentSubmitted);
    window.addEventListener('student_session_changed', handleSessionChanged);

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', refreshImmediately);
      window.removeEventListener('student_application_submitted', handleStudentSubmitted);
      window.removeEventListener('student_session_changed', handleSessionChanged);
      window.removeEventListener('open_student_login_modal', handleOpenLogin);
    };
  }, []);

  // Tra cứu theo Mã SV, CCCD hoặc Họ tên (Đồng bộ phiên cố định)
  const handleSearchStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchMaSv.trim()) return;

    fetch('/api/applications')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          const q = searchMaSv.trim().toLowerCase();
          const found = json.data.find(
            (x: any) =>
              x.ma_sv.toLowerCase() === q ||
              x.cccd === searchMaSv.trim() ||
              x.ho_ten.toLowerCase().includes(q)
          );
          if (found) {
            applyStudent(found, json.data);
            const rankInfo = getStudentRankInfo(found.ma_sv, json.data);
            setActionMessage(`✓ Đã đăng nhập vào hồ sơ sinh viên: ${found.ho_ten} (${found.ma_sv}) - Vị trí BXH: #${rankInfo.rank}.`);
          } else {
            setActionMessage(`Không tìm thấy hồ sơ với thông tin "${searchMaSv}".`);
          }
        }
      });
  };

  // XỬ LÝ CHỌN FILE VÀ NỘP BỔ SUNG MINH CHỨNG
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'cccd' | 'priority') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === 'cccd') setNewCccdBase64(base64);
      else setNewPriorityBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSupplementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCccdBase64 && !newPriorityBase64) {
      alert('Vui lòng chọn ít nhất một ảnh minh chứng để tải lên!');
      return;
    }
    setIsSubmittingSupplement(true);
    try {
      const res = await submitSupplementEvidenceAction({
        studentCode: studentInfo.ma_sv,
        newCccdBase64: newCccdBase64 || undefined,
        newPriorityBase64: newPriorityBase64 || undefined,
      });
      if (res.success) {
        const isApproved = Boolean(res.isAutoApproved ?? ((res as any).aiAnalysis?.decision === 'THAM_DINH_DAT'));
        setStatus(isApproved ? 'THAM_DINH_DAT' : 'CHO_THAM_DINH');
        if (isApproved && (res as any).awardedPoints) {
          setStudentInfo((prev) => ({
            ...prev,
            diem_uu_tien: (res as any).awardedPoints,
          }));
        }
        setWorkflowNotice(res.message);
        setShowUploadModal(false);
        setNewCccdBase64(null);
        setNewPriorityBase64(null);
        await fetchNotifications();

        // Tự động tải lại CSDL và xếp hạng mới để hiển thị thứ hạng đã thăng hạng
        try {
          const appRes = await fetch('/api/applications');
          const appJson = await appRes.json();
          if (appJson.success && Array.isArray(appJson.data)) {
            setAllApplications(appJson.data);
            const rankInfo = getStudentRankInfo(studentInfo.ma_sv, appJson.data);
            setStudentRank(rankInfo.rank);
            setTotalStudents(rankInfo.total);
          }
        } catch {}
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSubmittingSupplement(false);
    }
  };

  // SINH VIÊN KÝ HỢP ĐỒNG ĐIỆN TỬ BẰNG OTP
  const handleSignContract = async () => {
    if (!agreeContract) {
      alert('Vui lòng tích chọn cam kết đồng ý với các điều khoản của Hợp đồng trước khi ký số!');
      return;
    }
    if (!otpInput.trim()) {
      alert('Vui lòng nhập mã OTP xác thực ký số điện tử!');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await signContractAction(studentInfo.ma_sv, otpInput.trim(), studentInfo.ma_sv);
      if (res.success) {
        await fetch('/api/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sign' }),
        });
        await fetchWorkflow();
        setStatus('DA_KY');
        setWorkflowNotice('Ký hợp đồng điện tử thành công (SIGNED). Suất nội trú đã chuyển sang trạng thái ĐÃ GIỮ CHỖ và sẵn sàng tiếp nhận phòng.');
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert('Lỗi ký hợp đồng: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // RESET TIẾN TRÌNH VỀ BƯỚC 3 ĐỂ DEMO LẠI
  const handleResetWorkflow = async () => {
    try {
      await resetWorkflowAction();
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      await fetchWorkflow();
      setStatus('THAM_DINH_DAT');
      setWorkflowNotice('Đã thiết lập lại quy trình về Bước 3: Đang chờ Trưởng Ban phê duyệt.');
    } catch {}
  };

  // SINH VIÊN TỪ CHỐI NHẬN PHÒNG / TỪ CHỐI KÝ HỢP ĐỒNG (HUY_SUAT)
  const handleDeclineContract = async () => {
    setIsProcessing(true);
    try {
      const res = await declineContractAction(
        studentInfo.ma_sv,
        studentInfo.ma_sv,
        declineReason || 'Sinh viên chủ động từ chối nhận phòng KTX tại bước ký hợp đồng.'
      );
      if (res.success) {
        setStatus('HUY_SUAT');
        setShowDeclineModal(false);
        setWorkflowNotice(res.message);
        await fetchWorkflow();
        await fetchNotifications();
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ==============================================================================
  // CÁ NHÂN HÓA TIẾN TRÌNH: CHỈ HIỂN THỊ TIẾN ĐỘ THỰC TẾ CỦA SINH VIÊN ĐÓ
  // BƯỚC "AI SOẠN EMAIL YC BỔ SUNG" VÀ "NỘP BỔ SUNG" CHỈ HIỆN KHI CẦN BỔ SUNG
  // CHỈ TIÊU KTX ĐỢT 1 LÀ 120 CHỖ: CHỈ SINH VIÊN CÓ THỨ HẠNG <= 120 MỚI ĐƯỢC TRÚNG TUYỂN
  // ==============================================================================
  const isPendingReview = status === 'CHO_THAM_DINH';
  const isCancelled = status === 'HUY_SUAT';
  const isSupplement = status === 'CAN_BO_SUNG';
  const isApprovedEvidence =
    status === 'THAM_DINH_DAT' ||
    status === 'DA_DUYET' ||
    status === 'DA_PHAT_HANH' ||
    status === 'DA_KY';
  const isAdmitted = !isPendingReview && !isSupplement && !isCancelled && studentRank > 0 && studentRank <= 120;

  // PHÂN BỔ PHÒNG VÀ MÃ OTP CÁ NHÂN DUY NHẤT CHO TỪNG SINH VIÊN (1 NGƯỜI 1 PHÒNG & 1 MÃ OTP)
  const personalRoom = getAssignedRoomForStudent(
    { ma_sv: studentInfo.ma_sv, gioi_tinh: studentInfo.gioi_tinh, rank: studentRank },
    studentRank
  );
  const personalOtp = getStudentOtpCode(studentInfo.ma_sv);

  // TIẾN TRÌNH 5 BƯỚC CỐ ĐỊNH CHUẨN XUYÊN SUỐT TOÀN QUY TRÌNH (KHÔNG NHẢY BƯỚC, KHÔNG ĐỔI SỐ LƯỢNG)
  const studentSteps = [
    {
      num: 1,
      title: '1. Nộp hồ sơ',
      desc: 'Đã lưu CSDL',
    },
    {
      num: 2,
      title: '2. Thẩm định minh chứng',
      desc:
        status === 'CAN_BO_SUNG'
          ? 'Cần bổ sung (Hạn 48h)'
          : status === 'CHO_THAM_DINH'
          ? 'Chờ cán bộ QLSV rà soát'
          : 'Đã thẩm định đạt (✓)',
    },
    {
      num: 3,
      title: '3. Phê duyệt & Công bố',
      desc:
        workflowState.isPublished
          ? 'Đã công bố danh sách'
          : workflowState.isRankingsFinalized
          ? 'Trưởng ban đã duyệt (B2)'
          : 'Chờ Trưởng ban duyệt (B2)',
    },
    {
      num: 4,
      title: '4. Ký hợp đồng OTP',
      desc: workflowState.isSigned ? 'Đã ký số thành công' : 'Thời hạn 72h',
    },
    {
      num: 5,
      title: '5. Tiếp nhận & Bàn giao',
      desc: workflowState.isHandedOver ? 'Đã bàn giao phòng' : 'Bàn giao chìa khóa',
    },
  ];

  // TÍNH TOÁN SỐ THỨ TỰ BƯỚC HIỆN TẠI (TỪ 1 ĐẾN 5 ĐỒNG NHẤT 100% VỚI NỘI DUNG CARD BÊN DƯỚI)
  let currentStepNumber = 2;
  if (isCancelled) {
    currentStepNumber = 5;
  } else if (workflowState.isHandedOver || workflowState.isSigned) {
    currentStepNumber = 5; // Bước 5: Tiếp nhận phòng & bàn giao
  } else if (workflowState.isPublished && isAdmitted) {
    currentStepNumber = 4; // Bước 4: Mở cổng ký hợp đồng điện tử 72h
  } else if (workflowState.isRankingsFinalized) {
    currentStepNumber = 3; // Bước 3: Trưởng ban đã ký B2
  } else if (isApprovedEvidence || (studentInfo.diem_uu_tien > 0 && status !== 'CHO_THAM_DINH' && status !== 'CAN_BO_SUNG')) {
    currentStepNumber = 3; // Bước 3: Minh chứng đã duyệt đạt, đang chờ Trưởng ban duyệt B2
  } else {
    // status === 'CHO_THAM_DINH' hoặc status === 'CAN_BO_SUNG'
    currentStepNumber = 2; // Bước 2: Thẩm định minh chứng
  }

  // Điều kiện để ẩn cột "Thông tin hồ sơ đã ghi nhận" và hiển thị toàn màn hình Hợp đồng
  const isContractOrHandoverStep =
    !isPendingReview &&
    !isCancelled &&
    status !== 'CAN_BO_SUNG' &&
    workflowState.isRankingsFinalized &&
    isAdmitted &&
    (workflowState.isPublished || workflowState.isSigned);

  // NẾU CHƯA CÓ PHIÊN ĐĂNG NHẬP SINH VIÊN (CHƯA ĐĂNG NHẬP VÀ CHƯA NỘP ĐƠN)
  if (!studentInfo.ma_sv) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto shadow-sm my-6 animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#003366] mx-auto flex items-center justify-center text-3xl mb-4 border border-blue-100 shadow-inner">
          🎓
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Cổng Tra Cứu &amp; Ký Hợp Đồng KTX DUE
        </h2>
        <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          Hiện tại chưa có phiên sinh viên đăng nhập. Vui lòng đăng nhập bằng Mã sinh viên (MSSV), CCCD hoặc Họ tên để theo dõi tiến trình thẩm định và ký hợp đồng giữ chỗ trực tuyến, hoặc nộp đơn đăng ký mới.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setShowLoginModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#003366] hover:bg-blue-900 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center space-x-2"
          >
            <span>🔑 Đăng Nhập Tài Khoản Sinh Viên</span>
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem('student_page_tab', 'form');
                window.dispatchEvent(new CustomEvent('switch_student_tab', { detail: 'form' }));
              } catch {}
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-2"
          >
            <span>📝 Nộp Đơn Đăng Ký Mới</span>
          </button>
        </div>

        <StudentLoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          currentStudentCode={studentInfo.ma_sv}
          onSelectStudent={(st) => {
            applyStudent(st, allApplications);
            setActionMessage(`✓ Đã đăng nhập vào hồ sơ sinh viên: ${st.ho_ten} (${st.ma_sv})`);
            setShowLoginModal(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#072E54] via-[#0B4378] to-[#125FA9] px-6 py-4 text-white flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div className="flex-1 flex items-center space-x-3">
          <div className="bg-white rounded-lg px-2.5 py-1 shadow-sm shrink-0 hidden sm:flex items-center">
            <img
              src="/images/due-logo.png"
              alt="Đại học Kinh tế - ĐH Đà Nẵng"
              className="h-8 w-auto object-contain"
            />
          </div>
          <div>
            <h2 className="text-lg font-bold">Cổng Quản Lý Tuyển Sinh Nội Trú KTX DUE</h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Sinh viên: <strong className="text-white">{studentInfo.ho_ten}</strong> | MSSV:{' '}
              <strong className="text-white font-mono">{studentInfo.ma_sv}</strong> | Giới tính: <strong className="text-white">{studentInfo.gioi_tinh || 'Nữ'}</strong>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* NÚT MỞ MODAL ĐĂNG NHẬP / CHỌN TÀI KHOẢN */}
          <button
            type="button"
            onClick={() => setShowLoginModal(true)}
            className="px-3 py-1.5 bg-[#F26422] hover:bg-[#D94F12] text-white rounded-lg text-xs font-black shadow flex items-center space-x-1.5 transition"
            title="Đăng nhập hoặc tra cứu hồ sơ sinh viên khác theo MSSV"
          >
            <span>🔑 Đăng Nhập / Đổi SV</span>
          </button>

          {/* NÚT ĐĂNG XUẤT */}
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem('last_submitted_student');
                localStorage.removeItem('active_student_session_code');
                localStorage.setItem('student_page_tab', 'form');
                window.dispatchEvent(new CustomEvent('student_session_changed', { detail: null }));
                window.dispatchEvent(new CustomEvent('switch_student_tab', { detail: 'form' }));
              } catch {}
            }}
            className="px-2.5 py-1.5 bg-rose-500/80 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
            title="Đăng xuất khỏi tài khoản này"
          >
            <span>🚪 Đăng xuất</span>
          </button>

          {/* NÚT MỞ HỘP THƯ ĐIỆN TỬ KTX */}
          <button
            type="button"
            onClick={() => setShowInboxModal(true)}
            className="relative px-3 py-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg text-xs shadow border border-white/20 flex items-center space-x-1.5 transition"
            title="Xem danh sách thông báo và văn bản từ Ban Quản lý KTX"
          >
            <span>✉️ Hộp Thư Thông Báo</span>
            {notifications.length > 0 && (
              <span className="w-4 h-4 bg-[#F26422] text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {notifications.length}
              </span>
            )}
          </button>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow">
            {isCancelled
              ? 'Đã Từ Chối Nhận Phòng'
              : workflowState.isHandedOver
              ? 'Đã Bàn Giao Phòng (E2)'
              : workflowState.isSigned
              ? 'Đã Ký Hợp Đồng (SIGNED)'
              : isPendingReview
              ? 'Chờ Cán Bộ Rà Soát'
              : workflowState.isPublished && isAdmitted
              ? 'Đã Phát Hành HĐ (72h)'
              : workflowState.isPublished && !isAdmitted
              ? 'Danh Sách Chờ'
              : workflowState.isRankingsFinalized
              ? 'Trưởng Ban Đã Duyệt (B2)'
              : status === 'CAN_BO_SUNG'
              ? 'Cần Bổ Sung Minh Chứng'
              : 'Đã Tiếp Nhận Hồ Sơ'}
          </span>
          {workflowState.isRankingsFinalized && (
            <button
              type="button"
              onClick={handleResetWorkflow}
              className="px-2.5 py-1 text-[11px] bg-blue-800 hover:bg-blue-700 text-blue-100 rounded border border-blue-400/40"
            >
              Thiết Lập Lại
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Thông báo thao tác quy trình */}
        {workflowNotice && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold shadow-sm flex items-center justify-between">
            <span>{workflowNotice}</span>
            <button
              type="button"
              onClick={() => setWorkflowNotice(null)}
              className="text-slate-400 hover:text-slate-700 font-bold ml-2 text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tra cứu sinh viên */}
        <form onSubmit={handleSearchStudent} className="flex gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <input
            type="text"
            placeholder="Tra cứu hồ sơ khác (Nhập MSSV hoặc CCCD)..."
            value={searchMaSv}
            onChange={(e) => setSearchMaSv(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
          <button type="submit" className="px-4 py-1.5 bg-[#003366] hover:bg-blue-900 text-white font-bold rounded">
            Tìm Kiếm
          </button>
        </form>

        {actionMessage && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs font-semibold">
            {actionMessage}
          </div>
        )}

        {/* GIAI ĐOẠN 3B: TRƯỞNG BAN ĐÃ DUYỆT – CHỜ CÁN BỘ QLSV GỬI EMAIL */}
        {workflowState.isRankingsFinalized && !workflowState.isPublished && !isPendingReview && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-indigo-300 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 bg-[#003366] text-white text-[10px] font-bold rounded uppercase">
                  Bước 3: Đã Phê Duyệt Tuyển Sinh
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                  {isAdmitted ? '✓ Bạn Thuộc Top 120 Trúng Tuyển' : 'Danh Sách Chờ'}
                </span>
              </div>
              <h4 className="font-bold text-sm text-[#003366]">
                {isAdmitted
                  ? '🎉 Chúc Mừng: Trưởng Ban KTX Đã Ký Quyết Định Phê Duyệt Bạn Trúng Tuyển!'
                  : 'Hồ Sơ Của Bạn Đã Được Trưởng Ban KTX Ký Duyệt Xếp Hạng'}
              </h4>
              <p className="text-slate-600 text-xs leading-relaxed max-w-2xl">
                {isAdmitted
                  ? 'Trưởng Ban Quản lý KTX đã ký quyết định phê duyệt danh sách trúng tuyển đợt 1. Cán bộ QLSV đang tiến hành phát hành thông báo trúng tuyển kèm Hợp đồng điện tử 72h tới bạn.'
                  : 'Trưởng ban đã phê duyệt danh sách chính thức. Vị trí của bạn đang ở danh sách chờ và sẽ được xét bổ sung nếu có thí sinh từ chối.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/officer"
                className="px-3.5 py-2 bg-[#003366] hover:bg-blue-900 text-white font-bold rounded-lg text-xs shadow transition flex items-center space-x-1"
              >
                <span>✉️</span>
                <span>Cổng QLSV: Phát Hành Thông Báo &rarr;</span>
              </Link>
            </div>
          </div>
        )}

        {/* GIAI ĐOẠN 4: ĐÃ PHÁT HÀNH EMAIL – TOP 120 */}
        {workflowState.isPublished && !workflowState.isSigned && isAdmitted && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-400 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-emerald-700 text-white text-[10px] font-bold rounded uppercase">
                  Trúng Tuyển Nội Trú
                </span>
                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">
                  Hạn Ký Số: 72h
                </span>
              </div>
              <h4 className="font-bold text-sm text-emerald-950 mt-1">
                Chúc mừng bạn đã được phân bổ: {personalRoom}
              </h4>
              <p className="text-slate-700 mt-0.5 text-xs">
                Mã OTP ký hợp đồng cá nhân: <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 text-[#003366] font-black">{personalOtp}</strong> (hoặc mã nghiệm thu 888888)
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('formal-contract-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-4 py-2 bg-[#003366] hover:bg-blue-900 text-white font-bold rounded-lg shadow-xs text-xs whitespace-nowrap transition"
            >
              Xem &amp; Ký Hợp Đồng &darr;
            </button>
          </div>
        )}

        {/* GIAI ĐOẠN 4: DANH SÁCH CHỜ */}
        {workflowState.isPublished && !isAdmitted && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded uppercase">
                  Danh Sách Chờ
                </span>
                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-bold rounded-full">
                  Hạng #{studentRank} / {totalStudents} (Dự bị #{studentRank - 120})
                </span>
              </div>
              <h4 className="font-bold text-sm text-amber-950 mt-1">
                Hồ sơ đang ở danh sách chờ xét tuyển bổ sung
              </h4>
              <p className="text-amber-800 mt-0.5 text-xs">
                Chỉ tiêu đợt 1 (120 chỗ) đã hoàn tất. Hệ thống sẽ tự động gọi tiếp theo thứ hạng nếu có thí sinh hủy phòng.
              </p>
            </div>
            <Link
              href={`/ranking?search=${encodeURIComponent(studentInfo.ma_sv)}`}
              className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-xs shadow-xs transition"
            >
              Xem Bảng Xếp Hạng &rarr;
            </Link>
          </div>
        )}

        {/* CẢNH BÁO BỔ SUNG MINH CHỨNG (CHỈ HIỂN THỊ KHI ĐANG Ở TRẠNG THÁI CẦN BỔ SUNG) */}
        {status === 'CAN_BO_SUNG' && (
          <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl shadow-sm text-amber-950 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black uppercase text-amber-900 tracking-wide flex items-center gap-2">
                  <span>Yêu Cầu Bổ Sung Minh Chứng Trong 48 Giờ</span>
                  <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-bold rounded-full">
                    Hạn 48h
                  </span>
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Bộ phận Quản lý Sinh viên đã thẩm định hồ sơ của bạn và phát hiện minh chứng cần bổ sung bản chụp rõ nét hơn.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-xs shadow transition whitespace-nowrap self-end sm:self-auto"
              >
                Tải Lại Minh Chứng Bổ Sung
              </button>
            </div>

            {notifications.find((n) => n.loai === 'YEU_CAU_BO_SUNG') && (
              <div className="p-3 bg-white border border-amber-300 rounded-lg text-xs space-y-1.5">
                <div className="font-bold text-amber-900 flex items-center justify-between">
                  <span>Văn bản: {notifications.find((n) => n.loai === 'YEU_CAU_BO_SUNG')?.tieu_de}</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {new Date(notifications.find((n) => n.loai === 'YEU_CAU_BO_SUNG')?.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div
                  className="text-slate-700 max-h-36 overflow-y-auto border-t border-slate-100 pt-1"
                  dangerouslySetInnerHTML={{
                    __html: notifications.find((n) => n.loai === 'YEU_CAU_BO_SUNG')?.noi_dung || '',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* THÔNG BÁO TIẾP NHẬN MINH CHỨNG BỔ SUNG (KHI ĐÃ NỘP VÀ ĐANG CHỜ CÁN BỘ QLSV RÀ SOÁT - KHÔNG CÒN NÚT TẢI LẠI) */}
        {status === 'CHO_THAM_DINH' && notifications.some((n) => n.loai === 'YEU_CAU_BO_SUNG') && (
          <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-xl shadow-sm text-purple-950 space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="text-base">🔄</span>
              <h4 className="text-sm font-bold text-purple-900">
                Đã Tiếp Nhận Minh Chứng Bổ Sung Thành Công
              </h4>
              <span className="px-2 py-0.5 bg-purple-200 text-purple-900 text-[10px] font-bold rounded-full">
                Đang chờ Cán bộ QLSV rà soát
              </span>
            </div>
            <p className="text-xs text-purple-800 leading-relaxed">
              Bạn đã gửi lại minh chứng thành công. Do độ tin cậy AI &lt; 95%, hệ thống đã chuyển hồ sơ sang Cổng Cán bộ QLSV (Tab <strong>"Duyệt Minh Chứng Bổ Sung"</strong>) để đối chiếu thủ công trước khi duyệt điểm ưu tiên.
            </p>
          </div>
        )}

        {/* BẢN ĐỒ TIẾN TRÌNH CÁ NHÂN HÓA THEO HÀNH TRÌNH THỰC TẾ CỦA SINH VIÊN */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tiến Trình Hồ Sơ Của Bạn (Hiện tại: Bước {currentStepNumber} / {studentSteps.length})
            </h3>
            <span className="text-[11px] text-[#003366] font-bold">
              {currentStepNumber === 2
                ? status === 'CAN_BO_SUNG'
                  ? 'Cần bổ sung minh chứng trong 48h (Bước 2)'
                  : 'Hồ sơ đang trong hàng đợi Cán bộ QLSV thẩm định (Bước 2)'
                : currentStepNumber === 3
                ? workflowState.isRankingsFinalized
                  ? 'Trưởng Ban đã ký duyệt B2 – Chờ cán bộ phát hành (Bước 3)'
                  : 'Bước 2 đã duyệt xong – Đang chờ Trưởng Ban phê duyệt (Bước 3)'
                : currentStepNumber === 4
                ? 'Đang mở Cổng Ký Hợp Đồng Điện Tử (Thời hạn 72h)'
                : currentStepNumber === 5
                ? workflowState.isHandedOver
                  ? 'Đã hoàn tất bàn giao phòng – Quy trình kết thúc'
                  : 'Đã ký hợp đồng – Sẵn sàng tiếp nhận phòng'
                : 'Đã hoàn tất quy trình'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {studentSteps.map((s) => {
              const isPast = s.num < currentStepNumber;
              const isCurrent = s.num === currentStepNumber;

              return (
                <div
                  key={s.num}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    isCurrent
                      ? 'bg-[#003366] text-white border-[#003366] shadow-md scale-102 ring-2 ring-[#FFB800]'
                      : isPast
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block w-5 h-5 leading-5 rounded-full text-[10px] font-extrabold mb-1 ${
                      isCurrent
                        ? 'bg-[#FFB800] text-[#003366]'
                        : isPast
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isPast ? '✓' : s.num}
                  </span>
                  <div className="text-[11px] font-bold truncate leading-tight">{s.title}</div>
                  <div className="text-[9px] opacity-80 mt-0.5 truncate">{s.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============================================================================== */}
        {/* PHÂN VÙNG NỘI DUNG CHÍNH: */}
        {/* NẾU ĐẾN BƯỚC KÝ HỢP ĐỒNG / BÀN GIAO: ẨN CỘT THÔNG TIN HỒ SƠ RIÊNG LẺ, */}
        {/* HIỂN THỊ HỢP ĐỒNG ĐIỆN TỬ CHÍNH QUY TOÀN TRANG (FULL-WIDTH LEGAL CONTRACT) */}
        {/* ============================================================================== */}

        {isContractOrHandoverStep ? (
          <div id="formal-contract-section" className="space-y-8 pt-4 border-t border-slate-200">
            {/* NẾU ĐÃ KÝ: HIỂN THỊ THÊM GIẤY BÁO TIẾP NHẬN NỘI TRÚ VÀ LỊCH HẸN BÀN GIAO PHÒNG (BƯỚC 9) */}
            {workflowState.isSigned && (
              <div className="bg-white border-2 border-emerald-600 rounded-xl shadow-md p-6 sm:p-8 space-y-5 text-slate-900">
                {/* Tiêu ngữ giấy báo tiếp nhận */}
                <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="text-xs uppercase font-bold text-slate-700">ĐẠI HỌC ĐÀ NẴNG</div>
                    <div className="text-xs uppercase font-black text-[#003366]">TRƯỜNG ĐẠI HỌC KINH TẾ</div>
                    <div className="text-xs font-bold text-slate-600">BAN QUẢN LÝ KÝ TÚC XÁ</div>
                  </div>
                  <div className="sm:text-right text-xs">
                    <div className="font-mono font-bold text-slate-700">
                      Số: {studentInfo.ma_sv}/GB-KTX-DUE
                    </div>
                    <div className="text-slate-500 italic">Đà Nẵng, ngày 28 tháng 10 năm 2026</div>
                  </div>
                </div>

                <div className="text-center py-2">
                  <h3 className="text-base sm:text-lg font-black text-[#003366] uppercase tracking-wide">
                    GIẤY BÁO TIẾP NHẬN NỘI TRÚ VÀ LỊCH HẸN BÀN GIAO PHÒNG Ở
                  </h3>
                  <div className="text-xs text-slate-500 mt-1">
                    Năm học 2026 – 2027 (Kèm theo Hợp đồng số: {studentInfo.ma_sv}/2026/HĐ-KTX-DUE)
                  </div>
                </div>

                <div className="text-xs space-y-3 leading-relaxed text-slate-800">
                  <p>
                    Kính gửi: Sinh viên <strong>{studentInfo.ho_ten}</strong> (Mã SV: <strong className="font-mono">{studentInfo.ma_sv}</strong>) – Lớp/Khóa: <strong>{studentInfo.khoa}</strong>.
                  </p>
                  <p>
                    Căn cứ Hợp đồng cho thuê chỗ ở nội trú Ký túc xá đã được hai bên giao kết và xác thực chữ ký số điện tử thành công. Ban Quản lý Ký túc xá Trường Đại học Kinh tế – Đại học Đà Nẵng trân trọng thông báo kế hoạch bàn giao phòng ở như sau:
                  </p>

                  <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-2">
                    <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-600 font-semibold">1. Vị trí phòng nội trú bố trí:</span>
                      <strong className="text-[#003366] text-sm">{personalRoom}</strong>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-600 font-semibold">2. Thời gian tiếp nhận:</span>
                      <strong className="text-slate-900">Từ 08 giờ 00 phút đến 17 giờ 00 phút, ngày 01 tháng 09 năm 2026</strong>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-600 font-semibold">3. Địa điểm làm thủ tục:</span>
                      <strong className="text-slate-900">Văn phòng Ban Quản lý Ký túc xá DUE – Số 71 Ngũ Hành Sơn, TP. Đà Nẵng</strong>
                    </div>
                    <div className="py-1">
                      <span className="text-slate-600 font-semibold block mb-1">4. Hồ sơ thủ tục bắt buộc mang theo khi đến nhận phòng KTX:</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-700 pl-2">
                        <li>Bản gốc Căn cước công dân (CCCD) để đối chiếu thông tin định danh cá nhân.</li>
                        <li>Bản gốc Giấy chứng nhận đối tượng ưu tiên để lưu trữ hồ sơ theo quy định tuyển sinh.</li>
                        <li>02 ảnh thẻ kích cỡ 3x4 (ghi rõ Họ tên, MSSV, Phòng sau ảnh) để làm Thẻ nội trú KTX.</li>
                        <li>Khoản tiền bảo đảm cơ sở vật chất (ký quỹ hoàn lại): 500.000 VNĐ.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-950 font-semibold flex items-center justify-between">
                    <div>
                      <span>TRẠNG THÁI TIẾP NHẬN: </span>
                      <strong className="text-emerald-900">
                        {workflowState.isHandedOver
                          ? 'ĐÃ HOÀN TẤT BÀN GIAO PHÒNG (E2) & KÍCH HOẠT PORTAL NỘI TRÚ'
                          : 'HỢP ĐỒNG ĐÃ ĐƯỢC KÝ SỐ THÀNH CÔNG (SIGNED) – PHÒNG ĐÃ KHÓA GIỮ CHỖ (DOB_PH)'}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded text-xs font-bold shadow-xs transition"
                    >
                      In Giấy Báo
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HỢP ĐỒNG CHO THUÊ CHỖ Ở NỘI TRÚ CHÍNH QUY (LEGAL DOCUMENT - ZERO EMOJI) */}
            <div className="bg-[#fafafa] border-2 border-slate-300 rounded-xl shadow-lg p-6 sm:p-12 text-slate-900 font-serif leading-relaxed">
              {/* Header Quốc gia & Quốc hiệu */}
              <div className="text-center pb-6 border-b border-slate-300 space-y-1">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-900 font-sans">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </div>
                <div className="font-bold text-xs text-slate-900 font-sans">
                  Độc lập - Tự do - Hạnh phúc
                </div>
                <div className="text-slate-400 text-xs font-sans">-------------------o0o-------------------</div>

                <div className="pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-left text-xs font-sans text-slate-800 gap-3">
                  <div className="flex items-center space-x-3">
                    <img
                      src="/images/due-logo.png"
                      alt="Logo DUE"
                      className="h-10 sm:h-12 w-auto object-contain"
                    />
                    <div className="border-l-2 border-slate-300 pl-3">
                      <div className="font-bold text-[11px] text-slate-600 uppercase">ĐẠI HỌC ĐÀ NẴNG</div>
                      <div className="font-black text-sm uppercase text-[#003366]">TRƯỜNG ĐẠI HỌC KINH TẾ</div>
                      <div className="font-bold text-[11px] text-slate-700">BAN QUẢN LÝ KÝ TÚC XÁ</div>
                    </div>
                  </div>
                  <div className="sm:text-right mt-2 sm:mt-0">
                    <div className="font-mono font-bold text-slate-800">
                      Số: {studentInfo.ma_sv}/2026/HĐ-KTX-DUE
                    </div>
                    <div className="text-slate-500 italic">Đà Nẵng, ngày 28 tháng 10 năm 2026</div>
                  </div>
                </div>

                <div className="pt-6 pb-2 text-center">
                  <h2 className="text-lg sm:text-xl font-black uppercase text-[#003366] tracking-wide font-sans">
                    HỢP ĐỒNG CHO THUÊ CHỖ Ở NỘI TRÚ KÝ TÚC XÁ
                  </h2>
                  <div className="text-xs font-bold text-slate-700 uppercase font-sans mt-0.5">
                    NĂM HỌC 2026 – 2027
                  </div>
                  <div className="text-[11px] text-slate-500 italic font-sans mt-1">
                    (Xác lập qua phương thức Giao dịch điện tử có xác thực OTP theo Luật Giao dịch điện tử số 20/2023/QH15)
                  </div>
                </div>
              </div>

              {/* Căn cứ pháp lý */}
              <div className="py-4 text-[12px] italic text-slate-600 space-y-1 border-b border-slate-200">
                <p>• Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24 tháng 11 năm 2015 của Quốc hội nước Cộng hòa Xã hội Chủ nghĩa Việt Nam;</p>
                <p>• Căn cứ Luật Giao dịch điện tử số 20/2023/QH15 ngày 22 tháng 6 năm 2023 của Quốc hội;</p>
                <p>• Căn cứ Thông tư số 27/2011/TT-BGDĐT của Bộ trưởng Bộ Giáo dục và Đào tạo ban hành Quy chế công tác học sinh, sinh viên nội trú;</p>
                <p>• Căn cứ Quyết định số 1428/QĐ-ĐHKT ngày 15/08/2024 của Hiệu trưởng Trường Đại học Kinh tế – Đại học Đà Nẵng về việc ban hành Quy chế quản lý Ký túc xá;</p>
                <p>• Căn cứ Kết quả xét duyệt tuyển sinh nội trú Ký túc xá Năm học 2026 – 2027 được Trưởng Ban Quản lý Ký túc xá phê duyệt;</p>
                <p>• Căn cứ nhu cầu lưu trú thực tế của sinh viên và khả năng đáp ứng cơ sở vật chất của Ban Quản lý Ký túc xá.</p>
              </div>

              {/* Thông tin hai bên giao kết */}
              <div className="py-5 space-y-4 text-xs font-sans border-b border-slate-200">
                <p className="italic font-serif text-[13px]">Hôm nay, ngày 28 tháng 10 năm 2026, tại Văn phòng Ban Quản lý Ký túc xá Trường Đại học Kinh tế – Đại học Đà Nẵng, hai bên thống nhất ký kết Hợp đồng với các nội dung sau:</p>

                {/* BÊN A */}
                <div className="p-4 bg-white border border-slate-300 rounded-lg space-y-1.5">
                  <h4 className="font-black text-[#003366] uppercase text-xs">
                    BÊN A: BÊN CHO THUÊ (BAN QUẢN LÝ KÝ TÚC XÁ TRƯỜNG ĐẠI HỌC KINH TẾ – ĐH ĐÀ NẴNG)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-700 text-xs">
                    <div>Đại diện: <strong>ThS. Nguyễn Văn Quản</strong></div>
                    <div>Chức vụ: <strong>Trưởng Ban Quản lý Ký túc xá</strong></div>
                    <div>Địa chỉ trụ sở: <strong>Số 71 Ngũ Hành Sơn, Phường Mỹ An, Quận Ngũ Hành Sơn, TP. Đà Nẵng</strong></div>
                    <div>Điện thoại cơ quan: <strong>(0236) 3836169 / (0236) 3950110</strong></div>
                    <div>Hộp thư điện tử: <strong>ktx@due.edu.vn</strong></div>
                    <div>Tài khoản giao dịch: <strong>200120100xxxx tại Agribank Chi nhánh Nam Đà Nẵng</strong></div>
                  </div>
                </div>

                {/* BÊN B */}
                <div className="p-4 bg-white border border-slate-300 rounded-lg space-y-1.5">
                  <h4 className="font-black text-[#003366] uppercase text-xs">
                    BÊN B: BÊN THUÊ CHỖ Ở (SINH VIÊN NỘI TRÚ)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-700 text-xs">
                    <div>Họ và tên sinh viên: <strong className="text-slate-900 uppercase">{studentInfo.ho_ten}</strong></div>
                    <div>Mã số sinh viên (MSSV): <strong className="font-mono text-slate-900">{studentInfo.ma_sv}</strong></div>
                    <div>Số Căn cước công dân: <strong className="font-mono text-slate-900">{studentInfo.cccd}</strong></div>
                    <div>Khóa đào tạo / Lớp: <strong>{studentInfo.khoa}</strong></div>
                    <div>Hộ khẩu thường trú: <strong>{studentInfo.dia_chi_thuong_tru}</strong></div>
                    <div>Số điện thoại liên lạc: <strong>{studentInfo.so_dien_thoai}</strong></div>
                    <div>Hộp thư điện tử (Email): <strong className="font-mono">{studentInfo.email}</strong></div>
                    <div>Diện ưu tiên được xét: <strong className="text-blue-900">{studentInfo.dien_uu_tien} (+{studentInfo.diem_uu_tien} điểm)</strong></div>
                  </div>
                </div>
              </div>

              {/* CÁC ĐIỀU KHOẢN CHI TIẾT */}
              <div className="py-6 space-y-5 text-xs text-slate-800 leading-relaxed font-sans">
                {/* ĐIỀU 1 */}
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG VÀ VỊ TRÍ PHÒNG NỘI TRÚ
                  </h4>
                  <p className="mt-1">
                    1.1. Bên A đồng ý bố trí cho Bên B được thuê 01 (một) chỗ ở nội trú tại: <strong className="text-[#003366]">{personalRoom}</strong>, Ký túc xá Trường Đại học Kinh tế – Đại học Đà Nẵng (Số 71 Ngũ Hành Sơn, TP. Đà Nẵng).
                  </p>
                  <p className="mt-1">
                    1.2. Tiêu chuẩn và trang thiết bị bàn giao kèm theo: Chỗ ở tiêu chuẩn 04 sinh viên, có công trình vệ sinh khép kín, ban công phơi đồ thoáng mát, quạt trần, bình nước nóng lạnh và công tơ đo đếm điện, nước sinh hoạt riêng biệt. Tài sản cá nhân bàn giao gồm: 01 giường tầng có dát giường, 01 bàn học kèm giá sách, 01 ghế tựa và 01 ngăn tủ cá nhân có móc khóa an toàn.
                  </p>
                  <p className="mt-1">
                    1.3. Bên B có trách nhiệm kiểm tra hiện trạng tài sản tại thời điểm bàn giao theo Biên bản bàn giao cơ sở vật chất (Mẫu E2).
                  </p>
                </div>

                {/* ĐIỀU 2 */}
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 2: THỜI HẠN THUÊ CHỖ Ở
                  </h4>
                  <p className="mt-1">
                    2.1. Thời hạn thuê tính từ ngày <strong>01 tháng 09 năm 2026</strong> đến hết ngày <strong>30 tháng 06 năm 2027</strong> (tương ứng với thời gian học tập chính khóa năm học 2026 – 2027).
                  </p>
                  <p className="mt-1">
                    2.2. Trường hợp sinh viên có nguyện vọng lưu trú trong dịp hè (tháng 7 và tháng 8 năm 2027), Bên B phải làm đơn đăng ký riêng trước ngày 15 tháng 06 năm 2027 và được sự đồng ý bằng văn bản của Trưởng Ban Quản lý Ký túc xá.
                  </p>
                  <p className="mt-1">
                    2.3. Hết thời hạn hợp đồng, nếu Bên B có nguyện vọng tiếp tục ở nội trú năm học tiếp theo, Bên B phải thực hiện thủ tục đăng ký trực tuyến theo thông báo tuyển sinh mới và xét duyệt điểm ưu tiên theo quy định.
                  </p>
                </div>

                {/* ĐIỀU 3 */}
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 3: GIÁ THUÊ, ĐỊNH MỨC DỊCH VỤ VÀ PHƯƠNG THỨC THANH TOÁN
                  </h4>
                  <p className="mt-1">
                    3.1. Giá thuê chỗ ở nội trú: <strong>350.000 VNĐ / sinh viên / tháng</strong> (Ba trăm năm mươi nghìn đồng một tháng). Đơn giá đã bao gồm chi phí bảo đảm an ninh trật tự, vệ sinh khuôn viên chung, dịch vụ mạng internet nội trú và bảo trì định kỳ.
                  </p>
                  <p className="mt-1">
                    3.2. Tiền bảo đảm cơ sở vật chất (ký quỹ hoàn lại): <strong>500.000 VNĐ</strong> (Năm trăm nghìn đồng), nộp một lần khi tiếp nhận phòng. Khoản tiền này sẽ được Bên A hoàn trả đầy đủ cho Bên B khi thanh lý hợp đồng và bàn giao nguyên vẹn phòng ở.
                  </p>
                  <p className="mt-1">
                    3.3. Tiền sử dụng điện và nước sinh hoạt: Tính theo chỉ số tiêu thụ thực tế trên công tơ đo đếm riêng của từng phòng theo biểu giá quy định của Nhà nước và Nhà trường. Các thành viên trong phòng có trách nhiệm chia đều và thanh toán hàng tháng đúng kỳ hạn.
                  </p>
                  <p className="mt-1">
                    3.4. Phương thức và thời hạn thanh toán: Bên B thanh toán theo từng học kỳ (5 tháng/lần) qua Cổng thanh toán trực tuyến của Nhà trường hoặc chuyển khoản trong vòng 15 ngày kể từ ngày ban hành thông báo thu phí.
                  </p>
                </div>

                {/* ĐIỀU 4 */}
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 4: NGHĨA VỤ VÀ QUYỀN HẠN CỦA BÊN B (SINH VIÊN NỘI TRÚ)
                  </h4>
                  <p className="mt-1">
                    4.1. Chấp hành nghiêm chỉnh đường lối chính sách của Đảng, pháp luật của Nhà nước và Nội quy, Quy chế Ký túc xá Trường Đại học Kinh tế – Đại học Đà Nẵng.
                  </p>
                  <p className="mt-1">
                    4.2. Tuyệt đối tuân thủ quy định an toàn Phòng cháy chữa cháy (PCCC): Nghiêm cấm tự ý câu móc, đấu nối đường dây điện; nghiêm cấm sử dụng các thiết bị sinh nhiệt công suất lớn trong phòng ở (như bếp điện, bếp gas, bàn là, ấm đun công suất lớn trái quy chuẩn); không thắp hương, đốt vàng mã trong khu nội trú.
                  </p>
                  <p className="mt-1">
                    4.3. Giữ gìn an ninh trật tự, nếp sống văn minh học đường; không tổ chức đánh bạc, sử dụng rượu bia, chất ma túy, chất kích thích hoặc gây rối trật tự công cộng dưới mọi hình thức.
                  </p>
                  <p className="mt-1">
                    4.4. Không dẫn người lạ hoặc cho người khác giới ở lại qua đêm trong phòng ở. Tuân thủ nghiêm ngặt giờ giới nghiêm hàng ngày của Ký túc xá (Mở cửa: 05h00 – Đóng cửa: 23h00).
                  </p>
                  <p className="mt-1">
                    4.5. Chỗ ở được phân bổ đích danh cho Bên B. Nghiêm cấm mọi hành vi chuyển nhượng, cho thuê lại hoặc tự ý hoán đổi phòng ở cho sinh viên khác khi chưa được sự đồng ý bằng văn bản của Bên A.
                  </p>
                  <p className="mt-1">
                    4.6. Có trách nhiệm bồi thường thiệt hại nếu làm hư hỏng hoặc mất mát cơ sở vật chất, tài sản chung của Ký túc xá.
                  </p>
                </div>

                {/* ĐIỀU 5 */}
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 5: TRÁCH NHIỆM VÀ QUYỀN HẠN CỦA BÊN A (BAN QUẢN LÝ KÝ TÚC XÁ)
                  </h4>
                  <p className="mt-1">
                    5.1. Bố trí đúng vị trí chỗ ở đã cam kết; bảo đảm các điều kiện sinh hoạt thiết yếu (cung cấp điện, nước sinh hoạt, mạng internet nội trú ổn định).
                  </p>
                  <p className="mt-1">
                    5.2. Bố trí lực lượng bảo vệ thường trực 24/24 giờ, bảo đảm an ninh trật tự, an toàn PCCC và vệ sinh môi trường khu nội trú.
                  </p>
                  <p className="mt-1">
                    5.3. Định kỳ kiểm tra, bảo trì và khắc phục kịp thời các sự cố kỹ thuật về điện thoại, cấp thoát nước và cơ sở hạ tầng dùng chung.
                  </p>
                  <p className="mt-1">
                    5.4. Đôn đốc, kiểm tra việc thực hiện Nội quy KTX; có thẩm quyền lập biên bản đình chỉ, chuyển hồ sơ đề nghị Nhà trường xử lý kỷ luật đối với các trường hợp sinh viên vi phạm.
                  </p>
                  <p className="mt-1">
                    5.5. Hướng dẫn và phối hợp với Công an địa phương hoàn tất thủ tục đăng ký tạm trú cho Bên B theo quy định của Luật Cư trú.
                  </p>
                </div>

                {/* ĐIỀU 6 */}
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 6: ĐIỀU KHOẢN CHẤM DỨT HỢP ĐỒNG VÀ THU HỒI CHỖ Ở
                  </h4>
                  <p className="mt-1">
                    6.1. Hợp đồng đương nhiên chấm dứt hiệu lực khi hết thời hạn ghi tại Khoản 2.1 Điều 2.
                  </p>
                  <p className="mt-1">
                    6.2. Bên A có quyền đơn phương chấm dứt hợp đồng, thu hồi chỗ ở ngay lập tức và thông báo về Nhà trường trong các trường hợp:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-0.5 text-slate-700">
                    <li>Sinh viên bị đình chỉ học tập, buộc thôi học hoặc tự ý nghỉ học;</li>
                    <li>Sinh viên có hành vi vi phạm pháp luật, vi phạm Nội quy KTX mức Cảnh cáo toàn trường trở lên;</li>
                    <li>Sinh viên có hành vi cho thuê lại, sang nhượng phòng hoặc chứa chấp người lạ trái phép;</li>
                    <li>Sinh viên chậm thực hiện nghĩa vụ tài chính quá 30 ngày kể từ ngày có thông báo đôn đốc.</li>
                  </ul>
                  <p className="mt-1">
                    6.3. Trường hợp Bên B muốn chấm dứt hợp đồng trước hạn phải nộp đơn đề nghị trước ít nhất 15 ngày làm việc và hoàn tất mọi nghĩa vụ bàn giao tài sản.
                  </p>
                </div>

                {/* ĐIỀU 7 */}
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-xs">
                    ĐIỀU 7: GIÁ TRỊ PHÁP LÝ VÀ PHƯƠNG THỨC XÁC LẬP BẰNG CHỮ KÝ SỐ ĐIỆN TỬ
                  </h4>
                  <p className="mt-1">
                    7.1. Hợp đồng này được khởi tạo, gửi nhận và lưu trữ dưới dạng thông điệp dữ liệu điện tử, tuân thủ đầy đủ quy định của <strong>Luật Giao dịch điện tử số 20/2023/QH15</strong>. Hợp đồng có giá trị pháp lý ràng buộc tương đương văn bản giấy được ký tay và đóng dấu trực tiếp.
                  </p>
                  <p className="mt-1">
                    7.2. Bên A xác nhận nội dung hợp đồng bằng Chứng thư số chuyên dùng của Ban Quản lý Ký túc xá Trường Đại học Kinh tế – Đại học Đà Nẵng.
                  </p>
                  <p className="mt-1">
                    7.3. Bên B xác nhận ý chí đồng thuận giao kết hợp đồng và cam kết thực hiện đầy đủ các nghĩa vụ thông qua việc nhập mã xác thực OTP (One-Time Password) được cấp phát riêng qua cổng quản lý nội trú. Mã OTP này có giá trị xác thực danh tính điện tử tương đương chữ ký tay của Bên B.
                  </p>
                  <p className="mt-1">
                    7.4. Hợp đồng có hiệu lực kể từ thời điểm Bên B hoàn tất ký số điện tử và được lưu trữ vĩnh viễn trên Cơ sở dữ liệu Quản lý Ký túc xá Trường Đại học Kinh tế – Đại học Đà Nẵng.
                  </p>
                </div>
              </div>

              {/* KHU VỰC KÝ TÊN VÀ XÁC THỰC PHÁP LÝ HAI BÊN */}
              <div className="pt-8 border-t-2 border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs font-sans">
                {/* CỘT BÊN A */}
                <div className="text-center space-y-2 border border-slate-300 bg-white p-5 rounded-lg">
                  <div className="font-black text-slate-900 uppercase text-xs">
                    ĐẠI DIỆN BÊN CHO THUÊ
                  </div>
                  <div className="font-bold text-[#003366] text-xs">
                    TRƯỞNG BAN QUẢN LÝ KÝ TÚC XÁ
                  </div>
                  <div className="text-[11px] text-slate-500 italic">
                    (Đã ký số điện tử và đóng dấu số xác thực)
                  </div>

                  {/* DẤU ĐIỆN TỬ CỦA BAN QUẢN LÝ KTX DUE */}
                  <div className="my-4 inline-block p-3 border-2 border-dashed border-red-600 bg-red-50/60 rounded-lg text-left text-[11px] text-red-900 font-mono shadow-xs">
                    <div className="font-bold text-red-700 text-center uppercase tracking-wider text-[10px] pb-1 border-b border-red-300">
                      CHỨNG THỰC CHỮ KÝ SỐ ĐIỆN TỬ
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      <div>Cơ quan: <strong>TRƯỜNG ĐẠI HỌC KINH TẾ - ĐH ĐÀ NẴNG</strong></div>
                      <div>Đơn vị: <strong>BAN QUẢN LÝ KÝ TÚC XÁ</strong></div>
                      <div>Chứng thư số: <strong>SERIAL-KTX-DUE-2026-9941</strong></div>
                      <div>Thời gian ký: <strong>28/10/2026 10:15:00 GMT+7</strong></div>
                      <div>Trạng thái: <strong>CHỮ KÝ SỐ HỢP LỆ VÀ NGUYÊN VẸN</strong></div>
                    </div>
                  </div>

                  <div className="font-black text-slate-900 text-sm pt-2">
                    ThS. Nguyễn Văn Quản
                  </div>
                </div>

                {/* CỘT BÊN B */}
                <div className="text-center space-y-2 border border-slate-300 bg-white p-5 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="font-black text-slate-900 uppercase text-xs">
                      ĐẠI DIỆN BÊN THUÊ CHỖ Ở
                    </div>
                    <div className="font-bold text-[#003366] text-xs">
                      SINH VIÊN NỘI TRÚ
                    </div>
                    <div className="text-[11px] text-slate-500 italic">
                      (Xác thực ký số điện tử bằng mã OTP)
                    </div>
                  </div>

                  {/* TRƯỜNG HỢP 1: ĐÃ KÝ THÀNH CÔNG */}
                  {workflowState.isSigned ? (
                    <div className="my-4 inline-block p-3 border-2 border-dashed border-emerald-600 bg-emerald-50 rounded-lg text-left text-[11px] text-emerald-950 font-mono shadow-xs">
                      <div className="font-bold text-emerald-800 text-center uppercase tracking-wider text-[10px] pb-1 border-b border-emerald-300">
                        XÁC THỰC KÝ SỐ ĐIỆN TỬ THÀNH CÔNG
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        <div>Người ký: <strong>{studentInfo.ho_ten}</strong></div>
                        <div>Mã sinh viên: <strong>{studentInfo.ma_sv}</strong></div>
                        <div>Mã giao dịch ký: <strong>TX-KYHD-{studentInfo.ma_sv}-SUCCESS</strong></div>
                        <div>Phương thức ký: <strong>Xác thực mã OTP cá nhân ({personalOtp})</strong></div>
                        <div>Toàn vẹn dữ liệu: <strong>SHA-256 Validated & Encrypted</strong></div>
                      </div>
                    </div>
                  ) : (
                    /* TRƯỜNG HỢP 2: CHƯA KÝ -> KHUNG NHẬP OTP VÀ NÚT KÝ SỐ CHÍNH QUY */
                    <div className="my-4 space-y-3 text-left">
                      {/* Checkbox bắt buộc cam đoan */}
                      <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-slate-800 font-medium p-2 bg-slate-50 rounded border border-slate-300">
                        <input
                          type="checkbox"
                          checked={agreeContract}
                          onChange={(e) => setAgreeContract(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-[#003366] border-slate-300 rounded focus:ring-blue-600"
                        />
                        <span className="leading-snug">
                          Tôi xin cam đoan đã đọc kỹ, hiểu rõ và tự nguyện cam kết chấp hành toàn bộ nội quy và các điều khoản trong Hợp đồng này.
                        </span>
                      </label>

                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-700">
                          Nhập mã xác thực OTP gửi về email ({studentInfo.email}):
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              maxLength={6}
                              value={otpInput}
                              onChange={(e) => setOtpInput(e.target.value)}
                              placeholder={personalOtp}
                              className="px-3 py-2 border border-slate-300 rounded-lg font-mono text-center text-sm font-black text-[#003366] w-28 tracking-widest focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white shadow-inner"
                            />
                            <button
                              type="button"
                              onClick={() => setOtpInput(personalOtp)}
                              className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition whitespace-nowrap"
                              title="Tự động điền mã OTP cá nhân của bạn"
                            >
                              🔑 Điền OTP ({personalOtp})
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={handleSignContract}
                            disabled={isProcessing || !agreeContract}
                            className="flex-1 py-2 px-3 bg-[#003366] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                          >
                            {isProcessing ? 'Đang xử lý ký số...' : 'Xác Nhận Ký Số Điện Tử Hợp Đồng'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDeclineModal(true)}
                            disabled={isProcessing}
                            className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 whitespace-nowrap"
                            title="Nếu bạn không có nhu cầu ở KTX nữa, bạn có thể từ chối không ký để nhường cho sinh viên dự bị"
                          >
                            <span>✕ Từ Chối Nhận Phòng</span>
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          * Mã OTP cá nhân cấp riêng cho bạn: <strong className="font-mono text-blue-900 bg-blue-100 px-1 py-0.5 rounded">{personalOtp}</strong> (Mã thử nghiệm: <strong>888888</strong>). Thời hạn ký số còn lại: <strong>72 giờ</strong>.
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="font-black text-slate-900 text-sm pt-2">
                    {studentInfo.ho_ten}
                  </div>
                </div>
              </div>

              {/* Nút in hợp đồng */}
              <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-xs font-sans">
                <span className="text-slate-500">
                  Văn bản hợp đồng điện tử có giá trị lưu trữ và trích xuất vĩnh viễn trên Cổng thông tin Tuyển sinh KTX DUE.
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow-sm transition"
                >
                  In Hợp Đồng Điện Tử (Ctrl + P)
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================================== */
          /* KHI CHƯA ĐẾN BƯỚC HỢP ĐỒNG (BƯỚC 3: BXH HOẶC DANH SÁCH CHỜ / THU HỒI): */
          /* HIỂN THỊ GIAO DIỆN 2 CỘT QUEN THUỘC (THÔNG TIN HỒ SƠ & BXH REAL-TIME) */
          /* ============================================================================== */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
            {/* CỘT TRÁI: THÔNG TIN HỒ SƠ ĐÃ GHI NHẬN */}
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <h4 className="font-bold text-slate-900 uppercase text-xs">
                    Thông Tin Hồ Sơ Đã Ghi Nhận
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowLoginModal(true)}
                    className="text-[11px] text-blue-700 hover:text-blue-900 font-bold underline flex items-center gap-1 cursor-pointer"
                    title="Đổi tài khoản hoặc đăng nhập sinh viên khác"
                  >
                    <span>🔑 Đổi tài khoản / Đăng nhập</span>
                  </button>
                </div>
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Họ và tên:</span>
                    <strong className="text-slate-900 text-sm font-black">{studentInfo.ho_ten || 'Chưa đăng nhập'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mã sinh viên:</span>
                    <strong className="text-slate-800 font-mono text-sm">{studentInfo.ma_sv || '---'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Số CCCD:</span>
                    <strong className="text-slate-800 font-mono">{studentInfo.cccd || '---'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Diện ưu tiên:</span>
                    <strong className="text-blue-900">{studentInfo.dien_uu_tien || 'Không thuộc diện ưu tiên'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Điểm xét tuyển ưu tiên:</span>
                    <strong className="text-emerald-700 text-sm font-bold">
                      +{studentInfo.diem_uu_tien} điểm
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email cá nhân:</span>
                    <strong className="text-slate-800 font-mono">{studentInfo.email}</strong>
                  </div>
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-xs">Đối chiếu AI Vision:</span>
                      {isApprovedEvidence || (studentInfo.diem_uu_tien > 0 && status !== 'CHO_THAM_DINH' && status !== 'CAN_BO_SUNG') ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Đạt chuẩn (Đã thẩm định đạt)
                        </span>
                      ) : status === 'CAN_BO_SUNG' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          ⚠️ Cần bổ sung minh chứng (48h)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Đang rà soát đối chiếu (&lt; 95%)
                        </span>
                      )}
                    </div>
                    {/* Chip đối chiếu dữ liệu tự động */}
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded border ${
                        status === 'CHO_THAM_DINH'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        Họ tên: {status === 'CHO_THAM_DINH' ? '⚠️ Chờ đối chiếu' : studentInfo.ho_ten ? '✓ Khớp' : '---'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded border ${
                        status === 'CHO_THAM_DINH'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        CCCD: {status === 'CHO_THAM_DINH' ? '⚠️ Chờ đối chiếu' : studentInfo.cccd ? '✓ Khớp' : '---'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded border ${
                        status === 'CAN_BO_SUNG'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : status === 'CHO_THAM_DINH'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        Giấy tờ: {
                          status === 'CAN_BO_SUNG'
                            ? '⚠️ Thiếu mộc đỏ'
                            : status === 'CHO_THAM_DINH'
                            ? '⚠️ Đang xác thực'
                            : studentInfo.dien_uu_tien?.includes('Không')
                            ? 'Diện chuẩn'
                            : '✓ Mộc đỏ hợp lệ'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex items-center space-x-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span>Dữ liệu lưu an toàn trong CSDL KTX DUE.</span>
              </div>
            </div>

            {/* CỘT PHẢI: BƯỚC 3 - CHỜ TRƯỞNG BAN PHÊ DUYỆT DANH SÁCH (BƯỚC 2 ĐÃ XONG) */}
            {/* CỘT PHẢI: TRẠNG THÁI TIẾN ĐỘ THỰC TẾ CỦA HỒ SƠ */}
            {isCancelled ? (
              /* TRƯỜNG HỢP 1: ĐÃ TỪ CHỐI / HỦY SUẤT */
              <div className="bg-rose-50 rounded-xl border-2 border-rose-300 p-6 flex flex-col justify-between text-center space-y-4 shadow-sm">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 font-black text-xl flex items-center justify-center mx-auto">
                    ✕
                  </div>
                  <h3 className="text-sm font-black text-rose-950 uppercase">
                    BẠN ĐÃ TỪ CHỐI NHẬN PHÒNG / HỦY SUẤT NỘI TRÚ
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hệ thống đã ghi nhận bạn từ chối nhận phòng KTX. Suất nội trú này đã được thu hồi và chuyển giao cho sinh viên kế tiếp trên danh sách chờ theo đúng quy chế tuyển sinh KTX DUE.
                  </p>
                </div>
                <div className="pt-2 border-t border-rose-200 text-center">
                  <Link
                    href={`/ranking?search=${encodeURIComponent(studentInfo.ma_sv)}`}
                    className="inline-block py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition"
                  >
                    Xem Bảng Xếp Hạng &rarr;
                  </Link>
                </div>
              </div>
            ) : status === 'CAN_BO_SUNG' ? (
              /* TRƯỜNG HỢP 2A: BƯỚC 2 - YÊU CẦU BỔ SUNG MINH CHỨNG (HẠN 48H) */
              <div className="bg-gradient-to-br from-rose-50 via-amber-50 to-slate-50 rounded-xl border-2 border-rose-400 p-5 flex flex-col justify-between text-left space-y-3 shadow-xs">
                <div className="space-y-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 bg-[#003366] text-white text-[10px] font-bold rounded uppercase">
                      Bước 2: Thẩm Định Minh Chứng
                    </span>
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold rounded-full">
                      ⚠️ Cần Bổ Sung (Hạn 48h)
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-rose-950 uppercase">
                      Yêu Cầu Bổ Sung Ảnh Minh Chứng Hợp Lệ
                    </h3>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      Cán bộ Quản lý Sinh viên đã rà soát và yêu cầu bạn tải lên lại ảnh chụp minh chứng có dấu mộc đỏ rõ ràng hoặc giấy xác nhận hợp lệ.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-rose-200 text-xs space-y-1.5 text-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Trạng thái:</span>
                      <strong className="text-rose-700 font-bold">Chờ sinh viên tải lên minh chứng bổ sung</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Điểm ưu tiên hiện tại:</span>
                      <strong className="text-slate-700">0 điểm (Tạm dừng đến khi duyệt đạt)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Thời hạn bổ sung:</span>
                      <strong className="text-rose-600 font-bold">Trong vòng 48 giờ kể từ khi nhận thông báo</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(true)}
                    className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow transition text-center"
                  >
                    Tải Lên Ảnh Minh Chứng Bổ Sung Ngay &rarr;
                  </button>
                </div>
              </div>
            ) : status === 'CHO_THAM_DINH' ? (
              /* TRƯỜNG HỢP 2B: BƯỚC 2 - ĐANG CHỜ CÁN BỘ QLSV RÀ SOÁT MINH CHỨNG */
              <div className="bg-gradient-to-br from-amber-50 via-slate-50 to-blue-50 rounded-xl border border-amber-300 p-5 flex flex-col justify-between text-left space-y-3 shadow-xs">
                <div className="space-y-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 bg-[#003366] text-white text-[10px] font-bold rounded uppercase">
                      Bước 2: Thẩm Định Minh Chứng
                    </span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold rounded-full">
                      ⏳ Chờ Cán Bộ QLSV Rà Soát
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[#003366] uppercase">
                      Hồ Sơ Đang Trong Hàng Đợi Thẩm Định Thủ Công
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Ảnh minh chứng của bạn đã được tiếp nhận và chuyển đến Cán bộ Quản lý Sinh viên để kiểm tra đối chiếu trực tiếp.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-amber-200 text-xs space-y-1.5 text-amber-950">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Trạng thái rà soát:</span>
                      <strong className="text-amber-800">Đang chờ Cán bộ QLSV thẩm định</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Điểm ưu tiên hiện tại:</span>
                      <strong className="text-slate-700">0 điểm (Tạm dừng cho đến khi duyệt đạt)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Xếp hạng trên BXH:</span>
                      <strong className="text-slate-500 italic">Chờ phê duyệt để cập nhật thứ hạng</strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    * Sau khi Cán bộ QLSV thẩm định đạt, hệ thống sẽ tự động cộng điểm ưu tiên theo đúng quy chế và cập nhật thứ hạng tuyển sinh của bạn lên Bảng Xếp Hạng.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <Link
                    href={`/ranking?search=${encodeURIComponent(studentInfo.ma_sv)}`}
                    className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition text-center border border-slate-300 block"
                  >
                    Xem Bảng Xếp Hạng Tuyển Sinh &rarr;
                  </Link>
                </div>
              </div>
            ) : !workflowState.isRankingsFinalized ? (
              /* TRƯỜNG HỢP 3: BƯỚC 3A - CHỜ TRƯỞNG BAN PHÊ DUYỆT DANH SÁCH CHÍNH THỨC */
              <div className="bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50 rounded-xl border border-blue-300 p-5 flex flex-col justify-between text-left space-y-3 shadow-xs">
                <div className="space-y-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 bg-[#003366] text-white text-[10px] font-bold rounded uppercase">
                      Bước 3: Chờ Trưởng Ban Duyệt
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                      ✓ Đã Thẩm Định Đạt
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[#003366] uppercase">
                      Hồ Sơ Đã Đạt Chuẩn – Chờ Ký Quyết Định Tuyển Sinh (B2)
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Minh chứng của bạn đã được phê duyệt hợp lệ. Hệ thống đang chờ Trưởng Ban Quản lý KTX ký duyệt danh sách trúng tuyển đợt 1.
                    </p>
                  </div>

                  {/* VÙNG HIỂN THỊ VỊ TRÍ HIỆN TẠI TRONG BXH */}
                  <div className="bg-white p-3 rounded-xl border border-blue-200 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Thứ hạng xét tuyển tạm thời:
                    </span>
                    <div className="flex items-baseline justify-center space-x-1 mt-0.5">
                      <span className="text-2xl font-black text-[#003366]">#{studentRank}</span>
                      <span className="text-xs font-bold text-slate-500">/ {totalStudents}</span>
                    </div>
                    <div className="mt-1">
                      {isAdmitted ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ✓ Đủ điều kiện tiếp nhận (Top 120 chỉ tiêu)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          Danh sách chờ #{studentRank - 120} (Chỉ tiêu 120)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <Link
                    href={`/ranking?search=${encodeURIComponent(studentInfo.ma_sv)}`}
                    className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition text-center border border-slate-300 block"
                  >
                    Xem Bảng Xếp Hạng Tuyển Sinh &rarr;
                  </Link>
                </div>
              </div>
            ) : !workflowState.isPublished ? (
              /* TRƯỜNG HỢP 4: BƯỚC 3B - TRƯỞNG BAN ĐÃ DUYỆT, ĐANG CHỜ CÁN BỘ QLSV GỬI EMAIL */
              <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-slate-50 rounded-xl border-2 border-indigo-400 p-6 flex flex-col justify-between text-left space-y-4 shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 bg-[#003366] text-white text-[10px] font-bold rounded uppercase">
                      BƯỚC 3B: CHỜ CÁN BỘ QLSV GỬI THÔNG BÁO
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                      ✓ Trưởng Ban Đã Ký Duyệt
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-[#003366] uppercase leading-tight">
                      {isAdmitted
                        ? '🎉 Chúc Mừng: Bạn Đã Trúng Tuyển Nội Trú KTX DUE!'
                        : 'Hồ Sơ Của Bạn Đã Được Trưởng Ban KTX Ký Duyệt'}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      Trưởng Ban Quản lý KTX đã ký quyết định phê duyệt danh sách chính thức.
                      {isAdmitted
                        ? ' Bạn nằm trong Top 120 sinh viên trúng tuyển. Cán bộ QLSV đang hoàn tất phát hành thông báo để mở Cổng Ký Hợp Đồng Điện Tử 72 giờ cho bạn.'
                        : ' Bạn hiện đang ở danh sách chờ xét tuyển bổ sung đợt 2.'}
                    </p>
                    <p className="text-xs text-blue-900 font-semibold mt-1">
                      Ngay sau khi cán bộ phát hành thông báo, Cổng Ký Hợp Đồng Điện Tử (72h) sẽ chính thức mở cho bạn.
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm text-center">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Vị trí tạm thời của bạn trên Bảng xếp hạng xét tuyển:
                    </span>
                    <div className="flex items-baseline justify-center space-x-1 mt-1">
                      <span className="text-3xl font-black text-[#003366]">#{studentRank}</span>
                      <span className="text-xs font-bold text-slate-500">/ {totalStudents} thí sinh</span>
                    </div>
                    <div className="mt-1">
                      {isAdmitted ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                          ✓ Đang nằm trong Top 120 chỉ tiêu xét tuyển (Đủ điều kiện nhận phòng)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          Đang ở Danh sách chờ #{studentRank - 120} (Chỉ tiêu: 120 chỗ)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-2">
                  {isAdmitted && (
                    <Link
                      href="/officer"
                      className="w-full py-2.5 px-3 bg-[#FFB800] hover:bg-amber-400 text-[#003366] rounded-lg text-xs font-black shadow transition text-center block"
                    >
                      ✉️ Cổng QLSV: Phát Hành Thông Báo Trúng Tuyển &rarr;
                    </Link>
                  )}
                  <Link
                    href={`/ranking?search=${encodeURIComponent(studentInfo.ma_sv)}`}
                    className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition text-center border border-slate-300 block"
                  >
                    Xem Chi Tiết Bảng Xếp Hạng Tuyển Sinh &rarr;
                  </Link>
                </div>
              </div>
            ) : !isAdmitted ? (
              /* TRƯỜNG HỢP 5: DANH SÁCH CHỜ (RANK > 120) */
              <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-slate-50 rounded-xl border-2 border-amber-300 p-6 flex flex-col justify-between space-y-4 shadow-sm text-left">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-amber-600 text-white text-[10px] font-black rounded uppercase">
                      Kết Quả Đợt 1: Danh Sách Chờ
                    </span>
                    <span className="text-xs text-amber-900 font-bold">
                      Vị trí #{studentRank} / {totalStudents}
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm space-y-2.5">
                    <h3 className="font-bold text-amber-950 text-xs uppercase">
                      THÔNG BÁO KẾT QUẢ XÉT TUYỂN CHÍNH THỨC
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Trưởng ban Quản lý KTX và Cán bộ QLSV đã hoàn tất phát hành kết quả xét tuyển Đợt 1 (Chỉ tiêu: 120 chỗ).
                    </p>
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-950 space-y-1">
                      <div>Điểm xét tuyển ưu tiên: <strong>+{studentInfo.diem_uu_tien} điểm</strong></div>
                      <div>Thứ tự dự bị trong danh sách chờ: <strong className="text-amber-800 font-bold">#{studentRank - 120}</strong> (Thứ hạng tổng: #{studentRank})</div>
                      <div>Phòng ở đợt 1: <strong className="text-slate-600 italic">Chưa được cấp phòng (Chỉ tiêu 120 chỗ)</strong></div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pt-1">
                      Sau thời hạn 72 giờ, nếu có sinh viên trong Top 120 trúng tuyển không ký hợp đồng hoặc từ chối nhận phòng, hệ thống sẽ tự động gửi thông báo trúng tuyển bổ sung cho sinh viên kế tiếp trên danh sách chờ theo đúng thứ tự ưu tiên (Mở đợt 2).
                    </p>
                  </div>
                </div>

                <div className="text-center pt-2">
                  <Link
                    href={`/ranking?search=${encodeURIComponent(studentInfo.ma_sv)}`}
                    className="w-full py-2.5 px-4 bg-[#003366] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow transition flex items-center justify-center space-x-2"
                  >
                    <span>Xem Chi Tiết Bảng Xếp Hạng Tuyển Sinh</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </div>
            ) : (
              /* SUẤT NỘI TRÚ ĐÃ ĐƯỢC THU HỒI */
              <div className="bg-rose-50 rounded-xl border-2 border-rose-300 p-6 flex flex-col justify-between text-center space-y-4 shadow-sm">
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-rose-950 uppercase">
                    SUẤT NỘI TRÚ ĐÃ ĐƯỢC THU HỒI
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Do quá thời hạn 72 giờ ký hợp đồng hoặc sinh viên gửi yêu cầu hủy suất, phòng đã được hoàn về trạng thái TRỐNG và chuyển giao cho sinh viên kế tiếp trên danh sách chờ.
                  </p>
                </div>
                <div className="pt-2 border-t border-rose-200 text-center">
                  <Link
                    href={`/ranking?search=${encodeURIComponent(studentInfo.ma_sv)}`}
                    className="inline-block py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition"
                  >
                    Xem Bảng Xếp Hạng &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================================== */}
      {/* MODAL 1: TẢI LẠI MINH CHỨNG BỔ SUNG (TASK TR) */}
      {/* ============================================================================== */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#003366] p-4 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">Tải Lên Minh Chứng Bổ Sung</h3>
                <p className="text-[11px] text-blue-200 mt-0.5">
                  Sinh viên: {studentInfo.ho_ten} ({studentInfo.ma_sv})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-300 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSupplementSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                <div className="font-bold">Lưu ý theo quy chuẩn thẩm định:</div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  • <strong>CCCD:</strong> Rõ mặt trước/sau, thấy rõ cụm từ "CĂN CƯỚC CÔNG DÂN" (Không yêu cầu con dấu đỏ).<br/>
                  • <strong>Giấy tờ ưu tiên:</strong> Bắt buộc có con dấu/mộc đỏ của cơ quan thẩm quyền (UBND, Phòng LĐTBXH).
                </p>
              </div>

              {/* Upload CCCD */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  1. Ảnh Căn cước công dân (CCCD) mới (tùy chọn nếu cần đổi):
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'cccd')}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-300 rounded p-1"
                />
                {newCccdBase64 && (
                  <span className="text-[11px] text-emerald-600 font-bold block">Đã chọn ảnh CCCD mới</span>
                )}
              </div>

              {/* Upload Priority Proof */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  2. Ảnh Giấy chứng nhận ưu tiên có con dấu đỏ (tùy chọn):
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'priority')}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-300 rounded p-1"
                />
                {newPriorityBase64 && (
                  <span className="text-[11px] text-emerald-600 font-bold block">Đã chọn ảnh minh chứng ưu tiên mới</span>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSupplement || (!newCccdBase64 && !newPriorityBase64)}
                  className="px-5 py-2 bg-[#003366] hover:bg-blue-900 text-white rounded-lg font-bold shadow disabled:opacity-50"
                >
                  {isSubmittingSupplement ? 'Đang thẩm định AI Vision...' : 'Gửi Minh Chứng Bổ Sung'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 2: HỘP THƯ THÔNG BÁO VÀ VĂN BẢN KTX */}
      {/* ============================================================================== */}
      {showInboxModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#003366] p-4 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm">Hộp Thư Thông Báo Tuyển Sinh KTX DUE</h3>
                <p className="text-[11px] text-blue-200">
                  Sinh viên: {studentInfo.ho_ten} ({studentInfo.ma_sv}) • Tổng số {notifications.length} thông báo
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInboxModal(false);
                  setSelectedNotif(null);
                }}
                className="text-slate-300 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p>Chưa có thông báo nào được gửi đến mã sinh viên này.</p>
                </div>
              ) : selectedNotif ? (
                /* CHI TIẾT THƯ */
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedNotif(null)}
                    className="text-blue-700 hover:underline flex items-center space-x-1 font-bold text-xs"
                  >
                    <span>&larr; Quay lại danh sách thông báo</span>
                  </button>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <h4 className="font-bold text-sm text-[#003366]">{selectedNotif.tieu_de}</h4>
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 border-b border-slate-200 pb-2">
                      <span>Người nhận: <strong>{selectedNotif.recipient_email}</strong></span>
                      <span>Thời gian: {new Date(selectedNotif.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                    <div
                      className="text-slate-800 leading-relaxed pt-2 overflow-x-auto"
                      dangerouslySetInnerHTML={{ __html: selectedNotif.noi_dung }}
                    />

                    {/* LIÊN KẾT NHANH ĐẾN HỢP ĐỒNG ĐIỆN TỬ */}
                    {(selectedNotif.loai === 'TRUNG_TUYEN_KY_HD' || selectedNotif.tieu_de.includes('Hợp Đồng') || selectedNotif.tieu_de.includes('Trúng Tuyển')) && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-300 rounded-xl space-y-2">
                        <div className="font-bold text-sm text-[#003366]">
                          VĂN BẢN KÈM THEO: HỢP ĐỒNG CHO THUÊ CHỖ Ở NỘI TRÚ KÝ TÚC XÁ
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Mã xác thực OTP cấp phát riêng: <strong className="font-mono bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-black text-xs">{selectedNotif.chi_tiet?.otpCode || personalOtp}</strong>.
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowInboxModal(false);
                              const el = document.getElementById('formal-contract-section');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-4 py-2 bg-[#003366] hover:bg-blue-900 text-white font-bold rounded-lg text-xs shadow transition"
                          >
                            Đến Khung Xem &amp; Ký Hợp Đồng Điện Tử &darr;
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* DANH SÁCH THƯ */
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => setSelectedNotif(n)}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/40 transition cursor-pointer flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            n.loai === 'YEU_CAU_BO_SUNG'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : n.loai === 'TRUNG_TUYEN_KY_HD'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : n.loai === 'TU_CHOI'
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}
                        >
                          {n.loai === 'YEU_CAU_BO_SUNG'
                            ? 'Yêu Cầu Bổ Sung'
                            : n.loai === 'TRUNG_TUYEN_KY_HD'
                            ? 'Trúng Tuyển'
                            : n.loai === 'TU_CHOI'
                            ? 'Từ Chối'
                            : 'Thông Báo'}
                        </span>
                        <h4 className="font-bold text-slate-900 line-clamp-1">{n.tieu_de}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        Gửi đến: {n.recipient_email} • Bấm để xem toàn văn nội dung
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap self-center font-mono">
                      {new Date(n.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowInboxModal(false);
                  setSelectedNotif(null);
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 3: ĐĂNG NHẬP / CHỌN TÀI KHOẢN SINH VIÊN (DỮ LIỆU ĐỘNG 100%) */}
      {/* ============================================================================== */}
      <StudentLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        currentStudentCode={studentInfo.ma_sv}
        onSelectStudent={(st) => {
          applyStudent(st, allApplications);
          setActionMessage(`✓ Đã đăng nhập vào hồ sơ sinh viên: ${st.ho_ten} (${st.ma_sv})`);
          setShowLoginModal(false);
        }}
      />

      {/* ============================================================================== */}
      {/* MODAL 4: XÁC NHẬN TỪ CHỐI NHẬN PHÒNG KTX (HUY_SUAT) */}
      {/* ============================================================================== */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-rose-700 p-4 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold">⚠️</span>
                <h3 className="font-bold text-sm">Xác Nhận Từ Chối Nhận Phòng KTX</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="text-rose-200 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 space-y-2">
                <p className="font-bold text-rose-900 text-sm">
                  Bạn có chắc chắn muốn TỪ CHỐI NHẬN PHÒNG không?
                </p>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  Vị trí phòng được phân bổ: <strong className="text-blue-900 font-bold">{personalRoom}</strong>.<br/>
                  <strong className="text-rose-700 font-bold">Lưu ý quan trọng:</strong> Sau khi xác nhận từ chối, quyết định này <strong>không thể hoàn tác</strong>. Suất nội trú của bạn sẽ được giải phóng ngay lập tức để hệ thống tự động chuyển giao cho bạn sinh viên kế tiếp trên danh sách chờ (Mở đợt 2).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do từ chối (tùy chọn):
                </label>
                <textarea
                  rows={2}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Ví dụ: Đã tìm được phòng trọ bên ngoài, thay đổi kế hoạch lưu trú..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeclineModal(false)}
                  disabled={isProcessing}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold"
                >
                  Quay Lại (Tiếp Tục Ký HĐ)
                </button>
                <button
                  type="button"
                  onClick={handleDeclineContract}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold shadow transition disabled:opacity-50"
                >
                  {isProcessing ? 'Đang xử lý...' : 'Xác Nhận Từ Chối Nhận Phòng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
