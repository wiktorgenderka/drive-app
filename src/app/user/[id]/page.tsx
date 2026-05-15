'use client';

import { useParams, useRouter } from 'next/navigation';
import { UserProfileView } from '@/components/profile/PublicProfileModals';

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = typeof params.id === 'string' ? params.id : '';

  return (
    <div className="min-h-screen bg-background">
      <UserProfileView userId={userId} onBack={() => router.back()} />
    </div>
  );
}
