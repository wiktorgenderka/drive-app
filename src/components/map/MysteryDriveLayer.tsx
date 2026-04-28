'use client';

import { Marker, Source, Layer } from 'react-map-gl/mapbox';
import { useMapStore } from '@/stores/useMapStore';

// Zwraca indeks w tablicy coords (GeoJSON: [lng, lat]) najbliższy podanemu punktowi.
function nearestCoordIdx(coords: [number, number][], lat: number, lng: number): number {
  let minDist = Infinity;
  let best = 0;
  for (let i = 0; i < coords.length; i++) {
    const dx = coords[i][0] - lng;
    const dy = coords[i][1] - lat;
    const d = dx * dx + dy * dy;
    if (d < minDist) { minDist = d; best = i; }
  }
  return best;
}

function toGeoJSON(coordinates: [number, number][]): GeoJSON.Feature {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } };
}

// Renderuje segmenty trasy w stylu NFS:
//   - bieżący segment (currentIdx-1 → currentIdx): pełny neon
//   - następny segment (currentIdx → currentIdx+1): przyciemniony podgląd
// Gdy aktywny, RouteLayer wyłącza pełną linię trasy dla tego routeId.
export default function MysteryDriveLayer() {
  const mystery = useMapStore((s) => s.mysteryDrive);
  const routes = useMapStore((s) => s.routes);

  if (!mystery || mystery.status !== 'running') return null;

  const { waypoints, currentIdx, visibleAhead } = mystery;
  const lastVisibleIdx = Math.min(waypoints.length - 1, currentIdx + visibleAhead);
  const visible = waypoints.slice(currentIdx, lastVisibleIdx + 1);

  // Segmenty linii trasy
  const activeRoute = routes.find((r) => r.id === mystery.routeId);
  const coords = activeRoute?.coordinates;

  let currentSegGeo: GeoJSON.Feature | null = null;
  let nextSegGeo: GeoJSON.Feature | null = null;

  if (coords && coords.length >= 2) {
    const boundaries = waypoints.map((wp) =>
      nearestCoordIdx(coords, wp.latitude, wp.longitude)
    );

    // Bieżący segment: od poprzedniego checkpointa do aktualnego celu.
    // Gdy currentIdx=0 (waypoints[0] = start trasy, boundaries[0]≈0), segment byłby pusty.
    // W takim przypadku pokaż cały odcinek start→wp[1] jako bieżący.
    const curStart = currentIdx === 0 ? 0 : (boundaries[currentIdx - 1] ?? 0);
    const curEndRaw = boundaries[currentIdx] ?? coords.length - 1;
    const curEnd = curEndRaw > curStart ? curEndRaw : (boundaries[currentIdx + 1] ?? coords.length - 1);
    const curSlice = coords.slice(curStart, curEnd + 1);
    if (curSlice.length >= 2) currentSegGeo = toGeoJSON(curSlice);

    // Następny segment: od aktualnego celu do kolejnego checkpointa.
    const hasNext = currentIdx + 1 < waypoints.length;
    if (hasNext) {
      const nxtStart = curEnd;
      const nxtEnd = boundaries[currentIdx + (curEndRaw > curStart ? 1 : 2)] ?? coords.length - 1;
      if (nxtEnd > nxtStart) {
        const nxtSlice = coords.slice(nxtStart, nxtEnd + 1);
        if (nxtSlice.length >= 2) nextSegGeo = toGeoJSON(nxtSlice);
      }
    }
  }

  return (
    <>
      {/* Bieżący segment — pełny NFS neon */}
      {currentSegGeo && (
        <Source id="mystery-seg-current" type="geojson" data={currentSegGeo}>
          <Layer
            id="mystery-seg-current-glow"
            type="line"
            paint={{ 'line-color': '#fbbf24', 'line-width': 18, 'line-opacity': 0.18, 'line-blur': 7 }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
          <Layer
            id="mystery-seg-current-casing"
            type="line"
            paint={{ 'line-color': '#f97316', 'line-width': 9, 'line-opacity': 0.85 }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
          <Layer
            id="mystery-seg-current-line"
            type="line"
            paint={{ 'line-color': '#fde047', 'line-width': 4, 'line-opacity': 1 }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
        </Source>
      )}

      {/* Następny segment — przyciemniony podgląd */}
      {nextSegGeo && (
        <Source id="mystery-seg-next" type="geojson" data={nextSegGeo}>
          <Layer
            id="mystery-seg-next-glow"
            type="line"
            paint={{ 'line-color': '#fbbf24', 'line-width': 12, 'line-opacity': 0.07, 'line-blur': 5 }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
          <Layer
            id="mystery-seg-next-casing"
            type="line"
            paint={{ 'line-color': '#f97316', 'line-width': 6, 'line-opacity': 0.28 }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
          <Layer
            id="mystery-seg-next-line"
            type="line"
            paint={{ 'line-color': '#fde047', 'line-width': 3, 'line-opacity': 0.32 }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
        </Source>
      )}

      {/* Markery checkpointów — bieżący duży i pulsujący, kolejne stopniowo blakną */}
      {visible.map((wp, i) => {
        const idx = currentIdx + i;
        const isCurrent = i === 0;
        const isFinal = idx === waypoints.length - 1;
        const opacity = isCurrent ? 1 : Math.max(0.35, 1 - i * 0.22);
        const scale = isCurrent ? 1 : Math.max(0.55, 1 - i * 0.15);
        const color = isFinal ? '#10b981' : isCurrent ? '#f97316' : '#fb923c';

        return (
          <Marker
            key={`mystery-${idx}`}
            longitude={wp.longitude}
            latitude={wp.latitude}
            anchor="center"
          >
            <div
              className="relative"
              style={{ opacity, transform: `scale(${scale})` }}
            >
              {isCurrent && (
                <span
                  className="absolute -inset-3 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${color}66 0%, transparent 70%)`,
                    animation: 'pulse-mystery 1.4s ease-in-out infinite',
                  }}
                />
              )}
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-white shadow-2xl ring-4 ring-white/30"
                style={{ background: color }}
              >
                {isFinal ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 5h6v4h-6zM11 9h6v4h-6zM5 13h6v4h-6zM11 17h6v4h-6z" />
                    <path d="M5 5v18" stroke="currentColor" strokeWidth={1.5} fill="none" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
            </div>
          </Marker>
        );
      })}
      <style jsx global>{`
        @keyframes pulse-mystery {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </>
  );
}
