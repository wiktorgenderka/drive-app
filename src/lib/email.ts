import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let _transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (_transporter) return _transporter;

  if (process.env.SMTP_HOST) {
    // Production: use configured SMTP
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development: auto-create Ethereal test account
    // UWAGA: maile NIE trafiają do prawdziwej skrzynki — tylko podgląd w konsoli jako URL
    // Aby maile działały, dodaj SMTP_HOST/SMTP_USER/SMTP_PASS do .env.local
    console.warn('[email] Brak konfiguracji SMTP — używam Ethereal (maile nie dotrą do skrzynki).');
    console.warn('[email] Dodaj SMTP_HOST, SMTP_USER, SMTP_PASS do .env.local dla prawdziwego wysyłania.');

    const testAccount = await Promise.race([
      nodemailer.createTestAccount(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Ethereal createTestAccount timeout (10s)')), 10_000)
      ),
    ]);

    _transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('[email] Ethereal test account:', testAccount.user);
  }

  return _transporter;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const transporter = await getTransporter();
  const from = process.env.SMTP_FROM ?? '"Drive App" <noreply@driveapp.pl>';

  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Resetowanie hasła – Drive App',
    text: `Kliknij poniższy link, aby zresetować hasło (ważny 1 godzinę):\n\n${resetUrl}\n\nJeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#3b82f6">Resetowanie hasła</h2>
        <p>Kliknij przycisk poniżej, aby ustawić nowe hasło.<br>Link jest ważny przez <strong>1 godzinę</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;margin:16px 0;padding:12px 28px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Zresetuj hasło
        </a>
        <p style="color:#6b7280;font-size:13px">
          Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.<br>
          Link: <a href="${resetUrl}">${resetUrl}</a>
        </p>
      </div>
    `,
  });

  // In development: log the Ethereal preview URL to the console
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('[email] Reset password email preview:', previewUrl);
  }
}
