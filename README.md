# DriveApp

Aplikacja webowa dla kierowców z interaktywną mapą świata, systemem konwojów, zgłoszeniami drogowymi i stacjami paliw.

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **State Management**: Zustand
- **Mapa**: Mapbox GL JS + react-map-gl
- **Backend**: Next.js API Routes
- **Baza danych**: PostgreSQL + Prisma ORM 7
- **Autoryzacja**: NextAuth.js v5
- **Real-time**: Socket.io

## Wymagania

- Node.js 18+
- PostgreSQL
- Konto Mapbox (darmowy token)

## Instalacja

```bash
# 1. Zainstaluj zależności
npm install

# 2. Skopiuj zmienne środowiskowe
cp .env.example .env.local

# 3. Uzupełnij .env.local:
#    - DATABASE_URL - connection string do PostgreSQL
#    - NEXTAUTH_SECRET - wygeneruj: openssl rand -base64 32
#    - NEXT_PUBLIC_MAPBOX_TOKEN - token z mapbox.com

# 4. Wygeneruj klienta Prisma
npx prisma generate

# 5. Uruchom migracje bazy danych
npx prisma migrate dev --name init

# 6. Uruchom serwer deweloperski
npm run dev
```

Aplikacja będzie dostępna pod `http://localhost:3000`.

## Struktura projektu

```
src/
├── app/                  # Next.js App Router
│   ├── (auth)/           # Strony logowania/rejestracji
│   ├── api/              # API Routes
│   │   ├── auth/         # Autoryzacja (NextAuth + rejestracja)
│   │   ├── convoy/       # Konwoje
│   │   ├── friends/      # Znajomi
│   │   ├── fuel/         # Stacje paliw
│   │   ├── reports/      # Zgłoszenia drogowe
│   │   └── routes/       # Trasy
│   ├── dashboard/        # Główna strona z mapą
│   └── settings/         # Ustawienia
├── components/
│   ├── auth/             # Komponenty autoryzacji
│   ├── convoy/           # System konwojów
│   ├── friends/          # System znajomych
│   ├── fuel/             # Stacje paliw
│   ├── layout/           # Layout (Sidebar, Header)
│   ├── map/              # Mapa i markery
│   ├── reports/          # Zgłoszenia drogowe
│   ├── routes/           # Trasy
│   ├── settings/         # Panel ustawień
│   └── ui/               # Reusable UI components
├── hooks/                # Custom React hooks
├── lib/                  # Konfiguracja (auth, prisma, socket)
├── stores/               # Zustand stores
└── types/                # TypeScript types
```

## Funkcjonalności

### Mapa
- Interaktywna mapa Mapbox z ciemnym motywem
- Śledzenie lokalizacji użytkownika w czasie rzeczywistym
- Warstwy: zgłoszenia, stacje paliw, członkowie konwoju

### Autoryzacja
- Rejestracja i logowanie (email + hasło)
- Sesje JWT przez NextAuth.js
- Middleware chroniący strony

### Konwoje
- Tworzenie i dołączanie do konwojów
- Widoczność członków na mapie w real-time
- Role: właściciel i członek

### Zgłoszenia drogowe
- Typy: policja, kontrola prędkości, wypadek, przeszkoda, fotoradar
- Głosowanie (potwierdzanie/odrzucanie)
- Automatyczne wygasanie po 2 godzinach

### Stacje paliw
- Wyświetlanie na mapie
- Aktualizacja cen przez użytkowników
- Historia cen

### Znajomi
- Dodawanie przez email
- System zaproszeń (wyślij/akceptuj/odrzuć)
- Lista znajomych

### Interfejs
- Domyślny ciemny motyw
- Przełączanie jasny/ciemny
- Wybór koloru akcentu
- Responsywny design (mobile-first)

## Skrypty

```bash
npm run dev      # Serwer deweloperski
npm run build    # Build produkcyjny
npm run start    # Start produkcyjny
npm run lint     # Linting
```

## Zmienne środowiskowe

| Zmienna | Opis |
|---------|------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Klucz szyfrowania sesji |
| `NEXTAUTH_URL` | URL aplikacji |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox access token |
