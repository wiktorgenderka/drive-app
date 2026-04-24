import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(`forgot-password:${ip}`, 3, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';

    if (!email) {
      return NextResponse.json({ error: 'Email jest wymagany' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (mailError) {
      console.error('[forgot-password] Wysyłanie emaila nie powiodło się:', mailError);
      // Nie ujawniamy błędu SMTP użytkownikowi — token jest zapisany, można spróbować ponownie
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
