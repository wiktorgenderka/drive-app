'use client';

import { useState, useEffect } from 'react';

export function usePendingRequests(userId: string | null | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    async function fetch_() {
      try {
        const res = await fetch('/api/friends/requests');
        if (res.ok && active) {
          const data = await res.json();
          setCount(Array.isArray(data) ? data.length : 0);
        }
      } catch { /* silent */ }
    }

    fetch_();
    const interval = setInterval(fetch_, 30_000);
    return () => { active = false; clearInterval(interval); };
  }, [userId]);

  return count;
}
