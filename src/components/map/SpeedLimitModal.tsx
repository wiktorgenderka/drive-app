'use client';

interface SpeedLimitModalProps {
  show: boolean;
  speedLimit: number | null;
  speedLimitInput: string;
  onInputChange: (v: string) => void;
  onSelectPreset: (v: number) => void;
  onSetCustom: () => void;
  onDisable: () => void;
  onClose: () => void;
}

const PRESETS = [30, 50, 70, 90, 110, 130];

export default function SpeedLimitModal({
  show,
  speedLimit,
  speedLimitInput,
  onInputChange,
  onSelectPreset,
  onSetCustom,
  onDisable,
  onClose,
}: SpeedLimitModalProps) {
  if (!show) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full rounded-t-3xl border-t border-card-border bg-card-bg p-6 pb-10 shadow-2xl">
        <h2 className="mb-4 text-base font-bold text-foreground">Limit prÄ™dkoĹ›ci</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS.map((v) => (
            <button
              key={v}
              onClick={() => onSelectPreset(v)}
              className={`flex h-12 w-14 items-center justify-center rounded-xl border-2 text-sm font-bold transition ${
                speedLimit === v
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-card-border text-foreground hover:border-accent/50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="mb-3 flex gap-2">
          <input
            type="number"
            value={speedLimitInput}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="WĹ‚asny limit..."
            className="flex-1 rounded-xl border border-input-border bg-input-bg px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            onClick={onSetCustom}
            className="rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg"
          >
            Ustaw
          </button>
        </div>
        {speedLimit && (
          <button
            onClick={onDisable}
            className="w-full rounded-xl border border-card-border py-2.5 text-sm text-muted transition hover:border-white/30"
          >
            WyĹ‚Ä…cz limit
          </button>
        )}
      </div>
    </div>
  );
}
