'use client';

// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// MODAL ĐĂNG NHẬP / CHỌN TÀI KHOẢN SINH VIÊN (TOÀN HỆ THỐNG)
// CHO PHÉP ĐĂNG NHẬP DỰA TRÊN DỮ LIỆU ĐỘNG CSDL KTX DUE (MSSV, CCCD, HỌ TÊN)
// ==============================================================================

import React, { useState, useEffect } from 'react';

interface StudentLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStudentCode?: string;
  onSelectStudent?: (student: any) => void;
}

export default function StudentLoginModal({
  isOpen,
  onClose,
  currentStudentCode,
  onSelectStudent,
}: StudentLoginModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch('/api/applications')
        .then((res) => res.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setApplications(json.data);
          }
        })
        .catch((err) => console.warn('Lỗi tải danh sách sinh viên:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredApps = applications.filter((app) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      app.ma_sv?.toLowerCase().includes(q) ||
      app.ho_ten?.toLowerCase().includes(q) ||
      app.cccd?.includes(q) ||
      app.email?.toLowerCase().includes(q)
    );
  });

  const handleChoose = (app: any) => {
    try {
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
        status: app.status || 'CHO_THAM_DINH',
        aiConfidence: app.ai_result?.confidence ?? (app.status === 'THAM_DINH_DAT' ? 0.98 : 0.35),
      };
      localStorage.setItem('last_submitted_student', JSON.stringify(resolved));
      localStorage.setItem('active_student_session_code', app.ma_sv);
      localStorage.setItem('student_page_tab', 'tracker');

      // Bắn sự kiện đồng bộ toàn hệ thống
      window.dispatchEvent(new CustomEvent('student_session_changed', { detail: resolved }));
      window.dispatchEvent(new CustomEvent('switch_student_tab', { detail: 'tracker' }));

      if (onSelectStudent) {
        onSelectStudent(resolved);
      }
    } catch {}

    onClose();
    setSearchQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#072E54] via-[#0B4378] to-[#125FA9] p-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-white rounded-md px-2 py-1 shadow-sm flex items-center shrink-0">
              <img
                src="/images/due-logo.png"
                alt="Logo Trường Đại học Kinh tế - ĐH Đà Nẵng"
                className="h-7 w-auto object-contain"
              />
            </div>
            <div>
              <h3 className="font-bold text-sm">Cổng Thông Tin Tuyển Sinh KTX DUE</h3>
              <p className="text-[11px] text-blue-100">
                Tra cứu &amp; đồng bộ hồ sơ xét duyệt nội trú theo MSSV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              setSearchQuery('');
            }}
            className="text-slate-300 hover:text-white text-lg font-bold w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Ô TÌM KIẾM THEO MSSV HOẶC HỌ TÊN HOẶC CCCD */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nhập Mã sinh viên (MSSV), Số CCCD hoặc Họ tên:
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ví dụ: 251121536135, Thúy Trinh, 048204001234..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#125FA9] pl-9"
                autoFocus
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* DANH SÁCH SINH VIÊN TRONG CSDL */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold px-1">
              <span>HỒ SƠ SINH VIÊN TRONG HỆ THỐNG:</span>
              <span>{applications.length} hồ sơ</span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-2"></div>
                Đang tải dữ liệu hồ sơ từ hệ thống...
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {filteredApps.map((app) => {
                  const isCurrent = currentStudentCode === app.ma_sv;
                  return (
                    <div
                      key={app.id || app.ma_sv}
                      onClick={() => handleChoose(app)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-blue-50/80 border-[#125FA9] shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                            isCurrent ? 'bg-[#125FA9] text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {app.ho_ten?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            <span>{app.ho_ten}</span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] rounded font-bold">
                                Đang chọn
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[#125FA9] font-bold bg-blue-100/70 px-1 rounded">
                              {app.ma_sv}
                            </span>
                            <span>CCCD: {app.cccd}</span>
                            <span>• {app.email}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                          isCurrent
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 hover:bg-[#F26422] hover:text-white text-slate-700'
                        }`}
                      >
                        {isCurrent ? 'Đang chọn' : 'Đăng nhập →'}
                      </button>
                    </div>
                  );
                })}

                {filteredApps.length === 0 && (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    Không tìm thấy sinh viên nào khớp với &ldquo;{searchQuery}&rdquo;.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Dữ liệu đồng bộ trực tiếp từ CSDL tuyển sinh KTX DUE.</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              setSearchQuery('');
            }}
            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
