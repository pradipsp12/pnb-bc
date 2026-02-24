// app/api/auth/login/route.js
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    // Read credentials from environment variables
    const validUsername = process.env.AUTH_USERNAME || 'admin';
    const validPassword = process.env.AUTH_PASSWORD || 'pnb@1234';

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Create JWT token
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'pnb-scraper-secret-key-change-in-production'
    );

    const token = await new SignJWT({ username, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')  // session expires in 8 hours
      .sign(secret);

    // Set HttpOnly cookie — cannot be accessed by JavaScript (XSS safe)
    const response = NextResponse.json({ success: true, username });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,  // 8 hours in seconds
      path: '/',
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
