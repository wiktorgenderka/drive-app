'use client';

import { useState, useEffect, useCallback } from 'react';

interface CollectionRoute {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  routes: CollectionRoute[];
}

interface UserRoute {
  id: string;
  name: string;
}

export default function RouteCollectionsPanel() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [userRoutes, setUserRoutes] = useState<UserRoute[]>([]);
  const [addingRoute, setAddingRoute] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/collections');
      if (r.ok) setCollections(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadUserRoutes() {
    const r = await fetch('/api/routes');
    if (r.ok) {
      const data = await r.json();
      const list = data.data ?? data.routes ?? data;
      setUserRoutes(list.map((rt: { id: string; name: string }) => ({ id: rt.id, name: rt.name })));
    }
  }

  async function createCollection() {
    if (!newName.trim()) return;
    const r = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
    });
    if (r.ok) {
      const col = await r.json();
      setCollections((prev) => [col, ...prev]);
      setNewName('');
      setNewDesc('');
      setCreating(false);
    }
  }

  async function deleteCollection(id: string) {
    const r = await fetch(`/api/collections/${id}`, { method: 'DELETE' });
    if (r.ok) setCollections((prev) => prev.filter((c) => c.id !== id));
  }

  async function addRouteToCollection(collectionId: string) {
    if (!selectedRouteId) return;
    const r = await fetch(`/api/collections/${collectionId}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId: selectedRouteId }),
    });
    if (r.ok) {
      const updated = await r.json();
      setCollections((prev) => prev.map((c) => c.id === collectionId ? updated : c));
      setAddingRoute(null);
      setSelectedRouteId('');
    }
  }

  async function removeRouteFromCollection(collectionId: string, routeId: string) {
    const r = await fetch(`/api/collections/${collectionId}/routes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId }),
    });
    if (r.ok) {
      const updated = await r.json();
      setCollections((prev) => prev.map((c) => c.id === collectionId ? updated : c));
    }
  }

  async function toggleAddRoute(collectionId: string) {
    if (addingRoute === collectionId) {
      setAddingRoute(null);
      return;
    }
    setAddingRoute(collectionId);
    setSelectedRouteId('');
    if (userRoutes.length === 0) await loadUserRoutes();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Kolekcje tras</h3>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition hover:opacity-90"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nowa kolekcja
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border border-card-border bg-input-bg p-4 flex flex-col gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nazwa kolekcjiâ€¦"
            maxLength={100}
            className="rounded-lg border border-input-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Opis (opcjonalnie)â€¦"
            maxLength={300}
            className="rounded-lg border border-input-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={createCollection}
              disabled={!newName.trim()}
              className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
            >
              UtwĂłrz
            </button>
            <button
              onClick={() => { setCreating(false); setNewName(''); setNewDesc(''); }}
              className="rounded-lg border border-card-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {collections.length === 0 && !creating && (
        <p className="py-6 text-center text-sm text-muted">Nie masz jeszcze ĹĽadnych kolekcji.</p>
      )}

      {collections.map((col) => (
        <div key={col.id} className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === col.id ? null : col.id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-input-bg"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{col.name}</p>
              {col.description && <p className="text-xs text-muted truncate">{col.description}</p>}
            </div>
            <span className="shrink-0 rounded-full bg-input-bg px-2 py-0.5 text-xs font-medium text-muted">
              {col.routes.length}
            </span>
            <svg
              className={`h-4 w-4 shrink-0 text-muted transition-transform ${expanded === col.id ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded === col.id && (
            <div className="border-t border-card-border px-4 py-3 flex flex-col gap-2">
              {col.routes.length === 0 ? (
                <p className="text-xs text-muted py-1">Brak tras w tej kolekcji.</p>
              ) : (
                col.routes.map((rt) => (
                  <div key={rt.id} className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span className="flex-1 text-xs text-foreground truncate">{rt.name}</span>
                    <button
                      onClick={() => removeRouteFromCollection(col.id, rt.id)}
                      className="shrink-0 text-muted hover:text-red-400 transition"
                      title="UsuĹ„ z kolekcji"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              )}

              {addingRoute === col.id ? (
                <div className="flex gap-2 mt-1">
                  <select
                    value={selectedRouteId}
                    onChange={(e) => setSelectedRouteId(e.target.value)}
                    className="flex-1 rounded-lg border border-input-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Wybierz trasÄ™â€¦</option>
                    {userRoutes
                      .filter((r) => !col.routes.some((cr) => cr.id === r.id))
                      .map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                  </select>
                  <button
                    onClick={() => addRouteToCollection(col.id)}
                    disabled={!selectedRouteId}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
                  >
                    Dodaj
                  </button>
                  <button
                    onClick={() => setAddingRoute(null)}
                    className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
                  >
                    Anuluj
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => toggleAddRoute(col.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Dodaj trasÄ™
                  </button>
                  <span className="text-muted">Â·</span>
                  <button
                    onClick={() => deleteCollection(col.id)}
                    className="text-xs text-muted hover:text-red-400 transition"
                  >
                    UsuĹ„ kolekcjÄ™
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
