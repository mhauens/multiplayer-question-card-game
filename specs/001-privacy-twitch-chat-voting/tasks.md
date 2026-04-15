# Tasks: Privacy-First Twitch-Chat-Voting mit Minimalrechten

**Input**: Design documents from `/specs/001-privacy-twitch-chat-voting/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests and Validation**: Die Spezifikation verlangt automatisierte Unit- und Integrationstests fuer Privacy-Hinweis, Command-Parsing, Vote-Aggregation, Mehrfachluecken-Empfehlungen, Shared Chat, Isolation, Datenschutz und Lifecycle. Zusaetzlich sind `pnpm lint`, `pnpm test`, `pnpm build`, ein manueller Zwei-Browser-Smoke-Test sowie getrennte Zwei-Kanal- und Shared-Chat-Tests erforderlich.

**Organization**: Tasks sind nach User Story gegliedert, damit jede Story nachvollziehbar implementiert und getestet werden kann.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Gemeinsame Vertrags- und Dokumentationsbasis fuer die Feature-Umsetzung vorbereiten.

- [x] T001 Zentralisiere Community-Voting-Enums, Statuswerte und abgeleitete Hilfstypen in packages/game-rules/src/index.ts
- [x] T002 [P] Richte die Client- und Server-Typoberflaechen auf die Shared-Contract-Exporte in client/src/types.ts und server/src/types.ts aus
- [x] T003 [P] Aktualisiere die Twitch-Umgebungsvariablen, Privacy-Hinweise und manuellen Validierungsschritte in README.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Blocking-Prerequisites fuer Statusmodell, Lifecycle und Sanitizing schaffen, bevor Story-spezifische Arbeit beginnt.

**⚠️ CRITICAL**: Keine User-Story-Arbeit beginnt vor Abschluss dieser Phase.

- [x] T004 Implementiere das erweiterte Community-Voting-Statusmodell und Kontext-Reset-Grundlagen in server/src/game/GameState.ts
- [x] T005 [P] Erweitere OAuth-, EventSub-, Minimal-Scope-, Duplicate-Channel- und Cleanup-Grundlagen fuer privacy-sichere Verbindungszustandswechsel in server/src/twitch/TwitchService.ts und server/src/game/GameState.ts
- [x] T006 [P] Richte Socket-ACKs, Reconnect-Gating und Sanitizing fuer die Community-Voting-Flows in server/src/socket/handlers.ts ein
- [x] T007 Verdrahte den Twitch-Callback und den sanitisierten Player-State-Ausgang in server/src/index.ts
- [x] T008 Richte den Client-Kontext fuer warning_required-, connecting- und sanitisierten Community-Voting-State in client/src/context/GameContext.tsx ein

**Checkpoint**: Shared Contracts, Server-Grundlagen und Client-State sind bereit; User Stories koennen jetzt umgesetzt werden.

---

## Phase 3: User Story 1 - Eigene Community sicher verbinden (Priority: P1) 🎯 MVP

**Goal**: Spieler koennen ihren eigenen Twitch-Kanal erst nach bestaetigtem Privacy-Hinweis sicher verbinden und sehen ausschliesslich ihre eigene Verbindung.

**Independent Test**: Ein Spieler bestaetigt den Privacy-Hinweis, startet den OAuth-Flow, verbindet erfolgreich seinen Kanal und kein anderer Spieler sieht seine Verbindungsdetails.

### Tests for User Story 1 ⚠️

- [x] T009 [P] [US1] Erstelle Client-Tests fuer Privacy-Hinweis, Popup-Gating und nicht-persistente Session-Bestaetigung in client/src/context/GameContext.twitch.test.tsx
- [x] T010 [P] [US1] Erweitere OAuth-Callback-, Minimal-Scope-, State-Validierungs- und Duplicate-Channel-Tests in server/test/TwitchService.test.ts

### Implementation for User Story 1

- [x] T011 [US1] Implementiere den verpflichtenden Privacy-Hinweis und den sitzungsbezogenen Acknowledgement-Flow in client/src/context/GameContext.tsx
- [x] T012 [P] [US1] Rendere warning_required-, connecting-, connected- und error-Zustaende im Verbindungsbereich in client/src/components/CommunityVotingPanel.tsx
- [x] T013 [US1] Setze OAuth-Start mit minimalem Scope-Set, duplicate-channel-sichere Kanalbindung, Callback-Erfolg und nicht-sensitive Popup-Antworten in server/src/twitch/TwitchService.ts um
- [x] T014 [US1] Pflege die sanitisierten Verbindungszustandsuebergaenge pro Spieler in server/src/game/GameState.ts
- [x] T015 [US1] Stelle pro-Spieler-Connect/Disconnect-ACKs und isolierte State-Updates in server/src/socket/handlers.ts sicher
- [x] T016 [US1] Aktualisiere die sichtbaren Community-Voting-Typen fuer Session-Acknowledgement und neue Connection-Status in client/src/types.ts und server/src/types.ts

**Checkpoint**: Der sichere, privacy-first Twitch-Connect-Flow ist end-to-end funktionsfaehig und fuer andere Spieler unsichtbar.

---

## Phase 4: User Story 2 - Beratendes Voting pro Spielsituation nutzen (Priority: P2)

**Goal**: Spieler sehen in beiden Voting-Kontexten nur ihre eigenen `!card`-Overlays, Tallies und Empfehlungen; das Voting bleibt rein beratend.

**Independent Test**: Ein verbundener Spieler aktiviert Community-Voting und sieht in `SUBMIT_HAND` oder `JUDGE_SUBMISSIONS` nur fuer seine sichtbaren Optionen aktualisierte Tallies aus gueltigen `!card <nummer>`-Nachrichten.

### Tests for User Story 2 ⚠️

- [x] T017 [P] [US2] Erweitere Parser- und Shared-Chat-Filtertests fuer gueltige und ungueltige `!card`-Nachrichten in server/test/CommunityVoting.test.ts
- [x] T018 [P] [US2] Erweitere Kontext-, Aggregations- und Mehrfachluecken-Empfehlungstests in server/test/GameState.test.ts
- [x] T019 [P] [US2] Erweitere Isolations- und per-Spieler-`game-state`-Tests fuer Community-Voting in server/test/SocketHandlers.test.ts

### Implementation for User Story 2

- [x] T020 [US2] Zentralisiere Parsergrenzen, Vote-Command-Ableitung und Community-Voting-Hilfen in packages/game-rules/src/index.ts und server/src/twitch/communityVoting.ts
- [x] T021 [US2] Implementiere pro Kontext die letzte-gueltige-Stimme-Aggregation, Leading-Logik und Mehrfachluecken-Empfehlung in server/src/game/GameState.ts
- [x] T022 [US2] Wende Chat-Notification-Verarbeitung und Shared-Chat-Source-Filterung in server/src/twitch/TwitchService.ts an
- [x] T023 [P] [US2] Rendere `!card N`-Overlays, Tallies und Empfehlungen fuer Nicht-Boss-Handkarten in client/src/components/PlayerHand.tsx
- [x] T024 [P] [US2] Rendere `!card N`-Overlays, Tallies und Empfehlungen fuer Boss-Submissions in client/src/components/SubmittedAnswers.tsx
- [x] T025 [US2] Aktualisiere Kontext-Copy, Voter-Zusammenfassung und beratende Hinweise in client/src/components/CommunityVotingPanel.tsx und client/src/pages/Game.tsx

**Checkpoint**: Beratendes Voting funktioniert in beiden Kontexte mit parserkorrekten, isolierten Tallies und automatisiert nichts.

---

## Phase 5: User Story 3 - Datenschutz und Lifecycle sauber einhalten (Priority: P3)

**Goal**: Twitch-bezogene Daten bleiben fluechtig, Reconnect-Pausen frieren Voting ein und alle Lifecycle-Ereignisse raeumen die Verbindung sauber auf.

**Independent Test**: Disconnect, Reconnect, Leave, Kick, Spielende und Shared Chat koennen durchgespielt werden, ohne Tokens, Chatdaten oder stale Tallies zu hinterlassen.

### Tests for User Story 3 ⚠️

- [x] T026 [P] [US3] Erweitere Lifecycle-Tests fuer Reconnect-Freeze, Leave, Kick und Spielende in server/test/SocketHandlers.test.ts
- [x] T027 [P] [US3] Erweitere Privacy-, Revocation- und Subscription-Cleanup-Tests in server/test/TwitchService.test.ts
- [x] T028 [P] [US3] Erweitere Browser-Storage- und nicht-sensitive-Fehler-Regressionstests in client/src/context/GameContext.twitch.test.tsx

### Implementation for User Story 3

- [x] T029 [US3] Erhalte bestehende Twitch-Verbindungen im Reconnect-Fenster und friere Tallies waehrend Pausen in server/src/game/GameState.ts ein
- [x] T030 [US3] Implementiere privacy-sicheres Disconnect-, Revocation-, Resubscribe- und Best-Effort-Cleanup-Verhalten in server/src/twitch/TwitchService.ts
- [x] T031 [US3] Stelle sicher, dass Leave-, Kick-, Cleanup- und Game-End-Flows Twitch-Zustand abbauen in server/src/socket/handlers.ts und server/src/index.ts
- [x] T032 [US3] Entferne jede Twitch-bezogene Browserpersistenz und beschraenke Client-Fehler auf nicht-sensitive Meldungen in client/src/context/GameContext.tsx und client/src/components/CommunityVotingPanel.tsx

**Checkpoint**: Twitch-Daten bleiben fluechtig, Reconnect verhält sich spezifikationskonform und Cleanup entfernt alle Laufzeitreste.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Story-uebergreifende Qualitaet, Dokumentation und abschliessende Validierung.

- [x] T033 [P] Aktualisiere die spielergerichteten Regeln und Hilfetexte fuer beratendes Twitch-Voting in client/src/components/RulesModal.tsx und client/src/components/CommunityVotingPanel.tsx
- [x] T034 [P] Konsolidiere story-uebergreifende Regressionen fuer Isolation, Privacy und Lifecycle in server/test/TwitchService.test.ts und server/test/SocketHandlers.test.ts
- [x] T035 Fuehre `pnpm lint` im Repository-Root aus
- [x] T036 Fuehre `pnpm test` im Repository-Root aus
- [x] T037 Fuehre `pnpm build` im Repository-Root aus
- [ ] T038 Fuehre den manuellen Zwei-Browser-Gameplay-Smoke-Test aus spec.md und specs/001-privacy-twitch-chat-voting/quickstart.md aus
- [ ] T039 Fuehre den manuellen Zwei-Kanal- und Shared-Chat-Privacy-Test aus specs/001-privacy-twitch-chat-voting/quickstart.md aus

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** startet sofort.
- **Phase 2: Foundational** haengt von Phase 1 ab und blockiert alle User Stories.
- **Phase 3: US1** startet nach Phase 2 und liefert das MVP fuer sicheren Twitch-Connect.
- **Phase 4: US2** startet nach Phase 2; fuer die vollstaendige End-to-End-Demo ist ein funktionierender Connect-Flow aus US1 hilfreich.
- **Phase 5: US3** startet nach Phase 2; sie haertet Lifecycle- und Privacy-Verhalten ueber die vorherigen Stories hinweg.
- **Phase 6: Polish** startet erst nach den gewuenschten User Stories.

### User Story Dependencies

- **US1 (P1)**: Keine Abhaengigkeit auf andere Stories; liefert den MVP.
- **US2 (P2)**: Abhaengig nur von Setup + Foundational; nutzt den vorhandenen oder mit US1 vervollstaendigten Connect-Flow fuer die End-to-End-Verifikation.
- **US3 (P3)**: Abhaengig nur von Setup + Foundational; validiert und haertet die Laufzeitpfade ueber bestehende Voting-Flows hinweg.

### Within Each User Story

- Tests zuerst schreiben und fehlschlagen lassen.
- Serverautoritaet und Shared-Contract-Anpassungen vor UI-only-Arbeit umsetzen.
- Lifecycle- und Sanitizing-Logik vor Copy- und Hilfetext-Polish abschliessen.

### Parallel Opportunities

- **Setup**: T002 und T003 koennen parallel laufen.
- **Foundational**: T005 und T006 koennen parallel laufen, sobald T004 begonnen ist.
- **US1**: T009 und T010 koennen parallel laufen; T012 kann nach T011 parallel zu T013 vorbereitet werden.
- **US2**: T017, T018 und T019 koennen parallel laufen; T023 und T024 koennen parallel laufen, nachdem T021 den Server-Output stabilisiert hat.
- **US3**: T026, T027 und T028 koennen parallel laufen.

---

## Parallel Example: User Story 2

```bash
# Tests parallel vorbereiten
Task: "Erweitere Parser- und Shared-Chat-Filtertests in server/test/CommunityVoting.test.ts"
Task: "Erweitere Kontext-, Aggregations- und Mehrfachluecken-Empfehlungstests in server/test/GameState.test.ts"
Task: "Erweitere Isolations- und per-Spieler-game-state-Tests in server/test/SocketHandlers.test.ts"

# UI-Rendering parallel umsetzen, nachdem der Server-Output stabil ist
Task: "Rendere !card N-Overlays fuer Nicht-Boss-Handkarten in client/src/components/PlayerHand.tsx"
Task: "Rendere !card N-Overlays fuer Boss-Submissions in client/src/components/SubmittedAnswers.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 abschliessen.
2. Phase 2 abschliessen.
3. Phase 3 fuer US1 abschliessen.
4. US1 mit den zugehoerigen Tests und einem lokalen Connect-Flow validieren.

### Incremental Delivery

1. Setup + Foundational abschliessen.
2. US1 liefern und validieren.
3. US2 fuer sichtbare, beratende Tallies in beiden Kontexte liefern und validieren.
4. US3 fuer Privacy- und Lifecycle-Haertung liefern und validieren.
5. Abschliessende Polish- und Validierungsphase ausfuehren.

### Parallel Team Strategy

1. Ein Entwickler bearbeitet Shared Contracts und Server-Grundlagen.
2. Ein Entwickler bearbeitet parallel Client-State und Verbindungspanel nach Abschluss der Foundations.
3. Danach koennen Voting-Rendering und Lifecycle-Haertung getrennt umgesetzt werden, solange Dateikonflikte beachtet werden.

---

## Notes

- `[P]` bedeutet: andere Dateien, keine Abhaengigkeit auf unfertige Aufgaben.
- `[US1]`, `[US2]`, `[US3]` markieren die Rueckverfolgbarkeit zur jeweiligen User Story.
- Jede Story bleibt pruefbar, auch wenn die Gesamtfunktion inkrementell geliefert wird.
- Die finalen Validierungsschritte aus Phase 6 sind fuer shipped code nicht optional.
