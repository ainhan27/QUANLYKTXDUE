import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/common/Navbar';

export const metadata: Metadata = {
  title: 'Hệ thống Quản lý & Xét duyệt Nội trú KTX - ĐH Kinh tế Đà Nẵng',
  description: 'Cổng thông tin Đăng ký & Xét duyệt Tuyển sinh Ký túc xá - Trường Đại học Kinh tế, Đại học Đà Nẵng',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-slate-50 text-slate-800 min-h-screen flex flex-col antialiased">
        <Navbar currentRole="SV" userName="Sinh viên DUE" />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="bg-[#072E54] text-slate-300 text-xs py-7 border-t border-blue-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-white rounded px-2.5 py-1 shadow-sm shrink-0">
                <img
                  src="/images/due-logo.png"
                  alt="Đại học Đà Nẵng - Trường Đại học Kinh tế (DUE)"
                  className="h-7 w-auto object-contain"
                />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-200">
                  TRƯỜNG ĐẠI HỌC KINH TẾ – ĐẠI HỌC ĐÀ NẴNG (DUE)
                </p>
                <p className="text-[11px] text-slate-400">
                  Ban Quản lý Ký túc xá – Cổng đăng ký &amp; xét tuyển nội trú trực tuyến
                </p>
              </div>
            </div>

            <div className="text-center sm:text-right text-[11px] text-slate-400">
              <p className="font-semibold text-slate-200">
                BAN QUẢN LÝ KÝ TÚC XÁ – ĐẠI HỌC KINH TẾ (DUE)
              </p>
              <p className="mt-0.5">71 Ngũ Hành Sơn, TP. Đà Nẵng | Điện thoại: (0236) 3836.169 | Email: ktx@due.edu.vn</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
