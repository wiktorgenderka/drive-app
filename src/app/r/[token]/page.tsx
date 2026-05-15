import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import type { Metadata } from 'next';
import SharedRouteView from '@/components/routes/SharedRouteView';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const route = await prisma.route.findUnique({
    where: { shareToken: token },
    select: { name: true, description: true },
  });
  if (!route) return { title: 'Trasa nie znaleziona' };
  return {
    title: `${route.name} — DriveApp`,
    description: route.description ?? 'Udostępniona trasa w DriveApp',
  };
}

export default async function SharedRoutePage({ params }: Props) {
  const { token } = await params;

  const route = await prisma.route.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      name: true,
      description: true,
      waypoints: true,
      avgRating: true,
      ratingCount: true,
      createdAt: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });

  if (!route) notFound();

  return <SharedRouteView route={{ ...route, createdAt: route.createdAt.toISOString() }} />;
}
