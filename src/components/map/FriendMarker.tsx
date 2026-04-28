'use client';

import { Marker } from 'react-map-gl/mapbox';
import type { FriendLocation } from '@/stores/useMapStore';

interface FriendMarkerProps {
  friend: FriendLocation;
}

export default function FriendMarker({ friend }: FriendMarkerProps) {
  const firstName = friend.name.split(' ')[0];
  const initial = friend.name?.[0]?.toUpperCase() ?? '?';
  const speedKmh = friend.speed != null ? Math.round(friend.speed * 3.6) : null;

  return (
    <Marker latitude={friend.latitude} longitude={friend.longitude} anchor="bottom">
      <div className="flex flex-col items-center" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.55))' }}>
        {/* Avatar */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '2.5px solid #38bdf8',
            boxShadow: '0 0 8px rgba(56,189,248,0.7), 0 0 18px rgba(56,189,248,0.3)',
            overflow: 'hidden',
            background: '#0369a1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {friend.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={friend.image} alt={friend.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#e0f2fe', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>{initial}</span>
          )}
        </div>

        {/* Name + speed label */}
        <div
          style={{
            marginTop: 3,
            background: 'rgba(2,6,23,0.88)',
            border: '1px solid rgba(56,189,248,0.35)',
            backdropFilter: 'blur(6px)',
            borderRadius: 6,
            padding: '2px 7px',
            fontSize: 10,
            fontWeight: 600,
            color: '#e0f2fe',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {firstName}
          {speedKmh != null && speedKmh > 2 && (
            <span style={{ color: '#38bdf8' }}>{speedKmh} km/h</span>
          )}
        </div>

        {/* Bottom pointer */}
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '6px solid rgba(56,189,248,0.6)',
            marginTop: -1,
          }}
        />
      </div>
    </Marker>
  );
}
