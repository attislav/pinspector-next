# Pinspector: Woher kommen die Daten einer Interest/Idea-Seite?

Dieses Dokument beschreibt detailliert, wie Pinspector die Daten fuer eine Pinterest-Interest-Seite (auch "Idea" genannt) bezieht, verarbeitet und darstellt. Ziel ist es, dass jemand mit dieser Anleitung die Funktionalitaet in einer anderen App reproduzieren kann.

---

## Inhaltsverzeichnis

1. [Ueberblick: Was ist ein Pinterest Interest?](#1-ueberblick-was-ist-ein-pinterest-interest)
2. [Die Datenquelle: Pinterest Ideas Pages](#2-die-datenquelle-pinterest-ideas-pages)
3. [Scraping-Prozess im Detail](#3-scraping-prozess-im-detail)
4. [Suchvolumen (Search Volume)](#4-suchvolumen-search-volume)
5. [Last Update](#5-last-update)
6. [SEO-Kategorien (Breadcrumbs)](#6-seo-kategorien-breadcrumbs)
7. [KLP Pivots (Keyword Pivot Points)](#7-klp-pivots-keyword-pivot-points)
8. [Verwandte Interessen (Related Interests)](#8-verwandte-interessen-related-interests)
9. [Top Annotations (Keyword-Tags aus Pins)](#9-top-annotations-keyword-tags-aus-pins)
10. [Top 20 Pins mit Titel, Beschreibung etc.](#10-top-20-pins-mit-titel-beschreibung-etc)
11. [Suchvolumen-Historie](#11-suchvolumen-historie)
12. [Wie wir neue Interest-URLs finden (Google-Suche)](#12-wie-wir-neue-interest-urls-finden-google-suche)
13. [Datenbank-Schema](#13-datenbank-schema)
14. [Zusammenfassung der Darstellung auf der Detail-Seite](#14-zusammenfassung-der-darstellung-auf-der-detail-seite)
15. [Externe Abhaengigkeiten / APIs](#15-externe-abhaengigkeiten--apis)

---

## 1. Ueberblick: Was ist ein Pinterest Interest?

Ein Pinterest "Interest" (intern auch "Idea" genannt) ist eine thematische Sammelseite auf Pinterest. Jedes Interest hat eine eigene URL im Format:

```
https://www.pinterest.com/ideas/{slug}/{numerische-id}/
https://de.pinterest.com/ideas/{slug}/{numerische-id}/
```

Beispiel: `https://www.pinterest.com/ideas/meal-prep/936463259747/`

Auf dieser Seite zeigt Pinterest:
- Den Namen des Interests (z.B. "Meal Prep")
- Das interne Suchvolumen
- Verwandte Interessen
- Keyword-Variationen ("Bubbles" / KLP Pivots)
- Die Top-Pins zu diesem Thema
- Kategorie-Breadcrumbs

**Wichtig:** Es gibt keine offizielle Pinterest-API fuer diese Daten. Alle Daten werden durch Web-Scraping der HTML-Seite gewonnen.

---

## 2. Die Datenquelle: Pinterest Ideas Pages

### 2.1 Wo stecken die Daten?

Pinterest rendert seine Ideas-Seiten serverseitig und bettet die gesamten Initialdaten als JSON in ein `<script>`-Tag ein:

```html
<script id="__PWS_INITIAL_PROPS__" type="application/json">
  { ... riesiges JSON-Objekt ... }
</script>
```

Dieses JSON enthaelt den gesamten Redux-Initialstate, darunter:

```
jsonData.initialReduxState.resources.InterestResource.{id}.data
```

Dort liegt das `InterestResource`-Objekt mit allen relevanten Feldern.

### 2.2 Relevante Felder im InterestResource

| JSON-Pfad | Beschreibung | Pinspector-Feld |
|-----------|-------------|----------------|
| `interestData.page_metadata.metatags['og:title']` | Name des Interests | `idea.name` |
| `interestData.internal_search_count` | Internes Pinterest-Suchvolumen | `idea.searches` |
| `interestData.seo_breadcrumbs` | Kategorie-Hierarchie | `idea.seo_breadcrumbs` |
| `interestData.seo_related_interests` | Verwandte Interessen | `idea.related_interests` |
| `interestData.ideas_klp_pivots` | Keyword-Pivot-Bubbles | `idea.klp_pivots` |
| `interestData.page_metadata.metatags['og:updated_time']` | Letztes Pinterest-Update | `idea.last_update` |
| `jsonData.initialReduxState.pins` | Alle Pins auf der Seite | Top 20 Pins |

---

## 3. Scraping-Prozess im Detail

**Quelldatei:** `src/lib/pinterest-scraper.ts`

### 3.1 URL-Validierung und Normalisierung

```
Eingabe-URL -> Validierung -> Normalisierung -> Fetch
```

1. **Validierung:** URL muss dem Pattern `/ideas/{slug}/{id}` entsprechen
   - Regex: `/^https?:\/\/([a-z]{2}\.)?((www\.)?pinterest\.[a-z.]+)\/ideas\/[^/]+\/\d+/`
2. **ID-Extraktion:** Die numerische ID wird per Regex extrahiert: `/\/ideas\/[^/]+\/(\d+)/`
3. **Normalisierung:** `de.pinterest.com` wird zu `www.pinterest.com` umgeschrieben (fuer konsistente Daten)

### 3.2 HTTP-Request

```javascript
fetch(normalizedUrl, {
  headers: {
    'User-Agent': randomUserAgent,  // Rotation aus 3 User-Agents
    'Accept': 'text/html,application/xhtml+xml,...',
    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  },
  cache: 'no-store',
  signal: abortController.signal,  // 15 Sekunden Timeout
});
```

**User-Agent-Rotation:** Es werden 3 verschiedene User-Agents zufaellig rotiert:
- Chrome (Windows)
- Firefox (Windows)
- Safari (macOS)

**Timeout:** 15 Sekunden.

### 3.3 HTML-Parsing

Aus dem HTML wird das `<script id="__PWS_INITIAL_PROPS__">` Tag per Regex extrahiert:

```javascript
const scriptMatch = html.match(
  /<script id="__PWS_INITIAL_PROPS__"[^>]*>(.*?)<\/script>/s
);
const jsonData = JSON.parse(scriptMatch[1]);
```

### 3.4 Daten-Extraktion

Navigation zum InterestResource:

```javascript
const resources = jsonData.initialReduxState.resources;
const interestResourceKey = Object.keys(resources.InterestResource)[0];
const interestData = resources.InterestResource[interestResourceKey].data;
```

### 3.5 Batch-Scraping mit Rate-Limiting

Beim Scrapen mehrerer URLs wird ein Delay von 2-3 Sekunden (zufaellig) zwischen den Requests eingehalten:

```javascript
const delay = 2000 + Math.random() * 1000; // 2-3 Sekunden
```

---

## 4. Suchvolumen (Search Volume)

### Quelle

```javascript
const searches = interestData.internal_search_count || 0;
```

**Das Feld `internal_search_count`** ist Pinterests internes Suchvolumen. Es zeigt, wie oft nach diesem Interest innerhalb von Pinterest gesucht wird. Es ist NICHT das Google-Suchvolumen.

### Speicherung

- **Aktueller Wert:** `ideas.searches` (INTEGER) in der Datenbank
- **Historischer Verlauf:** Wird in `idea_history` gespeichert (siehe Abschnitt 11)

### Darstellung auf der Detail-Seite

Wird als "Suchvolumen" in einer StatCard oben auf der Seite angezeigt, formatiert mit Tausender-Trennzeichen.

---

## 5. Last Update

### Quelle

```javascript
const lastUpdate = interestData.page_metadata.metatags['og:updated_time']
                   || new Date().toISOString();
```

Das ist das Datum, wann Pinterest die Interest-Seite zuletzt aktualisiert hat (aus den OpenGraph-Metatags).

### Speicherung

- `ideas.last_update` (TIMESTAMP WITH TIME ZONE, nullable)
- Zusaetzlich gibt es `ideas.last_scrape` - wann WIR zuletzt gescrapt haben

### Darstellung

Zwei separate StatCards:
- **Last Update:** Wann Pinterest die Seite aktualisiert hat
- **Last Scrape:** Wann wir zuletzt gescrapt haben

---

## 6. SEO-Kategorien (Breadcrumbs)

### Quelle

```javascript
const seoBreadcrumbs = (interestData.seo_breadcrumbs || [])
  .map(b => b.name)
  .filter(Boolean);
```

Pinterest ordnet jedes Interest in eine Kategorie-Hierarchie ein, z.B.:
`Essen und Trinken > Rezepte > Desserts`

### Speicherung

- `ideas.seo_breadcrumbs` (JSONB) - Array von Strings

### Darstellung

Wird als "SEO Kategorien" mit Breadcrumb-Pfeilnavigation (`>`) angezeigt, jede Kategorie als roter Chip/Badge.

---

## 7. KLP Pivots (Keyword Pivot Points)

### Was sind KLP Pivots?

KLP steht fuer "Keyword Learning Pivots". Das sind die Keyword-Bubbles, die Pinterest auf einer Ideas-Seite anzeigt - verwandte Suchbegriffe/Variationen des Hauptinterests. Auf der Pinterest-Seite erscheinen sie als klickbare Chips/Bubbles oberhalb der Pins.

### Quelle

```javascript
const klpPivots = (interestData.ideas_klp_pivots || [])
  .filter(p => p.pivot_full_name && p.pivot_url)
  .map(p => ({
    name: p.pivot_full_name,
    url: p.pivot_url.startsWith('http')
      ? p.pivot_url
      : `https://www.pinterest.com${p.pivot_url}`,
  }));
```

Jeder KLP Pivot hat:
- `pivot_full_name`: Der Keyword-Name (z.B. "Meal Prep fuer Anfaenger")
- `pivot_url`: Die URL zur zugehoerigen Ideas-Seite

### Speicherung

- `ideas.klp_pivots` (TEXT, als JSON-String gespeichert) - Array von `{name, url}` Objekten

### Darstellung

Werden als "Keyword Pivots" angezeigt, als klickbare orange Chips. Klick darauf scraped das Interest und navigiert dorthin.

### Bedeutung fuer SEO

KLP Pivots sind extrem wertvoll, weil sie zeigen, welche verwandten Suchbegriffe Pinterest selbst als relevant einstuft. Sie sind quasi Pinterests eigene Keyword-Suggestions.

---

## 8. Verwandte Interessen (Related Interests)

### Quelle

```javascript
const relatedInterests = (interestData.seo_related_interests || [])
  .map(i => ({
    name: i.name,
    url: i.url.startsWith('http')
      ? i.url
      : `https://www.pinterest.com${i.url || `/ideas/${i.key}/`}`,
    id: i.id,
  }))
  .filter(i => i.name);
```

### Unterschied zu KLP Pivots

| | KLP Pivots | Related Interests |
|--|-----------|-------------------|
| **Quelle** | `ideas_klp_pivots` | `seo_related_interests` |
| **Charakter** | Keyword-Variationen des gleichen Themas | Thematisch verwandte, aber andere Interessen |
| **Beispiel** | "Meal Prep Rezepte", "Meal Prep fuer die Woche" | "Gesunde Ernaehrung", "Batch Cooking" |
| **Darstellung** | Orange Chips | Graue Chips (hover: rot) |

### Speicherung

- `ideas.related_interests` (JSONB) - Array von `{name, url, id?}` Objekten

### Darstellung

Werden als "Verwandte Interessen" angezeigt. Klick scraped und navigiert zum jeweiligen Interest.

---

## 9. Top Annotations (Keyword-Tags aus Pins)

### Was sind Annotations?

Annotations sind Keywords, die Pinterest einzelnen Pins zuordnet. Sie befinden sich in `pin.pin_join.annotations_with_links` und sind quasi Pinterests interne Tags fuer Pins.

### Quelle

Die Top Annotations werden aus ALLEN Pins auf der Ideas-Seite aggregiert:

```javascript
// Fuer jeden Pin:
const annotationsRaw = pin.pin_join.annotations_with_links;

// Jede Annotation hat:
// - name: Keyword-Name
// - url: URL zur zugehoerigen Ideas-Seite

// Filterkriterien:
// 1. URL muss '/ideas/' enthalten
// 2. URL muss auf eine Zahl enden (numerische ID)
// 3. URL darf keine Klammern enthalten
```

### Aggregation

Die Annotations werden gezaehlt (wie oft sie ueber alle Pins vorkommen), nach Haeufigkeit sortiert, und die Top 20 werden behalten.

### Speicherung

- `ideas.top_annotations` (TEXT) - Gespeichert als HTML-String im Format:
  ```
  <a href="/ideas/..." target="_blank">Keyword</a> (3), <a href="...">Keyword2</a> (2)
  ```
  Die Zahl in Klammern ist die Haeufigkeit ueber alle Pins.

### Darstellung

Werden als "Top Annotations" in einer eigenen Sektion angezeigt, mit der Anzahl der Vorkommen. Klick scraped das jeweilige Interest ueber den `/api/find-or-scrape` Endpoint.

---

## 10. Top 20 Pins mit Titel, Beschreibung etc.

### Quelle

Die Pins befinden sich im Redux-State unter:

```javascript
const pins = jsonData.initialReduxState.pins;
```

Es werden maximal die ersten 20 Pins extrahiert:

```javascript
Object.values(pins).slice(0, 20)
```

### Extrahierte Felder pro Pin

| Feld | JSON-Pfad im Pin-Objekt | Beschreibung |
|------|------------------------|-------------|
| `id` | `pin.id` | Eindeutige Pinterest Pin-ID |
| `title` | `pin.title` oder `pin.grid_title` | Pin-Titel |
| `description` | `pin.description` oder `pin.closeup_description` | Pin-Beschreibung |
| `image_url` | `pin.images['736x'].url` (Fallback: 564x, 474x, orig) | Bild in voller Groesse |
| `image_thumbnail_url` | `pin.images['236x'].url` (Fallback: 170x, 136x136) | Thumbnail |
| `link` | Konstruiert: `https://www.pinterest.com/pin/{id}/` | Direkt-Link zum Pin |
| `article_url` | `pin.rich_summary.url` / `pin.rich_metadata.url` / `pin.link` / `pin.attribution.url` / `pin.tracked_link` | Link zur Originalquelle (Blogpost etc.) |
| `repin_count` | `pin.repin_count` | Anzahl Repins |
| `save_count` | `pin.aggregated_pin_data.aggregated_stats.saves` | Anzahl Saves |
| `comment_count` | `pin.comment_count` / `pin.aggregated_pin_data.comment_count` | Anzahl Kommentare |
| `annotations` | `pin.pin_join.annotations_with_links` -> `[].name` | Keyword-Tags (max. 10 pro Pin) |
| `pin_created_at` | `pin.created_at` / `pin.created_time` | Erstellungsdatum (Unix-Timestamp -> ISO) |
| `domain` | `pin.domain` | Quell-Domain |

### Bild-URLs: Groessen-Fallback

Pinterest liefert Bilder in verschiedenen Groessen. Der Scraper versucht diese Reihenfolge:

**Vollbild:** 736x -> 564x -> 474x -> orig
**Thumbnail:** 236x -> 170x -> 136x136

### Article-URL: Mehrere Pfade

Die URL zur Originalquelle kann an verschiedenen Stellen im Pin-Objekt stehen:
1. `rich_summary.url` (Rich Pins)
2. `rich_metadata.url`
3. `rich_metadata.article.url`
4. `link` (Standard-Link)
5. `attribution.url`
6. `tracked_link`

### Datum-Konvertierung

Pinterest verwendet manchmal Unix-Timestamps (Sekunden seit Epoch):

```javascript
if (pinCreatedAt < 4102444800) {
  // Unix-Timestamp in Sekunden -> ISO
  pinCreatedAt = new Date(pinCreatedAt * 1000).toISOString();
} else {
  // Bereits in Millisekunden
  pinCreatedAt = new Date(pinCreatedAt).toISOString();
}
```

### Speicherung

Pins werden in einer separaten `pins`-Tabelle gespeichert. Die Zuordnung zu Ideas geschieht ueber die `idea_pins`-Junction-Tabelle mit einem `position`-Feld fuer die Reihenfolge.

### Darstellung

Werden als sortierbare Tabelle ("Pins Table") angezeigt mit:
- Position, Thumbnail, Titel, Beschreibung
- Save Count, Repin Count, Comment Count
- Erstellungsdatum, Domain, Artikel-Link
- Annotations pro Pin

Zusaetzliche Features:
- Sortierbar nach allen Spalten
- Bild-Vergroesserung per Klick
- "Keywords extrahieren" (via OpenAI aus den Pin-Titeln)
- "Content analysieren" (via OpenAI - Inhaltsstrategie-Empfehlung)

---

## 11. Suchvolumen-Historie

### Wie sie entsteht

Bei jedem Scrape-Vorgang wird geprueft, ob sich das Suchvolumen geaendert hat:

```javascript
// In idea-persistence.ts:
if (existingIdea.searches !== idea.searches) {
  await saveIdeaHistory(idea.id, idea.name, idea.searches);
}
```

Bei neuen Ideas wird immer ein initialer History-Eintrag erstellt.

### Speicherung

```sql
idea_history (
  id SERIAL PRIMARY KEY,
  idea_id TEXT FK -> ideas(id),
  name TEXT,
  searches INTEGER,
  scrape_date TIMESTAMP
)
```

### API-Endpoint

`GET /api/interests/{id}/history` - liefert alle History-Eintraege, gruppiert nach Monat (ein Eintrag pro Monat).

### Darstellung

1. **Chart:** Historischer Verlauf als Liniendiagramm
2. **Tabelle:** Chronologisch mit Spalten: Datum, Suchvolumen, Aenderung (+/- zum Vormonat)

---

## 12. Wie wir neue Interest-URLs finden (Google-Suche)

### DataForSEO API

**Quelldatei:** `src/lib/search.ts`

Um neue Pinterest-Interest-URLs zu einem Keyword zu finden, wird die DataForSEO SERP API verwendet:

```javascript
fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${base64(login:password)}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([{
    keyword: `site:de.pinterest.com/ideas ${suchbegriff}`,
    location_code: 2276,    // Deutschland
    language_code: 'de',
    device: 'desktop',
    depth: 10-100,          // Anzahl Ergebnisse (Vielfaches von 10)
  }]),
});
```

### So funktioniert es

1. Google-Suche mit `site:de.pinterest.com/ideas {keyword}`
2. Aus den Suchergebnissen werden alle URLs mit `/ideas/`-Format extrahiert
3. URLs werden auf Duplikate geprueft (gegen bereits in der DB vorhandene)
4. Die gefundenen URLs koennen dann einzeln oder im Batch gescrapt werden

### Alternative: Find-or-Scrape

Der Endpoint `POST /api/find-or-scrape` kann ein Interest auch ohne Google-Suche finden:

1. Zuerst: Suche in der Datenbank (exakt, dann partial match)
2. Dann: Versuche die Pinterest-URL zu konstruieren (Slug aus dem Namen generieren)
3. Folge Redirects, um die numerische ID zu erhalten
4. Scrape die finale URL

---

## 13. Datenbank-Schema

### Tabelle: `ideas`

```sql
CREATE TABLE ideas (
    id TEXT PRIMARY KEY,                              -- Pinterest Interest ID (numerisch)
    name TEXT NOT NULL,                                -- Name des Interests
    url TEXT,                                          -- Original Pinterest URL
    searches INTEGER DEFAULT 0,                        -- Internes Suchvolumen
    last_update TIMESTAMP WITH TIME ZONE,              -- Wann Pinterest zuletzt aktualisiert hat
    last_scrape TIMESTAMP WITH TIME ZONE DEFAULT NOW(),-- Wann wir zuletzt gescrapt haben
    related_interests JSONB DEFAULT '[]',              -- [{name, url, id?}]
    top_annotations TEXT,                              -- HTML-String mit Keyword-Links
    seo_breadcrumbs JSONB DEFAULT '[]',                -- ["Kat1", "Kat2", "Kat3"]
    klp_pivots TEXT DEFAULT '[]',                      -- JSON: [{name, url}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabelle: `idea_history`

```sql
CREATE TABLE idea_history (
    id SERIAL PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    searches INTEGER DEFAULT 0,
    scrape_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabelle: `pins`

```sql
CREATE TABLE pins (
    id TEXT PRIMARY KEY,                    -- Pinterest Pin ID
    title TEXT,                             -- Pin-Titel
    description TEXT,                       -- Pin-Beschreibung
    image_url TEXT,                         -- Bild-URL (gross)
    image_thumbnail_url TEXT,               -- Bild-URL (Thumbnail)
    link TEXT,                              -- Link zum Pin auf Pinterest
    article_url TEXT,                       -- Link zur Originalquelle
    repin_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    annotations TEXT[] DEFAULT '{}',        -- Array von Keyword-Strings
    pin_created_at TIMESTAMP WITH TIME ZONE,
    domain TEXT,                            -- Quell-Domain
    last_scrape TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabelle: `idea_pins` (Junction/Verknuepfung)

```sql
CREATE TABLE idea_pins (
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    pin_id TEXT REFERENCES pins(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,             -- Reihenfolge (0 = erster Pin)
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (idea_id, pin_id)
);
```

### Beziehungen

```
ideas (1) ---< idea_pins >--- (N) pins
ideas (1) ---< idea_history (N)
```

Ein Pin kann zu mehreren Ideas gehoeren (ueber Annotations-Matching). Wenn ein Pin Annotations hat, die einem bestehenden Interest-Namen entsprechen, wird automatisch eine Verknuepfung erstellt.

---

## 14. Zusammenfassung der Darstellung auf der Detail-Seite

Die Interest-Detail-Seite (`/interests/{id}`) zeigt folgende Bereiche, von oben nach unten:

| Bereich | Datenquelle | API-Endpoint |
|---------|-------------|-------------|
| **Header:** Name, ID, Buttons | `idea.name`, `idea.id` | `GET /api/interests/{id}` |
| **Stat-Cards:** Suchvolumen, Last Update, Last Scrape, History-Eintraege | `idea.searches`, `idea.last_update`, `idea.last_scrape`, `history.length` | `GET /api/interests/{id}` + `GET /api/interests/{id}/history` |
| **History-Chart:** Suchvolumen-Verlauf | `idea_history` Tabelle | `GET /api/interests/{id}/history` |
| **SEO-Kategorien:** Breadcrumb-Pfad | `idea.seo_breadcrumbs` | `GET /api/interests/{id}` |
| **Keyword Pivots:** KLP-Pivot-Chips | `idea.klp_pivots` | `GET /api/interests/{id}` |
| **Verwandte Interessen:** Related-Interest-Chips | `idea.related_interests` | `GET /api/interests/{id}` |
| **Top Annotations:** Keyword-Tags mit Haeufigkeit | `idea.top_annotations` | `GET /api/interests/{id}` |
| **Pins-Tabelle:** Top 20 Pins | `pins` Tabelle via `idea_pins` | `GET /api/interests/{id}/pins` |
| **History-Tabelle:** Suchvolumen-Aenderungen | `idea_history` Tabelle | `GET /api/interests/{id}/history` |

### Initiales Laden

Beim Oeffnen der Detail-Seite werden 3 API-Calls parallel ausgefuehrt:

```javascript
const [ideaRes, historyRes, pinsRes] = await Promise.all([
  fetch(`/api/interests/${id}`),         // Idea mit allen Metadaten
  fetch(`/api/interests/${id}/history`), // Suchvolumen-Historie
  fetch(`/api/interests/${id}/pins`),    // Zugehoerige Pins
]);
```

---

## 15. Externe Abhaengigkeiten / APIs

### Pinterest (Web-Scraping, keine API)

- **Was:** HTML-Seiten werden direkt abgerufen
- **URL-Format:** `https://www.pinterest.com/ideas/{slug}/{id}/`
- **Daten aus:** `<script id="__PWS_INITIAL_PROPS__">` Tag
- **Rate-Limiting:** 2-3 Sekunden zwischen Requests
- **Timeout:** 15 Sekunden pro Request
- **Kein API-Key noetig** - aber User-Agent-Rotation empfohlen

### DataForSEO (Google-Suche)

- **Was:** Google SERP API fuer die Suche nach Pinterest-URLs
- **Endpoint:** `https://api.dataforseo.com/v3/serp/google/organic/live/advanced`
- **Auth:** Basic Auth (Login + Passwort)
- **Konfiguration:** Deutschland (Location 2276), Deutsch, Desktop
- **Timeout:** 20 Sekunden
- **Env-Variablen:** `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`

### OpenAI (Content-Analyse)

- **Was:** Keyword-Extraktion und Content-Strategie-Analyse
- **Modell:** GPT-4 Mini
- **Verwendung:**
  - Keyword-Extraktion aus Pin-Titeln (`/api/extract-keywords`)
  - Content-Strategie-Empfehlungen (`/api/analyze-content`)
  - Sub-Topic-Generierung (`/api/discover-topics`)
  - Topical Map / Keyword-Clustering (`/api/cluster-keywords`)
- **Env-Variable:** `OPENAI_API_KEY`

### PostgreSQL (Datenbank)

- **Hosting:** Hetzner (Self-hosted)
- **Env-Variable:** `DATABASE_URL`

---

## Reproduktion in einer anderen App

Um diese Funktionalitaet in einer anderen App nachzubauen, braucht man:

1. **HTTP-Client** der Pinterest-Seiten abrufen kann (mit User-Agent-Header)
2. **HTML-Parser** der das `__PWS_INITIAL_PROPS__` Script-Tag extrahieren kann
3. **JSON-Parser** fuer die extrahierten Daten
4. **Datenbank** fuer Persistenz (jede SQL-DB reicht)
5. **Optional:** DataForSEO-Account oder alternative Google-Suche API fuer Interest-Discovery
6. **Optional:** OpenAI-API fuer AI-basierte Keyword-Extraktion

Der Kern-Algorithmus ist:
```
URL -> Fetch HTML -> Extrahiere __PWS_INITIAL_PROPS__ -> Parse JSON
  -> initialReduxState.resources.InterestResource.{key}.data
  -> Extrahiere: name, searches, breadcrumbs, related, klp_pivots
  -> initialReduxState.pins -> Extrahiere Top 20 Pins
  -> Speichere alles in DB
```
