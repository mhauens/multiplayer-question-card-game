# Quickstart: Privacy-First Twitch-Chat-Voting mit Minimalrechten

## 1. Voraussetzungen

- Twitch-App mit gueltigem Redirect auf `/api/twitch/oauth/callback`
- Zwei Browser-Sitzungen fuer den Gameplay-Smoke-Test
- Optional zwei getrennte Twitch-Kanaele fuer den Isolations-Smoke-Test
- Optional Shared Chat auf Twitch, falls der Shared-Chat-Test manuell geprueft wird

## 2. Lokale Konfiguration

In `server/.env.local` oder einer gleichwertigen lokalen Env-Datei setzen:

```env
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
TWITCH_REDIRECT_URI=http://localhost:3001/api/twitch/oauth/callback
CLIENT_URL=http://localhost:5173
```

## 3. Entwicklung starten

```bash
pnpm install
pnpm dev
```

Danach:

- Client unter `http://localhost:5173`
- Server unter `http://localhost:3001`

## 4. Automatische Validierung

Vor Review oder Merge ausfuehren:

```bash
pnpm lint
pnpm test
pnpm build
```

## 5. Manueller Privacy- und Lifecycle-Test

1. Lobby in Browser A erstellen.
2. Mit Browser B beitreten.
3. Spiel starten und bis in eine Runde gelangen.
4. In Browser A Community-Voting starten.
5. Pruefen, dass vor OAuth zwingend der Privacy-Hinweis erscheint.
6. Pruefen, dass das Spiel kein eigenes Twitch-Login-Formular anzeigt.
7. OAuth erfolgreich abschliessen.
8. Pruefen, dass nur Browser A den verbundenen Kanal und eigene Tallies sieht.
9. Unerwarteten Disconnect fuer Browser A simulieren.
10. Pruefen, dass das Spiel pausiert und keine neuen Votes verarbeitet.
11. Innerhalb des Reconnect-Fensters wiederverbinden.
12. Pruefen, dass dieselbe Twitch-Verbindung, derselbe Voting-Kontext und dieselben eingefrorenen Tallies fortgesetzt werden.
13. Danach Leave, Kick und Spielende pruefen und bestaetigen, dass Twitch-Daten entfernt werden.

## 6. Manueller Zwei-Kanal-Isolationstest

1. Zwei Spieler verbinden je einen unterschiedlichen Twitch-Kanal.
2. Bei beiden Spielern Community-Voting aktivieren.
3. In jedem Kanal getrennte `!card`-Votes senden.
4. Pruefen, dass Overlays, Tallies und Kanalnamen nur beim jeweiligen Spieler erscheinen.
5. Pruefen, dass kein Vote des einen Kanals die Tallies des anderen Spielers beeinflusst.

## 7. Manueller Shared-Chat-Test

1. Shared Chat fuer einen verbundenen Kanal aktivieren.
2. Stimmen aus eigener Community senden.
3. Stimmen aus einer fremden Shared-Chat-Quelle senden.
4. Pruefen, dass nur Stimmen mit leerem oder eigenem `source_broadcaster_user_id` in die Tallies eingehen.
5. Pruefen, dass die UI `sharedChatActive` sichtbar macht und die Einschraenkung erklaert.

## 8. Datenschutzpruefung

1. Browser-Devtools oeffnen und Local Storage, Session Storage und URL pruefen.
2. Bestaetigen, dass keine Twitch-Tokens oder OAuth-Codes auftauchen.
3. Server-Logs pruefen.
4. Bestaetigen, dass keine Tokens, vollstaendigen Chat-Nachrichten oder sensitiven Payloads geloggt werden.