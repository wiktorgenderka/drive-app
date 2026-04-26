'use client';

import {
  useState, useEffect, useRef,
  type FormEvent, type ChangeEvent, type ReactNode,
} from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useThemeStore } from '@/stores/useThemeStore';
import { useProfileStore } from '@/stores/useProfileStore';
import type { Vehicle } from '@/stores/useProfileStore';
import { useStatsStore } from '@/stores/useStatsStore';
import type { MapTheme } from '@/stores/useThemeStore';

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
];

const THEME_PRESETS: {
  id: string; name: string;
  mode: 'dark' | 'light'; accent: string; map: MapTheme;
  from: string; to: string;
}[] = [
  { id: 'midnight', name: 'Midnight',  mode: 'dark',  accent: '#3b82f6', map: 'dark',       from: '#0f172a', to: '#1e3a5f' },
  { id: 'galaxy',   name: 'Galaktyka', mode: 'dark',  accent: '#8b5cf6', map: 'navigation', from: '#1e1b4b', to: '#4c1d95' },
  { id: 'sunset',   name: 'Zachód',    mode: 'dark',  accent: '#f97316', map: 'dark',       from: '#431407', to: '#7c2d12' },
  { id: 'forest',   name: 'Las',       mode: 'dark',  accent: '#22c55e', map: 'outdoors',   from: '#052e16', to: '#14532d' },
  { id: 'ocean',    name: 'Ocean',     mode: 'dark',  accent: '#06b6d4', map: 'satellite',  from: '#083344', to: '#164e63' },
  { id: 'day',      name: 'Dzienny',   mode: 'light', accent: '#3b82f6', map: 'light',      from: '#bfdbfe', to: '#eff6ff' },
];

const MAP_THEMES: { value: MapTheme; label: string; bg: string; road: string; water: string }[] = [
  { value: 'auto',       label: 'Auto',     bg: '#374151', road: '#6b7280', water: '#4b5563' },
  { value: 'dark',       label: 'Ciemny',   bg: '#0f172a', road: '#334155', water: '#1e3a5f' },
  { value: 'light',      label: 'Jasny',    bg: '#e2e8f0', road: '#94a3b8', water: '#bfdbfe' },
  { value: 'satellite',  label: 'Satelita', bg: '#14532d', road: '#6b7280', water: '#164e63' },
  { value: 'navigation', label: 'Nawigacja',bg: '#1e1b4b', road: '#4f46e5', water: '#1e3a5f' },
  { value: 'outdoors',   label: 'Teren',    bg: '#365314', road: '#a3e635', water: '#0891b2' },
  { value: 'nfs',        label: 'NFS',      bg: '#040712', road: '#fde047', water: '#0a1733' },
];

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

async function resizeImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const SIZE = 256;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no ctx')); return; }
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, SIZE, SIZE);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function resizeVehicleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const W = 800; const H = 400;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no ctx')); return; }
      const imgRatio = img.width / img.height;
      const targetRatio = W / H;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgRatio > targetRatio) {
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function Toast({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null;
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
      msg.type === 'ok'
        ? 'border-emerald-700 bg-emerald-950/60 text-emerald-400'
        : 'border-red-800 bg-red-950/60 text-red-400'
    }`}>{msg.text}</div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl border border-card-border bg-card-bg p-5">{children}</section>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted">{children}</h3>;
}

function ToggleRow({
  label, desc, value, onChange, accent,
}: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"
        style={{ backgroundColor: value ? accent : 'var(--input-border)' }}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function Field({
  id, label, type = 'text', value, onChange, placeholder,
}: {
  id: string; label: string; type?: string;
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <input
        id={id} type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input-border bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted-light outline-none transition focus:ring-1 focus:ring-blue-500"
        style={{ borderColor: value ? undefined : undefined }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Stats {
  totalRoutes: number;
  totalReports: number;
  todayReports: number;
  activeConvoy: { name: string; memberCount: number } | null;
}

export default function SettingsPanel() {
  const { data: session, update: updateSession } = useSession();
  const { mode, accentColor, mapTheme, toggleMode, setMode, setAccentColor, setMapTheme } = useThemeStore();
  const { vehicles, privacy, notifications, addVehicle, updateVehicle, removeVehicle, setActiveVehicle, setPrivacy, setNotifications } = useProfileStore();
  const { overall, byVehicle } = useStatsStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Profile ──
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [carDisplay, setCarDisplay] = useState('');
  const [bio, setBio] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  // ── Stats ──
  const [stats, setStats] = useState<Stats | null>(null);

  // ── Password ──
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showPwds, setShowPwds] = useState(false);

  // ── Delete ──
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteZone, setShowDeleteZone] = useState(false);

  // ── Vehicle modal ──
  const [vehicleModal, setVehicleModal] = useState<'add' | 'edit' | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vMake, setVMake] = useState('');
  const [vModel, setVModel] = useState('');
  const [vYear, setVYear] = useState('');
  const [vPlate, setVPlate] = useState('');
  const [vColor, setVColor] = useState('');
  const [vImage, setVImage] = useState<string | null>(null);
  const vehicleImgRef = useRef<HTMLInputElement>(null);

  function openAddVehicle() {
    setEditingVehicleId(null);
    setVMake(''); setVModel(''); setVYear(''); setVPlate(''); setVColor(''); setVImage(null);
    setVehicleModal('add');
  }

  function openEditVehicle(v: Vehicle) {
    setEditingVehicleId(v.id);
    setVMake(v.make); setVModel(v.model); setVYear(v.year); setVPlate(v.licensePlate); setVColor(v.color); setVImage(v.image);
    setVehicleModal('edit');
  }

  async function handleVehicleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setVImage(await resizeVehicleImage(file)); } catch { /* ignore */ }
  }

  function handleVehicleSave() {
    const data = { make: vMake.trim(), model: vModel.trim(), year: vYear.trim(), licensePlate: vPlate.trim().toUpperCase(), color: vColor.trim(), image: vImage };
    if (!data.make || !data.model) return;
    if (vehicleModal === 'add') {
      addVehicle(data);
    } else if (editingVehicleId) {
      updateVehicle(editingVehicleId, data);
    }
    setVehicleModal(null);
  }

  // ── Custom color input ──
  const [customColor, setCustomColor] = useState(accentColor);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? '');
      setEmail(session.user.email ?? '');
      setAvatarPreview(session.user.image ?? null);
    }
  }, [session]);

  useEffect(() => {
    fetch('/api/users/me')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.createdAt) {
          setCreatedAt(new Date(d.createdAt).toLocaleDateString('pl-PL', {
            day: 'numeric', month: 'long', year: 'numeric',
          }));
        }
        if (d?.carDisplay !== undefined) setCarDisplay(d.carDisplay ?? '');
        if (d?.bio !== undefined) setBio(d.bio ?? '');
      })
      .catch(() => {});
    fetch('/api/dashboard/stats')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setStats(d); })
      .catch(() => {});
  }, []);

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await resizeImageToBase64(file);
      setAvatarPreview(b64);
      setPendingAvatar(b64);
    } catch { /* ignore */ }
  }

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileSaving(true);
    try {
      const body: Record<string, string> = { name, email, carDisplay, bio };
      if (pendingAvatar) body.image = pendingAvatar;
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setProfileMsg({ type: 'err', text: data.error ?? 'Błąd zapisu.' }); return; }
      setPendingAvatar(null);
      await updateSession({ name: data.name, email: data.email, image: data.image });
      setProfileMsg({ type: 'ok', text: 'Profil zaktualizowany!' });
    } catch { setProfileMsg({ type: 'err', text: 'Nieoczekiwany błąd.' }); }
    finally { setProfileSaving(false); }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== confirmPwd) { setPwdMsg({ type: 'err', text: 'Hasła nie są identyczne.' }); return; }
    if (newPwd.length < 8) { setPwdMsg({ type: 'err', text: 'Min. 8 znaków.' }); return; }
    setPwdSaving(true);
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setPwdMsg({ type: 'err', text: data.error ?? 'Błąd.' }); return; }
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setPwdMsg({ type: 'ok', text: 'Hasło zmienione!' });
    } catch { setPwdMsg({ type: 'err', text: 'Nieoczekiwany błąd.' }); }
    finally { setPwdSaving(false); }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'USUŃ') return;
    setDeleting(true);
    try {
      const res = await fetch('/api/users/me', { method: 'DELETE' });
      if (res.ok) await signOut({ callbackUrl: '/login' });
    } catch { /* ignore */ } finally { setDeleting(false); }
  }

  const pwdStrength = newPwd.length === 0 ? 0
    : newPwd.length >= 12 && /[A-Z]/.test(newPwd) && /[0-9]/.test(newPwd) && /[^A-Za-z0-9]/.test(newPwd) ? 4
    : newPwd.length >= 10 && (/[A-Z]/.test(newPwd) || /[0-9]/.test(newPwd)) ? 3
    : newPwd.length >= 8 ? 2 : 1;

  const strengthLabel = ['', 'Bardzo słabe', 'Słabe', 'Dobre', 'Mocne'][pwdStrength];
  const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'][pwdStrength];

  const initials = (name || session?.user?.email || '?')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-4 pb-6">

      {/* ── Header: avatar + info ── */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-card-border transition hover:border-white/40"
            >
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                : <span className="text-xl font-bold text-foreground" style={{ color: accentColor }}>{initials}</span>
              }
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card-bg text-white"
              style={{ backgroundColor: accentColor }}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <path d="M12 5v14M5 12l7-7 7 7" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-foreground">{name || 'Brak nazwy'}</p>
            <p className="truncate text-xs text-muted">{email || session?.user?.email}</p>
            {createdAt && <p className="mt-0.5 text-xs text-muted">Dołączył: {createdAt}</p>}
          </div>
        </div>


        {stats?.activeConvoy && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-card-border bg-input-bg px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{stats.activeConvoy.name}</p>
              <p className="text-[10px] text-muted">{stats.activeConvoy.memberCount} uczestników</p>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: accentColor }}>
              Aktywny
            </span>
          </div>
        )}
      </Card>

      {/* ── Motywy / Presets ── */}
      <Card>
        <SectionTitle>Motywy</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {THEME_PRESETS.map((p) => {
            const active = mode === p.mode && accentColor === p.accent && mapTheme === p.map;
            return (
              <button
                key={p.id}
                onClick={() => { setMode(p.mode); setAccentColor(p.accent); setMapTheme(p.map); setCustomColor(p.accent); }}
                className={`relative overflow-hidden rounded-xl border-2 transition ${
                  active ? 'border-white/80' : 'border-transparent hover:border-white/20'
                }`}
                style={{ background: `linear-gradient(160deg, ${p.from}, ${p.to})` }}
              >
                <div className="px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.accent }} />
                    <p className="text-left text-[11px] font-semibold text-white/90 leading-none">{p.name}</p>
                  </div>
                  <p className="text-left text-[10px] text-white/40 pl-4">
                    {p.mode === 'dark' ? 'Ciemny' : 'Jasny'}
                  </p>
                </div>
                {active && (
                  <div className="absolute right-2 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={3.5}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Wygląd ── */}
      <Card>
        <SectionTitle>Wygląd</SectionTitle>

        {/* Dark / Light */}
        <ToggleRow
          label="Tryb ciemny"
          desc="Przełącz między jasnym a ciemnym"
          value={mode === 'dark'}
          onChange={(v) => setMode(v ? 'dark' : 'light')}
          accent={accentColor}
        />

        {/* Accent color */}
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-foreground">Kolor akcentu</p>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setAccentColor(c); setCustomColor(c); }}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform ${
                  accentColor === c ? 'scale-110 border-white' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              >
                {accentColor === c && (
                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
            {/* Custom color picker */}
            <label className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-white/30 transition hover:border-white/60 overflow-hidden" title="Własny kolor">
              <span className="text-xs text-muted">+</span>
              <input
                type="color"
                value={customColor}
                onChange={(e) => { setCustomColor(e.target.value); setAccentColor(e.target.value); }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
          {/* Hex preview */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-5 w-5 rounded-md border border-white/20" style={{ backgroundColor: accentColor }} />
            <span className="font-mono text-xs text-muted">{accentColor.toUpperCase()}</span>
          </div>
        </div>

        {/* Map style */}
        <div className="mt-5">
          <p className="mb-3 text-sm font-medium text-foreground">Styl mapy</p>
          <div className="grid grid-cols-3 gap-2">
            {MAP_THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setMapTheme(t.value)}
                className="flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-2.5 transition border-card-border hover:border-foreground/30"
                style={mapTheme === t.value ? { borderColor: accentColor } : {}}
              >
                {/* Mini map SVG */}
                <svg width="40" height="28" viewBox="0 0 40 28" className="rounded-md">
                  <rect width="40" height="28" fill={t.bg} rx="3" />
                  {/* Roads */}
                  <path d="M0 14 Q10 10 20 14 Q30 18 40 14" stroke={t.road} strokeWidth="3" fill="none" />
                  <path d="M20 0 L20 28" stroke={t.road} strokeWidth="2" fill="none" opacity="0.6" />
                  {/* Water blob */}
                  <ellipse cx="8" cy="22" rx="6" ry="4" fill={t.water} opacity="0.7" />
                </svg>
                <span className="text-[11px] font-medium text-foreground">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Profil ── */}
      <Card>
        <SectionTitle>Profil</SectionTitle>
        <Toast msg={profileMsg} />
        <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
          <Field id="s-name" label="Imię i nazwisko" value={name} onChange={setName} placeholder="Jan Kowalski" />
          <Field id="s-email" label="Adres e-mail" type="email" value={email} onChange={setEmail} placeholder="jan@example.com" />
          <Field id="s-car" label="Wyświetlany pojazd" value={carDisplay} onChange={setCarDisplay} placeholder="np. BMW E46 320d" />
          <div>
            <label htmlFor="s-bio" className="mb-1.5 block text-sm font-medium text-muted">Bio</label>
            <textarea
              id="s-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Krótko o sobie — widoczne na publicznym profilu (max 280 znaków)"
              className="w-full resize-none rounded-xl border border-card-border bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <button
            type="submit" disabled={profileSaving}
            className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {profileSaving
              ? <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              : 'Zapisz profil'}
          </button>
        </form>
      </Card>

      {/* ── Statystyki ── */}
      <Card>
        <SectionTitle>Statystyki ogólne</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Łączny dystans', value: `${overall.totalKm.toFixed(1)} km` },
            { label: 'Max prędkość', value: `${Math.round(overall.maxSpeedKmh)} km/h` },
            { label: 'Przejazdy', value: String(overall.totalTrips) },
            { label: 'Czas jazdy', value: overall.totalMinutes >= 60
              ? `${Math.floor(overall.totalMinutes / 60)}h ${overall.totalMinutes % 60}m`
              : `${overall.totalMinutes} min` },
          ].map((s) => (
            <div key={s.label} className="flex flex-col rounded-xl border border-card-border bg-input-bg px-3 py-2.5">
              <span className="text-base font-extrabold" style={{ color: accentColor }}>{s.value}</span>
              <span className="text-[10px] text-muted">{s.label}</span>
            </div>
          ))}
        </div>

        {vehicles.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Per pojazd</p>
            {vehicles.map((v) => {
              const st = byVehicle[v.id];
              return (
                <div key={v.id} className="overflow-hidden rounded-xl border border-card-border">
                  <div className="flex items-center gap-2 border-b border-card-border px-3 py-2">
                    {v.image
                      ? <img src={v.image} alt="" className="h-7 w-12 rounded object-cover" />
                      : <div className="h-7 w-12 rounded" style={{ backgroundColor: v.color || 'rgba(255,255,255,0.08)' }} />
                    }
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {[v.make, v.model].filter(Boolean).join(' ') || 'Pojazd'}
                      </p>
                      {v.year && <p className="text-[10px] text-muted">{v.year}</p>}
                    </div>
                    {v.isActive && (
                      <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: accentColor }}>
                        Aktywny
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 divide-x divide-card-border bg-input-bg">
                    {[
                      { label: 'km', value: (st?.totalKm ?? 0).toFixed(1) },
                      { label: 'max km/h', value: String(Math.round(st?.maxSpeedKmh ?? 0)) },
                      { label: 'przejazdów', value: String(st?.totalTrips ?? 0) },
                      { label: 'min', value: String(st?.totalMinutes ?? 0) },
                    ].map((c) => (
                      <div key={c.label} className="flex flex-col items-center py-2">
                        <span className="text-sm font-bold text-foreground">{c.value}</span>
                        <span className="text-[9px] text-muted">{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Pojazdy ── */}
      <Card>
        <SectionTitle>Pojazdy</SectionTitle>

        <div className="flex flex-col gap-3">
          {vehicles.map((v) => (
            <div key={v.id} className="overflow-hidden rounded-xl border border-card-border">
              {/* Banner */}
              <div
                className="relative h-24 w-full"
                style={{
                  backgroundColor: v.color || 'rgba(255,255,255,0.05)',
                  backgroundImage: v.image ? `url(${v.image})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {v.isActive && (
                  <span
                    className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    Aktywny
                  </span>
                )}
              </div>
              {/* Info row */}
              <div className="flex items-center gap-3 bg-input-bg px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {[v.make, v.model, v.year].filter(Boolean).join(' ') || 'Bez nazwy'}
                  </p>
                  {v.licensePlate && <p className="text-xs text-muted">{v.licensePlate}</p>}
                </div>
                {!v.isActive && (
                  <button
                    type="button"
                    onClick={() => setActiveVehicle(v.id)}
                    className="shrink-0 rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted transition hover:border-white/30 hover:text-foreground"
                  >
                    Ustaw aktywny
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEditVehicle(v)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-card-border text-muted transition hover:border-white/30 hover:text-foreground"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeVehicle(v.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-900/50 text-red-400 transition hover:border-red-600"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={openAddVehicle}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-card-border text-sm font-medium text-muted transition hover:border-white/30 hover:text-foreground"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          Dodaj pojazd
        </button>
      </Card>

      {/* ── Vehicle modal ── */}
      {vehicleModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setVehicleModal(null)}>
          <div
            className="w-full max-w-lg rounded-t-3xl border-t border-card-border bg-card-bg p-5 pb-28"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                {vehicleModal === 'add' ? 'Dodaj pojazd' : 'Edytuj pojazd'}
              </h3>
              <button type="button" onClick={() => setVehicleModal(null)} className="text-muted hover:text-foreground">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Photo */}
            <button
              type="button"
              onClick={() => vehicleImgRef.current?.click()}
              className="relative mb-4 flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-card-border transition hover:border-white/30"
              style={vImage ? { backgroundImage: `url(${vImage})`, backgroundSize: 'cover', backgroundPosition: 'center', borderStyle: 'solid' } : undefined}
            >
              {!vImage && (
                <div className="flex flex-col items-center gap-1 text-muted">
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span className="text-xs">Dodaj zdjęcie</span>
                </div>
              )}
              {vImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition hover:opacity-100">
                  <span className="text-xs font-semibold text-white">Zmień zdjęcie</span>
                </div>
              )}
            </button>
            <input ref={vehicleImgRef} type="file" accept="image/*" className="hidden" onChange={handleVehicleImageChange} />

            <div className="grid grid-cols-2 gap-3">
              <Field id="vm-make" label="Marka" value={vMake} onChange={setVMake} placeholder="np. Toyota" />
              <Field id="vm-model" label="Model" value={vModel} onChange={setVModel} placeholder="np. Corolla" />
              <Field id="vm-year" label="Rok" value={vYear} onChange={setVYear} placeholder="2020" />
              <Field id="vm-color" label="Kolor nadwozia" value={vColor} onChange={setVColor} placeholder="np. Biały perłowy" />
            </div>

            <button
              type="button"
              onClick={handleVehicleSave}
              disabled={!vMake.trim() || !vModel.trim()}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
              style={{ backgroundColor: accentColor }}
            >
              {vehicleModal === 'add' ? 'Dodaj pojazd' : 'Zapisz zmiany'}
            </button>
          </div>
        </div>
      )}

      {/* ── Bezpieczeństwo ── */}
      <Card>
        <SectionTitle>Bezpieczeństwo</SectionTitle>
        <Toast msg={pwdMsg} />
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-3">
          {[
            { id: 's-cpwd', label: 'Aktualne hasło', value: currentPwd, set: setCurrentPwd, ph: '••••••••' },
            { id: 's-npwd', label: 'Nowe hasło', value: newPwd, set: setNewPwd, ph: 'Min. 8 znaków' },
            { id: 's-cpwd2', label: 'Potwierdź nowe', value: confirmPwd, set: setConfirmPwd, ph: 'Powtórz hasło' },
          ].map(({ id, label, value, set, ph }) => (
            <div key={id}>
              <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
              <input
                id={id} value={value} placeholder={ph}
                type={showPwds ? 'text' : 'password'}
                onChange={(e) => set(e.target.value)} required
                className="w-full rounded-xl border border-input-border bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted-light outline-none transition focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => setShowPwds((v) => !v)}
            className="flex items-center gap-1.5 self-start text-xs text-muted transition hover:text-foreground"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              {showPwds
                ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
              }
            </svg>
            {showPwds ? 'Ukryj' : 'Pokaż hasła'}
          </button>

          {newPwd.length > 0 && (
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((lvl) => (
                <div
                  key={lvl}
                  className="h-1.5 flex-1 rounded-full transition-colors"
                  style={{ backgroundColor: lvl <= pwdStrength ? strengthColor : 'rgba(255,255,255,0.1)' }}
                />
              ))}
              <span className="text-xs" style={{ color: strengthColor }}>{strengthLabel}</span>
            </div>
          )}

          <button
            type="submit" disabled={pwdSaving}
            className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {pwdSaving
              ? <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              : 'Zmień hasło'}
          </button>
        </form>
      </Card>

      {/* ── Prywatność ── */}
      <Card>
        <SectionTitle>Prywatność</SectionTitle>
        <div className="flex flex-col gap-4">
          <ToggleRow label="Udostępniaj lokalizację" desc="Inni widzą Cię na mapie" value={privacy.shareLocation} onChange={(v) => setPrivacy({ shareLocation: v })} accent={accentColor} />
          <ToggleRow label="Widoczny w konwoju" desc="Pojawiasz się na liście konwojów" value={privacy.showInConvoy} onChange={(v) => setPrivacy({ showInConvoy: v })} accent={accentColor} />
          <ToggleRow label="Publiczny profil" desc="Inni mogą wyszukać Twój profil" value={privacy.publicProfile} onChange={(v) => setPrivacy({ publicProfile: v })} accent={accentColor} />
          <ToggleRow label="Pokaż prędkość" desc="Wyświetlaj prędkość w konwoju" value={privacy.showSpeed} onChange={(v) => setPrivacy({ showSpeed: v })} accent={accentColor} />
        </div>
      </Card>

      {/* ── Powiadomienia ── */}
      <Card>
        <SectionTitle>Powiadomienia</SectionTitle>
        <div className="flex flex-col gap-4">
          <ToggleRow label="Pobliskie zgłoszenia" desc="Alerty o zdarzeniach w pobliżu" value={notifications.nearbyReports} onChange={(v) => setNotifications({ nearbyReports: v })} accent={accentColor} />
          <ToggleRow label="Zaproszenia do znajomych" value={notifications.friendRequests} onChange={(v) => setNotifications({ friendRequests: v })} accent={accentColor} />
          <ToggleRow label="Zaproszenia do konwoju" value={notifications.convoyInvites} onChange={(v) => setNotifications({ convoyInvites: v })} accent={accentColor} />
          <ToggleRow label="Alerty prędkości" desc="Ostrzeżenia o przekroczeniu limitu" value={notifications.speedAlerts} onChange={(v) => setNotifications({ speedAlerts: v })} accent={accentColor} />
          <ToggleRow label="Alerty o policji" desc="Szybkie powiadomienia o patrolu" value={notifications.policeAlerts} onChange={(v) => setNotifications({ policeAlerts: v })} accent={accentColor} />
        </div>
      </Card>

      {/* ── Konto ── */}
      <Card>
        <SectionTitle>Konto</SectionTitle>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-3 rounded-xl border border-card-border px-4 py-3 text-sm font-medium text-foreground transition hover:border-white/30"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
            <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </div>
          Wyloguj się
        </button>

        <div className="mt-3">
          <button
            onClick={() => setShowDeleteZone((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm font-medium text-red-400 transition hover:border-red-700"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
              <svg className="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />
              </svg>
            </div>
            Usuń konto
            <svg className={`ml-auto h-4 w-4 transition-transform text-muted ${showDeleteZone ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showDeleteZone && (
            <div className="mt-3 rounded-xl border border-red-900/40 bg-red-950/20 p-4">
              <p className="mb-3 text-xs leading-relaxed text-red-400/80">
                Tej operacji <strong className="text-red-400">nie można cofnąć</strong>. Wszystkie trasy, zgłoszenia i dane zostaną trwale usunięte. Wpisz{' '}
                <code className="rounded bg-red-900/40 px-1 py-0.5 font-mono text-red-300">USUŃ</code> aby potwierdzić.
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Wpisz USUŃ"
                className="mb-3 w-full rounded-xl border border-red-800/50 bg-red-950/40 px-4 py-2.5 text-sm text-red-300 placeholder-red-900/80 outline-none focus:border-red-600"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'USUŃ' || deleting}
                className="flex h-10 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting
                  ? <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  : 'Usuń konto na zawsze'}
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
