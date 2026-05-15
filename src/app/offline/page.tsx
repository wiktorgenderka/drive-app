'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="text-[100px] leading-none select-none opacity-10">đź“ˇ</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">đźŚ</span>
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brak poĹ‚Ä…czenia</h1>
          <p className="mt-2 text-sm text-muted max-w-xs">
            JesteĹ› offline. NiektĂłre funkcje DriveApp mogÄ… byÄ‡ niedostÄ™pne, ale zapisane dane dziaĹ‚ajÄ….
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-fg shadow-lg transition hover:opacity-90"
        >
          SprĂłbuj ponownie
        </button>
      </div>
    </div>
  );
}
