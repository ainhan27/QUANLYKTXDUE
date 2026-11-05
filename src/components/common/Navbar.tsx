'use client';

// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// NAVBAR ĐIỀU HƯỚNG PHÂN QUYỀN CHẶT CHẼ THEO VAI TRÒ (ROLE-BASED ACCESS CONTROL)
// SINH VIÊN TUYỆT ĐỐI KHÔNG THẤY MỤC CÁN BỘ QLSV VÀ TRƯỞNG BAN
// ==============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserRole } from '@/types/database';
import StudentLoginModal from '@/components/student/StudentLoginModal';

interface NavbarProps {
  currentRole?: UserRole;
  userName?: string;
}

export default function Navbar({ currentRole = 'SV', userName = 'Sinh viên DUE' }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Khởi tạo vai trò chuẩn xác ngay từ pathname để không bị nhầm vai trò Sinh viên trên trang Cán bộ
  const [role, setRole] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.startsWith('/officer')) return 'QLSV';
      if (p.startsWith('/director')) return 'TB';
      if (p.startsWith('/student')) return 'SV';
      const stored = localStorage.getItem('ktx_current_role') as UserRole;
      if (stored && ['SV', 'QLSV', 'TB'].includes(stored)) return stored;
    }
    if (pathname?.startsWith('/officer')) return 'QLSV';
    if (pathname?.startsWith('/director')) return 'TB';
    return 'SV';
  });
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [activeStudentName, setActiveStudentName] = useState<string>('Sinh viên DUE');
  const [activeStudentCode, setActiveStudentCode] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // THEO DÕI TÀI KHOẢN SINH VIÊN ĐANG ĐĂNG NHẬP / THAO TÁC TRÊN HỆ THỐNG
  useEffect(() => {
    const updateStudentName = () => {
      try {
        const raw = localStorage.getItem('last_submitted_student');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.ho_ten && parsed.ma_sv) {
            setActiveStudentName(`${parsed.ho_ten} (${parsed.ma_sv})`);
            setActiveStudentCode(parsed.ma_sv);
            return;
          }
        }
      } catch {}
      setActiveStudentName('Sinh viên DUE');
      setActiveStudentCode('');
    };
    updateStudentName();

    const handleOpenLogin = () => setIsLoginModalOpen(true);
    window.addEventListener('open_student_login_modal', handleOpenLogin);
    window.addEventListener('storage', updateStudentName);
    window.addEventListener('student_application_submitted', updateStudentName);
    window.addEventListener('student_session_changed', updateStudentName);
    return () => {
      window.removeEventListener('open_student_login_modal', handleOpenLogin);
      window.removeEventListener('storage', updateStudentName);
      window.removeEventListener('student_application_submitted', updateStudentName);
      window.removeEventListener('student_session_changed', updateStudentName);
    };
  }, [pathname]);

  const handleStudentLogout = () => {
    try {
      localStorage.removeItem('last_submitted_student');
      localStorage.removeItem('active_student_session_code');
      localStorage.setItem('student_page_tab', 'form');
      setActiveStudentName('Sinh viên DUE');
      setActiveStudentCode('');
      setIsRoleDropdownOpen(false);

      window.dispatchEvent(new CustomEvent('student_session_changed', { detail: null }));
      window.dispatchEvent(new CustomEvent('switch_student_tab', { detail: 'form' }));

      if (pathname !== '/student') {
        router.push('/student');
      }
    } catch {}
  };

  // ĐỒNG BỘ VAI TRÒ DỰA VÀO ĐƯỜNG DẪN HOẶC LOCAL STORAGE
  useEffect(() => {
    if (pathname.startsWith('/officer')) {
      setRole('QLSV');
      localStorage.setItem('ktx_current_role', 'QLSV');
      window.dispatchEvent(new CustomEvent('ktx_role_change', { detail: 'QLSV' }));
    } else if (pathname.startsWith('/director')) {
      setRole('TB');
      localStorage.setItem('ktx_current_role', 'TB');
      window.dispatchEvent(new CustomEvent('ktx_role_change', { detail: 'TB' }));
    } else if (pathname.startsWith('/student')) {
      setRole('SV');
      localStorage.setItem('ktx_current_role', 'SV');
      window.dispatchEvent(new CustomEvent('ktx_role_change', { detail: 'SV' }));
    } else {
      const stored = localStorage.getItem('ktx_current_role') as UserRole;
      if (stored && ['SV', 'QLSV', 'TB'].includes(stored)) {
        setRole(stored);
      } else {
        setRole('SV');
      }
    }
  }, [pathname]);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleMeta: Record<UserRole, { label: string; badge: string; subLabel: string }> = {
    SV: {
      label: 'Sinh viên DUE',
      badge: 'bg-emerald-500 text-white',
      subLabel: 'Người nộp hồ sơ & Ký HĐ',
    },
    HC: {
      label: 'Cán bộ Hành chính',
      badge: 'bg-sky-500 text-white',
      subLabel: 'Bộ phận hành chính KTX',
    },
    QLSV: {
      label: 'Cán bộ QLSV',
      badge: 'bg-indigo-600 text-white',
      subLabel: 'Rà soát minh chứng & Đối chiếu',
    },
    TB: {
      label: 'Trưởng ban KTX',
      badge: 'bg-amber-500 text-slate-900 font-bold',
      subLabel: 'Phê duyệt & Công bố chính thức',
    },
  };

  // PHÂN QUYỀN DANH MỤC ĐIỀU HƯỚNG THEO ĐÚNG VAI TRÒ
  const navLinks = useMemo(() => {
    if (role === 'SV') {
      return [
        { href: '/', label: 'Trang chủ' },
        { href: '/student', label: 'Nộp & Theo dõi hồ sơ' },
        { href: '/ranking', label: 'Bảng xếp hạng Tuyển sinh' },
      ];
    }

    if (role === 'QLSV') {
      return [
        { href: '/', label: 'Trang chủ' },
        { href: '/ranking', label: 'Bảng xếp hạng Tuyển sinh' },
        { href: '/officer', label: 'Hàng đợi thẩm định (QLSV)' },
      ];
    }

    // Role TB (Trưởng ban)
    return [
      { href: '/', label: 'Trang chủ' },
      { href: '/ranking', label: 'Bảng xếp hạng Tuyển sinh' },
      { href: '/director', label: 'Dashboard duyệt (Trưởng ban)' },
    ];
  }, [role]);

  // Chuyển đổi vai trò và điều hướng
  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem('ktx_current_role', newRole);
    window.dispatchEvent(new CustomEvent('ktx_role_change', { detail: newRole }));
    setIsRoleDropdownOpen(false);

    if (newRole === 'SV') {
      router.push('/student');
    } else if (newRole === 'QLSV') {
      router.push('/officer');
    } else if (newRole === 'TB') {
      router.push('/director');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-[#072E54] via-[#0B4378] to-[#125FA9] text-white shadow-md border-b border-blue-900/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & School Branding */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3 group">
              {/* Logo DUE Container */}
              <div className="bg-white rounded-lg px-2.5 py-1 shadow-sm flex items-center border border-white/20 transition-transform group-hover:scale-[1.02]">
                <img
                  src="/images/due-logo.png"
                  alt="Đại học Đà Nẵng - Trường Đại học Kinh tế (DUE)"
                  className="h-8 sm:h-9 w-auto object-contain"
                />
              </div>

              {/* Phân hệ KTX */}
              <div className="hidden sm:flex flex-col pl-2 border-l border-blue-400/30">
                <div className="flex items-center space-x-1.5">
                  <span className="font-black text-xs sm:text-sm tracking-wide text-amber-300 drop-shadow-xs">
                    KÝ TÚC XÁ DUE
                  </span>
                </div>
                <span className="text-[10px] text-blue-100 font-medium tracking-wide">
                  Cổng Tuyển Sinh &amp; Quản Lý Nội Trú
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links - Chỉ hiển thị mục phù hợp với vai trò hiện tại */}
          <nav className="hidden md:flex space-x-1 lg:space-x-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 rounded-lg text-xs lg:text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-[#F26422] text-white font-extrabold shadow-md shadow-orange-900/20'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Role Switcher & User Profile */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsRoleDropdownOpen((prev) => !prev)}
              className="flex items-center space-x-3 p-1.5 rounded-lg hover:bg-white/10 transition focus:outline-none"
              title="Nhấp để chuyển đổi phân hệ vai trò (Demo)"
            >
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-white truncate max-w-[160px]">
                  {role === 'SV'
                    ? activeStudentCode
                      ? activeStudentName
                      : 'Sinh viên DUE'
                    : role === 'QLSV'
                    ? 'Cán bộ QLSV'
                    : 'Trưởng Ban KTX'}
                </div>
                <span
                  className={`inline-block px-2 py-0.5 text-[10px] rounded-full uppercase tracking-wider ${
                    role === 'SV'
                      ? activeStudentCode
                        ? 'bg-emerald-500 text-white font-bold'
                        : 'bg-blue-950/80 text-blue-200 border border-blue-400/30'
                      : roleMeta[role].badge
                  }`}
                >
                  {role === 'SV'
                    ? activeStudentCode
                      ? 'Sinh viên ▾'
                      : 'Chưa đăng nhập ▾'
                    : `${roleMeta[role].label} ▾`}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#125FA9] border border-blue-300 flex items-center justify-center text-xs font-bold text-amber-300 shadow">
                {role === 'SV' ? (activeStudentCode ? 'SV' : '👤') : role === 'QLSV' ? 'QL' : 'TB'}
              </div>
            </button>

            {/* Dropdown Menu Chuyển Đổi Vai Trò Phục Vụ Nghiệm Thu / Demo */}
            {isRoleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 text-slate-800 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Phân Quyền Vai Trò Nghiệp Vụ
                  </span>
                  <span className="text-xs text-slate-600 font-medium">
                    Chọn vai trò để kiểm thử quy trình tương ứng:
                  </span>
                </div>

                {/* THẺ TÀI KHOẢN SINH VIÊN HIỆN TẠI (KÈM NÚT ĐỔI TÀI KHOẢN VÀ ĐĂNG XUẤT) */}
                {role === 'SV' && (
                  <div className="m-1.5 p-2.5 bg-blue-50/90 border border-blue-200 rounded-lg">
                    {activeStudentCode ? (
                      <>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          Tài khoản sinh viên đang truy cập:
                        </div>
                        <div className="text-xs font-black text-[#125FA9] truncate mt-0.5">
                          {activeStudentName}
                        </div>
                        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsRoleDropdownOpen(false);
                              setIsLoginModalOpen(true);
                            }}
                            className="py-1.5 px-2 bg-[#125FA9] hover:bg-[#0B4378] text-white text-[11px] font-bold rounded shadow-xs flex items-center justify-center space-x-1 transition"
                          >
                            <span>🔄 Đổi tài khoản</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleStudentLogout}
                            className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded shadow-xs flex items-center justify-center space-x-1 transition"
                            title="Đăng xuất khỏi tài khoản này để nộp đơn mới hoặc chuyển sang sinh viên khác"
                          >
                            <span>🚪 Đăng xuất</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider flex items-center space-x-1">
                          <span>⚠️ Chưa đăng nhập tài khoản sinh viên</span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1">
                          Bạn đang ở chế độ khách. Đăng nhập để tra cứu hồ sơ và ký hợp đồng.
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsRoleDropdownOpen(false);
                            setIsLoginModalOpen(true);
                          }}
                          className="mt-2.5 w-full py-2 px-2 bg-[#F26422] hover:bg-[#D94F12] text-white text-[11px] font-bold rounded-lg shadow-xs flex items-center justify-center space-x-1.5 transition"
                        >
                          <span>🔑 Đăng nhập / Chọn hồ sơ SV</span>
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="p-1.5 space-y-1 text-xs">
                  {/* Option 1: Sinh viên */}
                  <button
                    type="button"
                    onClick={() => switchRole('SV')}
                    className={`w-full text-left p-2.5 rounded-lg transition flex items-start space-x-2.5 ${
                      role === 'SV' ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="p-1 rounded bg-emerald-100 text-emerald-700 text-sm">👨‍🎓</span>
                    <div>
                      <div className="font-bold flex items-center space-x-1.5">
                        <span>Sinh viên DUE</span>
                        {role === 'SV' && <span className="text-[10px] text-emerald-600">✓ Đang chọn</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal">Nộp đơn, xem BXH &amp; ký hợp đồng 72h</div>
                    </div>
                  </button>

                  {/* Option 2: Cán bộ QLSV */}
                  <button
                    type="button"
                    onClick={() => switchRole('QLSV')}
                    className={`w-full text-left p-2.5 rounded-lg transition flex items-start space-x-2.5 ${
                      role === 'QLSV' ? 'bg-indigo-50 text-indigo-950 font-bold border border-indigo-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="p-1 rounded bg-indigo-100 text-indigo-700 text-sm">🧑‍💼</span>
                    <div>
                      <div className="font-bold flex items-center space-x-1.5">
                        <span>Cán bộ QLSV</span>
                        {role === 'QLSV' && <span className="text-[10px] text-indigo-600">✓ Đang chọn</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal">Rà soát minh chứng &amp; yêu cầu bổ sung 48h</div>
                    </div>
                  </button>

                  {/* Option 3: Trưởng ban KTX */}
                  <button
                    type="button"
                    onClick={() => switchRole('TB')}
                    className={`w-full text-left p-2.5 rounded-lg transition flex items-start space-x-2.5 ${
                      role === 'TB' ? 'bg-amber-50 text-amber-950 font-bold border border-amber-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="p-1 rounded bg-amber-100 text-amber-800 text-sm">🎖️</span>
                    <div>
                      <div className="font-bold flex items-center space-x-1.5">
                        <span>Trưởng ban Quản lý KTX</span>
                        {role === 'TB' && <span className="text-[10px] text-amber-600">✓ Đang chọn</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal">Ký duyệt danh sách &amp; công bố trúng tuyển</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL ĐĂNG NHẬP SINH VIÊN TOÀN CỤC */}
      <StudentLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentStudentCode={activeStudentCode}
        onSelectStudent={(st) => {
          setActiveStudentName(`${st.ho_ten} (${st.ma_sv})`);
          setActiveStudentCode(st.ma_sv);
          if (pathname !== '/student') {
            router.push('/student');
          }
        }}
      />
    </header>
  );
}
