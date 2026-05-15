import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DriveApp — Zaloguj się',
  description: 'Zaloguj się do DriveApp — aplikacji dla kierowców z mapą, konwojami i zgłoszeniami drogowymi.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        {/* App Logo */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
          <svg
            className="h-8 w-8 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">DriveApp</h1>
        <p className="text-sm text-muted">Navigate together</p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
