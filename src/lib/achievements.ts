import { prisma } from './prisma';
import { awardXP } from './xp';

export const ACHIEVEMENTS = [
  // Pierwsze kroki
  { key: 'first_trip',      name: 'Pierwsze koła',      description: 'Ukończyłeś pierwszą podróż.',              emoji: '🚗', rarity: 'COMMON',    xpReward: 50  },
  { key: 'first_convoy',    name: 'Nie jeżdżę sam',     description: 'Dołączyłeś do swojego pierwszego konwoju.', emoji: '👥', rarity: 'COMMON',    xpReward: 50  },
  { key: 'first_spot',      name: 'Odkrywca',           description: 'Dodałeś swój pierwszy spot.',               emoji: '📍', rarity: 'COMMON',    xpReward: 30  },
  { key: 'first_report',    name: 'Strażnik Dróg',      description: 'Wysłałeś pierwsze zgłoszenie drogowe.',     emoji: '🔦', rarity: 'COMMON',    xpReward: 25  },
  { key: 'first_route',     name: 'Kartograf',          description: 'Stworzyłeś swoją pierwszą trasę.',          emoji: '🗺️', rarity: 'COMMON',    xpReward: 100 },
  { key: 'first_friend',    name: 'Dobra ekipa',        description: 'Dodałeś pierwszego znajomego.',             emoji: '🤝', rarity: 'COMMON',    xpReward: 15  },
  { key: 'first_fuel',      name: 'Cenowy Szpieg',      description: 'Dodałeś ceny paliw na stacji.',             emoji: '⛽', rarity: 'COMMON',    xpReward: 20  },

  // Trasy
  { key: 'routes_5',        name: 'Pięciodrożnik',      description: 'Stworzyłeś 5 publicznych tras.',           emoji: '📋', rarity: 'RARE',      xpReward: 150 },
  { key: 'routes_10',       name: 'Legendarny Kartograf', description: 'Stworzyłeś 10 publicznych tras.',        emoji: '🏅', rarity: 'EPIC',      xpReward: 300 },
  { key: 'night_drive',     name: 'Nocny Maratończyk',  description: 'Ukończyłeś podróż po 23:00.',              emoji: '🌙', rarity: 'RARE',      xpReward: 80  },
  { key: 'dawn_drive',      name: 'Złota Godzina',      description: 'Ukończyłeś podróż między 6:00-7:00.',      emoji: '🌅', rarity: 'RARE',      xpReward: 80  },
  { key: 'record_breaker',  name: 'Rekordzista',        description: 'Pobił/aś rekord na trasie.',               emoji: '🏆', rarity: 'EPIC',      xpReward: 200 },
  { key: 'trip_100km',      name: 'Setka',              description: 'Przejechałeś/aś 100 km w jednej podróży.', emoji: '💯', rarity: 'RARE',      xpReward: 120 },
  { key: 'trips_total_1000km', name: 'Tysięcznik',     description: 'Łączny dystans podróży przekroczył 1000 km.', emoji: '🌍', rarity: 'EPIC',  xpReward: 500 },

  // Społeczność
  { key: 'friends_5',       name: 'Towarzyski',         description: 'Masz 5 znajomych.',                        emoji: '🫂', rarity: 'RARE',      xpReward: 100 },
  { key: 'post_popular',    name: 'Influencer Szos',    description: 'Twój post otrzymał 10 lajków.',            emoji: '❤️', rarity: 'RARE',      xpReward: 100 },
  { key: 'convoy_leader',   name: 'Lider Konwoju',      description: 'Stworzyłeś 3 konwoje.',                    emoji: '👑', rarity: 'RARE',      xpReward: 150 },
  { key: 'reports_10',      name: 'Czujny Kierowca',    description: '10 potwierdzonych zgłoszeń drogowych.',    emoji: '🚨', rarity: 'RARE',      xpReward: 200 },

  // Specjalne
  { key: 'mystery_drive_3', name: 'Mystery Driver',     description: 'Ukończyłeś 3 Mystery Drives.',             emoji: '🌟', rarity: 'EPIC',      xpReward: 300 },
  { key: 'streak_7',        name: 'Tygodniowy Flame',   description: '7-dniowy streak aktywności.',              emoji: '🔥', rarity: 'RARE',      xpReward: 200 },
  { key: 'streak_30',       name: 'Płomień Miesiąca',   description: '30-dniowy streak aktywności.',             emoji: '🔥', rarity: 'EPIC',      xpReward: 500 },
  { key: 'streak_100',      name: 'Wieczny Ogień',      description: '100-dniowy streak aktywności.',            emoji: '🔥', rarity: 'LEGENDARY', xpReward: 2000 },
  { key: 'level_5',         name: 'Asfalciarz',         description: 'Osiągnąłeś poziom 5.',                     emoji: '⭐', rarity: 'RARE',      xpReward: 0   },
  { key: 'level_10',        name: 'Road God',           description: 'Osiągnąłeś maksymalny poziom 10.',         emoji: '👑', rarity: 'LEGENDARY', xpReward: 0   },
] as const;

export type AchievementKey = typeof ACHIEVEMENTS[number]['key'];

export async function seedAchievements() {
  for (const ach of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: ach.key },
      update: { name: ach.name, description: ach.description, emoji: ach.emoji, rarity: ach.rarity, xpReward: ach.xpReward },
      create: { key: ach.key, name: ach.name, description: ach.description, emoji: ach.emoji, rarity: ach.rarity as never, xpReward: ach.xpReward },
    });
  }
}

export async function unlockAchievement(
  userId: string,
  key: AchievementKey,
): Promise<{ unlocked: boolean; achievement: typeof ACHIEVEMENTS[number] | null }> {
  const achDef = ACHIEVEMENTS.find((a) => a.key === key);
  if (!achDef) return { unlocked: false, achievement: null };

  const dbAch = await prisma.achievement.findUnique({ where: { key } });
  if (!dbAch) return { unlocked: false, achievement: null };

  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: dbAch.id } },
  });
  if (existing) return { unlocked: false, achievement: null };

  await prisma.userAchievement.create({ data: { userId, achievementId: dbAch.id } });

  if (achDef.xpReward > 0) {
    await awardXP(userId, 'ACHIEVEMENT_UNLOCKED', { achievementKey: key }, achDef.xpReward);
  }

  return { unlocked: true, achievement: achDef };
}

export async function checkAndUnlockAchievements(
  userId: string,
  context: {
    tripCount?: number;
    convoyCount?: number;
    spotCount?: number;
    reportCount?: number;
    routeCount?: number;
    friendCount?: number;
    fuelPriceCount?: number;
    streak?: number;
    level?: number;
    postLikes?: number;
    mysteryDrives?: number;
    totalDistanceKm?: number;
    lastTripHour?: number;
    tripDistanceKm?: number;
    reportConfirmed?: boolean;
  },
): Promise<Array<typeof ACHIEVEMENTS[number]>> {
  const unlocked: Array<typeof ACHIEVEMENTS[number]> = [];

  async function tryUnlock(key: AchievementKey) {
    const result = await unlockAchievement(userId, key);
    if (result.unlocked && result.achievement) unlocked.push(result.achievement);
  }

  if (context.tripCount === 1) await tryUnlock('first_trip');
  if (context.convoyCount === 1) await tryUnlock('first_convoy');
  if (context.convoyCount && context.convoyCount >= 3) await tryUnlock('convoy_leader');
  if (context.spotCount === 1) await tryUnlock('first_spot');
  if (context.reportCount === 1) await tryUnlock('first_report');
  if (context.reportConfirmed && context.reportCount && context.reportCount >= 10) await tryUnlock('reports_10');
  if (context.routeCount === 1) await tryUnlock('first_route');
  if (context.routeCount && context.routeCount >= 5) await tryUnlock('routes_5');
  if (context.routeCount && context.routeCount >= 10) await tryUnlock('routes_10');
  if (context.friendCount === 1) await tryUnlock('first_friend');
  if (context.friendCount && context.friendCount >= 5) await tryUnlock('friends_5');
  if (context.fuelPriceCount === 1) await tryUnlock('first_fuel');
  if (context.postLikes && context.postLikes >= 10) await tryUnlock('post_popular');
  if (context.mysteryDrives && context.mysteryDrives >= 3) await tryUnlock('mystery_drive_3');
  if (context.streak === 7) await tryUnlock('streak_7');
  if (context.streak === 30) await tryUnlock('streak_30');
  if (context.streak === 100) await tryUnlock('streak_100');
  if (context.level === 5) await tryUnlock('level_5');
  if (context.level === 10) await tryUnlock('level_10');
  if (context.tripDistanceKm && context.tripDistanceKm >= 100) await tryUnlock('trip_100km');
  if (context.totalDistanceKm && context.totalDistanceKm >= 1000) await tryUnlock('trips_total_1000km');
  if (context.lastTripHour !== undefined) {
    if (context.lastTripHour >= 23) await tryUnlock('night_drive');
    if (context.lastTripHour >= 6 && context.lastTripHour < 7) await tryUnlock('dawn_drive');
  }

  return unlocked;
}
