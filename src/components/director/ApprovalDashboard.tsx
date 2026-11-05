'use client';

// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// DASHBOARD DÀNH RIÊNG CHO TRƯỞNG BAN QUẢN LÝ KTX
// THẨM QUYỀN PHÊ DUYỆT VÀ CÔNG BỐ DANH SÁCH TRÚNG TUYỂN (BƯỚC 6 & BƯỚC 7)
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { generate350Students, computeMergedRankings } from '@/lib/data/mock-students';
import { RankingRow } from '@/components/ranking/RealtimeRankingTable';
import {
  approveRoundAndPublishAction,
  directorApproveRoundAction,
  officerSendBatchEmailsAction,
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
  const [pendingStudents, setPendingStudents] = useState<Array<{ id: string; ma_sv: string; ho_ten: string; status: string }>>([]);

  // ĐỒNG BỘ DỮ LIỆU TỪ WORKFLOW VÀ CƠ SỞ DỮ LIỆU
  const fetchWorkflowAndApplications = async () => {
    try {
      const [wfRes, appRes] = await Promise.all([
        fetch('/api/workflow'),
        fetch('/api/applications'),
      ]);
      const wfJson = await wfRes.json();
      if (wfJson.workflow) {
        setWorkflowState(wfJson.workflow);
      }
      if (typeof wfJson.pendingEvidenceCount === 'number') {
        setPendingEvidenceCount(wfJson.pendingEvidenceCount);
        if (wfJson.pendingStudents) setPendingStudents(wfJson.pendingStudents);
      }

      const appJson = await appRes.json();
      if (appJson.success && Array.isArray(appJson.data)) {
        const storedList = appJson.data as StoredApplication[];
        const pending = storedList.filter(
          (a) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
        );
        setPendingEvidenceCount(pending.length);
        setPendingStudents(
          pending.map((a) => ({ id: a.id, ma_sv: a.ma_sv, ho_ten: a.ho_ten, status: a.status }))
        );
        const merged = computeMergedRankings(storedList, 120);
        setAllCandidates(merged);
      }
    } catch (e) {
      console.warn('Lỗi đồng bộ Trưởng ban:', e);
    }
  };

  useEffect(() => {
    fetchWorkflowAndApplications();

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('ktx_sync');
      bc.onmessage = () => {
        fetchWorkflowAndApplications();
      };
    }

    const interval = setInterval(fetchWorkflowAndApplications, 2500);
    return () => {
      clearInterval(interval);
      if (bc) bc.close();
    };
  }, []);

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
  const pendingEvidenceApps = useMemo(() => {
    return allCandidates.filter(
      (c) => c.status === 'CHO_THAM_DINH' || c.status === 'CAN_BO_SUNG'
    );
  }, [allCandidates]);
  const pendingCount = Math.max(
    pendingEvidenceCount,
    pendingEvidenceApps.length,
    pendingStudents.length
  );

  // TRƯỞNG BAN KÝ DUYỆT DANH SÁCH CHÍNH THỨC (QUYẾT ĐỊNH B2)
  // SAU KHI DUYỆT: CHUYỂN TIẾP CHO CÁN BỘ QLSV ĐỂ PHÁT HÀNH EMAIL (AI SOẠN SẴN)
  const handleApproveAndPublish = async () => {
    setIsProcessing(true);
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
          'Trưởng ban đã phê duyệt danh sách chính thức (Quyết định B2)! AI đã soạn sẵn 120 email trúng tuyển kèm Hợp đồng điện tử. Đã chuyển tiếp sang Cán bộ Quản lý Sinh viên (QLSV) để phát hành gửi đến cho sinh viên.'
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

  // TRƯỞNG BAN PHÁT HÀNH & GỬI NGAY THÔNG BÁO TRÚNG TUYỂN (TASK TCB)
  const handleSendBatchNow = async () => {
    setIsProcessing(true);
    try {
      const res = await officerSendBatchEmailsAction();
      if (!res.success) {
        alert(res.message);
        return;
      }
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_by_officer' }),
      });
      await fetchWorkflowAndApplications();
      setStatusMessage(
        res.message ||
          '✓ Đã phát hành chính thức 120 thông báo trúng tuyển và mở cổng ký hợp đồng điện tử 72 giờ cho sinh viên thành công!'
      );

      // Đồng bộ cross-tab tức thì 0ms
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('ktx_sync');
        bc.postMessage({ type: 'ROUND_PUBLISHED', timestamp: Date.now() });
        setTimeout(() => bc.close(), 100);
      }
    } catch (e: any) {
      alert('Lỗi phát hành thông báo: ' + (e.message || ''));
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

  // THIẾT LẬP LẠI QUY TRÌNH VỀ BƯỚC 3 ĐỂ DEMO LẠI
  const handleResetWorkflow = async () => {
    try {
      await resetWorkflowAction();
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      await fetchWorkflowAndApplications();
      setStatusMessage('🔄 Đã thiết lập lại quy trình về Bước 3 (Bảng xếp hạng Tạm thời).');
    } catch {}
  };

  // Trả về điều chỉnh (XOR 3: 20% nhánh Trả về - Gửi thông báo đến Cổng QLSV)
  const handleReturnToOfficer = async () => {
    if (!returnReason.trim()) {
      alert('Vui lòng ghi chú lý do trả về để Cán bộ QLSV điều chỉnh!');
      return;
    }
    setIsProcessing(true);
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
        `⚠️ [XOR 3 TRẢ VỀ THÀNH CÔNG]: Đã gửi thông báo chỉ đạo điều chỉnh danh sách sang Cổng Cán bộ QLSV (/officer). Lý do: "${returnReason.trim()}".`
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
                {workflowState.isPublished
                  ? 'BƯỚC 4: ĐÃ PHÁT HÀNH EMAIL VÀ HỢP ĐỒNG 72H'
                  : workflowState.isRankingsFinalized
                  ? 'BƯỚC 3 ĐÃ XONG: TRƯỞNG BAN ĐÃ DUYỆT (B2) – CHỜ CÁN BỘ QLSV GỬI EMAIL'
                  : 'BƯỚC 3: CHỜ TRƯỞNG BAN PHÊ DUYỆT DANH SÁCH (B2)'}
              </strong>
            </span>
          </div>

          <h2 className="text-lg font-black text-white">
            {workflowState.isPublished
              ? 'Danh Sách Tuyển Sinh Đã Được Công Bố & Đang Mở Cổng Ký Hợp Đồng'
              : workflowState.isRankingsFinalized
              ? 'Trưởng Ban Đã Ký Quyết Định Phê Duyệt – Đang Chờ Cán Bộ QLSV Gửi Email Thông Báo'
              : 'Quyết Định Phê Duyệt Danh Sách Tuyển Sinh Chính Thức (Đợt 1)'}
          </h2>

          <p className="text-xs text-slate-200 max-w-2xl leading-relaxed">
            {workflowState.isPublished
              ? 'Trưởng ban đã phê duyệt quyết định tuyển sinh và Cán bộ QLSV đã hoàn tất phát hành email thông báo. Sinh viên trúng tuyển đang thực hiện ký hợp đồng điện tử 72 giờ.'
              : workflowState.isRankingsFinalized
              ? 'Trưởng ban đã ký quyết định phê duyệt chính thức. AI đã soạn sẵn 120 email trúng tuyển kèm Hợp đồng điện tử. Cán bộ Quản lý Sinh viên (QLSV) sẽ thực hiện kiểm tra và gửi email đến cho sinh viên.'
              : 'Theo Quy chế Tuyển sinh Ký túc xá Trường Đại học Kinh tế (DUE), Trưởng Ban Quản lý KTX là người có thẩm quyền ký quyết định phê duyệt danh sách chính thức.'}
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-3">
          {/* CẢNH BÁO ĐIỀU KIỆN TIÊN QUYẾT: CHỈ KHI QLSV DUYỆT HẾT THÌ MỚI ĐƯỢC CÔNG BỐ DANH SÁCH */}
          {!workflowState.isRankingsFinalized && (
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
                <Link
                  href="/officer"
                  className="px-3.5 py-2 bg-[#FFB800] hover:bg-amber-400 text-[#003366] font-black rounded-lg text-xs whitespace-nowrap shadow transition flex items-center space-x-1 shrink-0"
                >
                  <span>👉 Sang Cổng QLSV Duyệt ({pendingCount}) &rarr;</span>
                </Link>
              </div>
            ) : (
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-400 text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
                <span className="text-emerald-400 text-base font-bold">✓</span>
                <span className="font-semibold">100% hồ sơ minh chứng đã được QLSV hoàn tất thẩm định. Đủ điều kiện ký phê duyệt chính thức.</span>
              </div>
            )
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!workflowState.isRankingsFinalized ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(true)}
                  disabled={isProcessing}
                  className="px-4 py-2.5 border border-rose-300 text-rose-200 hover:bg-rose-500/20 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  Trả Về Điều Chỉnh (XOR 3)
                </button>
                <button
                  type="button"
                  onClick={handleApproveAndPublish}
                  disabled={isProcessing || pendingCount > 0}
                  className={`px-5 py-3 rounded-xl text-xs font-black shadow-lg transition flex items-center space-x-2 ${
                    pendingCount > 0
                      ? 'bg-slate-700 text-slate-300 border border-slate-600 cursor-not-allowed opacity-75'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white hover:shadow-xl'
                  }`}
                  title={
                    pendingCount > 0
                      ? `Khóa: Cán bộ QLSV phải duyệt hết ${pendingCount} minh chứng còn lại trước khi Trưởng ban được công bố danh sách.`
                      : 'Ký quyết định phê duyệt chính thức B2'
                  }
                >
                  {isProcessing ? (
                    <span>Đang ký duyệt...</span>
                  ) : pendingCount > 0 ? (
                    <span>🔒 KHÓA: CẦN CÁN BỘ QLSV DUYỆT XONG MINH CHỨNG ({pendingCount})</span>
                  ) : (
                    <span>TRƯỞNG BAN: PHÊ DUYỆT DANH SÁCH (QUYẾT ĐỊNH B2)</span>
                  )}
                </button>
              </>
            ) : !workflowState.isPublished ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendBatchNow}
                  disabled={isProcessing || pendingCount > 0}
                  className={`px-5 py-3 rounded-xl text-xs font-black shadow-lg transition flex items-center space-x-2 ${
                    pendingCount > 0
                      ? 'bg-slate-700 text-slate-300 border border-slate-600 cursor-not-allowed opacity-75'
                      : 'bg-[#FFB800] hover:bg-amber-400 text-[#003366]'
                  }`}
                  title={
                    pendingCount > 0
                      ? `Khóa: Còn ${pendingCount} minh chứng chưa được QLSV duyệt.`
                      : 'Phát hành chính thức 120 thông báo trúng tuyển'
                  }
                >
                  <span>{pendingCount > 0 ? '🔒' : '✉'}</span>
                  <span>
                    {isProcessing
                      ? 'Đang phát hành 120 email...'
                      : pendingCount > 0
                      ? `KHÓA: CẦN CÁN BỘ QLSV DUYỆT XONG MINH CHỨNG (${pendingCount})`
                      : 'TRƯỞNG BAN: PHÁT HÀNH & GỬI NGAY THÔNG BÁO TRÚNG TUYỂN (120 THÍ SINH)'}
                  </span>
                </button>
                <Link
                  href="/officer"
                  className="px-4 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <span>Chuyển Sang Cổng QLSV (/officer) &rarr;</span>
                </Link>
              </div>
            ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-400 text-emerald-300 rounded-xl text-xs font-bold flex items-center space-x-1.5">
                <span>✓</span>
                <span>ĐÃ CÔNG BỐ CHÍNH THỨC</span>
              </span>
              <button
                type="button"
                onClick={handleTriggerCancelStep10}
                disabled={isProcessing}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                <span>⚠️</span>
                <span>Kích Hoạt Thu Hồi 72h &amp; Mở Đợt 2 (Bước 10)</span>
              </button>
              <button
                type="button"
                onClick={handleResetWorkflow}
                disabled={isProcessing}
                className="px-3.5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50"
              >
                🔄 Reset Về Bước 3
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Chờ QLSV Thẩm Định</span>
          <div className="text-2xl font-black mt-1 flex items-baseline space-x-1">
            <span className={pendingCount === 0 ? 'text-emerald-600' : 'text-amber-600'}>
              {pendingCount}
            </span>
            <span className="text-xs font-normal text-slate-500">hồ sơ</span>
          </div>
          <span className={`text-[11px] font-bold mt-1 inline-block ${pendingCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {pendingCount === 0 ? '✓ Đã duyệt xong 100%' : 'Đang chờ thẩm định'}
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
              {workflowState.isRankingsFinalized ? 'ĐÃ PHÊ DUYỆT & CÔNG BỐ' : 'CHỜ TRƯỞNG BAN DUYỆT'}
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
                <th className="py-2.5 px-4">Mã SV</th>
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

      {/* MODAL TRẢ VỀ ĐIỀU CHỈNH */}
      {isReturnModalOpen && (
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
