// app/api/auth/staff-login/route.js
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { password } = await request.json();
    const staffPassword = process.env.STAFF_PASSWORD || 'staff@pnb';

    if (password !== staffPassword) {
      return NextResponse.json({ error: 'Invalid staff password' }, { status: 401 });
    }

    // Set a simple staff session cookie (not JWT — no sensitive data here)
    const sessionToken = process.env.STAFF_SESSION_TOKEN || 'staff-session-valid';
    const response = NextResponse.json({ success: true });
    response.cookies.set('staff_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 hours
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
