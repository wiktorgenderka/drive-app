'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useMapStore } from '@/stores/useMapStore';
import { resizeImageForPost } from '@/lib/imageResize';

interface PostUser {
  id: string;
  name: string;
  image: string | null;
  carDisplay: string | null;
}

interface CommentUser {
  id: string;
  name: string;
  image: string | null;
}

interface PostComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: CommentUser;
}

interface FeedPost {
  id: string;
  userId: string;
  content: string | null;
  imageData: string | null;
  latitude: number | null;
  longitude: number | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  user: PostUser;
  comments: PostComment[];
  myLiked: boolean;
}

interface SocialFeedProps {
  onShowProfile?: (userId: string) => void;
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const sec = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (sec < 60) return 'przed chwilą';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} dni temu`;
  return new Date(iso).toLocaleDateString('pl-PL');
}

export default function SocialFeed({ onShowProfile }: SocialFeedProps) {
  const { data: session } = useSession();
  const userLocation = useMapStore((s) => s.userLocation);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'friends'>('all');
  const [sort, setSort] = useState<'new' | 'hot'>('new');

  // User search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; image: string | null; carDisplay: string | null }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compose
  const [composeOpen, setComposeOpen] = useState(false);
  const [content, setContent] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [attachLocation, setAttachLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-post UI state
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [allComments, setAllComments] = useState<Record<string, PostComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const fetchFeed = useCallback(async (f: typeof filter = filter, s: typeof sort = sort) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/posts?filter=${f}&sort=${s}`);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPosts(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      setError(`Nie udało się załadować postów. ${e instanceof Error ? e.message : ''}`);
    } finally {
      setLoading(false);
    }
  }, [filter, sort]);

  useEffect(() => {
    fetchFeed(filter, sort);
  }, [fetchFeed, filter, sort]);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(value.trim())}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSearchResults(Array.isArray(data?.data) ? data.data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 280);
  }

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageLoading(true);
    try {
      const b64 = await resizeImageForPost(file);
      setImageData(b64);
    } catch (err) {
      setError(`Nie udało się wgrać zdjęcia. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setImageLoading(false);
    }
  }

  async function submitPost() {
    if (submitting) return;
    if (!content.trim() && !imageData) {
      setError('Dodaj tekst lub zdjęcie.');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {};
      if (content.trim()) body.content = content.trim();
      if (imageData) body.imageData = imageData;
      if (attachLocation && userLocation) {
        body.latitude = userLocation.latitude;
        body.longitude = userLocation.longitude;
      }
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        const msg = typeof b?.error === 'string' ? b.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const post = await res.json();
      setPosts((p) => [post, ...p]);
      setContent('');
      setImageData(null);
      setAttachLocation(false);
      setComposeOpen(false);
    } catch (err) {
      setError(`Nie udało się opublikować. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleLike(post: FeedPost) {
    if (likingId === post.id) return;
    // Optymistycznie
    setPosts((arr) =>
      arr.map((p) => p.id === post.id
        ? { ...p, myLiked: !p.myLiked, likeCount: p.likeCount + (p.myLiked ? -1 : 1) }
        : p
      )
    );
    setLikingId(post.id);
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data: { liked: boolean; likeCount: number } = await res.json();
      setPosts((arr) =>
        arr.map((p) => (p.id === post.id ? { ...p, myLiked: data.liked, likeCount: data.likeCount } : p))
      );
    } catch {
      // rollback
      setPosts((arr) =>
        arr.map((p) => p.id === post.id
          ? { ...p, myLiked: !p.myLiked, likeCount: p.likeCount + (p.myLiked ? -1 : 1) }
          : p
        )
      );
      setError('Nie udało się polubić posta.');
    } finally {
      setLikingId(null);
    }
  }

  async function loadComments(postId: string) {
    setCommentsLoading((p) => ({ ...p, [postId]: true }));
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAllComments((p) => ({ ...p, [postId]: Array.isArray(data?.data) ? data.data : [] }));
    } catch {
      setError('Nie udało się załadować komentarzy.');
    } finally {
      setCommentsLoading((p) => ({ ...p, [postId]: false }));
    }
  }

  function toggleCommentsOpen(postId: string) {
    setOpenComments((p) => {
      const next = !p[postId];
      if (next && !allComments[postId]) loadComments(postId);
      return { ...p, [postId]: next };
    });
  }

  async function submitComment(postId: string) {
    const draft = (draftComments[postId] ?? '').trim();
    if (!draft) return;
    setSubmittingComment(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      const data: { comment: PostComment; commentCount: number } = await res.json();
      setAllComments((p) => ({ ...p, [postId]: [...(p[postId] ?? []), data.comment] }));
      setPosts((arr) =>
        arr.map((p) =>
          p.id === postId
            ? { ...p, commentCount: data.commentCount, comments: [data.comment, ...(p.comments ?? [])].slice(0, 2) }
            : p
        )
      );
      setDraftComments((p) => ({ ...p, [postId]: '' }));
    } catch (e) {
      setError(`Nie udało się dodać komentarza. ${e instanceof Error ? e.message : ''}`);
    } finally {
      setSubmittingComment(null);
    }
  }

  async function deletePost(postId: string) {
    if (!confirm('Usunąć ten post?')) return;
    setDeletingId(postId);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setPosts((arr) => arr.filter((p) => p.id !== postId));
    } catch {
      setError('Nie udało się usunąć posta.');
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteComment(postId: string, commentId: string) {
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      const data: { commentCount: number } = await res.json();
      setAllComments((p) => ({ ...p, [postId]: (p[postId] ?? []).filter((c) => c.id !== commentId) }));
      setPosts((arr) =>
        arr.map((p) =>
          p.id === postId
            ? { ...p, commentCount: data.commentCount, comments: p.comments.filter((c) => c.id !== commentId) }
            : p
        )
      );
    } catch {
      setError('Nie udało się usunąć komentarza.');
    }
  }

  const myId = session?.user?.id;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-xl bg-input-bg p-1">
          <TabBtn active={filter === 'all'} onClick={() => setFilter('all')}>Wszyscy</TabBtn>
          <TabBtn active={filter === 'friends'} onClick={() => setFilter('friends')}>Znajomi</TabBtn>
        </div>
        <div className="flex flex-1 gap-1 rounded-xl bg-input-bg p-1">
          <TabBtn active={sort === 'new'} onClick={() => setSort('new')}>Nowe</TabBtn>
          <TabBtn active={sort === 'hot'} onClick={() => setSort('hot')}>Popularne</TabBtn>
        </div>
        <button
          onClick={() => {
            setSearchOpen((o) => {
              const next = !o;
              if (!next) {
                setSearchQuery('');
                setSearchResults([]);
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              }
              return next;
            });
          }}
          title="Wyszukaj profil"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
            searchOpen
              ? 'border-orange-500 bg-orange-600 text-white'
              : 'border-card-border bg-input-bg text-muted hover:text-foreground'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      </div>

      {/* User search panel */}
      {searchOpen && (
        <div className="rounded-2xl border border-card-border bg-card-bg p-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Szukaj po imieniu (min. 2 znaki)"
              className="w-full rounded-xl border border-card-border bg-input-bg py-2 pl-10 pr-4 text-sm text-foreground placeholder-muted outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
            {searchLoading && (
              <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>
          {searchQuery.trim().length >= 2 && (
            <div className="mt-2">
              {!searchLoading && searchResults.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted">Brak wyników</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {searchResults.map((u) => (
                    <li key={u.id}>
                      <button
                        onClick={() => {
                          onShowProfile?.(u.id);
                          setSearchOpen(false);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-input-bg"
                      >
                        <Avatar src={u.image} name={u.name} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{u.name}</p>
                          {u.carDisplay && (
                            <p className="truncate text-[10px] text-muted">{u.carDisplay}</p>
                          )}
                        </div>
                        <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compose toggle */}
      {!composeOpen ? (
        <button
          onClick={() => setComposeOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-card-border bg-card-bg px-4 py-3 text-left text-sm text-muted transition hover:border-orange-500/40 hover:text-foreground"
        >
          <Avatar src={session?.user?.image} name={session?.user?.name ?? '?'} size={36} />
          <span className="flex-1">Co u Ciebie? Podziel się ze społecznością…</span>
          <span className="rounded-lg bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white">+ Post</span>
        </button>
      ) : (
        <div className="rounded-2xl border border-card-border bg-card-bg p-4">
          <div className="flex items-start gap-3">
            <Avatar src={session?.user?.image} name={session?.user?.name ?? '?'} size={36} />
            <div className="min-w-0 flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Co u Ciebie? Podziel się trasą, zdjęciem albo myślą…"
                className="w-full resize-none rounded-xl border border-card-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder-muted outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
              {imageData && (
                <div className="relative mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageData} alt="Załącznik" className="max-h-64 w-full rounded-xl object-cover" />
                  <button
                    onClick={() => setImageData(null)}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-card-border bg-input-bg px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:text-foreground disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  {imageLoading ? 'Wczytuję…' : imageData ? 'Zmień zdjęcie' : 'Zdjęcie'}
                </button>
                <button
                  type="button"
                  onClick={() => setAttachLocation((v) => !v)}
                  disabled={!userLocation}
                  title={userLocation ? 'Dołącz aktualne miejsce' : 'Brak GPS'}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    attachLocation
                      ? 'border-emerald-500/40 bg-emerald-600/15 text-emerald-400'
                      : 'border-card-border bg-input-bg text-muted hover:text-foreground'
                  }`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {attachLocation ? 'Lokalizacja dołączona' : 'Dodaj lokalizację'}
                </button>
                <span className="ml-auto text-[11px] text-muted">{content.length}/1000</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => { setComposeOpen(false); setContent(''); setImageData(null); setAttachLocation(false); }}
                  className="flex-1 rounded-xl border border-card-border bg-card-bg py-2 text-xs font-semibold text-muted transition hover:bg-input-bg hover:text-foreground"
                >
                  Anuluj
                </button>
                <button
                  onClick={submitPost}
                  disabled={submitting || (!content.trim() && !imageData)}
                  className="flex-1 rounded-xl bg-orange-600 py-2 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
                >
                  {submitting ? 'Publikuję…' : 'Opublikuj'}
                </button>
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

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-card-border bg-card-bg/60 px-4 py-12 text-center">
          <p className="text-sm font-medium text-foreground">Tu jeszcze nic nie ma</p>
          <p className="mt-1 text-xs text-muted">
            {filter === 'friends'
              ? 'Twoi znajomi nic nie wrzucili. Dodaj nowych znajomych albo zobacz wszystkich.'
              : 'Bądź pierwszy — dodaj posta!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => {
            const isOwner = myId === post.userId;
            const open = !!openComments[post.id];
            const previewComments = open
              ? (allComments[post.id] ?? post.comments)
              : post.comments.slice().reverse();
            return (
              <article
                key={post.id}
                className="overflow-hidden rounded-2xl border border-card-border bg-card-bg shadow-sm"
              >
                {/* Header */}
                <header className="flex items-center gap-3 px-4 pt-3 pb-2">
                  <button
                    onClick={() => onShowProfile?.(post.user.id)}
                    className="shrink-0 transition hover:opacity-90"
                  >
                    <Avatar src={post.user.image} name={post.user.name} size={40} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => onShowProfile?.(post.user.id)}
                      className="block truncate text-left text-sm font-semibold text-foreground hover:text-orange-400"
                    >
                      {post.user.name}
                    </button>
                    <p className="truncate text-[11px] text-muted">
                      {post.user.carDisplay && (
                        <>
                          <span>{post.user.carDisplay}</span>
                          <span className="mx-1">•</span>
                        </>
                      )}
                      <span>{timeAgo(post.createdAt)}</span>
                      {post.latitude !== null && post.longitude !== null && (
                        <>
                          <span className="mx-1">•</span>
                          <span className="inline-flex items-center gap-0.5 text-emerald-400">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            okolica
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => deletePost(post.id)}
                      disabled={deletingId === post.id}
                      title="Usuń post"
                      className="rounded-lg p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  )}
                </header>

                {/* Content */}
                {post.content && (
                  <p className="whitespace-pre-wrap px-4 pb-2 text-sm leading-relaxed text-foreground">
                    {post.content}
                  </p>
                )}

                {/* Image */}
                {post.imageData && (
                  <button
                    onClick={() => setLightbox(post.imageData)}
                    className="block w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.imageData}
                      alt="Post"
                      className="max-h-[520px] w-full object-cover transition hover:opacity-95"
                    />
                  </button>
                )}

                {/* Footer actions */}
                <div className="flex items-center gap-1 border-t border-card-border px-2 py-1">
                  <button
                    onClick={() => toggleLike(post)}
                    disabled={likingId === post.id}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      post.myLiked ? 'text-rose-400' : 'text-muted hover:text-foreground hover:bg-input-bg'
                    }`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill={post.myLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                    {post.likeCount > 0 ? `${post.likeCount} ${post.myLiked ? 'lubisz' : 'lubi'}` : 'Polub'}
                  </button>
                  <button
                    onClick={() => toggleCommentsOpen(post.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted transition hover:bg-input-bg hover:text-foreground"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    {post.commentCount > 0 ? `${post.commentCount} komentarzy` : 'Komentuj'}
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
                            <button
                              onClick={() => onShowProfile?.(c.user.id)}
                              className="shrink-0"
                            >
                              <Avatar src={c.user.image} name={c.user.name} size={28} />
                            </button>
                            <div className="min-w-0 flex-1 rounded-xl bg-card-bg px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  onClick={() => onShowProfile?.(c.user.id)}
                                  className="text-[11px] font-semibold text-foreground hover:text-orange-400"
                                >
                                  {c.user.name}
                                </button>
                                <span className="text-[10px] text-muted">{timeAgo(c.createdAt)}</span>
                              </div>
                              <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground">{c.content}</p>
                              {c.userId === myId && (
                                <button
                                  onClick={() => deleteComment(post.id, c.id)}
                                  className="mt-1 text-[10px] text-muted hover:text-red-400"
                                >
                                  Usuń
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                        {!open && post.commentCount > previewComments.length && (
                          <li>
                            <button
                              onClick={() => toggleCommentsOpen(post.id)}
                              className="text-[11px] text-muted hover:text-foreground"
                            >
                              Pokaż wszystkie ({post.commentCount})
                            </button>
                          </li>
                        )}
                      </ul>
                    )}

                    {open && (
                      <div className="mt-3 flex items-start gap-2">
                        <Avatar src={session?.user?.image} name={session?.user?.name ?? '?'} size={28} />
                        <textarea
                          value={draftComments[post.id] ?? ''}
                          onChange={(e) => setDraftComments((p) => ({ ...p, [post.id]: e.target.value }))}
                          rows={1}
                          maxLength={500}
                          placeholder="Napisz komentarz…"
                          className="flex-1 resize-none rounded-xl border border-card-border bg-card-bg px-3 py-2 text-xs text-foreground placeholder-muted outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                        <button
                          onClick={() => submitComment(post.id)}
                          disabled={submittingComment === post.id || !(draftComments[post.id] ?? '').trim()}
                          className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
                        >
                          {submittingComment === post.id ? '…' : 'Wyślij'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Zdjęcie" className="max-h-full max-w-full rounded-xl object-contain" />
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
        active ? 'bg-card-bg text-foreground shadow-sm' : 'text-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function Avatar({ src, name, size }: { src: string | null | undefined; name: string; size: number }) {
  return (
    <div
      className="overflow-hidden rounded-full bg-input-bg ring-1 ring-card-border"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted">
          {name?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
    </div>
  );
}
