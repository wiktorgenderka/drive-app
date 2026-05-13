export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="text-[100px] leading-none select-none opacity-10">📡</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">🌐</span>
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brak połączenia</h1>
          <p className="mt-2 text-sm text-muted max-w-xs">
            Jesteś offline. Niektóre funkcje DriveApp mogą być niedostępne, ale zapisane dane działają.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
        >
          Spróbuj ponownie
        </button>
      </div>
    </div>
  );
}
