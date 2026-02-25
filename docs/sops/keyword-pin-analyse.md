# SOPs: Keyword- & Pin-Analyse via Pinspector API

**Base-URL:** `https://pinspector-next.vercel.app`

---

## SOP 1: Keyword-Analyse

**Ziel:** Für ein Keyword eine Liste verwandter Keywords (KLP Pivots, Related Interests, Top Annotations) mit jeweiligem Suchvolumen erhalten.

**Endpunkt:** `POST https://pinspector-next.vercel.app/api/find-or-scrape-live`

---

### Schritt 1 – Haupt-Keyword abfragen

Folgenden Request absenden (z.B. via curl, Postman oder ein beliebiges HTTP-Tool):

```bash
curl -X POST https://pinspector-next.vercel.app/api/find-or-scrape-live \
  -H "Content-Type: application/json" \
  -d '{
    "name": "häkeln anfänger",
    "language": "de"
  }'
```

**Parameter:**
| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `name` | String | Ja | Das Keyword, das analysiert werden soll |
| `language` | String | Nein | Sprachcode: `de`, `en`, `fr`, `es`, `it`, `pt`, `nl`. Standard: `de` |

**Beispiel-Response (gekürzt):**

```json
{
  "success": true,
  "idea": {
    "id": "987654321",
    "name": "häkeln anfänger",
    "searches": 14800,
    "url": "https://de.pinterest.com/ideas/häkeln-anfänger/987654321/",
    "klp_pivots": [
      { "name": "häkeln lernen", "url": "https://de.pinterest.com/ideas/häkeln-lernen/123/" },
      { "name": "einfache häkelmuster", "url": "https://de.pinterest.com/ideas/einfache-häkelmuster/456/" },
      { "name": "häkeln ideen", "url": "https://de.pinterest.com/ideas/häkeln-ideen/789/" }
    ],
    "related_interests": [
      { "name": "stricken anfänger", "url": "https://de.pinterest.com/ideas/stricken-anfänger/111/" },
      { "name": "makramee anfänger", "url": "https://de.pinterest.com/ideas/makramee-anfänger/222/" }
    ]
  },
  "pins": [
    {
      "title": "Einfache Häkelanleitung für Anfänger",
      "annotations": ["häkeln", "diy", "handarbeit", "wolle"],
      "save_count": 1200,
      "repin_count": 980,
      "comment_count": 45
    }
  ],
  "source": "scraped"
}
```

### Schritt 2 – Verwandte Keywords aus der Response sammeln

Aus der Response drei Listen extrahieren:

**a) KLP Pivots** → Feld `idea.klp_pivots`
```
häkeln lernen
einfache häkelmuster
häkeln ideen
```

**b) Related Interests** → Feld `idea.related_interests`
```
stricken anfänger
makramee anfänger
```

**c) Top Annotations** → Feld `pins[].annotations` (aus allen Pins sammeln, Duplikate zählen)
```
häkeln (12x)
diy (8x)
handarbeit (6x)
wolle (5x)
```

> **Wichtig:** Annotations sind Tags aus Pins. Sie haben kein eigenes Suchvolumen auf Pinterest. Nur KLP Pivots und Related Interests können als Keywords mit Suchvolumen nachgeschlagen werden.

### Schritt 3 – Suchvolumen für jedes verwandte Keyword abrufen

Für **jedes** Keyword aus KLP Pivots und Related Interests **denselben Endpoint** erneut aufrufen:

```bash
curl -X POST https://pinspector-next.vercel.app/api/find-or-scrape-live \
  -H "Content-Type: application/json" \
  -d '{
    "name": "häkeln lernen",
    "language": "de"
  }'
```

→ Aus der Response `idea.searches` ablesen = Suchvolumen dieses Keywords.

Dann den nächsten Call:

```bash
curl -X POST https://pinspector-next.vercel.app/api/find-or-scrape-live \
  -H "Content-Type: application/json" \
  -d '{
    "name": "einfache häkelmuster",
    "language": "de"
  }'
```

→ Wieder `idea.searches` ablesen.

**So weiter für jedes Keyword.** Zwischen den Calls **2-3 Sekunden warten** (Rate-Limit).

### Schritt 4 – Ergebnis-Tabelle zusammenstellen

Alle Ergebnisse in einer Tabelle zusammenfassen:

| Keyword | Suchvolumen | Quelle |
|---------|-------------|--------|
| häkeln anfänger | 14.800 | Haupt-Keyword |
| häkeln lernen | 22.100 | KLP Pivot |
| einfache häkelmuster | 9.400 | KLP Pivot |
| häkeln ideen | 18.600 | KLP Pivot |
| stricken anfänger | 11.200 | Related Interest |
| makramee anfänger | 7.300 | Related Interest |
| häkeln | – | Annotation (12x) |
| diy | – | Annotation (8x) |

---

### Alternative: Discover-Keywords (automatisiert, ein einziger Call)

Dieser Endpoint kombiniert Schritt 1-3 teilweise automatisch – er findet mehrere Pinterest-Ideas-Seiten zum Keyword und scrapt sie.

**Endpunkt:** `POST https://pinspector-next.vercel.app/api/discover-keywords`

```bash
curl -X POST https://pinspector-next.vercel.app/api/discover-keywords \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "häkeln anfänger",
    "limit": 10,
    "scrapeLimit": 5,
    "language": "de"
  }'
```

**Parameter:**
| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `keyword` | String | Ja | Das Keyword |
| `limit` | Number | Nein | Wie viele Pinterest-Ideas-URLs gesucht werden (Standard: 10) |
| `scrapeLimit` | Number | Nein | Wie viele davon tatsächlich gescrapt werden (Standard: 5) |
| `language` | String | Nein | Sprachcode (Standard: `de`) |

**Beispiel-Response (gekürzt):**

```json
{
  "success": true,
  "keyword": "häkeln anfänger",
  "urlsFound": 10,
  "urlsScraped": 5,
  "keywords": [
    { "name": "häkeln lernen", "count": 4, "source": "klp_pivot" },
    { "name": "stricken anfänger", "count": 3, "source": "related_interest" },
    { "name": "diy", "count": 8, "source": "annotation" }
  ],
  "scrapedIdeas": [
    { "id": "987654321", "name": "häkeln anfänger", "searches": 14800 },
    { "id": "123456789", "name": "häkeln lernen", "searches": 22100 },
    { "id": "111222333", "name": "einfache häkelmuster", "searches": 9400 }
  ]
}
```

**So liest du das Ergebnis:**
- `scrapedIdeas[]` → Jeder Eintrag hat `name` + `searches` (= Suchvolumen)
- `keywords[]` → Alle gefundenen Keywords mit Quelle. `count` = wie oft das Keyword auf den gescrapten Seiten vorkam (nicht Suchvolumen!)

---

## SOP 2: Top Pins für ein Keyword (mit Saves, Repins, Comments)

**Ziel:** Die Top Pins für ein bestimmtes Keyword abrufen mit Engagement-Metriken (Saves, Repins, Comments).

**Endpunkt:** `POST https://pinspector-next.vercel.app/api/find-or-scrape-live`

---

### Schritt 1 – Keyword abfragen

```bash
curl -X POST https://pinspector-next.vercel.app/api/find-or-scrape-live \
  -H "Content-Type: application/json" \
  -d '{
    "name": "home office einrichten",
    "language": "de"
  }'
```

**Parameter:**
| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|--------------|
| `name` | String | Ja | Das Keyword, für das die Top Pins abgerufen werden sollen |
| `language` | String | Nein | Sprachcode (Standard: `de`) |

### Schritt 2 – Pins aus der Response auslesen

Die Response enthält ein `pins[]`-Array mit bis zu 20 Pins.

**Beispiel-Response (gekürzt auf `pins[]`):**

```json
{
  "success": true,
  "idea": {
    "name": "home office einrichten",
    "searches": 27400
  },
  "pins": [
    {
      "id": "pin_001",
      "title": "10 Tipps für das perfekte Home Office",
      "description": "So richtest du dein Home Office produktiv ein...",
      "save_count": 3400,
      "repin_count": 2800,
      "comment_count": 67,
      "link": "https://example.com/home-office-tipps",
      "image_url": "https://i.pinimg.com/originals/ab/cd/ef.jpg",
      "domain": "example.com",
      "pin_created_at": "2024-03-15T10:00:00Z",
      "annotations": ["home office", "einrichtung", "produktivität"]
    },
    {
      "id": "pin_002",
      "title": "Kleines Home Office – große Wirkung",
      "description": "Auch auf wenig Raum lässt sich ein tolles Büro...",
      "save_count": 2100,
      "repin_count": 1750,
      "comment_count": 34,
      "link": "https://example.com/kleines-buero",
      "image_url": "https://i.pinimg.com/originals/gh/ij/kl.jpg",
      "domain": "example.com",
      "pin_created_at": "2024-01-22T14:30:00Z",
      "annotations": ["home office", "kleine räume", "ikea"]
    }
  ]
}
```

### Schritt 3 – Ergebnis-Tabelle erstellen

Relevante Felder pro Pin:

| Feld | Beschreibung |
|------|-------------|
| `title` | Titel des Pins |
| `save_count` | Wie oft der Pin gespeichert wurde |
| `repin_count` | Wie oft der Pin repinnt wurde |
| `comment_count` | Anzahl Kommentare |
| `link` | Ziel-URL (wohin der Pin verlinkt) |
| `domain` | Domain der Ziel-URL |
| `pin_created_at` | Erstelldatum des Pins |

**Beispiel-Tabelle:**

| # | Titel | Saves | Repins | Comments | Domain |
|---|-------|-------|--------|----------|--------|
| 1 | 10 Tipps für das perfekte Home Office | 3.400 | 2.800 | 67 | example.com |
| 2 | Kleines Home Office – große Wirkung | 2.100 | 1.750 | 34 | example.com |

> **Hinweis:** Die Pins kommen in Pinterest-Relevanz-Reihenfolge (nicht nach Saves sortiert). Zum Sortieren nach Saves/Repins/Comments die Liste selbst umsortieren.

---

## Offene Fragen

1. **Suchvolumen für Annotations:** Annotations (z.B. "diy", "wolle") sind Pin-Tags. Sie haben kein Pinterest-Suchvolumen, da sie keine eigenständigen Pinterest-Ideas-Seiten sind. Nur KLP Pivots und Related Interests lassen sich mit Suchvolumen nachschlagen.
2. **Rate-Limits:** Bei vielen Keyword-Abfragen hintereinander 2-3 Sekunden Pause zwischen Calls einhalten. Pinterest kann sonst mit 403/429 blockieren.
3. **Sortierung Pins:** Pins sind nach Pinterest-Relevanz sortiert, nicht nach Engagement. Sortierung nach `save_count`/`repin_count`/`comment_count` muss manuell erfolgen.
4. **Sprache:** Alle Endpoints unterstützen `de`, `en`, `fr`, `es`, `it`, `pt`, `nl`.
