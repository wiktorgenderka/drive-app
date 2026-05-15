'use client';

import { useParams, useRouter } from 'next/navigation';
import { UserProfileView } from '@/components/profile/PublicProfileModals';
import AuthGuard from '@/components/auth/AuthGuard';

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = typeof params.id === 'string' ? params.id : '';

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <UserProfileView userId={userId} onBack={() => router.back()} />
      </div>
    </AuthGuard>
  );
}
