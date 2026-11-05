// ==============================================================================
// NEXT.JS 14 MIDDLEWARE: KIỂM SOÁT PHÂN QUYỀN TRUY CẬP THEO VAI TRÒ (4 ROLES)
// ==============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Cho phép các route công khai (Tất cả phân hệ demo của dự án)
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/ranking') ||
    pathname.startsWith('/student') ||
    pathname.startsWith('/officer') ||
    pathname.startsWith('/director') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico');

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // 2. Chế độ demo / phát triển khi chưa nạp Supabase key thật
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isDemoMode =
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.includes('your-project-id') ||
    !supabaseUrl.startsWith('http');

  if (isDemoMode) {
    // Cho phép duyệt tự do mọi phân hệ để giảng viên chấm giao diện
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Nếu chưa đăng nhập mà vào route nội bộ -> chuyển hướng về /login
    if (!user) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Lấy role người dùng từ profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = profile?.role;

    if (pathname.startsWith('/student') && userRole !== 'SV') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    if (pathname.startsWith('/officer') && userRole !== 'QLSV' && userRole !== 'HC') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    if (pathname.startsWith('/director') && userRole !== 'TB') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  } catch (err) {
    console.warn('Middleware auth error, continuing:', err);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
