# Kalorify

Kalorify ist eine mobile-first PWA zum Tracken von Kalorien, Makros, Wasser, Schlaf, Schritten, Gewicht, Rezepten und Fortschritt. Die App läuft als statische Web-App und kann über den Browser zum Home-Bildschirm hinzugefügt werden.

## Hauptfunktionen

- Tagesübersicht mit Kalorien- und Makrozielen
- Mahlzeiten nach Frühstück, Mittag, Abend und Snack
- Wasser-, Schlaf-, Schritte- und Gewichtstracking
- Coach-Chat mit optionalen KI-Anbietern
- Lebensmittelsuche, Barcode-Scan und manuelle Einträge
- Eigene Rezepte mit Bildern, Zutaten, Zubereitung und Tags
- Zutaten aus Datenbank berechnen
- KI-Rezeptgenerierung und Erkennung aus Beschreibung
- Zubereitungsmodus mit Schritt-für-Schritt-Anleitung und Timer
- Firebase Login und Cloud-Synchronisierung
- PWA mit Manifest und Service Worker
- Datenexport und Import

## Deployment

Die Hauptdatei der App sollte als `index.html` bereitgestellt werden.

Wichtige Dateien:

```text
index.html
manifest.json
sw.js
_headers
_redirects
privacy.html
icons/icon-192.png
icons/icon-512.png
icons/maskable-512.png
icons/apple-touch-icon.png
```

## Cloudflare Pages / Workers

Für Cloudflare Pages sind diese Dateien besonders wichtig:

- `_headers` für korrekte Content-Types, UTF-8 und Service-Worker-Header
- `_redirects` für SPA/PWA-Fallback auf `index.html`

Nach dem Deployment prüfen:

```text
/manifest.json
/sw.js
/privacy.html
```

`manifest.json` muss JSON anzeigen. `sw.js` muss JavaScript anzeigen.

## Firebase

Die App nutzt Firebase für Auth und Realtime Database. Bei einer neuen Domain muss diese in Firebase Authentication als autorisierte Domain eingetragen werden.

Beispiel:

```text
Authentication → Settings → Authorized domains
```

Dort die Domain ohne `https://` eintragen.

## PWA Installation

### iPhone

1. Website in Safari öffnen
2. Teilen-Button antippen
3. „Zum Home-Bildschirm“ auswählen
4. App starten

### Android

1. Website in Chrome öffnen
2. Installationshinweis nutzen oder Menü öffnen
3. „App installieren“ auswählen

## Apple Kurzbefehle für Schritte

Die App unterstützt Schritte per URL-Parameter:

```text
https://deine-domain.example/?steps=8500
```

Ein iPhone-Kurzbefehl kann Schritte aus Apple Health lesen und diese URL öffnen. Die App speichert die Schritte nach Firebase-Sync robust in den Tageslog.

## Datenschutz

Siehe `privacy.html`.

## Hinweise

- Kalorify ist kein Medizinprodukt.
- KI-Antworten und Nährwerte können Schätzungen enthalten.
- Rezeptbilder werden komprimiert gespeichert, können aber bei sehr vielen Bildern Speicher beanspruchen.

## Versionierung

Bei Änderungen am Service Worker sollte der Cache-Name in `sw.js` erhöht werden, damit Nutzer zuverlässig Updates erhalten.
