# Feature Specification: Erweiterte End-of-Game-Stats + Spielerlimit auf 10

**Feature Branch**: `[002-endgame-stats-player-cap]`  
**Created**: 2026-04-16  
**Status**: Draft  
**Input**: User description: "Plan: Erweiterte End-of-Game-Stats + Spielerlimit auf 10"

## Clarifications

### Session 2026-04-16

- Q: Welche Spieler zaehlen fuer die Endscreen-Statistik und alle Highlights? → A: Nur Spieler, die beim GAME_OVER noch Teil der Partie sind, zaehlen fuer die Endscreen-Statistik und alle Highlights.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Groessere Runden zulassen (Priority: P1)

Als Spielgruppe moechte ich mit bis zu 10 Spielern einer Partie beitreten koennen, damit groessere Runden ohne Regelbruch starten und vollstaendig gespielt werden koennen.

**Why this priority**: Das neue Spielerlimit ist eine Kernregel fuer Lobbybeitritt und bestimmt, ob die Partie fuer groessere Gruppen ueberhaupt startbar ist.

**Independent Test**: Kann unabhaengig getestet werden, indem neun Spieler einer Lobby beitreten, ein zehnter Spieler erfolgreich beitritt und ein elfter Spieler abgewiesen wird.

**Acceptance Scenarios**:

1. **Given** eine Lobby hat noch weniger als 10 Spieler, **When** ein weiterer Spieler beitritt, **Then** wird der Beitritt bis zum zehnten Spieler akzeptiert.
2. **Given** eine Lobby hat bereits 10 Spieler, **When** ein elfter Spieler beitritt, **Then** wird der Beitritt abgewiesen und das Limit wird eindeutig kommuniziert.
3. **Given** ein Spieler oeffnet Regeln oder Lobby-Hinweise, **When** die maximale Spielerzahl angezeigt wird, **Then** wird 10 statt 8 angezeigt.

---

### User Story 2 - Match-Verlauf am Ende verstehen (Priority: P2)

Als Spieler moechte ich nach Spielende eine strukturierte Match-Zusammenfassung mit Highlights und Pro-Spieler-Statistiken sehen, damit ich den Verlauf der Partie schnell nachvollziehen kann.

**Why this priority**: Der Endscreen gewinnt nur dann neuen Wert, wenn er mehr als die Endrangliste liefert und die wichtigsten Matchmuster auf einen Blick sichtbar macht.

**Independent Test**: Kann unabhaengig getestet werden, indem eine Partie bis zum Spielende gespielt wird und auf dem Endscreen die neue Summary, Highlight-Karten und die Statustabelle fuer die beim GAME_OVER noch aktiven Spieler sichtbar sind.

**Acceptance Scenarios**:

1. **Given** eine Partie erreicht GAME_OVER, **When** der Endscreen erscheint, **Then** werden Siegerbanner, Endrangliste, Rundenzahl und die neue Match-Zusammenfassung gemeinsam fuer die beim GAME_OVER noch aktiven Spieler angezeigt.
2. **Given** zwei oder mehr Spieler fuehren bei einer Highlight-Kategorie gleichauf, **When** der Endscreen die Highlights rendert, **Then** werden alle Fuehrenden gemeinsam angezeigt.
3. **Given** eine Highlight-Kategorie hat als Fuehrungswert 0, **When** der Endscreen gerendert wird, **Then** wird diese Kategorie ausgeblendet, waehrend die Gesamtrunden immer sichtbar bleiben.

---

### User Story 3 - Match-Statistiken korrekt zuruecksetzen (Priority: P3)

Als Spieler moechte ich, dass Match-Statistiken nur die aktuelle Partie abbilden und nach einem Rematch sauber neu beginnen, damit keine alten Werte in die naechste Runde oder Partie uebernommen werden.

**Why this priority**: Die neue Statistik ist nur dann verlaesslich, wenn sie sich klar auf die laufende Partie beschraenkt und bei einem Neubeginn keine historischen Reste enthaelt.

**Independent Test**: Kann unabhaengig getestet werden, indem eine Partie beendet, ein Rematch gestartet und geprueft wird, dass alle neuen Werte zurueckgesetzt sind und vor GAME_OVER keine Endgame-Stats sichtbar sind.

**Acceptance Scenarios**:

1. **Given** die Partie laeuft noch nicht zu Ende, **When** ein Client den Spielzustand betrachtet, **Then** sind Endgame-Stats nicht sichtbar.
2. **Given** eine Partie endet, **When** der Endscreen geladen wird, **Then** enthalten die Stats die erwarteten Spielerzeilen, Highlights und die Gesamtrunden der laufenden Partie.
3. **Given** eine neue Partie wird per Rematch gestartet, **When** der erste neue Spielzug beginnt, **Then** sind Bossrunden, Abgaben, Tauschaktionen und Siegesserien aller Spieler wieder auf dem Startwert.

### Edge Cases

- Gleichstaende in Highlight-Kategorien muessen mehrere Fuehrende gleichzeitig anzeigen.
- Highlight-Kategorien mit Fuehrungswert 0 duerfen nicht als Karte erscheinen; die Gesamtrunden muessen dennoch immer sichtbar bleiben.
- Spieler, die die Partie vor Spielende verlassen, erhalten keine eigene Zeile im Endscreen.
- Die bestehende Rundenchronik bleibt erhalten; die neuen End-of-Game-Stats kommen zusaetzlich dazu und ersetzen das Round-Recap nicht.
- Kleinere Kartensets unterhalb der Vollvarianten-Formel bleiben startbar; es wird kein neues Hard-Blocking nur wegen der Setgroesse eingefuehrt.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Das System MUSS das globale Spielerlimit von 8 auf 10 erhoehen und den Beitritt zur Lobby sowie alle damit verbundenen Limitpruefungen entsprechend aktualisieren.
- **FR-002**: Das System MUSS Spielerlimit, Beitrittsgrenzen und passende Hinweise in Lobby, Regeln und allen sichtbaren Hilfstexten konsistent mit 10 Spielern ausweisen.
- **FR-003**: Das System MUSS die vorhandene Endrangliste beibehalten und nach Spielende zusaetzlich eine strukturierte Match-Zusammenfassung anzeigen.
- **FR-004**: Das System MUSS die Match-Zusammenfassung erst nach Spielende verfuegbar machen und waehrend aller anderen Phasen leer oder nicht sichtbar halten.
- **FR-005**: Das System MUSS pro laufender Partie je Spieler Bossrunden, erfolgreiche Abgaben, erfolgreiche Tauschaktionen sowie aktuelle und laengste Siegesserie erfassen.
- **FR-006**: Das System MUSS Bossrunden bei Beginn jeder neuen Runde fuer den jeweils aktiven Boss erhoehen.
- **FR-007**: Das System MUSS Abgaben nur dann erhoehen, wenn eine Abgabe erfolgreich angenommen wurde.
- **FR-008**: Das System MUSS Tauschaktionen nur dann erhoehen, wenn ein Handtausch erfolgreich abgeschlossen wurde.
- **FR-009**: Das System MUSS Siegesserien bei der Gewinnerauswahl so aktualisieren, dass der Gewinner seine Serie erhoeht und alle anderen ihre aktuelle Serie verlieren.
- **FR-010**: Das System MUSS bei Rematch und bei einer neu gestarteten Partie alle Match-Statistiken auf die Startwerte zuruecksetzen.
- **FR-011**: Das System MUSS eine Gesamtrundenzahl, eine per-Spieler-Statustabelle und Highlight-Karten fuer laengste Siegesserie, meiste Bossrunden, meiste Abgaben und meiste Tauschaktionen bereitstellen.
- **FR-012**: Das System MUSS bei Highlight-Karten mehrere Fuehrende gemeinsam anzeigen, wenn sich der Bestwert auf mehrere Spieler verteilt.
- **FR-013**: Das System MUSS Highlight-Kategorien mit Fuehrungswert 0 ausblenden und die Gesamtrundenzahl immer anzeigen.
- **FR-014**: Das System MUSS die Spielerzeilen in der Match-Zusammenfassung an der Endrangliste ausrichten, also zuerst nach Trophaeen absteigend und danach bei Gleichstand stabil nach Name sortieren.
- **FR-015**: Das System MUSS die Match-Zusammenfassung auf die Spieler begrenzen, die beim GAME_OVER noch Teil der Partie sind.
- **FR-016**: Das System MUSS die gemeinsamen Regelgrenzen in `packages/game-rules` auf 10 Spieler aktualisieren und die daraus abgeleiteten Mindestwerte fuer Vollvarianten auf 80 Antworten und 91 Fragen setzen.
- **FR-017**: Das System MUSS sicherstellen, dass kleine Kartensets unterhalb der Vollvarianten-Mindestwerte technisch weiterhin startbar bleiben und nicht allein wegen der Setgroesse blockiert werden.
- **FR-018**: Das System MUSS alle sichtbaren Regeln, Hilfetexte und verknuepften Tests, die 8 Spieler oder alte Mindestwerte nennen, auf die neuen Zahlen umstellen.

### Constitution Alignment *(mandatory)*

- **Authority Impact**: Die Serverautoritaet bleibt intakt. Diese Aenderung erweitert serverseitig gefuehrte Match-Statistiken, aktualisiert das globale Spielerlimit und zieht die dazugehoerigen Regeln und Ausgaben nach.
- **Affected Layers**: `client`: ja, fuer Endscreen, Lobby-Anzeigen, Regeln und sichtbare Statustexte. `server`: ja, fuer Match-Statistik, Limitpruefung und Endscreen-Daten. `packages/game-rules`: ja, fuer das gemeinsame Spielerlimit und die daraus abgeleiteten Mindestwerte. `card data`: nein. `user-facing rules/help copy`: ja, fuer Lobby, Regeln und Produkttexte.
- **Shared Contract Changes**: Die gemeinsamen Regelgrenzen muessen das neue Spielerlimit 10 sowie die abgeleiteten Vollvarianten-Mindestwerte 80 Antworten und 91 Fragen eindeutig enthalten. Ausserdem muessen die End-of-Game-Daten eine Gesamtrundenzahl, Spielerzeilen und Highlight-Kategorien mit mehreren Fuehrenden ausdruecken koennen.
- **Catalog Impact**: Die Kartenkataloge, Varianten und Erweiterungen bleiben unveraendert. Es wird weder neuer Karteninhalt geplant noch eine harte Validierung gegen kleinere Kartensaetze eingefuehrt.
- **Validation Scope**: Erfordert `pnpm lint`, `pnpm test` und `pnpm build` sowie einen manuellen Smoke-Test mit zwei Browser-Sitzungen. Zusaetzlich ist ein Lobby-Test mit dem 10. und 11. Spieler notwendig.

### Key Entities *(include if feature involves data)*

- **Match Statistics Summary**: Die strukturierte End-of-Game-Zusammenfassung mit Gesamtrundenzahl, Highlight-Karten und Pro-Spieler-Zeilen.
- **Player Match Stats**: Die je Spieler und je Partie gefuehrten Werte fuer Trophaeen, Bossrunden, Abgaben, Tauschaktionen, aktuelle Siegesserie und laengste Siegesserie.
- **Highlight Category**: Eine verdichtete Kennzahl mit Titel, Bestwert und Liste aller Fuehrenden.
- **Round Recap**: Die bestehende Rundenchronik, die erhalten bleibt und durch die neuen Stats ergaenzt wird.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In einem manuellen Lobby-Test duerfen 10 Spieler einer Partie beitreten, waehrend der 11. Spieler in 100% der Faelle abgewiesen wird.
- **SC-002**: In Tests und Smoke-Checks zeigen 100% der betroffenen Lobby- und Regelansichten das Spielerlimit 10 statt 8 an.
- **SC-003**: In einer Partie bis GAME_OVER zeigt der Endscreen in 100% der Faelle die bestehende Endrangliste, die Gesamtrundenzahl, Highlight-Karten und die per-Spieler-Statustabelle gemeinsam an.
- **SC-004**: In Stichproben mit Gleichstaenden werden in 100% der Faelle alle Fuehrenden einer Highlight-Kategorie gemeinsam angezeigt.
- **SC-005**: In Rematch-Tests beginnen 100% der neuen Partien mit zurueckgesetzten Match-Statistiken und ohne uebernommene Werte aus der Vorpartie.
- **SC-006**: In Dokumentations- und Regel-Checks sind 100% der verknuepften Hinweise auf alte 8-Spieler-Grenzen oder alte Vollvarianten-Mindestwerte auf die neuen Werte 10, 80 und 91 aktualisiert.

## Assumptions

- V1 der End-of-Game-Stats enthaelt bewusst keine Zeitmetriken.
- Die Trophaeenziele bleiben unveraendert; es wird nichts am Siegziel-Balancing geaendert.
- Die 10-Spieler-Erhoehung fuehrt nicht automatisch zu neuem Basis-Content und nicht zu einer harten Deckgroessen-Validierung.
- Per-Spieler-Statistiken beziehen sich auf die Spieler, die beim Spielende noch Teil der Partie sind; entfernte Spieler bekommen keine eigene Endscreen-Zeile.
- Die bestehende Rundenchronik bleibt erhalten und wird nicht durch die neue Match-Zusammenfassung ersetzt.
- Kleine Kartensaetze unterhalb der Vollvarianten-Formel bleiben startbar.

## Out of Scope

- Zeitbasierte Statistikwerte oder andere Echtzeitmetriken.
- Neue Karten, Varianten, Erweiterungen oder Deckgroessen-Regeln.
- Aenderungen an Trophaeenzielen oder an der Grundbalance der Partie.
- Ein neues visuelles Paradigma fuer den Round-Recap; die bestehende Chronik bleibt bestehen.