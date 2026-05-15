# PLAN ATAKU — Drive-App vs Feel The Road
## Strategia dominacji | 13.05.2026
## Ostatnia aktualizacja: 13.05.2026 — SESJA IMPLEMENTACJI 2

### POSTĘP SESJI 1
| Zadanie | Status |
|---|---|
| F0.1 Framer Motion — animacje przejść, Modal, Toast | ✅ ZROBIONE |
| F0.2 Bottom Nav redesign (5 tabów + layoutId pill) | ✅ ZROBIONE |
| F0.3 Design System — kolor accent #f97316, CSS variables | ✅ ZROBIONE |
| F0.4 UserMarker — ping ring w kolorze accent, bez styled-jsx | ✅ ZROBIONE |
| F1.1 System XP i rang — DB, lib/xp.ts, API /xp, /leaderboard, XPBar, LevelBadge | ✅ ZROBIONE |
| F1.2 System Odznak — 25 odznak, lib/achievements.ts, AchievementUnlock | ✅ ZROBIONE |
| F1.3 Streak + Leaderboard — StreakWidget, Leaderboard (XP + Raporty) | ✅ ZROBIONE |
| F2.1 Share Cards — TripSummaryModal redesign z html2canvas + share | ✅ ZROBIONE |
| F2.2 System Eventów — modele Event/EventAttendee, API events/* | ✅ ZROBIONE |
| F2.3 Garaż 2.0 — model Vehicle, API vehicles/* | ✅ ZROBIONE |

### POSTĘP SESJI 2
| Zadanie | Status |
|---|---|
| HomeScreen redesign — XPBar, StreakWidget, AchievementUnlock, statystyki | ✅ ZROBIONE |
| Podłączenie XP do akcji — trips, reports, spots, routes, friends, convoy, likes, route times | ✅ ZROBIONE |
| GaragePanel UI — karuzela aut, formularz dodawania, set active, delete | ✅ ZROBIONE |
| EventPanel UI — lista eventów, tworzenie, GOING/MAYBE attendance | ✅ ZROBIONE |
| Error pages — error.tsx (animated) + not-found.tsx | ✅ ZROBIONE |

### POSTĘP SESJI 2 (c.d.)
| Zadanie | Status |
|---|---|
| F3.1 Convoy 2.0 — Live ETA na mapie dla każdego membera + post-convoy stats | ✅ ZROBIONE |

### POSTĘP SESJI 2 (c.d.)
| Zadanie | Status |
|---|---|
| Onboarding Flow — 5-krokowy flow z Framer Motion, localStorage, skip | ✅ ZROBIONE |

### CO POZOSTAŁO (Sesja 3)
| Zadanie | Priorytet |
|---|---|
| Offline PWA — Service Worker | ŚREDNI |

---

> **Stan wyjściowy:** Drive-app jest TECHNICZNIE lepszy od FTR już teraz.
> Masz 56 komponentów, 49 API routes, konwoje z voice, social feed, Mystery Drive, Spotify.
> FTR ma 3,0/5 na Androidzie i bugi logowania.
> **Cel tego planu:** Zamknąć luki w UX i dodać funkcje, które FTR nie ma szans skopiować szybko.

---

## OBECNY STAN — co już masz (czego FTR nie ma)

| Funkcja | Drive-App | Feel The Road |
|---|---|---|
| Konwoje + Voice Chat | ✅ Zaimplementowane | ✅ Mają (z bugami) |
| Social Feed (posty, komentarze, lajki) | ✅ | ❌ Brak |
| Mystery Drive (NFS-like HUD) | ✅ | ❌ Brak |
| Spotify Widget (now playing) | ✅ | ❌ Brak |
| System Tras z Leaderboardami | ✅ | ❌ Brak |
| Trip Recording (stats podróży) | ✅ | ❌ Brak |
| Weather integration (auto day/night) | ✅ | ❌ Brak |
| 6 motywów mapy (w tym NFS) | ✅ | ❌ Brak |
| Zgłoszenia drogowe (6 typów + voting) | ✅ | ✅ Mają |
| Stacje paliw z cenami | ✅ | ✅ Mają |
| System znajomych | ✅ | ✅ Mają |
| Spoty / Meeting Points | ✅ | ✅ Mają |
| Gamifikacja (odznaki, XP, rangi) | ❌ BRAK | ❌ Brak |
| Share Cards po jeździe | ❌ BRAK | ❌ Brak |
| Kurowane trasy tematyczne | ❌ BRAK | ❌ Brak |
| System Eventów / Meetupów | ❌ BRAK | ❌ Brak |
| Push Notifications (PWA) | ❌ Brak (tylko toasty) | ❌ Brak |
| Offline mode | ❌ BRAK | ❌ Brak |
| Garaż z pełnym profilem auta | ❌ Częściowe | ❌ Częściowe |
| Onboarding flow | ❌ BRAK | ❌ Brak (i to ich problem) |

---

## FAZY REALIZACJI

---

# FAZA 0 — FUNDAMENT I POLISH UI
### Czas: ~2 tygodnie | Priorytet: KRYTYCZNY

*Bez tego reszta nie ma sensu. FTR przegrywa tutaj z marszu — ty musisz wygrywać od pierwszego odpalenia.*

---

## F0.1 — Animacje i Motion Design (Framer Motion)

**Cel:** Aplikacja musi czuć się jak premium produkt, nie jak projekt studencki.

**Do zainstalowania:**
```bash
npm install framer-motion
```

**Gdzie dodać animacje:**

### F0.1.1 — Page Transitions (przejście między tabami)
```
src/app/dashboard/page.tsx
```
- Każdy tab (home, map, profile, routes, friends, feed) wchodzi z animacją
- `AnimatePresence` + `motion.div` z `initial`, `animate`, `exit`
- Efekt: slide z prawej/lewej lub fade+scale
- Czas animacji: 200-250ms (szybko, nie może spowalniać)

### F0.1.2 — Modal Animations
```
src/components/ui/Modal.tsx
```
- Modals wchodzą z `scale: 0.95 → 1` + `opacity: 0 → 1`
- Tło (backdrop) fade in/out oddzielnie
- Zamknięcie: reverse

### F0.1.3 — Marker Animations na mapie
```
src/components/map/UserMarker.tsx
src/components/map/ReportMarker.tsx
src/components/map/SpotMarker.tsx
```
- Nowe markery "wpadają" na mapę (drop-in z góry lub scale)
- Pulsujący ring wokół własnego markera (CSS keyframes)
- Raport: czerwony ping (jak Apple Maps)

### F0.1.4 — Toast Animations
```
src/components/ui/Toast.tsx
```
- Wjeżdżają z dołu-prawej strony (slide up)
- Stack toastów (nowszy przesuwa starszy w górę)
- Smooth exit (slide right)

### F0.1.5 — Card Hover Effects
```
src/components/ui/Card.tsx
```
- `whileHover: { scale: 1.02, y: -2 }` na kartach tras, postów
- Subtle shadow grow na hover

### F0.1.6 — Liczniki i statystyki (animated numbers)
```
src/components/dashboard/HomeScreen.tsx
```
- Liczby "wkręcają się" przy pierwszym renderze (licznik od 0 do wartości)
- Biblioteka: `framer-motion` useMotionValue + useTransform

---

## F0.2 — Redesign Sidebar i nawigacji

**Problem:** Obecna nawigacja to prawdopodobnie standardowy sidebar — FTR ma mobilny look, ty musisz mieć premium feel.

**Plik:** `src/components/layout/Sidebar.tsx`, `src/components/layout/MainLayout.tsx`

### F0.2.1 — Bottom Navigation Bar (mobile-first)
- Zamień sidebar na bottom nav bar (jak w mobilnych appach)
- 5 ikon na dole: Mapa, Konwoje, Trasy, Znajomi, Profil
- Aktywna ikona: animacja scale + kolor highlight
- Tooltip przy długim przytrzymaniu (nazwa sekcji)
- Glassmorphism effect: `backdrop-blur-md bg-black/60 border border-white/10`

### F0.2.2 — Side Drawer dla dodatkowych opcji
- Feed, Stacje Paliw, Ustawienia → wysuwany drawer z lewej
- `AnimatePresence` + slide in/out

### F0.2.3 — Header redesign
- Logo + nazwa aplikacji z gradientem (nie "DriveApp" — przemyśl branding)
- Ikona powiadomień z badge licznika
- Avatar użytkownika z online indicator (zielona kropka)

---

## F0.3 — Design System i Typografia

**Pliki:** `src/app/globals.css`, `tailwind.config`

### F0.3.1 — Color Palette
Zdefiniuj CSS variables dla spójnego designu:
```css
--color-primary: #FF4B00;        /* pomarańczowo-czerwony — motoryzacja */
--color-primary-glow: #FF4B0033; /* glow wersja */
--color-surface: #0F0F0F;        /* tło kart */
--color-surface-2: #1A1A1A;      /* tło drugiego poziomu */
--color-border: #2A2A2A;         /* obramowania */
--color-text: #F5F5F5;
--color-text-muted: #888888;
--color-success: #00C851;
--color-warning: #FF8C00;
--color-danger: #FF3B30;
```

### F0.3.2 — Font upgrade
- Zainstaluj `Geist` (już masz) — użyj wariantu Variable dla płynnych wagach
- Dla liczb (prędkość, odległość) użyj czcionki monospace z tabular-nums

### F0.3.3 — Spójny system spacing
- Zdefiniuj scale: 4, 8, 12, 16, 24, 32, 48, 64px
- Użyj konsekwentnie w komponentach

---

## F0.4 — Onboarding Flow (KRYTYCZNE — FTR tego nie ma)

**Nowe pliki:**
```
src/components/onboarding/OnboardingOverlay.tsx
src/components/onboarding/OnboardingStep.tsx
src/app/api/users/me/onboarding/route.ts
```
**Schemat DB:** Dodaj pole `onboardingCompleted: Boolean @default(false)` do modelu `User`

### Kroki onboardingu (max 5 ekranów):
1. **Witaj w [NazwaApki]** — animowany splash z ikoną, krótki claim (3 sekundy lub skip)
2. **Twój profil** — imię, avatar (opcjonalne), co prowadzisz (lista marek)
3. **Uprawnienia lokalizacji** — wyjaśnienie po ludzku dlaczego, przycisk "Zezwól"
4. **Odkryj funkcje** — slider 3 kart: Mapa żywa | Konwoje | Trasy (swipeable)
5. **Gotowy!** — CTA "Zacznij eksplorować" → przejście na mapę

**UX detale:**
- Progress dots na dole (••○○○)
- Przycisk "Pomiń" zawsze widoczny
- Animacje między krokami: horizontal slide
- Dane z onboardingu zapisywane do DB

---

## F0.5 — Loading States i Skeleton UI

**Problem:** Puste stany podczas ładowania są niepolished.

**Do stworzenia:** `src/components/ui/Skeleton.tsx`
```tsx
// Skeleton block z shimmer animacją
<Skeleton className="h-4 w-3/4" />
<Skeleton className="h-32 w-full rounded-xl" />
```

Skeleton screens zamiast spinnerów dla:
- Lista tras (RoutePanel)
- Social Feed (SocialFeed)
- Lista znajomych (FriendsList)
- Dashboard stats (HomeScreen)

---

## F0.6 — PWA Improvements

**Plik:** `public/manifest.json`, `src/app/layout.tsx`

### F0.6.1 — Service Worker (offline shell)
```
public/sw.js
```
- Cache shell aplikacji (JS, CSS, ikony)
- Offline fallback page: "Brak połączenia — mapa offline niedostępna"
- Cache ostatnich spotów i tras (10 MB limit)

### F0.6.2 — Install Prompt
```
src/components/ui/InstallPWABanner.tsx
```
- Pojawia się po 30s użytkowania
- "Dodaj do ekranu głównego dla lepszego doświadczenia"
- Zapamiętuje odrzucenie w localStorage

### F0.6.3 — Manifest update
- Dodaj `screenshots` dla lepszego install UI
- Ustaw `display: standalone`
- Dodaj ikony 192x192 i 512x512

---

---

# FAZA 1 — GAMIFIKACJA (Największa Przewaga nad FTR)
### Czas: ~3 tygodnie | Priorytet: WYSOKI

*FTR nie ma gamifikacji. To twój największy wyróżnik i mechanizm retencji.*

---

## F1.1 — System XP i Rang

**Nowe modele DB (schema.prisma):**
```prisma
model UserXP {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  total     Int      @default(0)
  level     Int      @default(1)
  updatedAt DateTime @updatedAt
}

model XPEvent {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      XPEventType
  amount    Int
  meta      Json?    // {routeId, reportId, ...}
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
}

enum XPEventType {
  TRIP_COMPLETED
  ROUTE_CREATED
  ROUTE_DRIVEN
  REPORT_CONFIRMED
  SPOT_CREATED
  CONVOY_JOINED
  FRIEND_ADDED
  POST_LIKED
  STREAK_BONUS
  ACHIEVEMENT_UNLOCKED
}
```

**Tabela XP za aktywności:**
| Aktywność | XP |
|---|---|
| Ukończenie trasy | 50 XP |
| Dodanie raportu (potwierdzony) | 25 XP |
| Stworzenie trasy publicznej | 100 XP |
| Dołączenie do konwoju | 20 XP |
| Dodanie spotu | 30 XP |
| Pobicie własnego rekordu na trasie | 75 XP |
| Post polubiony 10x | 40 XP |
| Streak 7 dni aktywności | 200 XP |

**System rang (10 poziomów):**
| Poziom | Nazwa | XP wymagane |
|---|---|---|
| 1 | Debiutant | 0 |
| 2 | Kierowca | 500 |
| 3 | Entuzjasta | 1 500 |
| 4 | Weteran Dróg | 3 500 |
| 5 | Asfalciarz | 7 000 |
| 6 | Drift King | 13 000 |
| 7 | Kanionowy Lis | 22 000 |
| 8 | Legenda Szos | 35 000 |
| 9 | Mistrzowska Klasa | 55 000 |
| 10 | Road God | 100 000 |

**Pliki do stworzenia:**
```
src/lib/xp.ts                          # logika przyznawania XP
src/app/api/xp/route.ts                # GET historia XP
src/components/profile/XPBar.tsx       # Pasek XP z animacją fill
src/components/profile/LevelBadge.tsx  # Badge rangi
```

**XP Bar animation:** Framer Motion `animate={{ width: `${progress}%` }}` z duration 1.5s ease-out

---

## F1.2 — System Odznak (Achievements)

**Nowy model DB:**
```prisma
model Achievement {
  id          String   @id @default(uuid())
  key         String   @unique      // np. "first_convoy"
  name        String
  description String
  iconUrl     String
  xpReward    Int      @default(0)
  rarity      AchievementRarity @default(COMMON)
}

model UserAchievement {
  id            String      @id @default(uuid())
  userId        String
  achievementId String
  unlockedAt    DateTime    @default(now())
  achievement   Achievement @relation(fields: [achievementId], references: [id])
  user          User        @relation(fields: [userId], references: [id])

  @@unique([userId, achievementId])
}

enum AchievementRarity {
  COMMON
  RARE
  EPIC
  LEGENDARY
}
```

**Lista odznak (minimum 30):**

*Pierwsze kroki:*
- 🚗 Pierwsze koła — pierwsza trasa ukończona
- 👥 Nie jeżdżę sam — dołącz do konwoju
- 📍 Odkrywca — dodaj pierwszy spot
- 🔦 Strażnik Dróg — pierwsze zgłoszenie drogowe
- ⛽ Cenowy Szpieg — dodaj ceny paliw na stacji

*Trasy:*
- 🏔️ Górski Duch — jedź trasą z ponad 500m przewyższenia
- 🌅 Złota Godzina — jedź między 6:00-7:00
- 🌙 Nocny Maratończyk — jedź po 23:00
- 🔁 Stały Bywalec — pokonaj tę samą trasę 5 razy
- 🏆 Rekordzista — pobij rekord trasy

*Społeczność:*
- 🤝 Pierwszy Znajomy — dodaj kogoś do znajomych
- 💬 Gadatliwy — napisz 50 wiadomości w konwojach
- ❤️ Lubiany — otrzymaj 10 lajków na postach
- 📸 Fotograf Dróg — dodaj zdjęcie do 5 spotów
- 👑 Lider Konwoju — stwórz 3 konwoje

*Specjalne:*
- 🌟 Mystery Driver — ukończ 3 Mystery Drives
- ⚡ Speed Demon — jedź 200+ km/h (na torze! - disclaimer)
- 🗺️ Kartograf — stwórz 10 publicznych tras
- 🎵 Muzyczny Kierowca — jedź z Spotify przez 5 godzin
- 🔥 Płomień — 30-dniowy streak aktywności

**Achievement unlock animation:**
- Pełnoekranowy moment "unlock" (jak PlayStation trophy)
- Ciemne tło + ikona odznaki wjeżdża od dołu + confetti
- Dźwięk (opcjonalny)
- Komponent: `src/components/gamification/AchievementUnlock.tsx`

---

## F1.3 — Streak System (retencja)

**Nowy model DB:**
```prisma
model UserStreak {
  id            String   @id @default(uuid())
  userId        String   @unique
  currentStreak Int      @default(0)
  longestStreak Int      @default(0)
  lastActiveDate DateTime?
  user          User     @relation(fields: [userId], references: [id])
}
```

**Logika:** Jeśli user był aktywny dzisiaj (jakakolwiek akcja) → streak++. Brak aktywności przez 24h → reset do 0.

**UI:** `src/components/gamification/StreakWidget.tsx`
- Płomień ikona z liczbą dni
- Na Dashboard: widoczny streak + "Aktywny dziś ✓"
- Jeśli streak > 7: pulsujący złoty efekt

---

## F1.4 — Globalny Leaderboard

**Nowy API endpoint:** `src/app/api/leaderboard/route.ts`

**Kategorie:**
1. Łączny XP (ranking globalny)
2. Łączny dystans tego miesiąca
3. Liczba potwierdzonych raportów
4. Liczba ukończonych tras

**UI:** `src/components/gamification/Leaderboard.tsx`
- Top 10 z avatarami i rangami
- Twoja pozycja zawsze widoczna (podświetlona)
- Filtry: Globalnie / Znajomi / Ten miesiąc

---

---

# FAZA 2 — NOWE FUNKCJE (Czego FTR nie ma)
### Czas: ~3 tygodnie | Priorytet: WYSOKI

---

## F2.1 — Share Cards po Jeździe (Strava-Effect)

*To jest twój viral growth mechanism. Każda ukończona podróż może wygenerować kartę do udostępnienia.*

**Jak to działa:**
1. User kończy Trip Recording
2. `TripSummaryModal` pokazuje statystyki
3. Nowy przycisk "Udostępnij" generuje kartę PNG
4. User udostępnia na IG Stories, FB, Twitter

**Implementacja:**
```
npm install html2canvas
```

**Nowy komponent:** `src/components/trips/TripShareCard.tsx`

**Design karty (1080x1920 format stories):**
```
┌─────────────────────────────┐
│  [LOGO APLIKACJI]           │
│                             │
│  ████████████████████████   │
│  Mapa trasy (screenshot     │
│  z Mapbox Static API)       │
│  ████████████████████████   │
│                             │
│  ┌──────────────────────┐   │
│  │  🛣️  142.3 km         │   │
│  │  ⏱️  2h 14min         │   │
│  │  🚀  187 km/h (max)  │   │
│  │  📊  94 km/h (avg)   │   │
│  └──────────────────────┘   │
│                             │
│  "Trasa: Serpentyny Tatry"  │
│  @username • 13.05.2026     │
│                             │
│  [QR CODE do aplikacji]     │
└─────────────────────────────┘
```

**Mapbox Static API** — wygeneruj miniaturę trasy jako obraz:
```
src/app/api/trips/[id]/share-image/route.ts
```

**UI w TripSummaryModal:** Nowy tab "Udostępnij" z podglądem karty i przyciskami platform.

---

## F2.2 — System Eventów i Meetupów

*FTR nie ma eventów. To ogromna luka — society pasjonatów aut żyje eventami.*

**Nowe modele DB:**
```prisma
model Event {
  id          String      @id @default(uuid())
  title       String
  description String
  type        EventType
  date        DateTime
  endDate     DateTime?
  latitude    Float
  longitude   Float
  address     String
  maxAttendees Int?
  imageData   String?     // base64 lub URL
  createdById String
  createdBy   User        @relation(fields: [createdById], references: [id])
  attendees   EventAttendee[]
  createdAt   DateTime    @default(now())
  isPublic    Boolean     @default(true)
  route       Route?      @relation(fields: [routeId], references: [id])
  routeId     String?

  @@index([date, latitude, longitude])
}

model EventAttendee {
  id        String   @id @default(uuid())
  eventId   String
  userId    String
  status    AttendeeStatus @default(GOING)
  event     Event    @relation(fields: [eventId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())

  @@unique([eventId, userId])
}

enum EventType {
  MEETUP         // Spotkanie motoryzacyjne
  TRACK_DAY      // Dzień na torze
  CONVOY         // Zorganizowany konwój
  CRUISE         // Przejazd ulicami
  CAR_SHOW       // Wystawa aut
  OTHER
}

enum AttendeeStatus {
  GOING
  MAYBE
  NOT_GOING
}
```

**API Routes:**
```
src/app/api/events/route.ts                 # GET list, POST create
src/app/api/events/[id]/route.ts            # GET, PATCH, DELETE
src/app/api/events/[id]/attend/route.ts     # POST/DELETE attend
src/app/api/events/[id]/attendees/route.ts  # GET attendees list
```

**Komponenty:**
```
src/components/events/EventPanel.tsx         # Lista eventów
src/components/events/CreateEventModal.tsx   # Tworzenie eventu
src/components/events/EventCard.tsx          # Karta eventu
src/components/events/EventMapMarker.tsx     # Marker na mapie
```

**Mapa:** Eventy jako specjalne markery na mapie (kalendarzowa ikona) — klik otwiera kartę eventu.

---

## F2.3 — System Klubów / Grup

*Buduje społeczność i retencję na poziomie grupowym.*

**Nowe modele DB:**
```prisma
model Club {
  id          String       @id @default(uuid())
  name        String
  description String
  logoData    String?
  coverData   String?
  type        ClubType
  isPublic    Boolean      @default(true)
  ownerId     String
  owner       User         @relation(fields: [ownerId], references: [id])
  members     ClubMember[]
  routes      Route[]      // trasy przypisane do klubu
  createdAt   DateTime     @default(now())

  @@index([type, isPublic])
}

model ClubMember {
  id       String     @id @default(uuid())
  clubId   String
  userId   String
  role     ClubRole   @default(MEMBER)
  joinedAt DateTime   @default(now())
  club     Club       @relation(fields: [clubId], references: [id])
  user     User       @relation(fields: [userId], references: [id])

  @@unique([clubId, userId])
}

enum ClubType {
  MAKE        // Np. "BMW Owners Poland"
  REGIONAL    // Np. "Małopolska Car Crew"
  STYLE       // Np. "JDM Polska"
  TRACK       // Tor Poznań Members
  OTHER
}

enum ClubRole {
  OWNER
  ADMIN
  MEMBER
}
```

**Funkcje klubu:**
- Prywatne trasy tylko dla członków
- Klub ma własny Feed (posty)
- Klub może organizować Eventy
- Tabela wyników (leaderboard) w ramach klubu
- Zaproszenia przez link lub kod
- Liczba członków widoczna publicznie

---

## F2.4 — Rozszerzone Profile Aut (Garaż 2.0)

*FTR ma "garaż" ale jest ledwo szkielet. Twój Garaż 2.0 musi być kompletny.*

**Nowy model DB:**
```prisma
model Vehicle {
  id           String    @id @default(uuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id])
  make         String    // BMW
  model        String    // M3
  year         Int       // 2022
  color        String?
  photos       String[]  // array URL/base64
  mods         String?   // opis modyfikacji (tekstowy)
  horsepower   Int?
  torque       Int?
  engine       String?   // "3.0 B58"
  isActive     Boolean   @default(true) // aktywny (wyświetlany na mapie)
  createdAt    DateTime  @default(now())

  @@index([userId])
}
```

**Komponent:** `src/components/garage/GaragePanel.tsx`
- Karuzela aut z dużymi zdjęciami
- Dane techniczne na kliknięcie
- Przycisk "Ustaw aktywne" — to auto pojawia się przy markerze na mapie
- Formularz dodawania/edycji auta
- Lista popularnych marek z ikonami (masz już `/public/brands/`)

**Widok w profilu publicznym:** Kafelki aut z make/model/rok — klikalny, pokazuje szczegóły + foto.

---

## F2.5 — Kurowane Trasy Tematyczne (Admin Panel)

*To odróżnia cię od Waze — jesteś przewodnikiem, nie tylko narzędziem.*

**Nowy model DB:**
```prisma
model CuratedRoute {
  id          String   @id @default(uuid())
  title       String
  description String
  category    CuratedCategory
  difficulty  Int      @default(1)  // 1-5
  scenery     Int      @default(1)  // 1-5 (piękno krajobrazu)
  distance    Float                  // km
  region      String                 // "Tatry", "Bieszczady", etc.
  waypoints   Json                   // tablica [lat, lng, name]
  coverImage  String?
  tags        String[]
  routeId     String?
  route       Route?   @relation(fields: [routeId], references: [id])
  createdAt   DateTime @default(now())
  isPublished Boolean  @default(false)

  @@index([category, isPublished])
}

enum CuratedCategory {
  MOUNTAIN         // Górska przygoda
  COASTAL          // Nadmorska trasa
  FOREST           // Przez las
  CITY             // Miejska
  HISTORIC         // Zabytkowa
  RACETRACK        // Tor
  SCENIC           // Widokowa
}
```

**Uruchom z minimum 20 tras przy starcie (dodasz ręcznie przez seed lub panel admina).**

**Przykłady:**
- "Serpentyny Zakopianki" (Tatry, 45km, trudność 3/5, sceneria 5/5)
- "Pętla Bieszczadzka" (Bieszczady, 120km, trudność 2/5, sceneria 5/5)
- "Droga przez Pieniny" (50km, trudność 3/5)
- "Szlak Sudeckich Przełęczy" (Sudety, 80km)
- "Trasy Asfaltowe Mazur" (80km, nizinne ale krajobrazowe)

**UI:** Sekcja "Odkryj" w RoutePanel — grid kart z dużymi zdjęciami, filtr po kategorii.

---

## F2.6 — Live Weather Overlay na Mapie

*Masz już weather API — teraz pokaż to na mapie.*

**Plik:** `src/hooks/useWeather.ts` → rozszerz o precipitation data

**Mapbox Weather Layer:**
- Dodaj tile layer z OpenWeatherMap lub Open-Meteo
- Overlay: deszcz, mgła, śnieg na mapie w czasie rzeczywistym
- Toggle w ustawieniach warstw mapy

**Alert Pogodowy:**
- Jeśli jedzie konwój i wykryto deszcz na trasie → toast warning
- "⛈️ Deszcz na trasie za 15 minut"

---

---

# FAZA 3 — ULEPSZENIA ISTNIEJĄCYCH FUNKCJI
### Czas: ~2 tygodnie | Priorytet: ŚREDNI-WYSOKI

---

## F3.1 — Convoy 2.0 (Ulepsz to co masz)

**Brakujące funkcje vs FTR:**

### F3.1.1 — Convoy Live ETA
```
src/components/convoy/ConvoyPanel.tsx
```
- Dla każdego członka: "Przybędzie za ~8 min" (na podstawie lokalizacji + cel konwoju)
- Mapbox Directions API do obliczenia ETA
- Aktualizuje się co 30s

### F3.1.2 — Convoy Route Sharing
- Leader konwoju planuje trasę → automatycznie udostępnia wszystkim
- Każdy widzi tę samą nawigację turn-by-turn
- Jeśli ktoś zbacza → alert "Tomek zjechał z trasy!"

### F3.1.3 — Convoy Stats po zakończeniu
- Po zakończeniu konwoju: podsumowanie grupowe
- Łączny dystans, czas, kto był najszybszy, mapa trasy
- Option "Zapisz trasę konwoju jako Route"

### F3.1.4 — Reakcje w Chacie (nie tylko tekst)
- Szybkie emoji-reakcje na wiadomości: 👍 😂 🔥 ⚠️
- Reakcja wyświetla się pod wiadomością z licznikiem

---

## F3.2 — Reports 2.0 — Zdjęcia i Weryfikacja

**Schema:**
```prisma
// Dodaj do modelu Report:
photoData    String?   // base64 lub URL
accuracy     Float?    // GPS accuracy w metrach
```

**Nowe funkcje:**
- Dodawanie zdjęcia do zgłoszenia (camera API)
- AI moderacja zdjęć (opcjonalnie — Cloudinary lub własne)
- Mapa historyczna: "Ostatnie 24h w tym rejonie" — heatmapa aktywności policji
- Powiadomienie push gdy twoje zgłoszenie zostało potwierdzone przez 3 osoby (+25 XP)

---

## F3.3 — Social Feed 2.0

**Brakujące feature:**

### F3.3.1 — Stories (24h znikające)
```prisma
model Story {
  id        String   @id @default(uuid())
  userId    String
  imageData String
  caption   String?
  views     Int      @default(0)
  createdAt DateTime @default(now())
  expiresAt DateTime

  @@index([expiresAt])
}
```
- Okrąg avatara z gradientem = ma aktywną story
- Swipe do góry przez stories znajomych
- Auto-znikają po 24h

### F3.3.2 — Post z Trasą
- Możliwość dołączenia trasy do posta
- Post pokazuje mini-mapę trasy + statystyki

### F3.3.3 — Hashtagi i Discover
- `#bieszczady #bmw #serpentyny` w postach
- Strona Discover: grid postów publicznych posortowany po popularności

---

## F3.4 — Spots 2.0

**Brakujące:**
- Zdjęcia spotu (gallery)
- Kategorie spotu: 🏎️ Meetup | 📸 Foto Spot | 🍕 Postój | ⛽ Przerwa | 🏁 Start/Meta
- Ocena spotu (1-5 gwiazdek po wizycie)
- Historia visitów (kto i kiedy był)
- Spot: "Stały" vs "Jednorazowy" (current "expires after 2h")
- Filtr spotów na mapie po kategorii

---

## F3.5 — Trip Recording 2.0

**Brakujące:**

### F3.5.1 — Trip Timeline
- Trasa narysowana na mapie (GPS track recording co 5s)
- Nowy model DB:
```prisma
model TripTrack {
  id        String   @id @default(uuid())
  tripId    String
  points    Json     // [{lat, lng, speed, timestamp}[]]
  trip      Trip     @relation(fields: [tripId], references: [id])
}
```

### F3.5.2 — Trip vs Best Time
- Jeśli jedziesz na trasie która istnieje w bazie → live comparison z rekordem
- "Jesteś 1:23 szybciej od swojego najlepszego czasu!" w HUD

### F3.5.3 — Trip Photo Stops
- Manualne zaznaczenie punktu na mapie podczas jazdy ("zrobiłem zdjęcie tutaj")
- Po zakończeniu: galeria z lokalizacjami

---

## F3.6 — Nawigacja HUD Redesign

**Plik:** `src/components/map/NavigationHUD.tsx`

**Ulepszenia:**
- Większa ikona manewru (ikona skrętu) — czytelna jednym rzutem oka
- Speed meter (licznik prędkości) — animowany, zmieniający kolor na czerwono przy >limit
- ETA do celu + pozostały dystans
- Aktualny czas + godzina dotarcia
- "Night mode" — automatyczne przyciemnienie HUD nocą

---

---

# FAZA 4 — TECHNIKALIA I JAKOŚĆ
### Czas: ~2 tygodnie | Priorytet: ŚREDNI

---

## F4.1 — Push Notifications (PWA)

**Instalacja:**
```bash
npm install web-push
```

**Implementacja:**
```
src/app/api/notifications/subscribe/route.ts
src/app/api/notifications/send/route.ts
src/lib/push.ts
```

**Kiedy wysyłać push:**
- Nowe zaproszenie do konwoju
- Znajomy w pobliżu (<2km)
- Raport potwierdzony przez użytkownika
- Nowe osiągnięcie odblokowane
- Ktoś polubił Twój post

**Service Worker:** Rozszerz `public/sw.js` o obsługę push events.

---

## F4.2 — Offline Mode

**Strategia:** Cache-first dla statycznych danych, network-first dla live.

**Co cachować offline:**
- Ostatnio widziane spoty (do 100)
- Zapisane trasy (do 10)
- Profil użytkownika
- Lista znajomych

**Offline indicator:**
```
src/components/ui/OfflineBanner.tsx
```
- Pasek na górze "📵 Tryb offline — dane mogą być nieaktualne"

---

## F4.3 — Wyszukiwarka Globalna

**Problem:** Żeby znaleźć trasę/spot/usera trzeba wiedzieć gdzie szukać.

**Nowy komponent:** `src/components/search/GlobalSearch.tsx`
- Skrót klawiszowy: `Cmd+K` / `Ctrl+K`
- Szuka jednocześnie: trasy, spoty, znajomi, eventy
- Wyniki z ikonami kategorii
- Historia ostatnich wyszukiwań (localStorage)

---

## F4.4 — Performance Monitoring

**Dodaj:**
```bash
npm install @vercel/analytics @vercel/speed-insights
```

**W layout.tsx:**
```tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
```

**Custom events:**
```tsx
import { track } from '@vercel/analytics'
track('convoy_created', { memberCount: 5 })
track('route_shared', { routeId: 'xxx' })
track('achievement_unlocked', { key: 'first_convoy' })
```

---

## F4.5 — Error Handling i Error Boundaries

**Nowe pliki:**
```
src/app/error.tsx         # Global error page
src/app/not-found.tsx     # 404 page
src/components/ui/ErrorBoundary.tsx
```

**Design:** Strona błędu z ikoną auta (awaria?) i przyciskiem "Odśwież" — nie może być brzydki default Next.js.

---

---

# FAZA 5 — MONETYZACJA I GROWTH
### Czas: ~2 tygodnie | Priorytet: ŚREDNI

---

## F5.1 — Model Freemium (Transparentny)

**Nowy model DB:**
```prisma
model Subscription {
  id        String   @id @default(uuid())
  userId    String   @unique
  plan      Plan     @default(FREE)
  expiresAt DateTime?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}

enum Plan {
  FREE
  PRO
  TEAM
}
```

**Tabela planów (widoczna na stronie głównej i w ustawieniach):**

| Feature | 🆓 Darmowy | ⭐ Pro (9,99 zł/mies) | 👑 Team (24,99 zł/mies) |
|---|---|---|---|
| Mapa z live tracking | ✅ | ✅ | ✅ |
| Konwoje (do 5 osób) | ✅ | ✅ | ✅ |
| Konwoje (do 20 osób) | ❌ | ✅ | ✅ |
| Trasy publiczne (do 5) | ✅ | ✅ | ✅ |
| Trasy publiczne (nieograniczone) | ❌ | ✅ | ✅ |
| Share Cards po jeździe | ❌ | ✅ | ✅ |
| Offline mapy (top 3 regiony) | ❌ | ✅ | ✅ |
| Kurowane trasy tematyczne | ✅ | ✅ | ✅ |
| Statystyki zaawansowane | ❌ | ✅ | ✅ |
| Eventy (uczestnictwo) | ✅ | ✅ | ✅ |
| Eventy (tworzenie) | ❌ | ✅ | ✅ |
| Klub (tworzenie) | ❌ | ❌ | ✅ |
| Priorytet supportu | ❌ | ❌ | ✅ |
| Brak reklam | ❌ | ✅ | ✅ |

**Ważne:** NIE blokuj podstawowych funkcji. Blokuj rozszerzenia.

---

## F5.2 — Strona Landingowa

**Stwórz dedykowany landing:** `src/app/(marketing)/page.tsx`

**Sekcje:**
1. **Hero** — Animowane "dymne" tło mapy + claim + CTA "Dołącz bezpłatnie"
2. **Features** — 3 kolumny: Konwoje | Trasy | Społeczność
3. **Screenshots** — Mockupy aplikacji (iPhone + desktop)
4. **Tabela Cenowa** — Przejrzyste Darmowy / Pro / Team
5. **Social Proof** — "Dołącz do X kierowców" (live licznik)
6. **Footer** — Linki, contact, social media

---

## F5.3 — Partnerstwa (Long Term)

**Możliwe partnerstwa (do negocjacji):**
- **Stacje paliw** — wyróżnione stacje za abonament (banner "Partner")
- **Warsztaty i detailing** — punkty na mapie za miesięczną opłatę
- **Ubezpieczenia** — linki afiliacyjne (Link4, Mubi.com)
- **Eventy motoryzacyjne** — oficjalni partnerzy eventów (Targi, Tor Poznań)
- **Sklepy motoryzacyjne** — baner w sekcji garażu

---

---

# HARMONOGRAM (TIMELINE)

```
Tydzień 1-2:   FAZA 0 — Animacje, Onboarding, Design System, PWA
Tydzień 3-4:   FAZA 1A — XP + Rangi + Odznaki
Tydzień 5:     FAZA 1B — Streak + Leaderboard
Tydzień 6-7:   FAZA 2A — Share Cards + System Eventów
Tydzień 8-9:   FAZA 2B — Kluby + Garaż 2.0 + Kurowane Trasy
Tydzień 10:    FAZA 2C — Weather Overlay
Tydzień 11-12: FAZA 3 — Convoy 2.0, Reports 2.0, Social 2.0, Spots 2.0
Tydzień 13-14: FAZA 4 — Push Notifications, Offline, Global Search, Error Handling
Tydzień 15-16: FAZA 5 — Freemium, Landing Page, Analytics
```

---

# PRIORYTETY (Jeśli ograniczony czas)

**TOP 5 rzeczy które zrobisz najpierw — max efekt:**

1. **Animacje (Framer Motion)** — natychmiastowy wzrost postrzeganej jakości
2. **Onboarding Flow** — FTR go nie ma; retencja +40% przy dobrym onboardingu
3. **Gamifikacja XP + Odznaki** — największy mechanizm retencji, FTR nie ma
4. **Share Cards** — viral growth, każda karta to reklama
5. **Bottom Navigation** — mobilny feel natychmiast

---

# CZEGO NIE ROBIC (Pułapki)

- ❌ Nie przepisuj istniejącego kodu który działa
- ❌ Nie dodawaj wszystkiego naraz — jedna faza na raz
- ❌ Nie kopiuj FTR — bądź lepszy, nie taki sam
- ❌ Nie zapomnij o testach przy nowych modelach DB
- ❌ Nie wdrażaj na prod bez sprawdzenia migracji Prisma
- ❌ Nie blokuj core funkcji w Freemium za mocno — frustrowani userzy odchodzą

---

*Plan stworzony: 13 maja 2026 | Na podstawie pełnej analizy kodu drive-app i audytu Feel The Road*
*Powiązany audyt: `AUDYT_FeelTheRoad.md` (ten sam katalog)*
