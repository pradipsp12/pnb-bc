// middleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/problems/access', '/api/auth/staff-login'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // ── /problems route: allow manager JWT OR staff token ──────────────────
  if (pathname.startsWith('/problems') || pathname.startsWith('/api/problems')) {
    const managerToken = request.cookies.get('auth_token')?.value;
    const staffToken   = request.cookies.get('staff_token')?.value;

    // Check manager JWT
    if (managerToken) {
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'pnb-scraper-secret-key-change-in-production');
        await jwtVerify(managerToken, secret);
        return NextResponse.next(); // manager — full access
      } catch {}
    }

    // Check staff token (simple signed value)
    if (staffToken && staffToken === (process.env.STAFF_SESSION_TOKEN || 'staff-session-valid')) {
      // Staff can only access /problems — not the main dashboard
      return NextResponse.next();
    }

    // Neither — send to staff access page if trying /problems, else login
    if (pathname.startsWith('/problems') || pathname.startsWith('/api/problems')) {
      return NextResponse.redirect(new URL('/problems/access', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── All other routes: require manager JWT ──────────────────────────────
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'pnb-scraper-secret-key-change-in-production');
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};