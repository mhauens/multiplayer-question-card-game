# Implementation Plan: Privacy-First Twitch-Chat-Voting mit Minimalrechten

**Branch**: `[001-privacy-twitch-chat-voting]` | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-privacy-twitch-chat-voting/spec.md`

**Note**: This plan reflects the current pnpm workspace and the already vorhandene Twitch-Community-Voting-Basis im Repository. Die Umsetzung fokussiert auf Spezifikationsabgleich, Privacy-Haertung und gemeinsame Vertragsgrenzen statt auf einen Greenfield-Neubau.

## Summary

Die Funktion baut auf der bestehenden In-Memory-Twitch-Integration auf und haertet sie zu einer privacy-first, spielerindividuell isolierten Voting-Loesung. Der Schwerpunkt liegt auf drei Arbeitspaketen: erstens Privacy- und Lifecycle-Haertung fuer OAuth, fluechtige Twitch-Daten, Reconnect und Cleanup; zweitens gemeinsame Vertragsgrenzen fuer Voting-Kontexte, Statuswerte und `!card`-Parsing zwischen Client, Server und Tests; drittens UI- und State-Anpassungen, damit der verpflichtende Privacy-Hinweis, verbindungsspezifische Status und individuelle Tallies exakt der Spezifikation entsprechen.

## Technical Context

**Language/Version**: TypeScript 6, Node.js 22+, React 19  
**Primary Dependencies**: Express 5, Socket.IO 4, Vite 8, React Router 7, Vitest 3, `@kgs/game-rules` workspace package  
**Storage**: Server-RAM fuer Gameplay- und Twitch-Laufzeitdaten; keine persistente Twitch-Speicherung; Browser-Storage hoechstens fuer bestehende, nicht-Twitch-bezogene Reconnect-Metadaten des Spiels, niemals fuer Twitch-Daten, OAuth-Artefakte oder Community-Voting-Zustand  
**Testing**: Vitest fuer Client und Server, plus manuelle Zwei-Browser- und Zwei-Kanal-Smoke-Tests  
**Target Platform**: Web-Anwendung mit React-Client im Browser und Node/Express/Socket.IO-Server  
**Project Type**: pnpm-Monorepo fuer Echtzeit-Web-App mit Client, Server und Shared-Contract-Paket  
**Performance Goals**: Vote-Aenderungen sollen beim betroffenen Spieler im naechsten Server-Emit sichtbar werden; keine Speicherung von Chat-Historie; Echtzeitverhalten fuer laufende Partien bleibt unveraendert  
**Constraints**: Nur `user:read:chat`; keine Twitch-Tokens in URL, Local Storage, Session Storage oder Logs; Voting bleibt beratend; Reconnect-Pausen frieren Voting ein; UI-Copy bleibt deutsch  
**Scale/Scope**: Bis zu 8 Spieler pro Lobby, optional je Spieler eine eigene Twitch-Verbindung, 4 EventSub-Subscriptions pro verbundenem Kanal, 2 Voting-Kontexte pro Spieler

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate

- **PASS** Server authority preserved: Gameplay-Status, Phasenwechsel, Reconnect-Fenster, Vote-Annahme und Gewinnerauswahl bleiben serverseitig in `server/src/game/GameState.ts` und `server/src/socket/handlers.ts` verankert; der Client zeigt nur Status, Hinweise und Tallies an.
- **PASS** Cross-stack impact mapped: Server-Logik und Lifecycle in `server/src/game/GameState.ts`, Socket-Autorisierung in `server/src/socket/handlers.ts`, Twitch-Integration in `server/src/twitch/TwitchService.ts` und `server/src/twitch/communityVoting.ts`, Client-State in `client/src/context/GameContext.tsx`, Anzeige in `client/src/components/CommunityVotingPanel.tsx`, `client/src/components/PlayerHand.tsx`, `client/src/components/SubmittedAnswers.tsx`, sowie Hilfetexte im Client.
- **PASS** Shared contract respected: Voting-Kontexte, erlaubte `!card`-Befehlsgrenzen, sichtbare Community-Voting-Status und ggf. gemeinsame Status-/Typableitungen werden in `packages/game-rules/src/index.ts` zentralisiert, statt lokal in Client und Server auseinanderzulaufen.
- **PASS** Content model preserved: Keine Karten-, Varianten-, Erweiterungs- oder Theme-Kataloge werden geaendert; die Funktion arbeitet auf bereits sichtbaren Optionen des bestehenden JSON-Katalogs.
- **PASS** Validation planned: `pnpm lint`, `pnpm test`, `pnpm build`, manueller Zwei-Browser-Smoke-Test, manueller Zwei-Twitch-Kanaele-Test und manueller Shared-Chat-Test sind eingeplant.

### Post-Design Re-check

- **PASS** Server authority preserved: Das Datenmodell haelt Vote-Aggregation, Kontextwechsel und Reconnect-Freeze im Server-RAM; die Contracts exponieren nur den sanitisierten Spielerblick.
- **PASS** Cross-stack impact mapped: Die Design-Artefakte trennen Server-Runtime, Client-Sicht und Socket-/HTTP-Vertraege sauber und decken dieselben Dateigruppen wie im Gate ab.
- **PASS** Shared contract respected: Die Designentscheidung sieht ein erweitertes Shared-Contract-Set in `@kgs/game-rules` fuer Voting-Kontextarten, Parsergrenzen und Statuswerte vor.
- **PASS** Content model preserved: Keine Datenmodell- oder Contract-Aenderung greift in Kartenkataloge oder Variantenkompatibilitaet ein.
- **PASS** Validation planned: Quickstart und Research dokumentieren die automatischen und manuellen Validierungsschritte vollstaendig.

## Project Structure

### Documentation (this feature)

```text
specs/001-privacy-twitch-chat-voting/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── client-community-voting-state.md
│   ├── community-voting-socket-events.md
│   └── twitch-oauth-callback.md
└── tasks.md
```

### Source Code (repository root)

```text
client/
├── src/
│   ├── components/
│   │   ├── CommunityVotingPanel.tsx
│   │   ├── PlayerHand.tsx
│   │   └── SubmittedAnswers.tsx
│   ├── context/
│   │   ├── GameContext.tsx
│   │   └── GameContext.twitch.test.tsx
│   ├── pages/
│   │   └── Game.tsx
│   └── types.ts
packages/
└── game-rules/
    └── src/
        └── index.ts
server/
├── src/
│   ├── game/
│   │   └── GameState.ts
│   ├── socket/
│   │   └── handlers.ts
│   ├── twitch/
│   │   ├── communityVoting.ts
│   │   └── TwitchService.ts
│   ├── index.ts
│   └── types.ts
└── test/
    ├── CommunityVoting.test.ts
    ├── GameState.test.ts
    ├── SocketHandlers.test.ts
    └── TwitchService.test.ts
```

**Structure Decision**: Es bleibt bei der bestehenden Monorepo-Aufteilung `client` / `server` / `packages/game-rules`. Die Twitch-Laufzeit bleibt serverseitig in `server/src/twitch/`, der per-Spieler-Spielzustand bleibt in `server/src/game/`, waehrend `packages/game-rules` die gemeinsam verwendeten Voting-Kontext- und Parsergrenzen aufnimmt.

## Complexity Tracking

Keine konstitutionellen Ausnahmen erforderlich.

## Phase 0: Research Summary

- Die bestehende Architektur kann die Funktion ohne neue Persistenzschicht tragen; noetig sind Privacy-Haertung, Statusmodell-Abgleich und zentralisierte Vertragsgrenzen.
- Twitch EventSub WebSockets mit User Access Token und `user:read:chat` decken `channel.chat.message` ab; Shared-Chat-Events benoetigen keine zusaetzlichen Scopes.
- Der aktuelle Server multiplexed bereits mehrere Spielerverbindungen ueber eine EventSub-WebSocket-Session; der Plan behaelt das bei und fokussiert auf sauberes Resubscribe- und Cleanup-Verhalten.
- Die aktuelle Client-Implementierung nutzt bereits einen Blocking-Privacy-Hinweis per `window.confirm`; der Plan formalisiert daraus einen expliziten Session-Status und trennt Warnhinweis, Verbindungsaufbau und Fehlerzustand im Client-State.

## Phase 1: Design Summary

- Das Datenmodell trennt strikt zwischen serverseitiger Twitch-Runtime mit Tokens/Subscriptions, sanitisiertem Client-Community-Voting-State und kurzlebigem OAuth-State.
- Die Contracts definieren drei Grenzflaechen: HTTP-Callback inklusive Popup-`postMessage`, Socket-Events fuer Connect/Disconnect/Enable, und den `communityVoting`-Slice innerhalb von `ClientGameState`.
- Quickstart dokumentiert Env-Setup, automatische Tests und manuelle Reconnect-/Shared-Chat-Smoke-Tests.

## Implementation Strategy

1. **Shared Contract zuerst**: Parsergrenzen, Voting-Kontextarten und Connection-Status in `packages/game-rules` zentralisieren und die lokalen Typen in Client/Server darauf ausrichten.
2. **Server-Haertung**: `TwitchService`, `communityVoting` und `GameState` auf Privacy-Status, Reconnect-Fortsetzung, Cleanup, Revocation-Handling und logfreie Fehlerpfade abstimmen.
3. **Client-UX und Isolation**: `GameContext`, `CommunityVotingPanel`, `PlayerHand` und `SubmittedAnswers` auf das neue Statusmodell, den verpflichtenden Warnhinweis pro Sitzung und spielerindividuelle Overlays/Tallies anpassen.
4. **Validierung ausbauen**: Parser-, Aggregations-, Isolation-, Datenschutz-, Minimal-Scope- und Lifecycle-Tests auf Serverseite ergaenzen; Client-Tests fuer Privacy-Hinweis, nicht-persistente Session-Bestaetigung und spielerbezogene State-Sicht in `client/src/context/GameContext.twitch.test.tsx` ergaenzen; danach manuelle Mehrspieler-Smoke-Tests durchfuehren.
