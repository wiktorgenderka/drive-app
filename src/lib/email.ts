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

export async function sendDigestEmail({
  to,
  name,
  pendingRequests,
  newPostsCount,
}: {
  to: string;
  name: string;
  pendingRequests: string[];
  newPostsCount: number;
}) {
  const transporter = await getTransporter();
  const from = process.env.SMTP_FROM ?? '"Drive App" <noreply@driveapp.pl>';
  const appUrl = process.env.NEXTAUTH_URL ?? 'https://driveapp.pl';

  const parts: string[] = [];
  if (pendingRequests.length > 0) {
    parts.push(
      pendingRequests.length === 1
        ? `<strong>${pendingRequests[0]}</strong> wysłał(a) Ci zaproszenie do znajomych.`
        : `Masz <strong>${pendingRequests.length}</strong> nowych zaproszeń do znajomych.`
    );
  }
  if (newPostsCount > 0) {
    parts.push(`Twoi znajomi dodali <strong>${newPostsCount}</strong> nowych postów.`);
  }

  if (parts.length === 0) return;

  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Co słychać na Drive App? 🚗',
    text: `Cześć ${name}!\n\n${parts.join('\n')}\n\nOdwiedź aplikację: ${appUrl}/dashboard`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#18181b;color:#f4f4f5;border-radius:16px;overflow:hidden">
        <div style="background:#3b82f6;padding:24px 32px">
          <h1 style="margin:0;font-size:22px;color:#fff">🚗 Drive App</h1>
        </div>
        <div style="padding:24px 32px">
          <p style="font-size:16px;margin:0 0 16px">Cześć <strong>${name}</strong>!</p>
          <p style="margin:0 0 8px;color:#a1a1aa">W ciągu ostatnich 24h:</p>
          <ul style="margin:0 0 24px;padding-left:24px;line-height:1.8">
            ${parts.map((p) => `<li>${p}</li>`).join('')}
          </ul>
          <a href="${appUrl}/dashboard"
             style="display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">
            Otwórz aplikację
          </a>
        </div>
        <div style="padding:16px 32px;border-top:1px solid #27272a">
          <p style="margin:0;font-size:12px;color:#71717a">
            Aby wyłączyć powiadomienia email, zmień ustawienia w aplikacji.
          </p>
        </div>
      </div>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('[email] Digest preview:', previewUrl);
  }
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
