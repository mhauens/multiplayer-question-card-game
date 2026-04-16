# Kampf gegen das Spiessertum

Web-Umsetzung des Partyspiels als pnpm-Workspace mit React/Vite im Client, Express/Socket.IO im Server und einem gemeinsamen Regelpaket unter `packages/game-rules`.

## Ziel des Projekts

Das Projekt bildet eine Online-Variante von "Kampf gegen das Spiessertum" ab.

Spieler koennen:

- eine Lobby erstellen oder per Code/Link beitreten
- in Echtzeit ueber Socket.IO synchron spielen
- Karten einreichen, Karten tauschen und Gewinner waehlen
- eine Sitzung nach kurzem Verbindungsverlust wieder aufnehmen

## Tech-Stack

- Root: pnpm Workspace
- Client: React 19, React Router 7, Vite 8, TypeScript 6
- Server: Express 5, Socket.IO 4, TypeScript 6, tsx fuer lokale Entwicklung
- Shared Package: `@kgs/game-rules` mit TypeScript 6 und tsup

## Projektstruktur

```text
.
|- AGENTS.md              Hinweise fuer Coding-Agents und Repo-Konventionen
|- README.md
|- eslint.config.mjs      gemeinsame Lint-Konfiguration
|- render.yaml            Render-Blueprint fuer Client und Server
|- package.json           Root-Skripte fuer den gesamten Workspace
|- pnpm-workspace.yaml
|- client/
|  |- public/
|  |- src/
|  |  |- components/    UI-Bausteine wie Karten, Scoreboard, Regeln-Modal
|  |  |- context/       globaler Spielzustand im Browser
|  |  |- hooks/         Socket-Kommunikation, Reconnect und Pause bei Verbindungsabbruch
|  |  |- pages/         Home, Lobby, Game
|  |  |- styles/        globale Styles, Karten- und Game-Layout
|  |  |- App.tsx        Routing der App
|  |  |- theme.ts       Zuordnung von Varianten zu Client-Themes
|  |  `- main.tsx       Einstiegspunkt des Frontends
|  |- vite.config.ts    Dev-Server auf Port 5173, Proxy fuer /socket.io
|  `- package.json
|- packages/
|  `- game-rules/
|     |- src/
|     |  `- index.ts    gemeinsame Regelkonstanten und Hilfsfunktionen
|     |- package.json
|     `- tsup.config.ts
|- server/
|  |- data/
|  |  |- base-questions.json
|  |  |- base-answers.json
|  |  |- extensions/    optionale Kartenerweiterungen als JSON
|  |  `- variants/      alternative komplette Spielvarianten als JSON
|  |- src/
|  |  |- game/          GameManager, GameState, CardDeck
|  |  |- socket/        Socket-Handler fuer alle Spielaktionen
|  |  |- index.ts       Express-/Socket.IO-Server
|  |  `- types.ts       gemeinsame Server-Typen
|  |- test/             Vitest-Suites fuer Spiellogik, Handler und Skills
|  `- package.json
```

## Voraussetzungen

- Node.js 22 oder neuer empfohlen
- pnpm 10 oder neuer empfohlen

Falls `pnpm` lokal noch nicht verfuegbar ist, kann es ueber Corepack aktiviert werden:

```bash
corepack enable
corepack prepare pnpm@10 --activate
```

## Installation

```bash
pnpm install
```

Danach stehen alle Workspace-Skripte im Repo-Root zur Verfuegung.

## Lokale Entwicklung

Alles zusammen starten:

```bash
pnpm dev
```

Das startet:

- den Vite-Client auf `http://localhost:5173`
- den Express-/Socket.IO-Server auf `http://localhost:3001`

Einzelne Teile starten:

```bash
pnpm dev:client
pnpm dev:server
```

Nuetzliche weitere Root-Befehle:

```bash
pnpm lint
pnpm test
pnpm build
```

Dabei gilt:

- `pnpm lint` prueft `client/src`, `server/src`, `server/test` und `packages/game-rules/src`
- `pnpm test` fuehrt die Vitest-Suites von Client und Server aus
- `pnpm build` baut zuerst `@kgs/game-rules` und danach Client und Server

Direkte Paketbefehle sind ebenfalls moeglich:

```bash
pnpm --filter client test:watch
pnpm --filter server test:watch
pnpm --filter client preview
```

Build-Shortcuts fuer einzelne Deployments:

```bash
pnpm build:client
pnpm build:server
```

Wenn du an den gemeinsamen Regeln unter `packages/game-rules/` arbeitest, nutze `pnpm dev`, `pnpm dev:client` oder `pnpm dev:server`, damit der Shared-Build im Watch-Modus mitlaeuft.

Direkte Paket-Builds fuer `client` und `server` bauen das Shared-Paket automatisch mit und bleiben damit mit bestehenden CI- und Render-Build-Kommandos kompatibel. Die Root-Shortcuts `pnpm build:client`, `pnpm build:server` und `pnpm build` steuern die Build-Reihenfolge zentral, ohne das Shared-Paket doppelt zu bauen.

Produktionsstart des Servers:

```bash
pnpm build
pnpm start
```

Wichtig: `pnpm start` erwartet den zuvor gebauten Server unter `server/dist`.

## Deployment Auf Render

Das Repository enthaelt eine `render.yaml`, die den Server als Render Web Service und den Client als Render Static Site fuer dieses Monorepo vorkonfiguriert.

Wenn du die Services ueber die Render-Blueprint-Funktion anlegst, werden diese Einstellungen aus dem Repository uebernommen, inklusive SPA-Rewrite fuer Client-Routen wie `/join/:code`, `/lobby` und `/game`.

Wenn Client und Server stattdessen manuell als getrennte Render-Services angelegt werden, sind diese Kommandos die passenden Defaults:

Wichtig: Beide Render-Services sollten als Root Directory das Repository-Root verwenden, nicht `client/` oder `server/`, weil die Build-Kommandos auf den pnpm-Workspace und das Shared-Paket zugreifen.

- Static Site fuer den Client:
  - Build Command: `pnpm build:client`
  - Publish Directory: `client/dist`
  - Rewrite Rule: `/* -> /index.html` als `rewrite`, damit BrowserRouter-Direktaufrufe und Refreshs funktionieren
  - Wichtige Variable: `VITE_SERVER_URL` mit der oeffentlichen Server-URL
- Web Service fuer den Server:
  - Build Command: `pnpm build:server`
  - Start Command: `pnpm start`
  - Wichtige Variable: `CLIENT_URL` mit der oeffentlichen Client-URL

Wenn beide Teile in einer Render-Umgebung gemeinsam gebaut werden, bleibt `pnpm build` weiterhin gueltig.

## Laufzeit und Ports

- Client lokal: <http://localhost:5173>
- Server lokal: <http://localhost:3001>
- Health-Check: <http://localhost:3001/api/health>
- Verfuegbare Varianten: <http://localhost:3001/api/variants>
- Verfuegbare Erweiterungen: <http://localhost:3001/api/extensions>

Hinweis:

- Die Hosting-UI nutzt primaer das Socket-Event `get-variants`; jede Variante liefert ihre passenden Erweiterungen bereits mit.
- Der Endpoint `/api/extensions` ist vor allem fuer Debugging oder Katalog-Inspektion nuetzlich.

Wichtige Server-Umgebungsvariablen:

- `PORT` steuert den Server-Port, Standard ist `3001`
- `CLIENT_URL` steuert den erlaubten Client-Ursprung, Standard ist `http://localhost:5173`
- `TWITCH_CLIENT_ID` aktiviert die optionale Twitch-Community-Voting-Integration
- `TWITCH_CLIENT_SECRET` wird nur serverseitig fuer den OAuth-Code-Tausch genutzt
- `TWITCH_REDIRECT_URI` muss auf den Server-Callback `/api/twitch/oauth/callback` zeigen

Lokale Entwicklung:

- Fuer `pnpm dev` laedt der Server automatisch optionale Dateien in dieser Reihenfolge, ohne bereits gesetzte Prozess-Variablen zu ueberschreiben:
  - `/.env`
  - `/.env.local`
  - `/server/.env`
  - `/server/.env.local`
- Fuer lokale Twitch-Tests ist `server/.env.local` meist der einfachste Ort.
- Beispiel lokal: `TWITCH_REDIRECT_URI=http://localhost:3001/api/twitch/oauth/callback`

Hinweis zur Twitch-Integration:

- Die Verbindung ist optional und pro Spieler getrennt.
- Vor dem OAuth-Start zeigt der Client einen Privacy-Hinweis, dass der Login nicht im Stream sichtbar sein soll.
- Es wird nur das minimale Twitch-Scope `user:read:chat` angefordert.
- Twitch-bezogene Daten werden nicht persistent gespeichert und nur fluechtig im Server-RAM fuer die laufende Partie gehalten.
- Bei einem unerwarteten Disconnect innerhalb des Reconnect-Fensters bleibt eine bestehende Twitch-Verbindung fuer dieselbe laufende Partie erhalten; waehrend der Pause werden keine neuen Chat-Stimmen ausgewertet.
- Bei Shared Chat zaehlen nur Stimmen aus der eigenen Community des verbundenen Kanals; fremde Shared-Chat-Quellen werden ignoriert.

Empfohlene Validierung fuer Twitch-Community-Voting:

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- manueller Zwei-Browser-Smoke-Test fuer Connect, Voting und Reconnect
- manueller Zwei-Kanal-Isolationstest
- manueller Shared-Chat-Privacy-Test

## Wie das Spiel technisch funktioniert

### Client

- `GameContext` kapselt den Spielzustand fuer die UI.
- `GameContext` laedt den Variantenkatalog ueber `get-variants`, spiegelt `activeVariant` und `activeExtensions` aus dem Serverzustand und setzt das passende Theme.
- `useSocket` verwaltet die Socket.IO-Verbindung, inklusive Reconnect und ACK-basierter Kommunikation.
- `GameContext` speichert fuer laufende Partien eine lokale Reconnect-Identitaet, damit ein Reload oder Browser-Neustart innerhalb des Zeitfensters denselben Spieler wieder anmelden kann.
- `Home.tsx` enthaelt die Host-Auswahl fuer Variante und variantenspezifische Erweiterungen.
- `theme.ts` ordnet Varianten Client-Themes zu; aktuell hat `peppa-wutz` ein eigenes Theme, `base` ist der Fallback.
- Routing in `App.tsx` unterscheidet zwischen Startseite, Lobby und laufendem Spiel.

### Server

- `GameManager` verwaltet mehrere parallele Spiele.
- `GameState` enthaelt den eigentlichen Regelablauf einer Partie.
- `CardDeck` baut das Basis-Set synthetisch aus den Basisdateien auf, laedt weitere Varianten und Erweiterungen aus ihren eigenen Set-Unterordnern, ordnet Erweiterungen Varianten zu und filtert ungueltige Erweiterungen beim Spielstart heraus.
- `socket/handlers.ts` validiert alle Spielaktionen und broadcastet den aktuellen Zustand an alle Spieler.

### Shared Package

- `packages/game-rules/src/index.ts` enthaelt gemeinsame Regelkonstanten wie Mindestspielerzahl, Handgroesse, Trophaeenziele und Reconnect-Zeitfenster.
- Client, Server und testspezifische Dokumentationspruefungen greifen auf dieses Paket zu, damit zentrale Spielgrenzen nur an einer Stelle gepflegt werden.

## Wichtige Spielregeln in der Online-Variante

- Der Host erstellt die Lobby und startet das Spiel.
- Start ist erst ab 3 Spielern moeglich, und in einer Lobby koennen bis zu 10 Personen mitspielen.
- Jede Person startet mit 8 Antwortkarten.
- Nur Nicht-Bosse reichen Antworten ein.
- Wer Karten tauscht, setzt die aktuelle Runde aus.
- Nur der aktuelle Rundenboss deckt Antworten auf und waehlt den Gewinner.
- Nur der aktuelle Rundenboss startet die naechste Runde.
- Der Boss rotiert zur naechsten verbundenen Person.

## Kartendaten

Aktueller Stand der Basisdaten:

- Basisfragen: 91
- Basisantworten: 160
- Variante `peppa-wutz`: 31 Fragen, 125 Antworten
- Erweiterung `alltagschaos`: 20 Fragen, 40 Antworten

Die Basisvariante `base` wird aus `server/data/base-questions.json` und `server/data/base-answers.json` aufgebaut.

- Alternative komplette Spielvarianten liegen unter `server/data/variants/<variant-id>/questions.json` und `server/data/variants/<variant-id>/answers.json`.
- Optionale Erweiterungen liegen unter `server/data/extensions/<extension-id>/questions.json` und `server/data/extensions/<extension-id>/answers.json` und koennen einer oder mehreren Varianten zugeordnet werden.

Beispielstruktur einer Erweiterung:

```json
{
  "name": "beispiel-erweiterung",
  "title": "Beispiel-Erweiterung",
  "description": "Zusaetzliche Karten fuer das Basis-Set.",
  "variants": ["base"],
  "questions": [
    { "text": "Das schlimmste Weihnachtsgeschenk aller Zeiten: ________.", "blanks": 1 }
  ]
}
```

```json
{
  "name": "beispiel-erweiterung",
  "title": "Beispiel-Erweiterung",
  "description": "Zusaetzliche Karten fuer das Basis-Set.",
  "variants": ["base"],
  "answers": [
    "Ein selbstgestrickter Pullover."
  ]
}
```

Beispielstruktur einer Spielvariante:

```json
{
  "name": "peppa-wutz",
  "title": "Peppa Wutz",
  "description": "Alltag, Matschepfuetzen und Dorfchaos fuer Erwachsene.",
  "questions": [
    { "text": "Papa Wutz versucht ein Meeting zu retten mit ________.", "blanks": 1 }
  ]
}
```

```json
{
  "name": "peppa-wutz",
  "title": "Peppa Wutz",
  "description": "Alltag, Matschepfuetzen und Dorfchaos fuer Erwachsene.",
  "answers": [
    "einem passiv-aggressiven Elternbrief"
  ]
}
```

Wichtig:

- `name` wird als Erweiterungskennung verwendet
- `variants` ordnet eine Erweiterung einer oder mehreren Varianten zu; ohne Eintrag wird `base` verwendet
- Varianten koennen optional `title` und `description` fuer die UI mitgeben
- Erweiterungen koennen optional ebenfalls `title` und `description` fuer die UI mitgeben
- Jede Variante und Erweiterung lebt in einem eigenen Unterordner mit genau zwei Dateien: `questions.json` und `answers.json`
- `questions.json` enthaelt nur Fragedaten, `answers.json` nur Antwortdaten
- `questions` enthaelt Objekte mit `text` und `blanks`
- `answers` enthaelt einfache String-Eintraege

Katalogverhalten in der App:

- `get-variants` liefert Varianten inklusive ihrer passenden Erweiterungen fuer die Hosting-UI.
- Beim Spielstart akzeptiert der Server nur Erweiterungen, die zur gewaehlten Variante gehoeren.
- Der resultierende Spielzustand spiegelt `activeVariant` und `activeExtensions` an Lobby und Spielclient zurueck.
- Client-Themes werden aktuell nicht aus JSON geladen, sondern in `client/src/theme.ts` anhand der Varianten-ID zugeordnet.

## Typische Entwickleraufgaben

### UI aendern

- Seiten liegen unter `client/src/pages/`
- wiederverwendbare Komponenten unter `client/src/components/`
- Styling vor allem in `client/src/styles/global.css`, `cards.css` und `game.css`
- Varianten-Themes werden in `client/src/theme.ts` aktiviert und ueber CSS-Overrides in den Stylesheets umgesetzt

### Spielregeln anpassen

- Logik in `server/src/game/GameState.ts`
- Zugriffsrechte und Events in `server/src/socket/handlers.ts`
- gemeinsame Schwellenwerte und Konstanten in `packages/game-rules/src/index.ts`

### Neue Karten hinzufuegen

- Basissets in `server/data/base-questions.json` und `server/data/base-answers.json`
- komplette Varianten in `server/data/variants/<variant-id>/questions.json` und `server/data/variants/<variant-id>/answers.json`
- optionale Erweiterungen in `server/data/extensions/<extension-id>/questions.json` und `server/data/extensions/<extension-id>/answers.json`
- bei einer neuen Variante mit eigenem Look auch `client/src/theme.ts` und die zugehoerigen CSS-Overrides erweitern

## Validierung nach Aenderungen

Empfohlener Mindestcheck:

```bash
pnpm lint
pnpm test
pnpm build
```

Wenn du an Echtzeit- oder Spiellogik arbeitest, zusaetzlich:

1. `pnpm dev` starten
2. mit zwei Browser-Sessions eine Lobby erstellen und beitreten
3. Start, Antworten, Reveal, Gewinnerwahl und naechste Runde einmal durchspielen

Wenn du Varianten, Erweiterungen oder Themes aenderst, pruefe zusaetzlich:

1. auf der Startseite zwischen allen Varianten wechseln
2. ob nur passende Erweiterungen angezeigt und aktivierbar sind
3. ob Lobby und Spiel das erwartete Theme der gewaehlten Variante uebernehmen

## Hinweise

- Das Repo ist auf `pnpm` ausgerichtet.
- Wenn jemand im laufenden Spiel die Verbindung verliert, pausiert die Partie bis zu 30 Sekunden fuer einen Reconnect und laeuft danach mit oder ohne diese Person weiter.
- Wer aktiv auf "Spiel verlassen" geht, wird sofort aus der laufenden Partie entfernt.
- Wenn nach Ablauf des Reconnect-Fensters in einer laufenden Partie weniger als 3 Spieler uebrig bleiben, wird das Spiel fuer alle abgebrochen.
- Socket-Events sind ACK-basiert, der Server antwortet also auf Aktionen direkt mit Erfolg oder Fehlermeldung.
- React StrictMode kann lokal kurz doppelte Mount-/Unmount-Zyklen verursachen; der Socket-Client ist deshalb auf Wiederverwendung mit Grace-Period ausgelegt.
- Automatisierte Tests laufen mit Vitest in Client und Server; fuer Gameplay-Aenderungen bleibt der manuelle Spielfluss mit zwei Sessions trotzdem wichtig.
