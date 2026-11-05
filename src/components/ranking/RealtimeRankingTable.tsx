'use client';

// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// BẢNG XẾP HẠNG TUYỂN SINH REAL-TIME (QUY MÔ 350 SINH VIÊN + ĐỒNG BỘ DỮ LIỆU CSDL)
// TỰ ĐỘNG CẬP NHẬT TỨC THÌ KHI CÓ SINH VIÊN MỚI NỘP HỒ SƠ QUA WEBSOCKET / CSDL
// ==============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { generate350Students, computeMergedRankings } from '@/lib/data/mock-students';
import { StoredApplication } from '@/lib/data/live-store';
import { approveRoundAndPublishAction, resetWorkflowAction } from '@/actions/approval';
import { UserRole } from '@/types/database';

export interface RankingRow {
  id: string;
  thu_hang: number;
  ma_sv: string;
  ho_ten: string;
  tinh_thanh: string;
  dien_uu_tien: string;
  diem_uu_tien: number;
  is_trung_tuyen: boolean;
  status: string;
  updated_at: string;
}

interface RealtimeRankingTableProps {
  initialData?: RankingRow[];
}

export default function RealtimeRankingTable({ initialData }: RealtimeRankingTableProps) {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search') || '';

  const [allRankings, setAllRankings] = useState<RankingRow[]>(
    () => initialData || computeMergedRankings([])
  );
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('Vừa đồng bộ');
  const [highlightId, setHighlightId] = useState<string | null>(urlSearch || null);

  // Trạng thái điều phối quy trình BPMN liên thông (Bước 6, 7, 8, 9, 10)
  const [workflowState, setWorkflowState] = useState<{
    currentStep: number;
    isRankingsFinalized: boolean;
    isPublished: boolean;
  }>({
    currentStep: 3,
    isRankingsFinalized: false,
    isPublished: false,
  });
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeNotice, setFinalizeNotice] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Bộ lọc & Phân trang
  const [searchKeyword, setSearchKeyword] = useState(urlSearch);
  const [selectedCohort, setSelectedCohort] = useState<string>('ALL');
  const [selectedPolicy, setSelectedPolicy] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchWorkflow = async () => {
    try {
      const res = await fetch('/api/workflow');
      const json = await res.json();
      if (json.success && json.workflow) {
        setWorkflowState(json.workflow);
      }
      if (typeof json.pendingEvidenceCount === 'number') {
        setPendingCount(json.pendingEvidenceCount);
      }
    } catch {}
  };

  const [currentRole, setCurrentRole] = useState<UserRole>('SV');

  useEffect(() => {
    fetchWorkflow();

    // Đồng bộ vai trò người dùng hiện tại (Sinh viên vs Cán bộ / Trưởng ban)
    const syncRole = () => {
      try {
        const stored = localStorage.getItem('ktx_current_role') as UserRole;
        if (stored && ['SV', 'QLSV', 'TB'].includes(stored)) {
          setCurrentRole(stored);
        } else {
          setCurrentRole('SV');
        }
      } catch {}
    };

    syncRole();
    const handleRoleChange = (e: any) => {
      if (e.detail && ['SV', 'QLSV', 'TB'].includes(e.detail)) {
        setCurrentRole(e.detail);
      }
    };
    window.addEventListener('ktx_role_change', handleRoleChange);
    window.addEventListener('storage', syncRole);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('ktx_sync');
      bc.onmessage = () => {
        syncStoredApplications();
        fetchWorkflow();
      };
    }

    return () => {
      window.removeEventListener('ktx_role_change', handleRoleChange);
      window.removeEventListener('storage', syncRole);
      if (bc) bc.close();
    };
  }, []);

  // CÁN BỘ / TRƯỞNG BAN BẤM NÚT [CHỐT BẢNG XẾP HẠNG & PHÁT HÀNH THÔNG BÁO]
  const handleFinalizeAndPublish = async () => {
    setIsFinalizing(true);
    try {
      const res = await approveRoundAndPublishAction('round-k50-dot1');
      if (!res.success) {
        alert(res.message);
        setIsFinalizing(false);
        return;
      }
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize' }),
      });
      await fetchWorkflow();
      setFinalizeNotice(
        '🎉 [BƯỚC 6 & 7 THÀNH CÔNG]: Đã chốt danh sách Top 120 trúng tuyển & phát hành email hàng loạt (TCB)! Cổng Sinh Viên đã mở khóa Bước 8 để sinh viên vào ký hợp đồng điện tử 72h.'
      );

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('ktx_sync');
        bc.postMessage({ type: 'ROUND_PUBLISHED', timestamp: Date.now() });
        setTimeout(() => bc.close(), 100);
      }
    } catch (e: any) {
      alert('Lỗi chốt danh sách: ' + (e.message || ''));
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleResetWorkflow = async () => {
    try {
      await resetWorkflowAction();
      await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      await fetchWorkflow();
      setFinalizeNotice('🔄 Đã thiết lập lại quy trình về Bước 3 (Bảng xếp hạng Tạm thời).');
    } catch {}
  };

  // ============================================================================
  // 1. ĐỒNG BỘ DỮ LIỆU THỰC TẾ TỪ CƠ SỞ DỮ LIỆU (DATABASE SYNC)
  // ============================================================================
  const syncStoredApplications = async () => {
    try {
      const res = await fetch('/api/applications');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const storedList = json.data as StoredApplication[];
        const pending = storedList.filter(
          (a) => a.status === 'CHO_THAM_DINH' || a.status === 'CAN_BO_SUNG'
        ).length;
        setPendingCount(pending);
        const merged = computeMergedRankings(storedList, 120);
        setAllRankings((prev) => {
          if (prev.length === merged.length) {
            let isIdentical = true;
            for (let i = 0; i < Math.min(30, prev.length); i++) {
              if (
                prev[i].ma_sv !== merged[i].ma_sv ||
                prev[i].diem_uu_tien !== merged[i].diem_uu_tien ||
                prev[i].thu_hang !== merged[i].thu_hang ||
                prev[i].status !== merged[i].status
              ) {
                isIdentical = false;
                break;
              }
            }
            if (isIdentical) return prev; // Tránh re-render giật lag bảng xếp hạng
          }
          return merged;
        });
        setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
      }
    } catch (err) {
      console.warn('Lỗi đồng bộ BXH:', err);
    }
  };

  useEffect(() => {
    syncStoredApplications();

    if (urlSearch) {
      setSearchKeyword(urlSearch);
      setHighlightId(urlSearch);
    } else {
      try {
        const lastRaw = localStorage.getItem('last_submitted_student');
        if (lastRaw) {
          const lastStudent = JSON.parse(lastRaw);
          if (lastStudent?.ma_sv) {
            setHighlightId(lastStudent.ma_sv);
          }
        }
      } catch {}
    }

    const handleNewSubmission = (e: Event) => {
      syncStoredApplications();
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.student?.ma_sv) {
        setHighlightId(customEvent.detail.student.ma_sv);
        setSearchKeyword(customEvent.detail.student.ma_sv);
      }
    };

    window.addEventListener('student_application_submitted', handleNewSubmission);
    window.addEventListener('storage', syncStoredApplications);

    const interval = setInterval(syncStoredApplications, 6000);

    return () => {
      window.removeEventListener('student_application_submitted', handleNewSubmission);
      window.removeEventListener('storage', syncStoredApplications);
      clearInterval(interval);
    };
  }, [urlSearch]);

  // 2. SUPABASE REALTIME SUBSCRIPTION
  useEffect(() => {
    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-id')) {
        supabase = createClient();
      }
    } catch {}

    if (!supabase) return;

    const channel = supabase
      .channel('realtime_rankings_350_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rankings' }, () => {
        syncStoredApplications();
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // 3. LỌC DỮ LIỆU ĐA CHIỀU
  const filteredList = useMemo(() => {
    return allRankings.filter((item) => {
      const matchKeyword =
        searchKeyword === '' ||
        item.ho_ten.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        item.ma_sv.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        item.tinh_thanh.toLowerCase().includes(searchKeyword.toLowerCase());

      const matchCohort =
        selectedCohort === 'ALL' ||
        item.ma_sv.startsWith(selectedCohort) ||
        (searchKeyword !== '' && item.ma_sv.toLowerCase().includes(searchKeyword.toLowerCase()));

      const matchPolicy =
        selectedPolicy === 'ALL' || item.dien_uu_tien.toLowerCase().includes(selectedPolicy.toLowerCase());

      return matchKeyword && matchCohort && matchPolicy;
    });
  }, [allRankings, searchKeyword, selectedCohort, selectedPolicy]);

  // Phân trang
  const totalItems = filteredList.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* THÔNG BÁO TIẾN ĐỘ QUY TRÌNH NẾU VỪA THAO TÁC */}
      {finalizeNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold shadow-sm flex items-center justify-between">
          <span>{finalizeNotice}</span>
          <button
            type="button"
            onClick={() => setFinalizeNotice(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-2 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* THANH ĐIỀU PHỐI QUY TRÌNH / BANNER TRẠNG THÁI (PHÂN QUYỀN CHẶT CHẼ THEO VAI TRÒ) */}
      <div className="p-5 bg-gradient-to-r from-[#072E54] via-[#0B4378] to-[#125FA9] rounded-2xl border-2 border-blue-400/40 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-[#F26422] text-white shadow-xs">
              {currentRole === 'SV' ? 'Cổng Sinh Viên' : 'Tiến Độ Tuyển Sinh'}
            </span>
            <span className="text-xs text-blue-200">
              Trạng thái:{' '}
              <strong className="text-white">
                {workflowState.isRankingsFinalized
                  ? 'Đã Công Bố Kết Quả Chính Thức'
                  : 'Bảng Xếp Hạng Tạm Thời (Real-time)'}
              </strong>
            </span>
          </div>
          <h3 className="text-base font-bold text-white">
            {workflowState.isRankingsFinalized
              ? '🎉 Danh Sách Top 120 Trúng Tuyển Đã Được Phê Duyệt'
              : 'Bảng Xếp Hạng Tuyển Sinh Nội Trú KTX DUE'}
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {currentRole === 'SV'
              ? workflowState.isRankingsFinalized
                ? 'Sinh viên trúng tuyển vui lòng vào Cổng Sinh Viên để ký Hợp đồng điện tử trong thời hạn 72 giờ.'
                : 'Thứ hạng xét tuyển được cập nhật tự động theo thời gian thực. Nhập MSSV hoặc CCCD vào ô tìm kiếm bên dưới để tra cứu vị trí của bạn.'
              : workflowState.isRankingsFinalized
                ? 'Đã phê duyệt danh sách chính thức và mở cổng ký hợp đồng 72h cho sinh viên trúng tuyển.'
                : 'Thứ hạng được cập nhật liên tục. Trưởng Ban Quản lý KTX thực hiện phê duyệt và công bố danh sách chính thức khi kết thúc đợt xét tuyển.'}
          </p>
        </div>

        {/* NÚT THAO TÁC THEO PHÂN QUYỀN VAI TRÒ */}
        <div className="flex flex-wrap items-center gap-2">
          {currentRole === 'SV' ? (
            /* DÀNH CHO PHÍA SINH VIÊN: TUYỆT ĐỐI KHÔNG HIỂN THỊ CÁC NÚT DUYỆT CỦA TRƯỞNG BAN */
            <div className="flex items-center space-x-2">
              <Link
                href="/student"
                className={`px-5 py-3 rounded-xl text-xs font-bold text-white shadow-lg hover:shadow-xl transition-all flex items-center space-x-2 border ${
                  workflowState.isRankingsFinalized
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border-emerald-400/40'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border-blue-400/30'
                }`}
              >
                <span>
                  {workflowState.isRankingsFinalized
                    ? '✍️ Vào Cổng Sinh Viên Để Ký Hợp Đồng (72h)'
                    : '👨‍🎓 Cổng Cá Nhân: Nộp & Theo Dõi Hồ Sơ'}
                </span>
                <span>&rarr;</span>
              </Link>
            </div>
          ) : (
            /* DÀNH CHO TRƯỞNG BAN & CÁN BỘ QLSV */
            !workflowState.isRankingsFinalized ? (
              <>
                <Link
                  href="/director"
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-xl text-xs font-black shadow-lg hover:shadow-xl transition-all flex items-center space-x-2"
                >
                  <span>Chuyển Sang Dashboard Trưởng Ban Để Phê Duyệt &amp; Công Bố</span>
                  <span>&rarr;</span>
                </Link>
                <button
                  type="button"
                  onClick={handleFinalizeAndPublish}
                  disabled={isFinalizing || pendingCount > 0}
                  title={
                    pendingCount > 0
                      ? `Khóa: Còn ${pendingCount} hồ sơ/minh chứng đang chờ Cán bộ QLSV thẩm định. Cán bộ QLSV phải duyệt xong tất cả các minh chứng mới được công bố danh sách.`
                      : 'Dành riêng cho Trưởng Ban Quản Lý KTX'
                  }
                  className={`px-3.5 py-3 rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5 border ${
                    pendingCount > 0
                      ? 'bg-slate-700 text-slate-300 border-slate-600 cursor-not-allowed opacity-75'
                      : 'bg-emerald-600/90 hover:bg-emerald-600 text-white border-emerald-400/50'
                  }`}
                >
                  {isFinalizing ? (
                    <span>⏳ Đang phát hành...</span>
                  ) : pendingCount > 0 ? (
                    <>
                      <span>🔒</span>
                      <span>Khóa: Chờ QLSV duyệt ({pendingCount})</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Trưởng Ban: Duyệt Nhanh</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/director"
                  className="px-4 py-2.5 bg-indigo-800 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <span>📋 Dashboard Trưởng Ban</span>
                  <span>&rarr;</span>
                </Link>
                <button
                  type="button"
                  onClick={handleResetWorkflow}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700"
                >
                  🔄 Reset Đợt
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* HEADER BẢNG XẾP HẠNG */}
      <div className="bg-gradient-to-r from-[#072E54] via-[#0B4378] to-[#125FA9] rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase bg-[#F26422] text-white shadow-xs">
              Real-time WebSocket & CSDL
            </span>
            <span className="text-xs text-blue-200">
              Cập nhật: <strong className="text-white">{lastUpdated}</strong>
            </span>
          </div>
          <h1 className="text-2xl font-black mt-1">
            Bảng Xếp Hạng Tuyển Sinh KTX ĐH Kinh Tế – DUE
          </h1>
          <p className="text-xs text-blue-200 mt-0.5">
            Quy mô thực tế: <strong className="text-white">{allRankings.length} sinh viên</strong> | Đa khóa (K47 - K51+) | Chỉ tiêu trúng tuyển: <strong className="text-amber-300">120 chỗ</strong>
          </p>
        </div>

        {/* Trạng thái kết nối */}
        <div className="flex items-center space-x-3 bg-blue-950/70 px-4 py-2 rounded-xl border border-blue-400/20">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <div className="text-xs">
            <span className="block font-bold text-emerald-400">Đang Đồng Bộ Trực Tiếp</span>
            <span className="text-[10px] text-blue-300">Tự động thêm SV mới nộp (F5-free)</span>
          </div>
        </div>
      </div>

      {/* THÔNG BÁO TÌM KIẾM ĐÍCH DANH (NẾU ĐI TỪ TRANG TRACKER HOẶC VỪA NỘP) */}
      {searchKeyword && (
        <div className="p-3 bg-blue-50 border border-blue-300 rounded-xl flex justify-between items-center text-xs">
          <div>
            <span className="font-bold text-blue-950">
              🔍 Đang lọc kết quả cho: &quot;{searchKeyword}&quot;
            </span>
            <span className="text-slate-600 ml-2">
              (Tìm thấy <strong>{filteredList.length}</strong> kết quả)
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchKeyword('');
              if (highlightId) {
                const foundIdx = allRankings.findIndex(
                  (x) => x.ma_sv.toLowerCase() === highlightId.toLowerCase() || x.id === highlightId
                );
                if (foundIdx >= 0) {
                  const targetPage = Math.floor(foundIdx / pageSize) + 1;
                  setCurrentPage(targetPage);
                }
              }
            }}
            className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 font-bold shadow-sm"
          >
            ✕ Xem tất cả {allRankings.length} sinh viên (Đến trang chứa hồ sơ của bạn)
          </button>
        </div>
      )}

      {/* THANH TÌM KIẾM & BỘ LỌC */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tìm kiếm sinh viên:</label>
          <input
            type="text"
            placeholder="Tìm theo Tên, MSSV, Tỉnh thành..."
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lọc theo Khóa học:</label>
          <select
            value={selectedCohort}
            onChange={(e) => {
              setSelectedCohort(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50 font-medium"
          >
            <option value="ALL">Tất cả các khóa</option>
            <option value="51K">Khóa 51 (51K)</option>
            <option value="50K">Khóa 50 (50K)</option>
            <option value="49K">Khóa 49 (49K)</option>
            <option value="48K">Khóa 48 (48K)</option>
            <option value="47K">Khóa 47 (47K)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Diện ưu tiên:</label>
          <select
            value={selectedPolicy}
            onChange={(e) => {
              setSelectedPolicy(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50 font-medium"
          >
            <option value="ALL">Tất cả diện chính sách</option>
            <option value="liệt sĩ">Con thương binh, liệt sĩ</option>
            <option value="nghèo">Hộ nghèo, cận nghèo</option>
            <option value="vùng sâu">Vùng sâu, vùng xa, hải đảo</option>
            <option value="dân tộc">Dân tộc thiểu số</option>
            <option value="ngoại tỉnh">Ngoại tỉnh (&gt;200km)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Số lượng / trang:</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50 font-medium"
          >
            <option value={10}>10 sinh viên / trang</option>
            <option value={25}>25 sinh viên / trang</option>
            <option value={50}>50 sinh viên / trang</option>
            <option value={100}>100 sinh viên / trang</option>
          </select>
        </div>
      </div>

      {/* BẢNG DỮ LIỆU */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 text-center w-16">Thứ Hạng</th>
                <th className="py-3 px-4">Mã Sinh Viên</th>
                <th className="py-3 px-4">Họ và Tên</th>
                <th className="py-3 px-4">Tỉnh / Thành</th>
                <th className="py-3 px-4">Diện Ưu Tiên</th>
                <th className="py-3 px-4 text-center">Điểm Xét</th>
                <th className="py-3 px-4 text-center">Trạng Thái Tuyển Sinh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedList.map((row) => {
                const isAdmitted = row.thu_hang <= 120;
                const isMyProfile = highlightId
                  ? row.id === highlightId || row.ma_sv.toLowerCase() === highlightId.toLowerCase()
                  : false;
                const isMatchKeyword =
                  searchKeyword !== '' &&
                  (row.ma_sv.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                    row.ho_ten.toLowerCase().includes(searchKeyword.toLowerCase()));

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isMyProfile
                        ? 'bg-amber-100 text-amber-950 font-bold ring-2 ring-amber-400'
                        : isMatchKeyword
                        ? 'bg-blue-50 text-blue-950 font-semibold'
                        : isAdmitted
                        ? 'hover:bg-emerald-50/50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-bold">
                      <span
                        className={`inline-block w-7 h-7 leading-7 rounded-full text-xs ${
                          row.thu_hang === 1
                            ? 'bg-[#F26422] text-white font-extrabold shadow'
                            : row.thu_hang <= 3
                            ? 'bg-blue-100 text-[#125FA9] font-bold'
                            : isAdmitted
                            ? 'bg-slate-100 text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.thu_hang}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {row.ma_sv}
                      {isMyProfile && (
                        <span className="ml-1.5 px-2 py-0.5 rounded bg-[#F26422] text-white text-[10px] uppercase font-black shadow-sm">
                          Hồ sơ của bạn (Vừa nộp)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{row.ho_ten}</td>
                    <td className="py-3 px-4 text-slate-600">{row.tinh_thanh}</td>
                    <td className="py-3 px-4 text-slate-700">{row.dien_uu_tien}</td>
                    <td className="py-3 px-4 text-center font-bold text-blue-900 text-sm">
                      {row.status === 'CHO_THAM_DINH' || row.status === 'CAN_BO_SUNG' ? (
                        <span className="text-amber-700 text-xs font-semibold">0đ (Chờ duyệt)</span>
                      ) : row.status === 'HUY_SUAT' ? (
                        <span className="text-slate-400 text-xs">0đ (Đã hủy)</span>
                      ) : (
                        `+${row.diem_uu_tien}đ`
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.status === 'CHO_THAM_DINH' ? (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          ⏳ Chờ QLSV Rà Soát
                        </span>
                      ) : row.status === 'CAN_BO_SUNG' ? (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          ⚠️ Cần Bổ Sung MC
                        </span>
                      ) : row.status === 'HUY_SUAT' ? (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">
                          ✕ Đã Từ Chối / Hủy
                        </span>
                      ) : row.is_trung_tuyen ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Đủ Điểm Trúng Tuyển (Top 120)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          Danh Sách Chờ #{Math.max(1, row.thu_hang - 120)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* THANH PHÂN TRANG */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <span className="text-slate-600">
            Hiển thị <strong>{(currentPage - 1) * pageSize + 1}</strong> -{' '}
            <strong>{Math.min(currentPage * pageSize, totalItems)}</strong> trong tổng số{' '}
            <strong>{totalItems}</strong> sinh viên
          </span>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 border rounded bg-white disabled:opacity-40 font-semibold"
            >
              ← Trang trước
            </button>
            <span className="px-3 font-semibold text-slate-700">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 border rounded bg-white disabled:opacity-40 font-semibold"
            >
              Trang sau →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
