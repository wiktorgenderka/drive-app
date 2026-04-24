'use client';

interface SearchResult {
  id: string;
  name: string;
  address: string;
  lng: number;
  lat: number;
}

interface SearchPanelProps {
  show: boolean;
  hasDestination: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  onQueryChange: (q: string) => void;
  onNavigateTo: (place: SearchResult) => void;
  onPickOnMap: () => void;
  onClose: () => void;
}

export default function SearchPanel({
  show,
  hasDestination,
  searchQuery,
  searchResults,
  isSearching,
  onQueryChange,
  onNavigateTo,
  onPickOnMap,
  onClose,
}: SearchPanelProps) {
  if (!show || hasDestination) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card-bg border border-card-border text-muted transition hover:text-foreground"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex flex-1 items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-2.5">
          <svg className="h-5 w-5 text-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Wpisz miasto, ulicę lub miejsce..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-light outline-none"
          />
          {searchQuery && (
            <button onClick={() => onQueryChange('')} className="rounded-lg p-0.5 text-muted hover:text-foreground">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4">
        {isSearching && searchQuery.length >= 2 && (
          <div className="flex items-center justify-center py-8">
            <svg className="h-6 w-6 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="flex flex-col gap-1">
            {searchResults.map((place) => (
              <button
                key={place.id}
                onClick={() => onNavigateTo(place)}
                className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-card-bg"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/15 text-blue-500">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                  </svg>
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-medium text-foreground truncate">{place.name}</p>
                  <p className="text-xs text-muted truncate">{place.address}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <p className="text-sm">Brak wyników</p>
          </div>
        )}

        <button
          onClick={onPickOnMap}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 mt-2 text-left transition hover:bg-card-bg"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-500">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Wskaż na mapie</p>
            <p className="text-xs text-muted">Kliknij punkt na mapie</p>
          </div>
        </button>

        {searchQuery.length < 2 && searchResults.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M3 11l19-9-9 19-2-8-8-2z" />
            </svg>
            <p className="text-sm">Wpisz cel podróży</p>
          </div>
        )}
      </div>
    </div>
  );
}
