'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useMapStore } from '@/stores/useMapStore';
import { resizeImageForPost } from '@/lib/imageResize';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PostUser { id: string; name: string; image: string | null; carDisplay: string | null; }
interface CommentUser { id: string; name: string; image: string | null; }
interface PostComment { id: string; postId: string; userId: string; content: string; createdAt: string; user: CommentUser; }
interface FeedPost {
  id: string; userId: string; content: string | null; imageData: string | null;
  latitude: number | null; longitude: number | null;
  likeCount: number; commentCount: number;
  createdAt: string; updatedAt: string;
  user: PostUser; comments: PostComment[]; myLiked: boolean;
}
interface SocialFeedProps { onShowProfile?: (userId: string) => void; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'przed chwilą';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(toRad((lat2 - lat1) / 2)) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad((lon2 - lon1) / 2)) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extractHashtags(content: string | null): string[] {
  if (!content) return [];
  const m = content.match(/#[\wÀ-ɏ]+/g) ?? [];
  return [...new Set(m.map((t) => t.toLowerCase()))];
}

type PostKind = 'photo' | 'checkin' | 'route' | 'record' | 'event' | 'normal';

function detectKind(post: FeedPost): PostKind {
  const c = (post.content ?? '').toLowerCase();
  if (c.includes('#zlot') || c.includes('#event') || c.includes('#spotkanie')) return 'event';
  if (c.includes('km/h') || c.includes('#rekord') || c.includes('nowy rekord')) return 'record';
  if (c.includes('#trasa') || /\d+\s*km(?!\/)/.test(c)) return 'route';
  if (post.imageData && post.latitude != null) return 'checkin';
  if (post.imageData) return 'photo';
  if (post.latitude != null) return 'checkin';
  return 'normal';
}

const KIND_META: Record<PostKind, { label: string; icon: string; tw: string } | null> = {
  photo:   { label: 'Zdjęcie',  icon: '📷', tw: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  checkin: { label: 'Check-in', icon: '📍', tw: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  route:   { label: 'Trasa',    icon: '🗺️', tw: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  record:  { label: 'Rekord',   icon: '⚡', tw: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  event:   { label: 'Zlot',     icon: '🎉', tw: 'bg-pink-500/15 text-pink-300 border-pink-500/30' },
  normal:  null,
};

const POST_TYPES = [
  { id: 'normal' as const, label: 'Post',   icon: '💬', tag: '' },
  { id: 'route'  as const, label: 'Trasa',  icon: '🗺️', tag: ' #trasa' },
  { id: 'record' as const, label: 'Rekord', icon: '⚡', tag: ' #rekord' },
  { id: 'event'  as const, label: 'Zlot',   icon: '🎉', tag: ' #zlot' },
];
type ComposeType = (typeof POST_TYPES)[number]['id'];

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 40, online }: { src?: string | null; name: string; size?: number; online?: boolean }) {
  const bg = `hsl(${(name.charCodeAt(0) * 47) % 360},50%,35%)`;
  return (
    <div className="relative inline-flex shrink-0">
      <div className="overflow-hidden rounded-full ring-2 ring-card-border" style={{ width: size, height: size }}>
        {src
          ? <img src={src} alt={name} className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white" style={{ background: bg }}>
              {(name?.[0] ?? '?').toUpperCase()}
            </div>
        }
      </div>
      {online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-card-bg" />}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PostSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-2xl border border-card-border bg-card-bg p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-28 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <div className="h-2.5 w-20 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-3 w-4/5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
      <div className="flex gap-3 pt-1">
        <div className="h-8 w-24 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-8 w-24 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>
    </div>
  );
}

// ─── Online strip ─────────────────────────────────────────────────────────────

function OnlineStrip({ onShowProfile }: { onShowProfile?: (id: string) => void }) {
  const friendLocations = useMapStore((s) => s.friendLocations);
  const now = Date.now();
  const online = Object.values(friendLocations).filter((f) => now - f.updatedAt < 10 * 60_000);
  if (online.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card-bg px-4 py-3">
      <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Na trasie teraz ({online.length})
      </p>
      <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {online.map((f) => (
          <button key={f.userId} onClick={() => onShowProfile?.(f.userId)}
            className="flex shrink-0 flex-col items-center gap-1.5 transition hover:opacity-80">
            <Avatar src={f.image} name={f.name} size={48} online />
            <span className="max-w-[52px] truncate text-[10px] text-muted">{f.name.split(' ')[0]}</span>
            {f.speed != null && f.speed > 2 && (
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                {Math.round(f.speed * 3.6)} km/h
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Trending hashtags ────────────────────────────────────────────────────────

function TrendingHashtags({ posts, activeTag, onTagClick }: {
  posts: FeedPost[]; activeTag: string | null; onTagClick: (t: string | null) => void;
}) {
  const trending = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of posts)
      for (const tag of extractHashtags(p.content))
        counts[tag] = (counts[tag] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [posts]);
  if (trending.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
      {activeTag && (
        <button onClick={() => onTagClick(null)}
          className="flex shrink-0 items-center gap-1 rounded-full border border-card-border bg-input-bg px-3 py-1 text-xs text-muted transition hover:text-foreground">
          ✕ wyczyść
        </button>
      )}
      {trending.map(([tag, count]) => (
        <button key={tag} onClick={() => onTagClick(activeTag === tag ? null : tag)}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
            activeTag === tag
              ? 'border-orange-500 bg-orange-600/20 text-orange-400'
              : 'border-card-border bg-input-bg text-muted hover:border-orange-500/40 hover:text-orange-300'
          }`}>
          {tag}
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
            activeTag === tag ? 'bg-orange-500/30 text-orange-300' : 'bg-white/8 text-white/40'
          }`}>{count}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Rich content (hashtags + mentions) ──────────────────────────────────────

function RichContent({ text, activeTag, onTagClick }: { text: string; activeTag: string | null; onTagClick: (t: string) => void }) {
  const parts = text.split(/(#[\wÀ-ɏ]+|@\S+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^#[\wÀ-ɏ]+$/.test(part)) {
          const tag = part.toLowerCase();
          return (
            <button key={i} onClick={() => onTagClick(tag)}
              className={`font-semibold transition-colors ${activeTag === tag ? 'text-orange-400' : 'text-orange-400/70 hover:text-orange-400'}`}>
              {part}
            </button>
          );
        }
        if (/^@\S+$/.test(part)) return <span key={i} className="font-semibold text-sky-400">{part}</span>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ socialFilter, typeFilter, activeTag, onClear }: {
  socialFilter: string; typeFilter: string; activeTag: string | null; onClear: () => void;
}) {
  const hasFilters = typeFilter !== 'all' || !!activeTag;
  return (
    <div className="rounded-2xl border border-dashed border-card-border bg-card-bg/60 px-4 py-12 text-center">
      <div className="mb-2 text-3xl">
        {hasFilters ? '🔍' : socialFilter === 'friends' ? '👥' : '📭'}
      </div>
      <p className="text-sm font-semibold text-foreground">
        {hasFilters ? 'Brak pasujących postów'
          : socialFilter === 'friends' ? 'Znajomi jeszcze nic nie wrzucili'
          : 'Bądź pierwszy!'}
      </p>
      <p className="mt-1 text-xs text-muted">
        {hasFilters ? 'Spróbuj zmienić filtry.'
          : socialFilter === 'friends' ? 'Przełącz na "Wszyscy" lub dodaj znajomych.'
          : 'Podziel się trasą, zdjęciem lub myślą.'}
      </p>
      {hasFilters && (
        <button onClick={onClear}
          className="mt-3 rounded-lg bg-orange-600/20 px-4 py-2 text-xs font-semibold text-orange-400 transition hover:bg-orange-600/30">
          Wyczyść filtry
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SocialFeed({ onShowProfile }: SocialFeedProps) {
  const { data: session } = useSession();
  const userLocation = useMapStore((s) => s.userLocation);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [socialFilter, setSocialFilter] = useState<'all' | 'friends'>('all');
  const [sort, setSort] = useState<'new' | 'hot'>('new');
  const [typeFilter, setTypeFilter] = useState<'all' | 'photo' | 'location' | 'near'>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; image: string | null; carDisplay: string | null }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compose
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeType, setComposeType] = useState<ComposeType>('normal');
  const [content, setContent] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [attachLocation, setAttachLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-post
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [allComments, setAllComments] = useState<Record<string, PostComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [newPostsBanner, setNewPostsBanner] = useState(false);
  const latestKnownIdRef = useRef<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }

  const fetchFeed = useCallback(async (social: 'all' | 'friends', s: 'new' | 'hot', reset: boolean) => {
    reset ? setLoading(true) : setLoadingMore(true);
    setError('');
    try {
      const res = await fetch(`/api/posts?filter=${social}&sort=${s}`);
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error ?? `HTTP ${res.status}`); }
      const data = await res.json();
      const incoming: FeedPost[] = Array.isArray(data?.data) ? data.data : [];
      if (reset) {
        setPosts(incoming);
        setNewPostsBanner(false);
        if (incoming.length > 0) latestKnownIdRef.current = incoming[0].id;
      } else {
        setPosts((prev) => { const ids = new Set(prev.map((p) => p.id)); return [...prev, ...incoming.filter((p) => !ids.has(p.id))]; });
      }
      setHasMore(incoming.length >= 10);
    } catch (e) {
      setError(`Nie udało się załadować. ${e instanceof Error ? e.message : ''}`);
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchFeed(socialFilter, sort, true); }, [socialFilter, sort, fetchFeed]);

  // Track the newest post ID and poll for new posts every 60s
  useEffect(() => {
    if (posts.length > 0 && !latestKnownIdRef.current) {
      latestKnownIdRef.current = posts[0].id;
    }
  }, [posts]);

  useEffect(() => {
    if (sort !== 'new' || socialFilter !== 'all') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/posts?filter=all&sort=new&limit=1');
        if (!res.ok) return;
        const data = await res.json();
        const newest: FeedPost | undefined = Array.isArray(data?.data) ? data.data[0] : undefined;
        if (newest && latestKnownIdRef.current && newest.id !== latestKnownIdRef.current) {
          setNewPostsBanner(true);
        }
      } catch { /* silent */ }
    }, 60_000);
    return () => clearInterval(interval);
  }, [sort, socialFilter]);

  const visiblePosts = useMemo(() => {
    let r = posts;
    if (typeFilter === 'photo') r = r.filter((p) => !!p.imageData);
    if (typeFilter === 'location') r = r.filter((p) => p.latitude != null);
    if (typeFilter === 'near' && userLocation)
      r = r.filter((p) => p.latitude != null && p.longitude != null && haversineKm(userLocation.latitude, userLocation.longitude, p.latitude!, p.longitude!) <= 50);
    if (activeTag) r = r.filter((p) => extractHashtags(p.content).includes(activeTag));
    return r;
  }, [posts, typeFilter, activeTag, userLocation]);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(value.trim())}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSearchResults(Array.isArray(data?.data) ? data.data : []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 280);
  }

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setImageLoading(true);
    try { setImageData(await resizeImageForPost(file)); }
    catch (err) { setError(`Błąd zdjęcia. ${err instanceof Error ? err.message : ''}`); }
    finally { setImageLoading(false); }
  }

  async function submitPost() {
    if (submitting) return;
    const typeTag = POST_TYPES.find((t) => t.id === composeType)?.tag ?? '';
    const finalContent = content.trim() + typeTag;
    if (!finalContent.trim() && !imageData) { setError('Dodaj tekst lub zdjęcie.'); return; }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {};
      if (finalContent.trim()) body.content = finalContent.trim();
      if (imageData) body.imageData = imageData;
      if (attachLocation && userLocation) { body.latitude = userLocation.latitude; body.longitude = userLocation.longitude; }
      const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(typeof b?.error === 'string' ? b.error : `HTTP ${res.status}`); }
      const post = await res.json();
      setPosts((p) => [post, ...p]);
      setContent(''); setImageData(null); setAttachLocation(false); setComposeOpen(false); setComposeType('normal');
      showToast('Post opublikowany! ✓');
    } catch (err) { setError(`Błąd. ${err instanceof Error ? err.message : ''}`); }
    finally { setSubmitting(false); }
  }

  async function toggleLike(post: FeedPost) {
    if (likingId === post.id) return;
    setPosts((arr) => arr.map((p) => p.id === post.id ? { ...p, myLiked: !p.myLiked, likeCount: p.likeCount + (p.myLiked ? -1 : 1) } : p));
    setLikingId(post.id);
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data: { liked: boolean; likeCount: number } = await res.json();
      setPosts((arr) => arr.map((p) => p.id === post.id ? { ...p, myLiked: data.liked, likeCount: data.likeCount } : p));
    } catch {
      setPosts((arr) => arr.map((p) => p.id === post.id ? { ...p, myLiked: !p.myLiked, likeCount: p.likeCount + (p.myLiked ? -1 : 1) } : p));
    } finally { setLikingId(null); }
  }

  async function loadComments(postId: string) {
    setCommentsLoading((p) => ({ ...p, [postId]: true }));
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAllComments((p) => ({ ...p, [postId]: Array.isArray(data?.data) ? data.data : [] }));
    } catch { setError('Nie udało się załadować komentarzy.'); }
    finally { setCommentsLoading((p) => ({ ...p, [postId]: false })); }
  }

  function toggleCommentsOpen(postId: string) {
    setOpenComments((p) => { const next = !p[postId]; if (next && !allComments[postId]) loadComments(postId); return { ...p, [postId]: next }; });
  }

  async function submitComment(postId: string) {
    const draft = (draftComments[postId] ?? '').trim();
    if (!draft) return;
    setSubmittingComment(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draft }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error ?? `HTTP ${res.status}`); }
      const data: { comment: PostComment; commentCount: number } = await res.json();
      setAllComments((p) => ({ ...p, [postId]: [...(p[postId] ?? []), data.comment] }));
      setPosts((arr) => arr.map((p) => p.id === postId ? { ...p, commentCount: data.commentCount, comments: [data.comment, ...(p.comments ?? [])].slice(0, 2) } : p));
      setDraftComments((p) => ({ ...p, [postId]: '' }));
    } catch (e) { setError(`Błąd komentarza. ${e instanceof Error ? e.message : ''}`); }
    finally { setSubmittingComment(null); }
  }

  async function deletePost(postId: string) {
    if (!confirm('Usunąć ten post?')) return;
    setDeletingId(postId);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setPosts((arr) => arr.filter((p) => p.id !== postId));
      showToast('Post usunięty.');
    } catch { setError('Nie udało się usunąć.'); }
    finally { setDeletingId(null); }
  }

  async function deleteComment(postId: string, commentId: string) {
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      const data: { commentCount: number } = await res.json();
      setAllComments((p) => ({ ...p, [postId]: (p[postId] ?? []).filter((c) => c.id !== commentId) }));
      setPosts((arr) => arr.map((p) => p.id === postId ? { ...p, commentCount: data.commentCount, comments: p.comments.filter((c) => c.id !== commentId) } : p));
    } catch { setError('Nie udało się usunąć komentarza.'); }
  }

  async function sharePost(post: FeedPost) {
    const text = `${post.user.name}: ${post.content ?? 'Post z DriveApp'}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `Post od ${post.user.name}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        showToast('Skopiowano do schowka!');
      }
    } catch { /* cancelled */ }
  }

  const myId = session?.user?.id;
  const selectedType = POST_TYPES.find((t) => t.id === composeType)!;

  return (
    <div className="flex flex-col gap-3">

      {/* Online friends */}
      <OnlineStrip onShowProfile={onShowProfile} />

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 overflow-hidden rounded-xl bg-input-bg p-0.5">
          {(['all', 'friends'] as const).map((f) => (
            <button key={f} onClick={() => setSocialFilter(f)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${socialFilter === f ? 'bg-card-bg text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}>
              {f === 'all' ? 'Wszyscy' : 'Znajomi'}
            </button>
          ))}
        </div>
        <div className="flex flex-1 overflow-hidden rounded-xl bg-input-bg p-0.5">
          {(['new', 'hot'] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${sort === s ? 'bg-card-bg text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}>
              {s === 'new' ? 'Nowe' : '🔥 Top'}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setSearchOpen((o) => !o); if (searchOpen) { setSearchQuery(''); setSearchResults([]); } }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${searchOpen ? 'border-orange-500 bg-orange-600 text-white' : 'border-card-border bg-input-bg text-muted hover:text-foreground'}`}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
        <button onClick={() => fetchFeed(socialFilter, sort, true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-card-border bg-input-bg text-muted transition hover:text-foreground">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
      </div>

      {/* Type filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {([
          { id: 'all'      as const, label: 'Wszystko', icon: '✦' },
          { id: 'photo'    as const, label: 'Zdjęcia',  icon: '📷' },
          { id: 'location' as const, label: 'Miejsca',  icon: '📍' },
          { id: 'near'     as const, label: 'Pobliskie', icon: '🧭' },
        ]).map((f) => (
          <button key={f.id}
            disabled={f.id === 'near' && !userLocation}
            onClick={() => setTypeFilter(f.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-40 ${
              typeFilter === f.id
                ? 'border-orange-500 bg-orange-600/20 text-orange-400'
                : 'border-card-border bg-input-bg text-muted hover:text-foreground'
            }`}>
            <span>{f.icon}</span>{f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {searchOpen && (
        <div className="rounded-2xl border border-card-border bg-card-bg p-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input autoFocus type="text" value={searchQuery} onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Szukaj użytkownika…"
              className="w-full rounded-xl border border-card-border bg-input-bg py-2 pl-10 pr-4 text-sm text-foreground placeholder-muted outline-none transition focus:border-orange-500" />
            {searchLoading && (
              <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>
          {searchQuery.trim().length >= 2 && (
            <div className="mt-2">
              {!searchLoading && searchResults.length === 0
                ? <p className="py-3 text-center text-xs text-muted">Brak wyników</p>
                : <ul className="flex flex-col gap-1">
                    {searchResults.map((u) => (
                      <li key={u.id}>
                        <button onClick={() => { onShowProfile?.(u.id); setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-input-bg">
                          <Avatar src={u.image} name={u.name} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">{u.name}</p>
                            {u.carDisplay && <p className="truncate text-[10px] text-muted">{u.carDisplay}</p>}
                          </div>
                          <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                      </li>
                    ))}
                  </ul>
              }
            </div>
          )}
        </div>
      )}

      {/* Compose */}
      {!composeOpen ? (
        <button onClick={() => setComposeOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-card-border bg-card-bg px-4 py-3 text-left transition hover:border-orange-500/40">
          <Avatar src={session?.user?.image} name={session?.user?.name ?? '?'} size={36} />
          <span className="flex-1 text-sm text-muted/70">Co u Ciebie? Podziel się ze społecznością…</span>
          <span className="rounded-lg bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white">+ Post</span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-card-border bg-card-bg">
          {/* Post type selector */}
          <div className="flex border-b border-card-border">
            {POST_TYPES.map((t) => (
              <button key={t.id} onClick={() => setComposeType(t.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                  composeType === t.id ? 'bg-orange-600/10 text-orange-400 border-b-2 border-orange-500 -mb-px' : 'text-muted hover:text-foreground'
                }`}>
                <span className="text-base leading-none">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <Avatar src={session?.user?.image} name={session?.user?.name ?? '?'} size={36} />
              <div className="min-w-0 flex-1">
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} maxLength={1000}
                  placeholder={
                    composeType === 'route'  ? 'Opisz trasę… #trasa #bmw' :
                    composeType === 'record' ? 'Nowy rekord! Ile km/h? #rekord' :
                    composeType === 'event'  ? 'Zapraszam na zlot! Data, miejsce… #zlot' :
                    'Co u Ciebie? Podziel się trasą, zdjęciem albo myślą…'
                  }
                  className="w-full resize-none rounded-xl border border-card-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder-muted outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500" />

                {imageData && (
                  <div className="relative mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageData} alt="" className="max-h-64 w-full rounded-xl object-cover" />
                    <button onClick={() => setImageData(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={imageLoading}
                    className="flex items-center gap-1.5 rounded-lg border border-card-border bg-input-bg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:text-foreground disabled:opacity-50">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                    {imageLoading ? 'Wczytuję…' : imageData ? 'Zmień' : 'Zdjęcie'}
                  </button>
                  <button type="button" onClick={() => setAttachLocation((v) => !v)} disabled={!userLocation}
                    title={userLocation ? 'Dołącz lokalizację' : 'Brak GPS'}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                      attachLocation ? 'border-emerald-500/40 bg-emerald-600/15 text-emerald-400' : 'border-card-border bg-input-bg text-muted hover:text-foreground'
                    }`}>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {attachLocation ? 'GPS ✓' : 'Lokalizacja'}
                  </button>

                  {/* circular char counter */}
                  <div className="ml-auto flex items-center gap-1.5">
                    <svg className="h-6 w-6 -rotate-90" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/10" />
                      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeDasharray={`${(content.length / 1000) * 50.27} 50.27`}
                        className={content.length > 900 ? 'text-red-400' : 'text-orange-400'} />
                    </svg>
                    {content.length > 900 && <span className="text-[11px] text-red-400">{1000 - content.length}</span>}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setComposeOpen(false); setContent(''); setImageData(null); setAttachLocation(false); setComposeType('normal'); }}
                    className="flex-1 rounded-xl border border-card-border bg-card-bg py-2 text-xs font-semibold text-muted transition hover:bg-input-bg hover:text-foreground">
                    Anuluj
                  </button>
                  <button onClick={submitPost} disabled={submitting || (!content.trim() && !imageData)}
                    className="flex-1 rounded-xl bg-orange-600 py-2 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50">
                    {submitting ? 'Publikuję…' : `${selectedType.icon} Opublikuj`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-300 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Trending hashtags */}
      {!loading && posts.length > 0 && (
        <TrendingHashtags posts={posts} activeTag={activeTag} onTagClick={setActiveTag} />
      )}

      {/* New posts banner */}
      {newPostsBanner && !loading && (
        <button
          onClick={() => {
            setNewPostsBanner(false);
            latestKnownIdRef.current = null;
            fetchFeed(socialFilter, sort, true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent/15 border border-accent/30 px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/25 animate-pulse"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          Nowe posty — kliknij aby odświeżyć
        </button>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <PostSkeleton key={i} />)}</div>
      ) : visiblePosts.length === 0 ? (
        <EmptyState socialFilter={socialFilter} typeFilter={typeFilter} activeTag={activeTag}
          onClear={() => { setActiveTag(null); setTypeFilter('all'); }} />
      ) : (
        <div className="flex flex-col gap-3">
          {visiblePosts.map((post) => {
            const isOwner = myId === post.userId;
            const open = !!openComments[post.id];
            const kind = detectKind(post);
            const kindMeta = KIND_META[kind];
            const previewComments = open ? (allComments[post.id] ?? post.comments) : post.comments.slice().reverse();
            const dist = userLocation && post.latitude != null && post.longitude != null
              ? haversineKm(userLocation.latitude, userLocation.longitude, post.latitude, post.longitude)
              : null;

            return (
              <article key={post.id} className="overflow-hidden rounded-2xl border border-card-border bg-card-bg shadow-sm">
                {/* Header */}
                <header className="flex items-center gap-3 px-4 pb-2 pt-3">
                  <button onClick={() => onShowProfile?.(post.user.id)} className="shrink-0 transition hover:opacity-90">
                    <Avatar src={post.user.image} name={post.user.name} size={40} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button onClick={() => onShowProfile?.(post.user.id)}
                        className="truncate text-left text-sm font-semibold text-foreground hover:text-orange-400">
                        {post.user.name}
                      </button>
                      {kindMeta && (
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${kindMeta.tw}`}>
                          {kindMeta.icon} {kindMeta.label}
                        </span>
                      )}
                    </div>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
                      {post.user.carDisplay && <><span className="text-muted/80">{post.user.carDisplay}</span><span>·</span></>}
                      <span>{timeAgo(post.createdAt)}</span>
                      {dist != null && (
                        <><span>·</span>
                        <span className="inline-flex items-center gap-0.5 text-emerald-400">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                          {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                        </span></>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => sharePost(post)} title="Udostępnij"
                      className="rounded-lg p-1.5 text-muted transition hover:bg-input-bg hover:text-foreground">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                    </button>
                    {isOwner && (
                      <button onClick={() => deletePost(post.id)} disabled={deletingId === post.id} title="Usuń"
                        className="rounded-lg p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </header>

                {/* Content */}
                {post.content && (
                  <div className="whitespace-pre-wrap px-4 pb-2 text-sm leading-relaxed text-foreground">
                    <RichContent text={post.content} activeTag={activeTag} onTagClick={setActiveTag} />
                  </div>
                )}

                {/* Image */}
                {post.imageData && (
                  <button onClick={() => setLightbox(post.imageData)} className="block w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.imageData} alt="Post" className="max-h-[520px] w-full object-cover transition hover:opacity-95" />
                  </button>
                )}

                {/* Like/comment count row */}
                {(post.likeCount > 0 || post.commentCount > 0) && (
                  <div className="flex items-center justify-between px-4 py-1.5 text-[11px] text-muted">
                    {post.likeCount > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-[9px] text-white">♥</span>
                        {post.likeCount}
                      </span>
                    )}
                    {post.commentCount > 0 && (
                      <button onClick={() => toggleCommentsOpen(post.id)} className="ml-auto hover:text-foreground">
                        {post.commentCount} {post.commentCount === 1 ? 'komentarz' : post.commentCount < 5 ? 'komentarze' : 'komentarzy'}
                      </button>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-px border-t border-card-border px-2 py-1">
                  <button onClick={() => toggleLike(post)} disabled={likingId === post.id}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${post.myLiked ? 'text-rose-400' : 'text-muted hover:bg-input-bg hover:text-foreground'}`}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill={post.myLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                    {post.myLiked ? 'Lubię' : 'Polub'}
                  </button>
                  <button onClick={() => toggleCommentsOpen(post.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-muted transition hover:bg-input-bg hover:text-foreground">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    Komentuj
                  </button>
                  <button onClick={() => sharePost(post)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-muted transition hover:bg-input-bg hover:text-foreground">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    Udostępnij
                  </button>
                </div>

                {/* Comments */}
                {(post.commentCount > 0 || open) && (
                  <div className="border-t border-card-border bg-input-bg/30 px-4 py-3">
                    {commentsLoading[post.id] ? (
                      <div className="flex justify-center py-3">
                        <svg className="h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {previewComments.map((c) => (
                          <li key={c.id} className="flex items-start gap-2">
                            <button onClick={() => onShowProfile?.(c.user.id)} className="mt-0.5 shrink-0">
                              <Avatar src={c.user.image} name={c.user.name} size={28} />
                            </button>
                            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-card-bg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <button onClick={() => onShowProfile?.(c.user.id)} className="text-[11px] font-semibold text-foreground hover:text-orange-400">
                                  {c.user.name}
                                </button>
                                <span className="ml-auto text-[10px] text-muted">{timeAgo(c.createdAt)}</span>
                              </div>
                              <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground">{c.content}</p>
                              {c.userId === myId && (
                                <button onClick={() => deleteComment(post.id, c.id)} className="mt-1 text-[10px] text-muted hover:text-red-400">Usuń</button>
                              )}
                            </div>
                          </li>
                        ))}
                        {!open && post.commentCount > previewComments.length && (
                          <li>
                            <button onClick={() => toggleCommentsOpen(post.id)} className="text-[11px] font-semibold text-orange-400/70 hover:text-orange-400">
                              Pokaż wszystkie ({post.commentCount}) ↓
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                    {open && (
                      <div className="mt-3 flex items-center gap-2">
                        <Avatar src={session?.user?.image} name={session?.user?.name ?? '?'} size={28} />
                        <div className="flex flex-1 items-center gap-2 overflow-hidden rounded-2xl border border-card-border bg-card-bg px-3 py-1.5">
                          <input
                            value={draftComments[post.id] ?? ''}
                            onChange={(e) => setDraftComments((p) => ({ ...p, [post.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(post.id); } }}
                            maxLength={500} placeholder="Napisz komentarz…"
                            className="flex-1 bg-transparent text-xs text-foreground placeholder-muted outline-none" />
                          <button onClick={() => submitComment(post.id)}
                            disabled={submittingComment === post.id || !(draftComments[post.id] ?? '').trim()}
                            className="shrink-0 rounded-lg bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50">
                            {submittingComment === post.id ? '…' : '↑'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {/* Load more */}
          {hasMore && typeFilter === 'all' && !activeTag && (
            <button onClick={() => fetchFeed(socialFilter, sort, false)} disabled={loadingMore}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-card-border bg-card-bg py-3 text-sm font-semibold text-muted transition hover:border-white/20 hover:text-foreground disabled:opacity-50">
              {loadingMore
                ? <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Ładuję…</>
                : 'Załaduj więcej'
              }
            </button>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
          <button onClick={() => setLightbox(null)} className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-foreground/90 px-4 py-2 text-xs font-semibold text-background shadow-xl backdrop-blur-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
