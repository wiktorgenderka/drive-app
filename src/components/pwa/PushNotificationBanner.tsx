'use client';

import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

type BannerState = 'idle' | 'asking' | 'subscribed' | 'denied' | 'dismissed';

export default function PushNotificationBanner() {
  const [state, setState] = useState<BannerState>('idle');

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setState('dismissed');
      return;
    }
    if (Notification.permission === 'granted') {
      setState('subscribed');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    const dismissed = sessionStorage.getItem('push-banner-dismissed');
    if (dismissed) {
      setState('dismissed');
      return;
    }
    setState('asking');
  }, []);

  async function subscribe() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setState('dismissed');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = sub.toJSON();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });

      setState('subscribed');
    } catch {
      setState('dismissed');
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState('asking');
    } catch {
      // ignore
    }
  }

  function dismiss() {
    sessionStorage.setItem('push-banner-dismissed', '1');
    setState('dismissed');
  }

  if (state === 'dismissed' || state === 'idle' || state === 'denied') return null;

  if (state === 'subscribed') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-900/30 border border-green-700/50 px-3 py-2 text-sm text-green-300">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        <span>Powiadomienia włączone</span>
        <button
          onClick={unsubscribe}
          className="ml-auto text-green-400 hover:text-green-200"
          title="Wyłącz powiadomienia"
          aria-label="Wyłącz powiadomienia"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 003.844.148m-3.844-.148a23.856 23.856 0 01-5.455-1.31 8.964 8.964 0 002.3-5.542m3.155 6.852a3 3 0 005.667 1.97m1.965-2.277L21 21m-4.225-4.225a8.964 8.964 0 00.925-3.577v-.75m-11.7 4.008A9.001 9.001 0 013 12c0-.682.074-1.348.215-1.99M3 3l18 18" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm">
      <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      <span className="text-gray-200">Włącz powiadomienia push</span>
      <button
        onClick={subscribe}
        className="ml-auto rounded bg-yellow-500 px-2 py-1 text-xs font-medium text-black hover:bg-yellow-400"
      >
        Włącz
      </button>
      <button onClick={dismiss} className="text-gray-500 hover:text-gray-300" aria-label="Zamknij">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
