'use client';

// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// DASHBOARD DÀNH RIÊNG CHO TRƯỞNG BAN QUẢN LÝ KTX
// THẨM QUYỀN PHÊ DUYỆT VÀ CÔNG BỐ DANH SÁCH TRÚNG TUYỂN (BƯỚC 6 & BƯỚC 7)
// ==============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { generate350Students, computeMergedRankings } from '@/lib/data/mock-students';
import { RankingRow } from '@/components/ranking/RealtimeRankingTable';
import {
  approveRoundAndPublishAction,
  directorApproveRoundAction,
  cancelAndReallocateAction,
  resetWorkflowAction,
} from '@/actions/approval';
import { StoredApplication } from '@/lib/data/live-store';

interface WorkflowState {
  isRankingsFinalized: boolean;
  isPublished: boolean;
  isSigned: boolean;
  isHandedOver: boolean;
  isCancelled: boolean;
  assignedRoom?: string;
  currentStep: number;
}

export default function ApprovalDashboard() {
  const [allCandidates, setAllCandidates] = useState<RankingRow[]>(() => generate350Students(120));
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    isRankingsFinalized: false,
    isPublished: false,
    isSigned: false,
    isHandedOver: false,
    isCancelled: false,
    currentStep: 3,
  });

  const [returnReason, setReturnReason] = useState('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Bộ lọc khóa sinh viên
  const [selectedCohort, setSelectedCohort] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [pendingEvidenceCount, setPendingEvidenceCount] = useState<number>(0);
  const [approvedEvidenceCount, setApprovedEvidenceCount] = useState<number>(0);
  const [pendingStudents, setPendingStudents] = useState<Array<{ id: string; ma_sv: string; ho_ten: string; status: string }>>([]);

  // ĐỒNG BỘ DỮ LIỆU TỪ WORKFLOW VÀ CƠ SỞ DỮ LIỆU (TỐI ƯU HÓA HOOKS, CHỐNG RE-RENDER LIÊN TỤC)
  const fetchWorkflowAndApplications = useCallback(async () => {
    try {
      const [wfRes, appRes] = await Promise.all([
        fetch('/api/workflow'),
        fetch('/api/applications'),
      ]);
      const wfJson = await wfRes.json();
      const appJson = await appRes.json();

      let pendingLength = 0;
      if (appJson.success && Array.isArray(appJson.data)) {
        const storedList = appJson.data as StoredApplication[];
        const pending = storedList.filter(
          (a) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
        );
        pendingLength = pending.length;
        const approved = storedList.filter(
          (a) =>
            a.status === 'THAM_DINH_DAT' ||
            a.status === 'DA_XEP_HANG' ||
            a.status === 'DA_PHAT_HANH' ||
            a.status === 'DA_KY'
        );

        setPendingEvidenceCount((prev) => (prev === pending.length ? prev : pending.length));
        setApprovedEvidenceCount((prev) => (prev === approved.length ? prev : approved.length));

        setPendingStudents((prev) => {
          if (
            prev.length === pending.length &&
            prev.every((p, idx) => p.id === pending[idx].id && p.status === pending[idx].status)
          ) {
            return prev;
          }
          return pending.map((a) => ({ id: a.id, ma_sv: a.ma_sv, ho_ten: a.ho_ten, status: a.status }));
        });

        const merged = computeMergedRankings(storedList, 120);
        setAllCandidates((prev) => {
          if (prev.length === merged.length) {
            let isDiff = false;
            for (let i = 0; i < prev.length; i++) {
              if (
                prev[i].id !== merged[i].id ||
                prev[i].status !== merged[i].status ||
                prev[i].diem_uu_tien !== merged[i].diem_uu_tien ||
                prev[i].thu_hang !== merged[i].thu_hang
              ) {
                isDiff = true;
                break;
              }
            }
            if (!isDiff) return prev;
          }
          return merged;
        });
      }

      if (wfJson.workflow) {
        setWorkflowState((prev) => {
          const isLocallyFinalized =
            typeof window !== 'undefined' &&
            localStorage.getItem('ktx_director_finalized') === 'true';
          const isLocallyPublished =
            typeof window !== 'undefined' &&
            localStorage.getItem('ktx_director_published') === 'true';
          const isLocallyReset =
            typeof window !== 'undefined' &&
            localStorage.getItem('ktx_director_reset') === 'true';

          // Khi có cờ reset vừa thực hiện
          if (isLocallyReset) {
            if (!wfJson.workflow.isRankingsFinalized) {
              localStorage.removeItem('ktx_director_reset');
            }
            return {
              ...wfJson.workflow,
              isRankingsFinalized: false,
              isPublished: false,
            };
          }

          // Anti-flapping: Trạng thái duyệt chính thức là bền vững một chiều
          const resolvedFinalized =
            isLocallyFinalized || Boolean(wfJson.workflow.isRankingsFinalized);
          const resolvedPublished =
            isLocallyPublished || Boolean(wfJson.workflow.isPublished);

          if (
            prev.currentStep === wfJson.workflow.currentStep &&
            prev.isRankingsFinalized === resolvedFinalized &&
            prev.isPublished === resolvedPublished
          ) {
            return prev;
          }
          return {
            ...wfJson.workflow,
            isRankingsFinalized: resolvedFinalized,
            isPublished: resolvedPublished,
          };
        });
      }
    } catch (e) {
      console.warn('Lỗi đồng bộ Trưởng ban:', e);
    }
  }, []);

  useEffect(() => {
    fetchWorkflowAndApplications();

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('ktx_sync');
      bc.onmessage = (e) => {
        if (e.data?.type === 'ALL_EVIDENCE_APPROVED') {
          // Cập nhật tức thì 0ms khi QLSV duyệt đạt 100% minh chứng
          setPendingEvidenceCount(0);
          setPendingStudents([]);
          setAllCandidates((prev) =>
            prev.map((c) =>
              c.status === 'CHO_THAM_DINH' || c.status === 'CAN_BO_SUNG'
                ? { ...c, status: 'THAM_DINH_DAT', diem_uu_tien: c.diem_uu_tien > 0 ? c.diem_uu_tien : 35 }
                : c
            )
          );
        } else if (e.data?.type === 'DIRECTOR_APPROVED') {
          setWorkflowState((prev) => ({ ...prev, isRankingsFinalized: true }));
        } else if (e.data?.type === 'WORKFLOW_RESET') {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('ktx_director_finalized');
            localStorage.removeItem('ktx_director_published');
            localStorage.setItem('ktx_director_reset', 'true');
          }
          setWorkflowState((prev) => ({
            ...prev,
            isRankingsFinalized: false,
            isPublished: false,
            currentStep: 3,
          }));
        } else if (e.data?.type === 'OFFICER_EMAILS_SENT' || e.data?.type === 'ALL_EMAILS_SENT') {
          setWorkflowState((prev) => ({ ...prev, isRankingsFinalized: true, isPublished: true }));
        }
        fetchWorkflowAndApplications();
      };
    }

    const interval = setInterval(fetchWorkflowAndApplications, 5000);
    return () => {
      clearInterval(interval);
      if (bc) bc.close();
    };
  }, [fetchWorkflowAndApplications]);

  // Lọc theo khóa
  const filteredCandidates = useMemo(() => {
    return allCandidates.filter((c) => {
      if (selectedCohort === 'ALL') return true;
      return c.ma_sv.startsWith(selectedCohort);
    });
  }, [allCandidates, selectedCohort]);

  // Phân trang
  const totalPages = Math.ceil(filteredCandidates.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCandidates.slice(start, start + pageSize);
  }, [filteredCandidates, currentPage]);

  // KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT: CHỈ KHI QLSV PHÊ DUYỆT HẾT MINH CHỨNG THÌ TRƯỞNG BAN MỚI ĐƯỢC DUYỆT
  const pendingCount = pendingEvidenceCount;

  // TRƯỞNG BAN PHÊ DUYỆT NHANH TẤT CẢ MINH CHỨNG CÒN LẠI ĐỂ MỞ KHÓA KÝ QUYẾT ĐỊNH
  const handleApproveAllPendingQuick = async () => {
    setIsProcessing(true);
    try {
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_all_pending' }),
      });
      setPendingEvidenceCount(0);
      setPendingStudents([]);
      setAllCandidates((prev) =>
        prev.map((c) =>
          c.status === 'CHO_THAM_DINH' || c.status === 'CAN_BO_SUNG'
            ? { ...c, status: 'THAM_DINH_DAT', diem_uu_tien: c.diem_uu_tien > 0 ? c.diem_uu_tien : 35 }
            : c
        )
      );
      setStatusMessage('✓ Đã thẩm định đạt 100% minh chứng! Hệ thống đã mở khóa để Trưởng ban ký Quyết định phê duyệt.');
      await fetchWorkflowAndApplications();
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('ktx_sync');
        bc.postMessage({ type: 'ALL_EVIDENCE_APPROVED', timestamp: Date.now() });
        setTimeout(() => bc.close(), 100);
      }
    } catch (e: any) {
      alert('Lỗi phê duyệt: ' + (e.message || ''));
    } finally {
      setIsProcessing(false);
    }
  };

  // TRƯỞNG BAN KÝ DUYỆT DANH SÁCH CHÍNH THỨC
  // SAU KHI DUYỆT: QUYẾT ĐỊNH BAN HÀNH CHÍNH THỨC, CHUYỂN SANG BƯỚC 3B CHO CÁN BỘ QLSV
  const handleApproveAndPublish = async () => {
    setIsProcessing(true);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ktx_director_reset');
      localStorage.setItem('ktx_director_finalized', 'true');
    }
    setWorkflowState((prev) => ({ ...prev, isRankingsFinalized: true }));

    try {
      const res = await directorApproveRoundAction('round-k50-dot1');
      if (!res.success) {
        alert(res.message);
        return;
      }
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_by_director' }),
      });
      await fetchWorkflowAndApplications();
      setStatusMessage(
        res.message ||
          'Trưởng ban Quản lý KTX đã ký quyết định phê duyệt danh sách chính thức Đợt 1 (Quyết định B2)! Quyết định đã ban hành và có hiệu lực thi hành.'
      );

      // Đồng bộ cross-tab tức thì 0ms
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('ktx_sync');
        bc.postMessage({ type: 'DIRECTOR_APPROVED', timestamp: Date.now() });
        setTimeout(() => bc.close(), 100);
      }
    } catch (e: any) {
      alert('Lỗi phê duyệt: ' + (e.message || ''));
    } finally {
      setIsProcessing(false);
    }
  };

  // TRƯỞNG BAN KÍCH HOẠT THU HỒI PHÒNG QUÁ HẠN 72H & MỞ ĐỢT 2 (BƯỚC 10)
  const handleTriggerCancelStep10 = async () => {
    if (!confirm('Xác nhận kích hoạt quy trình thu hồi phòng quá hạn 72h và tự động mời sinh viên trong danh sách chờ (Mở đợt 2)?')) {
      return;
    }
    setIsProcessing(true);
    try {
      // Tìm sinh viên đang trúng tuyển đầu tiên để thực hiện mô phỏng
      const targetStudent = allCandidates.find((c) => c.thu_hang === 1) || {
        ma_sv: '48K01.001',
        ho_ten: 'Sinh viên mẫu',
        email: 'student@due.udn.vn',
      };
      const email = (targetStudent as any).email || `${targetStudent.ma_sv.toLowerCase()}@due.udn.vn`;
      await cancelAndReallocateAction(targetStudent.ma_sv, email, targetStudent.ho_ten);
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      await fetchWorkflowAndApplications();
      setStatusMessage(
        '🔄 [BƯỚC 10 THÀNH CÔNG]: Đã kích hoạt sự kiện hết hạn 72h (BE5 Err_Huy). Thu hồi phòng về TRỐNG (AVAILABLE) và chuyển suất trúng tuyển cho sinh viên kế tiếp trong danh sách chờ (Mở Đợt 2)!'
      );
    } catch (e: any) {
      alert('Lỗi kích hoạt Bước 10: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // THIẾT LẬP LẠI QUY TRÌNH VỀ BƯỚC 3 ĐỂ DEMO / KIỂM THỬ LẠI
  const handleResetWorkflow = async () => {
    if (!confirm('Xác nhận đặt lại trạng thái về "Chưa Phê Duyệt" để thực hiện lại thao tác ký duyệt hoặc demo?')) {
      return;
    }
    setIsProcessing(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ktx_director_finalized');
        localStorage.removeItem('ktx_director_published');
        localStorage.setItem('ktx_director_reset', 'true');
      }
      setWorkflowState((prev) => ({
        ...prev,
        isRankingsFinalized: false,
        isPublished: false,
        currentStep: 3,
      }));
      await resetWorkflowAction();
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      await fetchWorkflowAndApplications();
      setStatusMessage('🔄 Đã đặt lại trạng thái thành công! Đợt tuyển sinh đã quay về trạng thái "Chờ Trưởng Ban Duyệt" để sẵn sàng kiểm thử / demo lại.');

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('ktx_sync');
        bc.postMessage({ type: 'WORKFLOW_RESET', timestamp: Date.now() });
        setTimeout(() => bc.close(), 100);
      }
    } catch (e: any) {
      alert('Lỗi đặt lại trạng thái: ' + (e.message || ''));
    } finally {
      setIsProcessing(false);
    }
  };

  // Trả về điều chỉnh (XOR 3: 20% nhánh Trả về - Gửi thông báo đến Cổng QLSV)
  const handleReturnToOfficer = async () => {
    if (!returnReason.trim()) {
      alert('Vui lòng ghi chú lý do trả về để Cán bộ QLSV điều chỉnh!');
      return;
    }
    setIsProcessing(true);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ktx_director_finalized');
      localStorage.removeItem('ktx_director_published');
    }
    setWorkflowState((prev) => ({
      ...prev,
      isRankingsFinalized: false,
      isPublished: false,
    }));
    try {
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'return_to_officer',
          reason: returnReason.trim(),
        }),
      });
      setStatusMessage(
        `⚠️ [TRẢ VỀ ĐIỀU CHỈNH THÀNH CÔNG]: Đã gửi thông báo chỉ đạo điều chỉnh danh sách sang Cổng Cán bộ QLSV (/officer). Lý do: "${returnReason.trim()}".`
      );
      setIsReturnModalOpen(false);
      setReturnReason('');
      await fetchWorkflowAndApplications();
    } catch (err: any) {
      alert('Lỗi gửi thông báo cho QLSV: ' + (err.message || ''));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold shadow-sm flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-2 text-sm"
          >
            ✕
          </button>
        </div>
      )}
  

      {/* BẢNG TIẾN TRÌNH & ĐIỀU HƯỚNG CHUYỂN BƯỚC QUY TRÌNH BPMN TO-BE */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="text-blue-600 text-sm">🔄</span>
              <span>Điều Hướng Chuyển Bước Toàn Trình (Quy Trình Tuyển Sinh KTX BPMN TO-BE)</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Chuyển nhanh giữa các bước để theo dõi toàn trình nghiệp vụ hoặc kiểm thử luồng quy trình
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetWorkflow}
              disabled={isProcessing}
              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              title="Đặt lại đợt tuyển sinh về trạng thái Chưa Phê Duyệt để demo lại quy trình Trưởng ban ký quyết định"
            >
              <span>🔄 Reset Về Chưa Phê Duyệt</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <Link
            href="/student"
            className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition text-center group cursor-pointer"
          >
            <div className="text-[10px] font-bold text-slate-400 group-hover:text-blue-600 uppercase">Bước 1</div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-blue-900 mt-0.5">Nộp Hồ Sơ</div>
            <div className="text-[10px] text-slate-500 mt-1">Cổng Sinh Viên &rarr;</div>
          </Link>

          <Link
            href="/officer"
            className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition text-center group cursor-pointer"
          >
            <div className="text-[10px] font-bold text-slate-400 group-hover:text-blue-600 uppercase">Bước 2</div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-blue-900 mt-0.5">Thẩm Định AI Vision</div>
            <div className="text-[10px] text-slate-500 mt-1">Cổng Cán Bộ QLSV &rarr;</div>
          </Link>

          <div className="p-3 rounded-xl border-2 border-blue-600 bg-blue-50/80 text-center shadow-xs">
            <div className="text-[10px] font-black text-blue-700 uppercase">Bước 3A (Hiện Tại)</div>
            <div className="text-xs font-extrabold text-[#003366] mt-0.5">Trưởng Ban Phê Duyệt</div>
            <div className="text-[10px] font-black mt-1">
              {workflowState.isRankingsFinalized ? (
                <span className="text-emerald-700">✓ ĐÃ PHÊ DUYỆT B2</span>
              ) : (
                <span className="text-amber-700">⏳ Chờ Ký Duyệt</span>
              )}
            </div>
          </div>

          <Link
            href="/officer"
            className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 transition text-center group cursor-pointer"
          >
            <div className="text-[10px] font-bold text-slate-400 group-hover:text-amber-700 uppercase">Bước 3B</div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-amber-900 mt-0.5">Phát Hành Email & Ký HĐ</div>
            <div className="text-[10px] text-amber-700 font-semibold mt-1">Cổng QLSV &rarr;</div>
          </Link>

          <Link
            href="/student"
            className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-400 transition text-center group cursor-pointer"
          >
            <div className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-700 uppercase">Bước 4 & 5</div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 mt-0.5">Ký OTP & Bàn Giao Khóa</div>
            <div className="text-[10px] text-indigo-700 font-semibold mt-1">Cổng Sinh Viên &rarr;</div>
          </Link>
        </div>
      </div>

      {/* THANH ĐIỀU HÀNH CHÍNH XÁC DÀNH CHO TRƯỞNG BAN QUẢN LÝ KTX */}
      <div className="p-6 bg-gradient-to-r from-[#072E54] via-[#0B4378] to-[#125FA9] rounded-2xl border-2 border-blue-400/50 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-[#F26422] text-white shadow-xs">
              Thẩm Quyền Trưởng Ban Quản Lý KTX
            </span>
            <span className="text-xs text-indigo-200">
              Tiến độ:{' '}
              <strong className="text-white">
                {workflowState.isRankingsFinalized
                  ? 'BƯỚC 3 ĐÃ HOÀN TẤT: TRƯỞNG BAN ĐÃ KÝ PHÊ DUYỆT DANH SÁCH CHÍNH THỨC'
                  : pendingCount > 0
                  ? `BƯỚC 2: CHỜ QLSV THẨM ĐỊNH (${pendingCount} HỒ SƠ CHƯA DUYỆT)`
                  : 'BƯỚC 3: SẴN SÀNG – 100% MINH CHỨNG ĐÃ HỢP LỆ'}
              </strong>
            </span>
          </div>

          <h2 className="text-lg font-black text-white">
            {workflowState.isRankingsFinalized
              ? 'Trưởng Ban Đã Ký Quyết Định Phê Duyệt Danh Sách Tuyển Sinh (Đợt 1)'
              : pendingCount > 0
              ? `Chưa Thể Công Bố: Đang Chờ Cán Bộ QLSV Thẩm Định Xong Minh Chứng (Còn ${pendingCount} Hồ Sơ)`
              : 'Quyết Định Phê Duyệt Danh Sách Tuyển Sinh Chính Thức (Đợt 1)'}
          </h2>

          <p className="text-xs text-slate-200 max-w-2xl leading-relaxed">
            {workflowState.isRankingsFinalized
              ? 'Trưởng ban Quản lý KTX đã ký quyết định phê duyệt chính thức 120 thí sinh trúng tuyển (Quyết định B2). Quyết định đã ban hành và có hiệu lực thi hành.'
              : pendingCount > 0
              ? 'Theo Quy chế KTX DUE, Cán bộ QLSV phải thẩm định và duyệt xong 100% minh chứng trước khi công bố. Khi số hồ sơ còn lại bằng 0, Trưởng ban mới có thể ký duyệt danh sách trúng tuyển.'
              : '100% hồ sơ minh chứng đã được Cán bộ QLSV duyệt đạt chuẩn. Trưởng ban Quản lý KTX thực hiện ký quyết định phê duyệt danh sách chính thức.'}
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-3">
          {/* CẢNH BÁO ĐIỀU KIỆN TIÊN QUYẾT: CHỈ KHI QLSV DUYỆT HẾT THÌ MỚI ĐƯỢC CÔNG BỐ DANH SÁCH */}
          {!workflowState.isRankingsFinalized ? (
            pendingCount > 0 ? (
              <div className="p-4 bg-amber-500/20 border-2 border-amber-400 text-amber-200 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-2xl shadow-lg animate-in fade-in">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl shrink-0">🔒</span>
                  <div>
                    <div className="font-extrabold text-white text-sm">
                      CHƯA THỂ CÔNG BỐ: CÒN <span className="text-amber-300 underline font-mono text-base">{pendingCount}</span> HỒ SƠ MINH CHỨNG CHƯA DUYỆT!
                    </div>
                    <div className="text-amber-200 text-xs mt-0.5 leading-relaxed">
                      Theo quy chế KTX DUE, Cán bộ Quản lý Sinh viên (QLSV) phải duyệt xong tất cả các minh chứng, duyệt xong Trưởng ban mới được công bố danh sách.
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApproveAllPendingQuick}
                    disabled={isProcessing}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs whitespace-nowrap shadow transition flex items-center space-x-1 shrink-0 cursor-pointer"
                    title="Cán bộ / Trưởng ban phê duyệt nhanh tất cả để mở khóa ký quyết định"
                  >
                    <span>✓ Duyệt Đạt Tất Cả ({pendingCount})</span>
                  </button>
                  <Link
                    href="/officer"
                    className="px-3.5 py-2 bg-[#FFB800] hover:bg-amber-400 text-[#003366] font-black rounded-lg text-xs whitespace-nowrap shadow transition flex items-center space-x-1 shrink-0 cursor-pointer"
                  >
                    <span>👉 Cổng QLSV &rarr;</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-400 text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
                <span className="text-emerald-400 text-base font-bold">✓</span>
                <span className="font-semibold">100% hồ sơ minh chứng đã được QLSV hoàn tất thẩm định. Đủ điều kiện ký phê duyệt chính thức.</span>
              </div>
            )
          ) : (
            <div className="p-3 bg-emerald-500/25 border-2 border-emerald-400 text-emerald-100 rounded-xl text-xs flex items-center space-x-2 shadow-sm">
              <span className="text-emerald-400 text-lg font-black">✓</span>
              <span className="font-bold">
                ĐÃ KÝ PHÊ DUYỆT CHÍNH THỨC (QUYẾT ĐỊNH B2) – QUYẾT ĐỊNH ĐÃ CÓ HIỆU LỰC PHÁP LÝ
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!workflowState.isRankingsFinalized ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(true)}
                  disabled={isProcessing}
                  className="px-4 py-2.5 border border-rose-300 text-rose-200 hover:bg-rose-500/20 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  Trả Về Cho Cán Bộ Thẩm Định Lại
                </button>
                <button
                  type="button"
                  onClick={handleApproveAndPublish}
                  disabled={isProcessing || pendingCount > 0}
                  className={`px-5 py-3 rounded-xl text-xs font-black shadow-lg transition flex items-center space-x-2 ${
                    pendingCount > 0
                      ? 'bg-slate-700 text-slate-300 border border-slate-600 cursor-not-allowed opacity-75'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white hover:shadow-xl cursor-pointer'
                  }`}
                  title={
                    pendingCount > 0
                      ? `Khóa: Cán bộ QLSV phải duyệt hết ${pendingCount} minh chứng còn lại trước khi Trưởng ban được công bố danh sách.`
                      : 'Ký quyết định phê duyệt chính thức'
                  }
                >
                  {isProcessing ? (
                    <span>Đang ký duyệt...</span>
                  ) : pendingCount > 0 ? (
                    <span>🔒 KHÓA: CẦN CÁN BỘ QLSV DUYỆT XONG MINH CHỨNG ({pendingCount})</span>
                  ) : (
                    <span>TRƯỞNG BAN: KÝ PHÊ DUYỆT DANH SÁCH CHÍNH THỨC</span>
                  )}
                </button>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/officer"
                  className="px-4 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-[#003366] font-black rounded-xl text-xs shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
                  title="Chuyển sang Bước 3B: Cổng Cán Bộ QLSV (Phát hành thông báo trúng tuyển & mở cổng ký hợp đồng)"
                >
                  <span>👉 Chuyển Sang Bước 3B: Cổng QLSV &rarr;</span>
                </Link>
                <Link
                  href="/student"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
                  title="Chuyển sang Bước 4: Cổng Sinh Viên (Mở cổng ký hợp đồng điện tử OTP 72h)"
                >
                  <span>📱 Cổng Sinh Viên (Bước 4) &rarr;</span>
                </Link>
                <Link
                  href="/ranking"
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
                  title="Xem Bảng Xếp Hạng Tuyển Sinh Chính Thức Đã Phê Duyệt"
                >
                  <span>📊 Xem Bảng Xếp Hạng &rarr;</span>
                </Link>
                <button
                  type="button"
                  onClick={handleResetWorkflow}
                  disabled={isProcessing}
                  className="px-3.5 py-2.5 bg-slate-800/90 hover:bg-rose-700 text-slate-200 hover:text-white border border-slate-600 hover:border-rose-400 rounded-xl text-xs font-bold shadow transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  title="Cơ chế đặt lại trạng thái về Chưa Phê Duyệt để thực hiện demo hoặc kiểm thử lại quy trình ký duyệt"
                >
                  <span>🔄 Reset Về Chưa Phê Duyệt</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* THẺ THỐNG KÊ CHỈ SỐ KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tổng Hồ Sơ Tiếp Nhận</span>
          <div className="text-2xl font-black text-blue-900 mt-1">
            {allCandidates.length} <span className="text-xs font-normal text-slate-500">sinh viên</span>
          </div>
          <span className="text-[11px] text-blue-600 font-semibold mt-1 inline-block">Mọi khóa: K47, K48, K49, K50, K51</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Chỉ Tiêu Phòng KTX</span>
          <div className="text-2xl font-black text-indigo-900 mt-1">
            120 <span className="text-xs font-normal text-slate-500">chỗ</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">Đợt 1 Năm học 2026-2027</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tỷ Lệ Lấp Đầy Dự Kiến</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">100%</div>
          <span className="text-[11px] text-slate-500 mt-1 inline-block">120 / 120 chỗ đạt chuẩn</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Thẩm Định Minh Chứng (QLSV)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <div>
              <span className="text-xl font-black text-emerald-600">{approvedEvidenceCount}</span>
              <span className="text-[10px] text-slate-500 ml-1 font-semibold">đã duyệt</span>
            </div>
            <div>
              <span className={`text-xl font-black ${pendingCount === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{pendingCount}</span>
              <span className="text-[10px] text-slate-500 ml-1 font-semibold">chờ duyệt</span>
            </div>
          </div>
          <span className={`text-[11px] font-bold mt-1.5 inline-block ${pendingCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {pendingCount === 0 ? '✓ Đã duyệt xong 100% (Đủ điều kiện)' : `Còn ${pendingCount} hồ sơ cần QLSV duyệt`}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Trạng Thái Đợt Tuyển</span>
          <div className="mt-1">
            <span
              className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold ${
                workflowState.isRankingsFinalized
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {workflowState.isRankingsFinalized ? 'ĐÃ PHÊ DUYỆT CHÍNH THỨC' : 'CHỜ TRƯỞNG BAN DUYỆT'}
            </span>
          </div>
        </div>
      </div>

      {/* BẢNG DANH SÁCH XÉT DUYỆT */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Danh Sách Đề Xuất Trúng Tuyển (Quy Mô {allCandidates.length} Sinh Viên)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Top 120 sinh viên cao điểm nhất được xếp vào diện trúng tuyển chính thức
            </p>
          </div>

          {/* Lọc Khóa */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCohort}
              onChange={(e) => {
                setSelectedCohort(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
            >
              <option value="ALL">Tất cả các khóa</option>
              <option value="48K">Khóa 48 (48K)</option>
              <option value="49K">Khóa 49 (49K)</option>
              <option value="50K">Khóa 50 (50K)</option>
              <option value="51K">Khóa 51 (51K)</option>
            </select>

            <Link
              href="/ranking"
              className="px-3 py-1.5 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-bold transition"
            >
              Xem Bảng Xếp Hạng Real-time &rarr;
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 text-center">Thứ Hạng</th>
                <th className="py-2.5 px-4">Lớp</th>
                <th className="py-2.5 px-4">Họ và Tên</th>
                <th className="py-2.5 px-4">Tỉnh / Thành</th>
                <th className="py-2.5 px-4">Diện Ưu Tiên</th>
                <th className="py-2.5 px-4 text-center">Điểm</th>
                <th className="py-2.5 px-4 text-center">Tình Trạng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedList.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-4 text-center font-bold text-slate-900">#{c.thu_hang}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-blue-900">{c.ma_sv}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">{c.ho_ten}</td>
                  <td className="py-2.5 px-4 text-slate-600">{c.tinh_thanh}</td>
                  <td className="py-2.5 px-4 text-slate-700">{c.dien_uu_tien}</td>
                  <td className="py-2.5 px-4 text-center font-bold text-blue-700">+{c.diem_uu_tien}</td>
                  <td className="py-2.5 px-4 text-center">
                    {c.thu_hang <= 120 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {workflowState.isRankingsFinalized ? 'Trúng tuyển chính thức' : 'Trong chỉ tiêu 120'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Danh sách chờ #{c.thu_hang - 120}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500">
            Hiển thị trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong> (Tổng: {filteredCandidates.length} sinh viên)
          </span>
          <div className="flex space-x-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 border rounded bg-white disabled:opacity-40"
            >
              Trước
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 border rounded bg-white disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* MODAL TRẢ VỀ ĐIỀU CHỈNH (CHỈ KHẢ DỤNG TRƯỚC KHI TRƯỞNG BAN KÝ PHÊ DUYỆT) */}
      {!workflowState.isRankingsFinalized && isReturnModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase">
              Trả Về Danh Sách Cho Bộ Phận QLSV Điều Chỉnh
            </h3>
            <p className="text-xs text-slate-600">
              Vui lòng nêu rõ lý do hoặc chỉ đạo chỉnh sửa cơ cấu chỉ tiêu phòng:
            </p>
            <textarea
              rows={4}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Ví dụ: Cần rà soát thêm đối tượng sinh viên khó khăn của Khóa 51 mới nhập học..."
              className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-700"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleReturnToOfficer}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold shadow"
              >
                Xác Nhận Trả Về
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
