import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex flex-col items-center gap-6">
        {/* 404 display */}
        <div className="relative">
          <div className="text-[120px] font-black leading-none text-foreground/5 select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">đź—şď¸Ź</span>
          </div>
        </div>

        {/* Text */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trasa nie znaleziona</h1>
          <p className="mt-2 text-sm text-muted max-w-xs">
            Ta droga nie istnieje w naszej bazie. MoĹĽe skrÄ™ciĹ‚eĹ› za wczeĹ›nie?
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/dashboard"
          className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-fg shadow-lg transition hover:opacity-90"
        >
          WrĂłÄ‡ na gĹ‚ĂłwnÄ…
        </Link>
      </div>
    </div>
  );
}
