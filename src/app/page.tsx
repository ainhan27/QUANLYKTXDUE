'use client';

// ==============================================================================
// DỰ ÁN HỌC PHẦN MIS3047 - ĐH KINH TẾ ĐÀ NẴNG (DUE)
// TRANG CHỦ HỆ THỐNG XÉT DUYỆT NỘI TRÚ KÝ TÚC XÁ TO-BE (BPMN 2.0)
// TỰ ĐỘNG PHÂN BIỆT GIAO DIỆN THEO VAI TRÒ (ROLE-BASED ACCESS CONTROL)
// SINH VIÊN CHỈ THẤY CHỨC NĂNG CỦA SINH VIÊN - KHÔNG THẤY CÁN BỘ / TRƯỞNG BAN
// ==============================================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserRole } from '@/types/database';

export default function HomePage() {
  const [currentRole, setCurrentRole] = useState<UserRole>('SV');
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);

  useEffect(() => {
    const stored = (localStorage.getItem('ktx_current_role') as UserRole) || 'SV';
    if (['SV', 'QLSV', 'TB'].includes(stored)) {
      setCurrentRole(stored);
    }
    const handler = (e: any) => {
      if (e.detail && ['SV', 'QLSV', 'TB'].includes(e.detail)) {
        setCurrentRole(e.detail);
      }
    };
    window.addEventListener('ktx_role_change', handler);
    return () => window.removeEventListener('ktx_role_change', handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCode.trim()) return;

    if (searchCode.includes('042') || searchCode.includes('Nam')) {
      setSearchResult('✅ Sinh viên Lê Hoàng Nam (49K21.042) - Trạng thái: ĐÃ PHÁT HÀNH HỢP ĐỒNG (Phòng 301 - Khu A). Vui lòng vào Cổng Sinh Viên để ký xác nhận OTP.');
    } else if (searchCode.includes('001') || searchCode.includes('An')) {
      setSearchResult('✅ Sinh viên Nguyễn Văn An (50K21.001) - Trạng thái: THẨM ĐỊNH ĐẠT (AI duyệt 96%). Thứ hạng #1 trên Bảng xếp hạng tuyển sinh.');
    } else {
      setSearchResult(`🔍 Hồ sơ mã "${searchCode}": Đang trong giai đoạn [CHỜ THẨM ĐỊNH MINH CHỨNG]. Vui lòng theo dõi Bảng xếp hạng real-time.`);
    }
  };

  return (
    <div className="space-y-10 py-4">
      {/* Hero Section tích hợp ảnh Ký Túc Xá và màu thương hiệu DUE */}
      <div className="bg-gradient-to-br from-[#072E54] via-[#0B4378] to-[#125FA9] rounded-2xl p-6 sm:p-8 lg:p-10 text-white shadow-xl relative overflow-hidden border border-blue-400/20">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(#F26422_1.5px,transparent_1.5px)] [background-size:16px_16px]" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          {/* Cột trái: Thông tin & Nút hành động */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#F26422] text-white uppercase tracking-wider shadow-sm">
                <span>DUE</span>
                <span className="opacity-70">|</span>
                <span>Tuyển Sinh 2026 - 2027</span>
              </span>
              <span className="text-[11px] font-semibold text-blue-200">
                Đại học Đà Nẵng – Trường Đại học Kinh tế
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-snug">
              Cổng Đăng Ký &amp; Xét Tuyển Nội Trú Ký Túc Xá DUE
            </h1>

            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-normal">
              Cổng thông tin tuyển sinh nội trú trực tuyến chính thức của Trường Đại học Kinh tế – ĐH Đà Nẵng: Tiếp nhận hồ sơ điện tử, AI tự động quét đối chiếu CCCD và minh chứng ưu tiên, cập nhật thứ hạng tuyển sinh theo thời gian thực và ký hợp đồng giữ chỗ trực tuyến.
            </p>

            {/* Thống kê nổi bật */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-2.5 text-center">
                <div className="text-base sm:text-lg font-black text-amber-300">120 Chỗ</div>
                <div className="text-[10px] text-blue-200">Chỉ tiêu đợt 1</div>
              </div>
              <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-2.5 text-center">
                <div className="text-base sm:text-lg font-black text-emerald-300">&lt; 5 Giây</div>
                <div className="text-[10px] text-blue-200">AI Thẩm định</div>
              </div>
              <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-2.5 text-center">
                <div className="text-base sm:text-lg font-black text-white">72 Giờ</div>
                <div className="text-[10px] text-blue-200">Ký HĐ điện tử OTP</div>
              </div>
            </div>

            {/* Các nút điều hướng nhanh */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {currentRole === 'SV' && (
                <Link
                  href="/student"
                  className="px-6 py-3 rounded-xl bg-[#F26422] hover:bg-[#D94F12] text-white font-extrabold text-xs shadow-lg shadow-orange-500/30 transition-transform hover:-translate-y-0.5 flex items-center space-x-1.5"
                >
                  <span>📝 Nộp Hồ Sơ Xét Tuyển</span>
                  <span>&rarr;</span>
                </Link>
              )}
              {currentRole === 'QLSV' && (
                <Link
                  href="/officer"
                  className="px-6 py-3 rounded-xl bg-[#F26422] hover:bg-[#D94F12] text-white font-extrabold text-xs shadow-lg shadow-orange-500/30 transition-transform hover:-translate-y-0.5 flex items-center space-x-1.5"
                >
                  <span>🔍 Rà Soát Minh Chứng (QLSV)</span>
                  <span>&rarr;</span>
                </Link>
              )}
              {currentRole === 'TB' && (
                <Link
                  href="/director"
                  className="px-6 py-3 rounded-xl bg-[#F26422] hover:bg-[#D94F12] text-white font-extrabold text-xs shadow-lg shadow-orange-500/30 transition-transform hover:-translate-y-0.5 flex items-center space-x-1.5"
                >
                  <span>🎖️ Dashboard Phê Duyệt</span>
                  <span>&rarr;</span>
                </Link>
              )}
              <Link
                href="/ranking"
                className="px-5 py-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/30 transition-transform hover:-translate-y-0.5 flex items-center space-x-1"
              >
                <span>📊 Bảng Xếp Hạng Tuyển Sinh</span>
              </Link>
            </div>
          </div>

          {/* Cột phải: Ảnh Ký Túc Xá Sinh Viên Quốc Tế DUE */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative group w-full max-w-md">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#F26422] to-amber-400 rounded-2xl blur-xs opacity-40 group-hover:opacity-75 transition duration-500" />
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-white/30 shadow-2xl">
                <img
                  src="/images/ktx-building.png"
                  alt="Ký túc xá sinh viên quốc tế - Trường Đại học Kinh tế ĐH Đà Nẵng"
                  className="w-full h-64 sm:h-72 object-cover object-center group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/30 to-transparent pointer-events-none" />

                {/* Floating Info Badge trên ảnh */}
                <div className="absolute bottom-3 left-3 right-3 p-3 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 text-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-black uppercase text-[#125FA9] tracking-wide">
                      Ký Túc Xá Sinh Viên Quốc Tế DUE
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5 font-medium">
                    📍 71 Ngũ Hành Sơn, Q. Ngũ Hành Sơn, TP. Đà Nẵng
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-1.5">
                    <span>Tiêu chuẩn: <strong>4 sinh viên / phòng</strong></span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                      Đang nhận đơn
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tra cứu nhanh hồ sơ (Dành cho Sinh viên & Phụ huynh) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs max-w-2xl mx-auto">
        <h3 className="text-xs font-bold text-[#125FA9] uppercase tracking-wider text-center mb-1">
          Tra Cứu Nhanh Kết Quả Hồ Sơ KTX
        </h3>
        <p className="text-[11px] text-slate-500 text-center mb-3">
          Nhập Mã sinh viên hoặc Số CCCD để xem trạng thái tức thì
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Nhập MSSV (ví dụ: 251121536135) hoặc Số CCCD..."
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#125FA9] focus:outline-none"
          />
          <button
            type="submit"
            className="px-5 py-2 bg-[#125FA9] hover:bg-[#0B4378] text-white rounded-lg text-xs font-bold shadow-xs transition"
          >
            Tra Cứu
          </button>
        </form>

        {searchResult && (
          <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs font-medium">
            {searchResult}
          </div>
        )}
      </div>

      {/* 5 GIAI ĐOẠN QUY TRÌNH TINH GỌN */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
          <h3 className="text-sm font-bold text-slate-900">
            Quy Trình Xét Tuyển Nội Trú KTX DUE
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">5 Giai đoạn khép kín</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center hover:border-blue-300 transition">
            <strong className="text-[#125FA9] block font-bold">1. Nộp Hồ Sơ</strong>
            <p className="text-[11px] text-slate-500 mt-1">Đăng ký online và tải ảnh minh chứng</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center hover:border-blue-300 transition">
            <strong className="text-[#125FA9] block font-bold">2. AI Thẩm Định</strong>
            <p className="text-[11px] text-slate-500 mt-1">Đối chiếu dữ liệu &amp; mộc đỏ tự động</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center hover:border-blue-300 transition">
            <strong className="text-[#125FA9] block font-bold">3. Xếp Hạng</strong>
            <p className="text-[11px] text-slate-500 mt-1">Cập nhật BXH theo thời gian thực</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center hover:border-orange-300 transition">
            <strong className="text-[#F26422] block font-bold">4. Ký Hợp Đồng</strong>
            <p className="text-[11px] text-slate-500 mt-1">Xác thực OTP điện tử trong 72 giờ</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center hover:border-blue-300 transition">
            <strong className="text-[#125FA9] block font-bold">5. Bàn Giao Phòng</strong>
            <p className="text-[11px] text-slate-500 mt-1">Đối chiếu hồ sơ gốc và nhận chìa khóa</p>
          </div>
        </div>
      </div>

      {/* DANH MỤC TƯƠNG TÁC ĐƯỢC PHÂN QUYỀN CHẶT CHẼ THEO VAI TRÒ */}
      <div>
        <div className="mb-4">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
            Khu Vực Phân Hệ
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-1">
            {currentRole === 'SV'
              ? 'Dịch Vụ Tuyển Sinh Dành Cho Tân Sinh Viên'
              : currentRole === 'QLSV'
              ? 'Nghiệp Vụ Dành Cho Cán Bộ Quản Lý Sinh Viên (QLSV)'
              : 'Nghiệp Vụ Dành Cho Trưởng Ban Quản Lý KTX'}
          </h3>
        </div>

        {/* 1. KHI VAI TRÒ LÀ SINH VIÊN: TUYỆT ĐỐI CHỈ HIỂN THỊ CÁC THẺ CỦA SINH VIÊN */}
        {currentRole === 'SV' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 font-extrabold flex items-center justify-center text-lg">
                  📝
                </div>
                <h4 className="text-base font-bold text-slate-900">Cổng Đăng Ký Nội Trú Mới</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Điền form đăng ký trực tuyến, tải ảnh Căn cước công dân và Giấy tờ xác nhận diện ưu tiên (có con dấu xác nhận), ký chữ ký điện tử.
                </p>
              </div>
              <Link
                href="/student"
                className="mt-6 block text-center py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
              >
                Nộp Hồ Sơ Trực Tuyến &rarr;
              </Link>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-lg">
                  📊
                </div>
                <h4 className="text-base font-bold text-slate-900">Bảng Xếp Hạng Tuyển Sinh Real-time</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Theo dõi trực tiếp điểm số ưu tiên và vị trí xếp hạng thời gian thực của bạn trong quy mô 350 sinh viên dự tuyển.
                </p>
              </div>
              <Link
                href="/ranking"
                className="mt-6 block text-center py-2 text-xs font-bold text-[#125FA9] bg-blue-50 hover:bg-blue-100 rounded-lg transition"
              >
                Xem Thứ Hạng Của Bạn &rarr;
              </Link>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 text-[#F26422] font-extrabold flex items-center justify-center text-lg">
                  ✍️
                </div>
                <h4 className="text-base font-bold text-slate-900">Cổng Ký Hợp Đồng Điện Tử (72h)</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Khi Trưởng ban chính thức công bố trúng tuyển, sinh viên vào xác thực mã OTP trong vòng 72 giờ để hoàn tất giữ chỗ nội trú.
                </p>
              </div>
              <Link
                href="/student"
                className="mt-6 block text-center py-2 text-xs font-bold text-[#F26422] bg-orange-50 hover:bg-orange-100 rounded-lg transition"
              >
                Kiểm Tra &amp; Ký Hợp Đồng &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* 2. KHI VAI TRÒ LÀ CÁN BỘ QLSV */}
        {currentRole === 'QLSV' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-lg">
                  🔍
                </div>
                <h4 className="text-base font-bold text-slate-900">Hàng Đợi Rà Soát Minh Chứng</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Thẩm định đối chiếu hồ sơ nghi vấn, kiểm tra con dấu mộc đỏ, duyệt đạt hoặc gửi yêu cầu bổ sung minh chứng trong 48h.
                </p>
              </div>
              <Link
                href="/officer"
                className="mt-6 block text-center py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
              >
                Vào Hàng Đợi Thẩm Định &rarr;
              </Link>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-lg">
                  📊
                </div>
                <h4 className="text-base font-bold text-slate-900">Bảng Xếp Hạng Tuyển Sinh (350 SV)</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Giám sát danh sách thứ hạng điểm số của 350 sinh viên các khóa K47 – K51 trước khi trình Trưởng ban ký duyệt.
                </p>
              </div>
              <Link
                href="/ranking"
                className="mt-6 block text-center py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
              >
                Xem Bảng Xếp Hạng &rarr;
              </Link>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 font-extrabold flex items-center justify-center text-lg">
                  🔑
                </div>
                <h4 className="text-base font-bold text-slate-900">Bàn Giao Phòng &amp; Chìa Khóa Offline</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tiếp nhận sinh viên đến nộp bản gốc đối chiếu tại văn phòng KTX và cập nhật trạng thái bàn giao phòng vào Portal.
                </p>
              </div>
              <Link
                href="/officer"
                className="mt-6 block text-center py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition"
              >
                Xác Nhận Bàn Giao Phòng &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* 3. KHI VAI TRÒ LÀ TRƯỞNG BAN KTX */}
        {currentRole === 'TB' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 font-extrabold flex items-center justify-center text-lg">
                  🎖️
                </div>
                <h4 className="text-base font-bold text-slate-900">Dashboard Phê Duyệt &amp; Công Bố</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ký quyết định phê duyệt chính thức cho Top 120 sinh viên trúng tuyển và phát hành thông báo đến sinh viên.
                </p>
              </div>
              <Link
                href="/director"
                className="mt-6 block text-center py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
              >
                Vào Dashboard Trưởng Ban &rarr;
              </Link>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-lg">
                  📊
                </div>
                <h4 className="text-base font-bold text-slate-900">Bảng Xếp Hạng Tuyển Sinh (350 SV)</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Xem toàn cảnh dữ liệu thứ hạng, phân bổ khóa và danh sách chờ dự bị của đợt xét tuyển.
                </p>
              </div>
              <Link
                href="/ranking"
                className="mt-6 block text-center py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
              >
                Xem Bảng Xếp Hạng &rarr;
              </Link>
            </div>

            <div className="bg-white p-6 rounded-xl border border-rose-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 font-extrabold flex items-center justify-center text-lg">
                  ⚠️
                </div>
                <h4 className="text-base font-bold text-slate-900">Thu Hồi Quá Hạn 72h &amp; Mở Đợt 2</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Xử lý sự kiện BE5 Err_Huy khi sinh viên không ký hợp đồng đúng hạn, hoàn phòng về AVAILABLE và mời danh sách chờ.
                </p>
              </div>
              <Link
                href="/director"
                className="mt-6 block text-center py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
              >
                Điều Hành Đợt Tuyển &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
