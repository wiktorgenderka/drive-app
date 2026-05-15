import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'DriveApp — Dashboard',
  description: 'Twoja mapa, konwoje i zgłoszenia drogowe w czasie rzeczywistym.',
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
