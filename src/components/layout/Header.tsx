'use client';

import { useSession } from 'next-auth/react';
import Avatar from '@/components/ui/Avatar';
import { useThemeStore } from '@/stores/useThemeStore';
import { useMapStore } from '@/stores/useMapStore';
import PushNotificationBanner from '@/components/pwa/PushNotificationBanner';

export default function Header() {
  const { data: session } = useSession();
  const { mode, setMode } = useThemeStore();
  const ecoMode = useMapStore((s) => s.ecoMode);
  const toggleEcoMode = useMapStore((s) => s.toggleEcoMode);

  return (
    <div>
    <header className="h-14 bg-gray-900/80 backdrop-blur border-b border-gray-800 flex items-center justify-between px-4 md:px-6 z-20">
      <div className="md:hidden w-10" /> {/* spacer for mobile hamburger */}
      <h1 className="text-lg font-bold text-gray-100 hidden md:block">DriveApp</h1>

      <div className="flex items-center gap-3">
        {/* ECO mode toggle */}
        <button
          onClick={toggleEcoMode}
          className={`p-2 rounded-lg transition-colors ${ecoMode ? 'text-green-400 bg-green-900/30' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
          title={ecoMode ? 'Tryb ECO włączony (GPS co 30s)' : 'Włącz tryb ECO (oszczędność baterii)'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M4.5 10.5H18V15H4.5v-4.5zM3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" />
          </svg>
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          title={mode === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
        >
          {mode === 'dark' ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>

        {/* Notifications */}
        <button className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors relative">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User avatar */}
        {session?.user && (
          <Avatar
            name={session.user.name || 'User'}
            image={session.user.image}
            size="sm"
            isOnline
          />
        )}
      </div>
    </header>
    <div className="px-4 py-1">
      <PushNotificationBanner />
    </div>
    </div>
  );
}
