// middleware.js  (root level — runs on Edge runtime before every request)
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals (_next/static, _next/image, favicon)
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'pnb-scraper-secret-key-change-in-production');
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // Token invalid or expired — clear cookie and redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
