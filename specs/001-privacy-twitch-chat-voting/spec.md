# Feature Specification: Privacy-First Twitch-Chat-Voting mit Minimalrechten

**Feature Branch**: `[001-privacy-twitch-chat-voting]`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: User description: "Spec: Privacy-First Twitch-Chat-Voting mit Minimalrechten"

## Clarifications

### Session 2026-04-15

- Q: Welche Regel gilt fuer eine bereits verbundene Twitch-Verbindung nach einem unerwarteten Disconnect innerhalb des Reconnect-Fensters? → A: Dieselbe Twitch-Verbindung bleibt fuer die laufende Partie erhalten; nach erfolgreichem Reconnect wird derselbe Voting-Kontext mit denselben eingefrorenen Tallies fortgesetzt.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Eigene Community sicher verbinden (Priority: P1)

Als Spieler moechte ich meinen eigenen Twitch-Kanal nur nach einem verpflichtenden Privacy-Hinweis verbinden koennen, damit ich Community-Voting nutzen kann, ohne Twitch-Zugangsdaten im Spiel einzugeben oder versehentlich sensible Login-Schritte im Stream zu zeigen.

**Why this priority**: Ohne einen sicheren, klaren und spielerindividuellen Verbindungsablauf kann die Funktion nicht verantwortbar genutzt werden.

**Independent Test**: Kann vollstaendig getestet werden, indem ein Spieler den Hinweis bestaetigt, die Twitch-Verbindung startet, den Kanal erfolgreich verbindet und anschliessend nur seine eigene Verbindung im Spiel sieht.

**Acceptance Scenarios**:

1. **Given** ein Spieler hat Community-Voting noch nicht verbunden, **When** er Community-Voting aktivieren will, **Then** muss das Spiel zuerst einen verpflichtenden Privacy-Hinweis anzeigen und darf die Twitch-Autorisierung erst nach ausdruecklicher Bestaetigung starten.
2. **Given** der Privacy-Hinweis wurde in der aktuellen Sitzung bestaetigt, **When** der Spieler die Verbindung startet, **Then** muss die Autorisierung ausschliesslich ueber Twitch erfolgen und das Spiel darf kein eigenes Formular fuer Twitch-Zugangsdaten anzeigen.
3. **Given** ein Spieler hat seinen Kanal erfolgreich verbunden, **When** andere Spieler dieselbe Partie betrachten, **Then** duerfen sie weder Verbindungsdetails noch Overlays oder Tallies dieses Kanals sehen.

---

### User Story 2 - Beratendes Voting pro Spielsituation nutzen (Priority: P2)

Als Spieler moechte ich je nach Rolle und Phase ein klar sichtbares, beratendes Community-Voting fuer meine aktuell sichtbaren Optionen nutzen, damit mein Chat Empfehlungen geben kann, ohne dass das Spiel automatisch Karten einreicht oder Gewinner auswaehlt.

**Why this priority**: Der eigentliche Produktnutzen entsteht durch die Empfehlung aus dem Chat waehrend Kartenwahl und Boss-Entscheidung.

**Independent Test**: Kann unabhaengig getestet werden, indem Community-Voting in beiden Kontexte aktiviert wird und nur gueltige `!card <nummer>`-Nachrichten die sichtbaren Tallies fuer den betroffenen Spieler aktualisieren.

**Acceptance Scenarios**:

1. **Given** ein Nicht-Boss-Spieler befindet sich im Einreichungskontext, **When** Community-Voting aktiv ist, **Then** muessen ueber seinen sichtbaren Handkarten `!card N`-Hinweise und zugehoerige Vote-Tallies fuer genau diesen Spieler erscheinen.
2. **Given** der Boss befindet sich im Bewertungs-Kontext, **When** Community-Voting aktiv ist, **Then** muessen ueber den sichtbaren Submission-Gruppen `!card N`-Hinweise und Tallies fuer genau diesen Boss erscheinen.
3. **Given** eine Mehrfachluecken-Frage ist aktiv, **When** Stimmen fuer einzelne Karten eingehen, **Then** muss die UI die aktuell besten so vielen Einzelkarten empfehlen, wie Luecken benoetigt werden, ohne eine Kombination automatisch auszuwaehlen oder einzureichen.

---

### User Story 3 - Datenschutz und Lifecycle sauber einhalten (Priority: P3)

Als Spieler und Betreiber moechte ich sicher sein, dass Twitch-bezogene Daten nur fluechtig verarbeitet, bei Unterbrechungen korrekt eingefroren und bei jedem relevanten Lifecycle-Ereignis vollstaendig entfernt werden, damit Komfort niemals Vorrang vor Datenschutz bekommt.

**Why this priority**: Die Funktion ist nur tragfaehig, wenn sensible Daten nicht dauerhaft gespeichert oder ueber Spielgrenzen hinweg mitgeschleppt werden.

**Independent Test**: Kann unabhaengig getestet werden, indem Verbinden, Shared Chat, Reconnect-Pause, Leave, Kick, Spielende und Server-Cleanup durchgespielt und dabei Speicher-, Logging- und Sichtbarkeitsgrenzen geprueft werden.

**Acceptance Scenarios**:

1. **Given** Community-Voting laeuft waehrend einer Partie, **When** die Partie in eine Reconnect-Pause geht und der betroffene Spieler rechtzeitig zurueckkehrt, **Then** muessen die bestehende Twitch-Verbindung, derselbe Voting-Kontext und die eingefrorenen Tallies bis zur Fortsetzung erhalten bleiben.
2. **Given** Shared Chat ist fuer einen verbundenen Kanal aktiv, **When** Nachrichten aus einer fremden Community ankommen, **Then** duerfen diese Stimmen die Tallies des Spielers nicht beeinflussen.
3. **Given** ein Spieler trennt die Verbindung, verlaesst das Spiel, wird entfernt, die Partie endet oder der Server raeumt auf, **When** das Lifecycle-Ereignis abgeschlossen ist, **Then** muessen alle fluechtigen Twitch-Daten und zugehoerigen Subscriptions fuer diesen Fall entfernt sein.

### Edge Cases

- Was passiert, wenn der Spieler das OAuth-Popup schliesst, blockiert oder der Twitch-Login fehlschlaegt? Die Verbindung bleibt getrennt, es wird kein teilverbundener Zustand behalten und der Spieler sieht nur eine nicht-sensitive Fehlermeldung.
- Was passiert, wenn zwei Spieler versuchen, denselben Twitch-Kanal gleichzeitig fuer dieselbe Partie zu nutzen? Die Partie muss eine doppelte Kanalbindung fuer dieselbe laufende Partie ablehnen, damit Isolation und Verantwortlichkeit erhalten bleiben.
- Wie wird mit Nachrichten umgegangen, die dem Befehl nur aehnlich sehen? Alles ausser dem exakt unterstuetzten `!card <nummer>`-Format im gueltigen Bereich wird ignoriert und veraendert keine Tallies.
- Wie verhaelt sich das System, wenn eine Voting-Situation endet oder in einen anderen Kontext wechselt? Vorherige Stimmen zaehlen nicht in den neuen Kontext hinein und die Empfehlung wird ausschliesslich aus Stimmen des aktuellen Kontexts gebildet.
- Wie verhaelt sich das System nach einem unerwarteten Disconnect innerhalb des Reconnect-Fensters? Die bestehende Twitch-Verbindung, derselbe Voting-Kontext und die eingefrorenen Tallies bleiben fuer die laufende Partie erhalten und werden bei erfolgreichem Reconnect fortgesetzt.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Das System MUSS vor jeder erstmaligen Twitch-Autorisierung in einer Browser-Sitzung einen verpflichtenden Privacy-Hinweis anzeigen und eine ausdrueckliche Bestaetigung verlangen.
- **FR-002**: Das System MUSS Twitch-Authentifizierung ausschliesslich ueber Twitch durchfuehren und darf niemals ein eigenes Formular fuer Twitch-Zugangsdaten anzeigen.
- **FR-003**: Das System MUSS jedem Spieler erlauben, seine eigene Twitch-Verbindung fuer Community-Voting unabhaengig von anderen Spielern zu verbinden, zu trennen und ein- oder auszuschalten.
- **FR-004**: Das System MUSS fuer V1 nur die minimal noetigen Rechte zum Lesen von Chat-Nachrichten des verbundenen Kanals anfordern und darf keine Schreib-, Bot-, Moderations-, Subscriber-, Channel-Management- oder Profilrechte anfordern.
- **FR-005**: Das System MUSS den Autorisierungsvorgang gegen ungueltige, abgelaufene oder manipulierte Verbindungsversuche absichern und darf einen Kanal nur nach erfolgreich validierter Rueckkehr der Autorisierung an einen Spieler binden.
- **FR-006**: Das System MUSS Twitch-bezogene sensible Daten, einschliesslich Autorisierungscodes, Access Tokens, Refresh Tokens, Kanalbindungen, Chat-Nachrichten, Chatter-Listen und historischer Vote-Historie, ausschliesslich fluechtig fuer die laufende Partie verarbeiten.
- **FR-007**: Das System MUSS verhindern, dass sensible Twitch-Daten in Browser-Storage, URL-Parametern, dauerhafter Server-Speicherung, fuer andere Spieler sichtbarem Client-State oder Server-Logs auftauchen.
- **FR-008**: Das System MUSS pro Spieler nur dessen eigene Twitch-Verbindung, eigene `!card`-Overlays, eigenen Voting-Kontext und eigene Vote-Tallies sichtbar machen.
- **FR-009**: Das System MUSS Community-Voting strikt beratend halten und darf weder Karten automatisch einreichen noch automatisch eine Gewinnerauswahl treffen.
- **FR-010**: Das System MUSS ausschliesslich Nachrichten auswerten, die nach Trimmen der Gesamtnachricht dem Format `!card <nummer>` entsprechen, wobei der Befehl ohne Beachtung der Gross-/Kleinschreibung erkannt wird, zwischen Befehl und Zahl ein oder mehrere Leerzeichen erlaubt sind und nur ganze Zahlen im gueltigen Bereich angenommen werden.
- **FR-011**: Das System MUSS alle anderen Chat-Nachrichten und ungueltigen Befehlsformate ignorieren, ohne Tallies oder Empfehlungen zu veraendern.
- **FR-012**: Das System MUSS je Chatter im aktuellen Voting-Kontext immer nur die letzte gueltige Stimme zaehlen.
- **FR-013**: Das System MUSS Community-Voting in genau zwei Kontexte bereitstellen: fuer Nicht-Boss-Spieler waehrend der Handauswahl und fuer den Boss waehrend der Bewertungsphase von Einreichungen.
- **FR-014**: Das System MUSS im Handauswahl-Kontext nur die aktuell sichtbaren Handkarten des betroffenen Nicht-Boss-Spielers und im Bewertungs-Kontext nur die aktuell sichtbaren Submission-Gruppen des Bosses als abstimmbare Optionen anbieten.
- **FR-015**: Das System MUSS bei Mehrfachluecken-Fragen die aktuell fuehrenden so vielen Einzelkarten empfehlen, wie Luecken benoetigt werden, ohne daraus automatisch eine Kombination zu bilden.
- **FR-016**: Das System MUSS Shared Chat unterstuetzen, dabei aber nur Stimmen zaehlen, deren Ursprung zur eigenen Community des verbundenen Kanals gehoert; Stimmen aus fremden Communities muessen ignoriert werden.
- **FR-017**: Das System MUSS waehrend einer Reconnect-Pause Tallies einfrieren und bis zur Fortsetzung des Spiels keine neuen Stimmen auf den aktiven Voting-Kontext anwenden.
- **FR-018**: Das System MUSS bei einem erfolgreichen Reconnect innerhalb des bestehenden Reconnect-Fensters die bereits verbundene Twitch-Verbindung, den aktiven Voting-Kontext und die eingefrorenen Tallies fuer die laufende Partie weiterverwenden, ohne eine neue OAuth-Autorisierung zu verlangen.
- **FR-019**: Das System MUSS doppelte Bindungen desselben Twitch-Kanals an mehrere Spieler innerhalb derselben laufenden Partie verhindern.
- **FR-020**: Das System MUSS bei Trennung, Leave, Kick, Spielende, Server-Neustart oder sonstigem Cleanup alle Twitch-Subscriptions und alle fluechtigen Twitch-Daten des betroffenen Kontexts vollstaendig entfernen.
- **FR-021**: Das System MUSS dem Spieler nach Abschluss oder Abbruch der Autorisierung eine minimale Rueckmeldung geben, die den Verbindungsstatus ohne Offenlegung sensibler Daten eindeutig macht.

### Constitution Alignment *(mandatory)*

- **Authority Impact**: Die Kernregeln fuer Gewinnerauswahl und Phasenhoheit bleiben servergesteuert. Neu hinzu kommen serverseitig durchgesetzte Privacy-, Autorisierungs- und Isolationsregeln fuer spielerindividuelles, rein beratendes Community-Voting sowie das Einfrieren waehrend Reconnect-Pausen.
- **Affected Layers**: `client`: ja, fuer Privacy-Hinweis, Verbindungsstatus, individuelle Overlays und Tallies. `server`: ja, fuer Autorisierung, Vote-Auswertung, Isolation, Cleanup und Lifecycle. `packages/game-rules`: ja, falls gemeinsame Begriffe oder Grenzen fuer Voting-Kontexte, erlaubte Befehlsformate oder Statuswerte zwischen Client und Server vereinheitlicht werden. `card data`: nein. `user-facing rules/help copy`: ja, fuer Privacy-Hinweis, Bedienhinweise und Klarstellung, dass Voting nur beratend ist.
- **Shared Contract Changes**: Gemeinsame Vertragsgrenzen muessen die zwei Voting-Kontexte, den beratenden Charakter, den erlaubten `!card`-Befehl, die sichtbaren Spielerfelder fuer Community-Voting sowie die Privacy-relevanten Statusuebergaenge eindeutig beschreiben.
- **Catalog Impact**: Die modulare JSON-Katalogstruktur fuer Karten, Varianten und Erweiterungen bleibt unveraendert; die Funktion arbeitet ausschliesslich mit bereits sichtbaren Spieloptionen und fuehrt keine neuen Karten- oder Themenkataloge ein.
- **Validation Scope**: Erfordert `pnpm lint`, `pnpm test` und `pnpm build` sowie einen manuellen Smoke-Test mit zwei Browser-Sitzungen. Fuer diese Funktion gehoeren ausserdem ein manueller Test mit zwei getrennten Twitch-Kanaelen und ein manueller Shared-Chat-Test zum Validierungsumfang.

### Key Entities *(include if feature involves data)*

- **Player Twitch Connection**: Die fluechtige, einem einzelnen Spieler in einer laufenden Partie zugeordnete Twitch-Verbindung mit Verbindungsstatus, sichtbarem Kanalnamen und Shared-Chat-Hinweis.
- **Community Voting Context**: Die aktuelle Spielsituation, in der Stimmen ausgewertet werden, einschliesslich Kontextart, Rundennummer, sichtbarer Optionen und Anzahl benoetigter Empfehlungen.
- **Vote Option**: Eine aktuell sichtbare abstimmbare Einheit mit Zielbezug, angezeigter Befehlsnummer, Vote-Command, Stimmenzahl und Fuehrungsstatus.
- **Volatile Vote Tally**: Die nur fuer den aktuellen Kontext im Arbeitsspeicher gehaltene Zuordnung aus letzter gueltiger Chatter-Stimme und aggregiertem Ergebnis pro Option.
- **Privacy Acknowledgement**: Die sitzungsbezogene Bestaetigung des Warnhinweises, die den Start der Twitch-Autorisierung freischaltet, ohne sensible Twitch-Daten selbst zu speichern.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% der erfolgreichen erstmaligen Twitch-Verbindungen in einer Testsitzung erfolgen erst nach bestaetigtem Privacy-Hinweis und ohne Anzeige eines in-app Twitch-Login-Formulars.
- **SC-002**: In einem manuellen Test mit zwei Spielern und zwei Twitch-Kanaelen bleiben in 100% der geprueften Schritte Verbindungsdaten, `!card`-Overlays und Vote-Tallies strikt beim jeweils verbundenen Spieler isoliert.
- **SC-003**: In Parser- und Aggregationstests werden 100% der gueltigen `!card`-Nachrichten im unterstuetzten Format korrekt gewertet und 100% der ungueltigen Formate folgenlos ignoriert.
- **SC-004**: In Datenschutztests werden 0 Vorkommen von OAuth-Codes, Tokens, vollstaendigen Chat-Nachrichten, Chatter-Listen oder historischer Vote-Historie in Browser-Storage, URL-Parametern, dauerhafter Speicherung oder Logs nachgewiesen.
- **SC-005**: In Lifecycle-Tests werden bei Reconnect-Pause, erfolgreichem Reconnect innerhalb des Zeitfensters, Leave, Kick, Spielende und Cleanup in 100% der geprueften Faelle keine weiteren Stimmen auf eingefrorene oder bereits bereinigte Voting-Kontexte angewendet und bestehende Twitch-Verbindungen werden nur im erlaubten Reconnect-Fall fortgesetzt.

## Assumptions

- V1 nutzt ausschliesslich Twitch OAuth; eine manuelle Eingabe von Tokens oder alternativen Zugangsdaten ist nicht Bestandteil der Funktion.
- Die bestehende In-Memory-Architektur des Spiels bleibt erhalten; Twitch-bezogene Laufzeitdaten duerfen nur fuer die aktive Partie im Arbeitsspeicher gehalten werden.
- Eine unerwartet unterbrochene, bereits verbundene Twitch-Verbindung darf innerhalb des bestehenden Reconnect-Fensters fuer dieselbe laufende Partie weiterverwendet werden und erfordert in diesem Fall keine erneute OAuth-Autorisierung.
- Jeder Spieler verbindet hoechstens einen eigenen Twitch-Kanal pro laufender Partie.
- Das Spiel beantwortet Chat-Nachrichten nicht und sendet selbst keine Twitch-Chat-Nachrichten in V1.
- Betriebsseitig werden die fuer Twitch-Autorisierung benoetigten Konfigurationswerte fuer Client-Kennung, serverseitiges Geheimnis und Ruecksprung-URL ausserhalb des Spiels bereitgestellt.
- Falls Twitch seine Anforderungen aendert, bleibt die Leitlinie bestehen, nur das kleinste Rechte-Set fuer das Lesen der eigenen Chat-Nachrichten anzufordern.
- Boss-Voting startet erst in der eigentlichen Bewertungsphase und nicht bereits waehrend des blossen Aufdeckens.

## Out of Scope

- Automatische Karteneinreichung, automatische Gewinnerwahl oder sonstige verbindliche Spielentscheidungen durch Chat-Stimmen.
- Persistente Speicherung oder spaetere Auswertung von Chat-Historie, Chatter-Listen, Vote-Historie oder Kanalverbindungen ueber die laufende Partie hinaus.
- Twitch-Schreibrechte, Bot-Funktionen, Moderationswerkzeuge, Subscriber-spezifische Interaktionen oder Channel-Management.
- Unterstuetzung anderer Streaming-Plattformen oder plattformuebergreifender Voting-Mechaniken.
- Neue Karten, Varianten, Erweiterungen oder Theme-Anpassungen ausserhalb der fuer Hinweise und Tallies noetigen UI-Texte.