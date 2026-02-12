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

4. Setze den Root-Ordner in Vercel auf `pinspector-next`

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

- `POST /api/scrape` - Pinterest Ideas URL scrapen
- `GET /api/interests` - Interests mit Pagination/Filter
- `DELETE /api/interests` - Interests löschen
- `POST /api/find-interests` - Neue Interests über Google finden
- `POST /api/export` - CSV Export

## License

MIT
