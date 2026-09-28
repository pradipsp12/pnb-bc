// app/api/auth/whoami/route.js
// Returns the role of the current user based on cookies
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const managerToken = request.cookies.get('auth_token')?.value;
    const staffToken   = request.cookies.get('staff_token')?.value;

    if (managerToken) {
      try {
        const secret = new TextEncoder().encode(
          process.env.JWT_SECRET || 'pnb-scraper-secret-key-change-in-production'
        );
        const { payload } = await jwtVerify(managerToken, secret);
        return NextResponse.json({ role: 'manager', username: payload.username });
      } catch {}
    }

    if (staffToken && staffToken === (process.env.STAFF_SESSION_TOKEN || 'staff-session-valid')) {
      return NextResponse.json({ role: 'staff' });
    }

    return NextResponse.json({ role: 'none' }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ role: 'none', error: err.message }, { status: 500 });
  }
}
