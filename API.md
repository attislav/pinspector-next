# Pinspector API-Dokumentation

## Authentifizierung

**Keine Authentifizierung erforderlich.** Alle Endpoints sind offen zugaenglich -- es gibt keinen API-Token, kein JWT, keine API-Keys. Du brauchst nur die Base-URL deiner laufenden Instanz.

> **Voraussetzung:** Die App muss laufen (`npm run dev` oder deployed) und die Server-seitigen Env-Variablen (`DATABASE_URL`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `OPENAI_API_KEY`) muessen gesetzt sein. Diese werden intern genutzt, nicht vom Client uebergeben.

---

## Multi-Language Support

Die Such- und Scraping-Endpoints unterstuetzen einen optionalen `language`-Parameter, um Pinterest-Ideas in verschiedenen Sprachen/Maerkten zu finden.

| Code | Sprache | Pinterest-Domain | DataForSEO-Markt |
|------|---------|------------------|------------------|
| `de` | Deutsch (Default) | de.pinterest.com | Deutschland (2276) |
| `en` | Englisch | www.pinterest.com | USA (2840) |
| `fr` | Franzoesisch | fr.pinterest.com | Frankreich (2250) |
| `es` | Spanisch | es.pinterest.com | Spanien (2724) |
| `it` | Italienisch | it.pinterest.com | Italien (2380) |
| `pt` | Portugiesisch | br.pinterest.com | Brasilien (2076) |
| `nl` | Niederlaendisch | nl.pinterest.com | Niederlande (2528) |

**Betroffene Endpoints:** `/api/discover-keywords`, `/api/find-interests`, `/api/find-or-scrape`, `/api/scrape`, `/api/scrape-live`, `/api/find-or-scrape-live`, `/api/pins-live`

Wird kein `language` angegeben, wird automatisch `"de"` verwendet (Rueckwaertskompatibel).

Die verwendete Sprache wird im `language`-Feld des Idea-Objekts gespeichert und bei erneutem Scraping automatisch wiederverwendet.

```bash
# Deutsche Ergebnisse (Default)
curl -X POST "$BASE_URL/api/find-interests" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "wohnzimmer deko"}'

# Englische Ergebnisse
curl -X POST "$BASE_URL/api/find-interests" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "living room decor", "language": "en"}'

# Franzoesische Ergebnisse
curl -X POST "$BASE_URL/api/discover-keywords" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "décoration salon", "language": "fr"}'
```

---

## Schnellstart: Keyword-Recherche in 3 Schritten

```bash
BASE_URL="http://localhost:3000"
```

### Schritt 1: Keywords entdecken

```bash
curl -X POST "$BASE_URL/api/discover-keywords" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "meal prep",
    "limit": 10,
    "scrapeLimit": 5
  }'
```

### Schritt 2: Sub-Topics generieren (KI)

```bash
curl -X POST "$BASE_URL/api/discover-topics" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "meal prep"
  }'
```

### Schritt 3: Keywords clustern (Topical Map)

```bash
curl -X POST "$BASE_URL/api/cluster-keywords" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "meal prep",
    "ideas": [
      { "name": "meal prep for beginners", "searches": 45000 },
      { "name": "weekly meal prep ideas", "searches": 32000 }
    ],
    "keywords": [
      { "name": "meal prep containers", "count": 5, "source": "annotation" },
      { "name": "healthy meal prep", "count": 3, "source": "klp_pivot" }
    ]
  }'
```

---

## Alle Endpoints im Detail

### 1. POST /api/discover-keywords

Sucht via Google (DataForSEO) nach Pinterest-Ideas-URLs, scrapt sie und extrahiert Keywords.

**Request:**
```json
{
  "keyword": "home office einrichten",
  "limit": 10,
  "scrapeLimit": 5,
  "skipExisting": true,
  "language": "de"
}
```

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| keyword | string | ja | - | Suchbegriff |
| limit | number | nein | 10 | Anzahl URLs die gesucht werden |
| scrapeLimit | number | nein | 5 | Anzahl URLs die tatsaechlich gescrapt werden |
| skipExisting | boolean | nein | true | Bereits bekannte Ideas ueberspringen |
| language | string | nein | "de" | Sprache/Markt (de, en, fr, es, it, pt, nl) |

**Response:**
```json
{
  "success": true,
  "keyword": "home office einrichten",
  "urlsFound": 10,
  "urlsScraped": 5,
  "keywords": [
    { "name": "schreibtisch ideen", "count": 3, "source": "annotation" },
    { "name": "buero dekoration", "count": 2, "source": "klp_pivot" }
  ],
  "scrapedIdeas": [
    { "id": "abc123", "name": "home office ideen", "searches": 25000 }
  ]
}
```

**Timeout:** 60 Sekunden

---

### 2. POST /api/discover-topics

Generiert Sub-Topics zu einem Hauptthema per OpenAI.

**Request:**
```json
{
  "topic": "home office einrichten"
}
```

**Response:**
```json
{
  "success": true,
  "topic": "home office einrichten",
  "subTopics": [
    "ergonomischer Arbeitsplatz",
    "Beleuchtung im Home Office",
    "Kabelmanagement Ideen",
    "kleine Raeume nutzen"
  ]
}
```

---

### 3. POST /api/extract-keywords

Extrahiert Keywords aus Pin-Titeln per OpenAI.

**Request:**
```json
{
  "titles": [
    "15 geniale Meal Prep Ideen fuer die ganze Woche",
    "Meal Prep Anfaenger Guide: So sparst du Zeit",
    "Gesunde Meal Prep Rezepte unter 30 Minuten"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "keywords": ["meal prep ideen", "meal prep anfaenger", "gesunde rezepte"],
  "count": 3
}
```

---

### 4. POST /api/cluster-keywords

Erstellt eine Topical Map (Pillar-Struktur) aus Ideas und Keywords per OpenAI.

**Request:**
```json
{
  "topic": "meal prep",
  "ideas": [
    { "name": "meal prep for beginners", "searches": 45000 },
    { "name": "weekly meal prep ideas", "searches": 32000 }
  ],
  "keywords": [
    { "name": "meal prep containers", "count": 5, "source": "annotation" },
    { "name": "healthy meal prep", "count": 3, "source": "klp_pivot" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "topicalMap": {
    "summary": "Meal Prep ist ein breites Thema mit hohem Suchvolumen...",
    "pillars": [
      {
        "name": "Meal Prep Basics",
        "description": "Grundlagen fuer Einsteiger",
        "priority": "high",
        "keywords": ["meal prep anfaenger", "meal prep starten"]
      }
    ],
    "topRecommendation": "Starte mit dem Pillar 'Meal Prep Basics'..."
  }
}
```

---

### 5. POST /api/analyze-content

Analysiert Pin-Titel und gibt Content-Strategie-Empfehlungen.

**Request:**
```json
{
  "keyword": "meal prep",
  "titles": [
    "15 geniale Meal Prep Ideen",
    "Meal Prep Guide fuer Anfaenger",
    "Schnelle Meal Prep Rezepte"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "analysis": "Basierend auf den Top-Pins fuer 'meal prep'..."
}
```

---

### 6. POST /api/scrape

Scrapt eine einzelne Pinterest-Ideas-URL und speichert die Daten.

**Request:**
```json
{
  "url": "https://www.pinterest.com/ideas/meal-prep/123456/",
  "skipIfRecent": false,
  "language": "en"
}
```

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| url | string | ja | - | Pinterest-Ideas-URL |
| skipIfRecent | boolean | nein | false | Nicht erneut scrapen wenn kuerzlich gescrapt |
| language | string | nein | "de" | Sprache/Markt fuer Accept-Language Header |

**Response:**
```json
{
  "success": true,
  "idea": {
    "id": "123456",
    "name": "meal prep",
    "url": "https://www.pinterest.com/ideas/meal-prep/123456/",
    "searches": 45000,
    "last_update": "2025-01-15T10:30:00Z",
    "last_scrape": "2025-01-20T14:00:00Z",
    "related_interests": [
      { "name": "healthy recipes", "url": "/ideas/healthy-recipes/789/", "id": "789" }
    ],
    "top_annotations": "<span>meal prep containers</span>",
    "seo_breadcrumbs": ["Food", "Meal Planning"],
    "klp_pivots": [
      { "name": "meal prep ideas", "url": "/ideas/meal-prep-ideas/456/" }
    ],
    "language": "en"
  },
  "pins": [],
  "isNew": true,
  "isDuplicate": false
}
```

---

### 7. POST /api/find-or-scrape

Sucht eine Interest in der DB oder scrapt sie bei Bedarf.

**Request (nach Name):**
```json
{
  "name": "meal prep",
  "language": "de"
}
```

**Request (nach URL):**
```json
{
  "url": "https://www.pinterest.com/ideas/meal-prep/123456/",
  "language": "en"
}
```

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| name | string | nein* | - | Keyword-Name (*entweder name oder url) |
| url | string | nein* | - | Pinterest-Ideas-URL (*entweder name oder url) |
| language | string | nein | "de" | Sprache/Markt fuer Scraping und URL-Konstruktion |
```

**Response:**
```json
{
  "success": true,
  "idea": { "...": "idea object" },
  "source": "database",
  "searched": false
}
```

`source` kann sein: `"scraped"`, `"database"`, `"database_partial"`, `"scraped_redirect"`

---

### 8. POST /api/find-interests

Sucht via Google nach Pinterest-Ideas-URLs zu einem Keyword.

**Request:**
```json
{
  "keyword": "meal prep",
  "limit": 20,
  "includeExisting": false,
  "language": "en"
}
```

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| keyword | string | ja | - | Suchbegriff |
| limit | number | nein | 20 | Max. Anzahl URLs |
| includeExisting | boolean | nein | false | Bereits bekannte URLs mit zurueckgeben |
| language | string | nein | "de" | Sprache/Markt (de, en, fr, es, it, pt, nl) |

**Response:**
```json
{
  "urls": [
    {
      "url": "https://www.pinterest.com/ideas/meal-prep/123456/",
      "title": "Meal Prep Ideas",
      "breadcrumb": "Food > Meal Planning",
      "existing": false
    }
  ],
  "total": 15,
  "duplicates": [],
  "message": "15 neue URLs gefunden"
}
```

---

### 9. GET /api/interests

Liste aller gespeicherten Interests (paginiert, filterbar).

**Request:**
```bash
curl "$BASE_URL/api/interests?page=1&pageSize=30&search=meal&sortBy=searches&sortOrder=desc&minSearches=1000"
```

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| page | number | 1 | Seite |
| pageSize | number | 30 | Ergebnisse pro Seite |
| search | string | - | Name-Suche (ILIKE) |
| sortBy | string | last_scrape | name, searches, last_scrape, last_update |
| sortOrder | string | desc | asc, desc |
| minSearches | number | - | Minimum Suchvolumen |
| maxSearches | number | - | Maximum Suchvolumen |
| minWords | number | - | Min. Woerter im Namen |
| maxWords | number | - | Max. Woerter im Namen |
| mainCategory | string | - | Hauptkategorie |
| subCategory | string | - | Unterkategorie |

**Response:**
```json
{
  "data": [{ "...": "idea objects" }],
  "total": 150,
  "page": 1,
  "pageSize": 30,
  "totalPages": 5
}
```

---

### 10. GET /api/interests/[id]

Einzelne Interest mit allen Details.

```bash
curl "$BASE_URL/api/interests/123456"
```

---

### 11. DELETE /api/interests

Mehrere Interests loeschen.

**Request:**
```json
{
  "ids": ["123456", "789012"]
}
```

**Response:**
```json
{
  "success": true,
  "deleted": 2
}
```

---

### 12. GET /api/interests/[id]/pins

Pins einer bestimmten Interest.

```bash
curl "$BASE_URL/api/interests/123456/pins"
```

**Response:**
```json
{
  "pins": [
    {
      "id": "pin_abc",
      "title": "15 Meal Prep Ideen",
      "description": "Die besten Meal Prep Rezepte...",
      "image_url": "https://i.pinimg.com/...",
      "link": "https://example.com/meal-prep",
      "save_count": 5000,
      "repin_count": 3000,
      "annotations": ["meal prep", "healthy"],
      "position": 1
    }
  ]
}
```

---

### 13. GET /api/interests/[id]/history

Suchvolumen-Verlauf (monatliche Snapshots).

```bash
curl "$BASE_URL/api/interests/123456/history"
```

**Response:**
```json
[
  { "id": 1, "idea_id": "123456", "name": "meal prep", "searches": 45000, "scrape_date": "2025-01-01T00:00:00Z" },
  { "id": 2, "idea_id": "123456", "name": "meal prep", "searches": 48000, "scrape_date": "2025-02-01T00:00:00Z" }
]
```

---

### 14. GET /api/pins

Alle Pins (uebergreifend, paginiert, filterbar).

```bash
curl "$BASE_URL/api/pins?page=1&limit=50&search=meal&sortBy=save_count&sortOrder=desc&minSaves=100"
```

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|--------------|
| page | number | 1 | Seite |
| limit | number | 50 | Ergebnisse pro Seite |
| search | string | - | Suche in Titel/Beschreibung |
| ideaId | string | - | Filtern nach Idea |
| minSaves | number | - | Min. Saves |
| maxSaves | number | - | Max. Saves |
| hasArticle | boolean | - | Nur Pins mit Artikel-URL |
| sortBy | string | - | save_count, repin_count, comment_count, pin_created_at, title |
| sortOrder | string | - | asc, desc |

---

### 15. GET /api/categories

Kategorie-Hierarchie aller gespeicherten Ideas.

```bash
curl "$BASE_URL/api/categories"
```

**Response:**
```json
{
  "mainCategories": ["Food", "Home Decor", "Fashion"],
  "subCategories": {
    "Food": ["Meal Planning", "Recipes", "Baking"],
    "Home Decor": ["Living Room", "Bedroom"]
  }
}
```

---

### 16. POST /api/export

Ideas als CSV exportieren.

**Request:**
```json
{
  "ids": ["123456", "789012"]
}
```

oder mit Filtern:

```json
{
  "filters": {
    "search": "meal",
    "minSearches": 1000
  }
}
```

**Response:** CSV-Datei (Content-Type: text/csv)

---

### 17. POST /api/scrape-live

Scrapt eine Pinterest-Ideas-URL live. **Kein DB-Zugriff** -- weder Lesen noch Schreiben.

**Request:**
```json
{
  "url": "https://de.pinterest.com/ideas/wohnzimmer-deko/123456/",
  "language": "de"
}
```

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| url | string | ja | - | Pinterest-Ideas-URL |
| language | string | nein | auto-detect | Sprache/Markt. Wird automatisch aus URL erkannt wenn nicht angegeben |

**Response:**
```json
{
  "success": true,
  "idea": { "...": "idea object (inkl. language)" },
  "pins": [],
  "language": "de"
}
```

---

### 18. POST /api/find-or-scrape-live

Findet eine Pinterest-Ideas-Seite per Name oder URL und scrapt live. **Kein DB-Zugriff.**

**Request (nach Name):**
```json
{
  "name": "wohnzimmer deko",
  "language": "de"
}
```

**Request (nach URL):**
```json
{
  "url": "https://de.pinterest.com/ideas/wohnzimmer-deko/123456/",
  "language": "de"
}
```

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| name | string | nein* | - | Keyword-Name (*entweder name oder url) |
| url | string | nein* | - | Pinterest-Ideas-URL (*entweder name oder url) |
| language | string | nein | auto-detect/de | Sprache/Markt |

**Response:**
```json
{
  "success": true,
  "idea": { "...": "idea object (inkl. language)" },
  "pins": [],
  "source": "scraped",
  "language": "de"
}
```

`source` kann sein: `"scraped"`, `"scraped_redirect"`

---

### 19. POST /api/pins-live

Scrapt Pins einer Pinterest-Ideas-Seite live. **Kein DB-Zugriff.**

**Request:**
```json
{
  "url": "https://de.pinterest.com/ideas/wohnzimmer-deko/123456/",
  "language": "de"
}
```

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| url | string | ja | - | Pinterest-Ideas-URL |
| language | string | nein | auto-detect | Sprache/Markt |

**Response:**
```json
{
  "success": true,
  "idea_id": "123456",
  "idea_name": "wohnzimmer deko",
  "pins": [],
  "total": 0,
  "language": "de"
}
```

---

### 20. POST /api/find-interests-live

Sucht via Google nach Pinterest-Ideas-URLs. **Kein DB-Zugriff** -- kein Duplikat-Check.

**Request:**
```json
{
  "keyword": "wohnzimmer deko",
  "limit": 20,
  "language": "de"
}
```

| Feld | Typ | Pflicht | Default | Beschreibung |
|------|-----|---------|---------|--------------|
| keyword | string | ja | - | Suchbegriff |
| limit | number | nein | 20 | Max. Anzahl URLs |
| language | string | nein | "de" | Sprache/Markt |

**Response:**
```json
{
  "success": true,
  "urls": [
    {
      "url": "https://de.pinterest.com/ideas/wohnzimmer-deko/123456/",
      "title": "Wohnzimmer Deko Ideen",
      "breadcrumb": "Wohnen > Wohnzimmer"
    }
  ],
  "total": 15,
  "language": "de"
}
```

---

## Fehlerbehandlung

Alle Endpoints geben bei Fehlern JSON zurueck:

```json
{ "error": "Fehlermeldung hier" }
```

| HTTP Status | Bedeutung |
|-------------|-----------|
| 400 | Fehlende Pflichtfelder |
| 404 | Ressource nicht gefunden |
| 429 | Rate Limit (DataForSEO) |
| 500 | Server-Fehler |

---

## Komplettes Beispiel: Keyword-Recherche per cURL

```bash
# 1. Keywords entdecken
RESULT=$(curl -s -X POST "http://localhost:3000/api/discover-keywords" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "home office einrichten", "limit": 10, "scrapeLimit": 5}')

echo "$RESULT" | jq .

# 2. Sub-Topics generieren
curl -s -X POST "http://localhost:3000/api/discover-topics" \
  -H "Content-Type: application/json" \
  -d '{"topic": "home office einrichten"}' | jq .

# 3. Gespeicherte Interests durchsuchen
curl -s "http://localhost:3000/api/interests?search=office&sortBy=searches&sortOrder=desc" | jq .

# 4. Pins einer Interest abrufen
curl -s "http://localhost:3000/api/interests/IDEA_ID/pins" | jq .

# 5. Keywords aus Pin-Titeln extrahieren
curl -s -X POST "http://localhost:3000/api/extract-keywords" \
  -H "Content-Type: application/json" \
  -d '{"titles": ["Home Office Ideen fuer kleine Raeume", "Ergonomischer Schreibtisch Setup"]}' | jq .

# 6. Topical Map erstellen
curl -s -X POST "http://localhost:3000/api/cluster-keywords" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "home office",
    "ideas": [{"name": "home office ideen", "searches": 25000}],
    "keywords": [{"name": "schreibtisch setup", "count": 4, "source": "annotation"}]
  }' | jq .
```
