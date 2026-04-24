'use client';

import { getArrowRotation } from '@/lib/mapNavigation';

interface ManeuverIconProps {
  type: string;
  modifier?: string;
  size?: number;
}

export default function ManeuverIcon({ type, modifier, size = 28 }: ManeuverIconProps) {
  const rotation = getArrowRotation(type, modifier ?? '');

  if (type === 'arrive') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
      </svg>
    );
  }

  if (type === 'roundabout' || type === 'rotary') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
      </svg>
    );
  }

  if ((modifier ?? '').includes('uturn')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 5v3l4-4-4-4v3c-4.42 0-8 3.58-8 8h2c0-3.31 2.69-6 6-6zm4 9c-3.31 0-6-2.69-6-6H8c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path d="M12 3l-1.5 1.8 4.5 4.7H4v2.5h11l-4.5 4.7 1.5 1.8 7-7.25L12 3z" />
    </svg>
  );
}
