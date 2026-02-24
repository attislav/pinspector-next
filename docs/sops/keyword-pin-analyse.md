# SOPs: Keyword- & Pin-Analyse via Pinspector API

**Base-URL:** `https://pinspector-next.vercel.app`

---

## SOP 1: Keyword-Analyse (KLP Pivots, Related Interests, Top Annotations + Suchvolumen)

**Ziel:** Für ein Keyword eine Liste verwandter Keywords (KLP Pivots, Related Interests, Top Annotations) mit jeweiligem Suchvolumen erhalten.

### Schritt 1 – Haupt-Keyword scrapen

```
POST /api/find-or-scrape-live
Content-Type: application/json

{
  "name": "dein keyword",
  "language": "de"
}
```

**Response enthält:**
- `idea.searches` → Suchvolumen des Haupt-Keywords
- `idea.related_interests` → Liste verwandter Interessen (`name`, `url`)
- `idea.klp_pivots` → Bubble-Keywords (`name`, `url`)
- `pins[].annotations` → Top Annotations (aus den Pins extrahiert)

### Schritt 2 – Verwandte Keywords sammeln

Aus der Response alle Keywords extrahieren:

| Quelle | Feld | Format |
|--------|------|--------|
| KLP Pivots | `idea.klp_pivots` | `[{name, url}]` |
| Related Interests | `idea.related_interests` | `[{name, url}]` |
| Top Annotations | `pins[].annotations` | Strings aus allen Pins sammeln, Häufigkeit zählen |

### Schritt 3 – Suchvolumen pro Keyword abrufen

Für jedes verwandte Keyword aus Schritt 2 einzeln aufrufen:

```
POST /api/find-or-scrape-live
Content-Type: application/json

{
  "name": "verwandtes keyword",
  "language": "de"
}
```

→ `idea.searches` = Suchvolumen dieses Keywords.

> **Hinweis:** Pro Keyword ein separater Call nötig. Bei vielen Keywords Aufrufe sequentiell mit kurzer Pause (2-3s) ausführen, um Rate-Limits zu vermeiden.

### Alternative: Discover-Keywords (automatisiert)

Kombiniert Schritt 1-3 teilweise automatisch:

```
POST /api/discover-keywords
Content-Type: application/json

{
  "keyword": "dein keyword",
  "limit": 10,
  "scrapeLimit": 5,
  "language": "de"
}
```

**Response:**
- `keywords[]` → `{name, count, source}` (source: `annotation` | `klp_pivot` | `related_interest`)
- `scrapedIdeas[]` → `{id, name, searches}` ← hier ist das Suchvolumen enthalten

> `count` = Häufigkeit des Keywords in den gescrapten Seiten (nicht Suchvolumen).
> `scrapedIdeas[].searches` = tatsächliches Pinterest-Suchvolumen.

### Output-Format

| Keyword | Suchvolumen | Quelle |
|---------|-------------|--------|
| keyword a | 12.400 | klp_pivot |
| keyword b | 8.200 | related_interest |
| keyword c | 3.100 | annotation |

---

## SOP 2: Top Pins für ein Keyword (mit Saves, Repins, Comments)

**Ziel:** Die Top Pins für ein bestimmtes Keyword abrufen, inkl. Engagement-Metriken.

### Schritt 1 – Keyword scrapen und Pins erhalten

```
POST /api/find-or-scrape-live
Content-Type: application/json

{
  "name": "dein keyword",
  "language": "de"
}
```

**Response enthält `pins[]` (bis zu 20 Pins) mit:**
- `title` → Pin-Titel
- `description` → Beschreibung
- `save_count` → Anzahl Saves
- `repin_count` → Anzahl Repins
- `comment_count` → Anzahl Kommentare
- `link` → Ziel-URL
- `image_url` → Bild-URL
- `domain` → Quell-Domain
- `pin_created_at` → Erstelldatum

### Schritt 2 – Ergebnis-Tabelle erstellen

Pins aus `pins[]` als Tabelle:

| # | Titel | Saves | Repins | Comments | Domain | Link |
|---|-------|-------|--------|----------|--------|------|
| 1 | ... | 1.200 | 980 | 45 | example.com | ... |
| 2 | ... | 890 | 750 | 32 | ... | ... |

> Die Pins kommen in der Reihenfolge, wie Pinterest sie auf der Ideas-Seite anzeigt (Relevanz-Sortierung). Für eine eigene Sortierung nach Saves/Repins/Comments die Tabelle clientseitig sortieren.

### Alternative: Nur Pins live scrapen (wenn URL bekannt)

```
POST /api/pins-live
Content-Type: application/json

{
  "url": "https://de.pinterest.com/ideas/dein-keyword/1234567890/",
  "language": "de"
}
```

---

## Offene Fragen

1. **Shares:** Pinterest stellt keine Share-Zahlen über das Scraping bereit. Verfügbar sind nur `save_count`, `repin_count` und `comment_count`. Shares sind in der aktuellen API nicht abrufbar.
2. **Suchvolumen für Annotations:** Annotations sind Keyword-Tags aus Pins (z.B. "vegan", "DIY"). Sie haben kein eigenes Pinterest-Suchvolumen, da sie keine eigenständigen Pinterest-Ideas-Seiten sind. Nur Keywords, die als Pinterest Interest/Idea existieren, haben ein Suchvolumen.
3. **Rate-Limits:** Bei Massen-Abfragen (viele Keywords hintereinander) können Pinterest-seitige Blockierungen auftreten (403/429). Empfehlung: Max. 1 Request alle 2-3 Sekunden.
4. **Sortierung Pins:** Die Pins kommen unsortiert nach Engagement – sie sind nach Pinterest-Relevanz geordnet. Eine Sortierung nach `save_count`, `repin_count` oder `comment_count` muss clientseitig erfolgen.
5. **Sprache:** Alle Endpoints unterstützen den `language`-Parameter (`de`, `en`, `fr`, `es`, `it`, `pt`, `nl`). Standard ist Deutsch (`de`).
