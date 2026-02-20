# Pinspector Next.js

Pinterest Ideas Analyzer - Neuimplementierung mit Next.js, Supabase und Tailwind CSS.

## Features

- **Search**: Pinterest Ideas URLs analysieren und Daten extrahieren
- **Interests**: Alle gespeicherten Interessen durchsuchen, filtern und exportieren
- **Find**: Neue Pinterest Interessen über Google-Suche entdecken

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS
- **Backend**: Next.js API Routes
- **Datenbank**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## Setup

### 1. Dependencies installieren

```bash
cd pinspector-next
npm install
```

### 2. Supabase Projekt erstellen

1. Gehe zu [supabase.com](https://supabase.com) und erstelle ein neues Projekt
2. Führe das SQL-Schema aus `supabase/migrations/001_initial_schema.sql` im SQL Editor aus

### 3. Umgebungsvariablen konfigurieren

Kopiere `.env.local.example` zu `.env.local` und fülle die Werte aus:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Für die "Find Interests" Funktion
RAPIDAPI_KEY=your-rapidapi-key
```

### 4. Entwicklungsserver starten

```bash
npm run dev
```

Die App läuft dann unter [http://localhost:3000](http://localhost:3000)

## Deployment auf Vercel

1. Pushe das Repository zu GitHub
2. Verbinde das Repository mit Vercel
3. Konfiguriere die Umgebungsvariablen in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RAPIDAPI_KEY` (optional)

## Projektstruktur

```
pinspector-next/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes
│   │   │   ├── export/        # CSV Export
│   │   │   ├── find-interests/# Google Search für neue Interests
│   │   │   ├── interests/     # CRUD für Interests
│   │   │   └── scrape/        # Pinterest Scraper
│   │   ├── find/              # Find Interests Page
│   │   ├── interests/         # Interests Browser Page
│   │   ├── search/            # Search Page
│   │   ├── layout.tsx         # Root Layout
│   │   └── page.tsx           # Landing Page
│   ├── components/            # React Components
│   │   └── Navigation.tsx
│   ├── lib/                   # Utilities
│   │   ├── pinterest-scraper.ts
│   │   └── supabase.ts
│   └── types/                 # TypeScript Types
│       └── database.ts
├── supabase/
│   └── migrations/            # SQL Migrations
└── public/                    # Static Assets
```

## Unterschiede zur alten Version

| Feature | Alt (Flask) | Neu (Next.js) |
|---------|-------------|---------------|
| Backend | Python/Flask | Next.js API Routes |
| Frontend | Jinja2 + jQuery | React + Tailwind |
| Datenbank | PostgreSQL (Hetzner) | Supabase |
| Tables | DataTables | Native React |
| Deployment | Gunicorn | Vercel |
| Keywords-Suche | Selenium (broken) | Entfernt |

## API Endpunkte

Die API ist in zwei Bereiche aufgeteilt:

### Externe Endpoints (`-live`)

Für externe Konsumenten. Kein Datenbank-Zugriff — scrapen und liefern immer frische Daten direkt von Pinterest/Google.

| Endpoint | Methode | Body | Beschreibung |
|----------|---------|------|-------------|
| `/api/scrape-live` | POST | `{ url, language? }` | Pinterest Ideas-Seite scrapen (Idea + Pins) |
| `/api/pins-live` | POST | `{ url, language? }` | Nur Pins einer Ideas-Seite scrapen |
| `/api/find-interests-live` | POST | `{ keyword, limit?, language? }` | Pinterest Ideas URLs via Google-Suche finden |
| `/api/find-or-scrape-live` | POST | `{ name?, url?, language? }` | Interest per Name oder URL finden und scrapen |

**Multi-Language Support:** Alle externen Endpoints unterstützen den `language` Parameter (`de`, `en`, `fr`, `es`, `it`, `pt`, `nl`). Sprache wird automatisch aus der URL erkannt, kann aber explizit überschrieben werden. Standard: `de`.

### Interne Endpoints

Für die interne App. Lesen und schreiben in die Datenbank.

| Endpoint | Methode | Beschreibung |
|----------|---------|-------------|
| `/api/scrape` | POST | Pinterest scrapen und in DB speichern |
| `/api/find-or-scrape` | POST | Erst DB durchsuchen, dann scrapen |
| `/api/find-interests` | POST | Google-Suche + DB-Duplikat-Check |
| `/api/discover-keywords` | POST | Keywords entdecken (Google + Scrape + DB) |
| `/api/interests` | GET | Interests mit Pagination/Filter |
| `/api/interests` | DELETE | Interests löschen |
| `/api/interests/{id}` | GET | Einzelnes Interest |
| `/api/interests/{id}/pins` | GET | Pins aus DB |
| `/api/interests/{id}/history` | GET | Suchvolumen-Verlauf |
| `/api/pins` | GET | Alle Pins mit Pagination/Filter |
| `/api/categories` | GET | Kategorien aus Breadcrumbs |
| `/api/export` | POST | CSV Export |

### AI Endpoints (kein DB-Zugriff)

| Endpoint | Methode | Beschreibung |
|----------|---------|-------------|
| `/api/analyze-content` | POST | Content-Strategie via OpenAI |
| `/api/cluster-keywords` | POST | Topical Map via OpenAI |
| `/api/discover-topics` | POST | Sub-Topics generieren via OpenAI |
| `/api/extract-keywords` | POST | Keywords aus Pin-Titeln via OpenAI |

## License

MIT
