import { NextResponse } from 'next/server';
import { getUserByEmail, verifyPassword, createSession, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = getUserByEmail(email);
    if (!user) {
      // Same response as wrong-password to prevent email enumeration
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const sessionValue = createSession(user.email);

    const res = NextResponse.json({
      ok: true,
      user: { email: user.email, name: user.name, role: user.role || 'user' },
    });
    res.cookies.set(SESSION_COOKIE_NAME, sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
    });
    return res;
  } catch (e) {
    console.error('POST /api/auth/login error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
