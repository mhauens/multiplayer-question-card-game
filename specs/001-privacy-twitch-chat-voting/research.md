# Research: Privacy-First Twitch-Chat-Voting mit Minimalrechten

## Decision 1: Use Twitch EventSub WebSockets with a broadcaster user access token and only `user:read:chat`

- **Decision**: Die Umsetzung bleibt bei EventSub WebSockets mit einem User Access Token des verbundenen Spielers und fordert fuer V1 ausschliesslich `user:read:chat` an.
- **Rationale**: Die Twitch-Dokumentation fuer Chat-Authentifizierung beschreibt diesen Fall als Installed-Chatbot-/Chat-Client-artigen Flow mit User Access Token. Fuer `channel.chat.message` ueber WebSockets reicht `user:read:chat`; `channel.shared_chat.begin`, `channel.shared_chat.update` und `channel.shared_chat.end` benoetigen keine zusaetzliche Autorisierung. Das passt direkt zu den Privacy-Vorgaben der Spec.
- **Alternatives considered**: App Access Token plus `user:bot` und `channel:bot` wurde verworfen, weil das mehr Rechte als benoetigt verlangt. IRC oder schreibende Chat-Rechte wurden verworfen, weil das Produkt keine Chat-Nachrichten senden soll.

## Decision 2: Keep Twitch runtime state strictly in server RAM and expose only a sanitized player-local view

- **Decision**: Access Tokens, Refresh Tokens, Subscription-IDs, Kanalbindungen und Vote-Aggregation bleiben ausschliesslich in der Server-Runtime; der Client erhaelt nur den sanitisierten `communityVoting`-Slice fuer den aktuellen Spieler.
- **Rationale**: Das bestehende Repository ist bewusst in-memory, und die Spec verbietet jede persistente Speicherung sensibler Twitch-Daten. Der aktuelle `GameState.getClientState()` liefert bereits einen spielerbezogenen Blick; diese Trennung wird beibehalten und praezisiert.
- **Alternatives considered**: Daten im Browser zwischenzuspeichern wurde wegen Privacy-Risiko und Mehrbenutzer-Sichtbarkeit verworfen. Persistente Server-Speicherung wurde wegen der ausdruecklichen Spec-Vorgaben verworfen.

## Decision 3: Treat privacy acknowledgement as session-local UI state, not persisted browser storage

- **Decision**: Die Bestaetigung des Privacy-Hinweises wird als sitzungsbezogener Client-State gefuehrt und nicht in Local Storage, Session Storage oder URL-Parametern persistiert.
- **Rationale**: Die Spec verlangt einen verpflichtenden Hinweis vor OAuth, verbietet aber sensible oder Twitch-bezogene Browserpersistenz. Ein rein in-memory gefuehrter Session-Flag deckt den UX-Bedarf, ohne Datenschutzgrenzen zu verletzen.
- **Alternatives considered**: `localStorage` oder `sessionStorage` fuer Komfort wurden verworfen, weil die Spec Browserpersistenz fuer Twitch-bezogene Daten explizit minimiert und der Warnhinweis bewusst pro Sitzung neu relevant sein darf.

## Decision 4: Preserve the existing Twitch connection through the game reconnect window and freeze tallies meanwhile

- **Decision**: Bei unerwartetem Disconnect bleibt eine bereits verbundene Twitch-Verbindung innerhalb des bestehenden Reconnect-Fensters fuer dieselbe laufende Partie erhalten; Tallies werden eingefroren und derselbe Voting-Kontext wird nach erfolgreichem Reconnect fortgesetzt.
- **Rationale**: Diese Entscheidung ist in der Spec-Klaerung festgelegt und passt zur vorhandenen Reconnect-Architektur in `GameState`, die Phasen bereits pausiert und spaeter fortsetzt. Dadurch wird kein neuer OAuth-Flow erzwungen und dennoch waehrend der Pause keine weitere Vote-Verarbeitung zugelassen.
- **Alternatives considered**: Sofortiges Entfernen der Twitch-Verbindung oder erzwungene Neu-Autorisierung nach jedem Disconnect wurden verworfen, weil sie die bestehende Reconnect-Logik unnoetig brechen und den Privacy-Hinweis mit einem Komfortverlust verwechseln.

## Decision 5: Count only the last valid vote per chatter per active context and filter shared chat by source broadcaster

- **Decision**: Das Vote-Parsing bleibt strikt auf `!card <nummer>` nach `trim()`, case-insensitive Kommando, mindestens ein Leerzeichen und gueltigen Bereich beschraenkt; pro `chatter_user_id` zaehlt im aktiven Kontext nur die letzte gueltige Stimme. Bei Shared Chat werden nur Events mit `source_broadcaster_user_id === null` oder eigener Kanal-ID gewertet.
- **Rationale**: Die bestehende Parser- und Aggregationslogik in `communityVoting.ts` und `GameState.recordCommunityVote()` deckt dieses Modell bereits weitgehend ab. Twitch liefert fuer Shared Chat die Ursprungs-Kanal-ID im Message-Event, wodurch die Community-Filterung ohne zusaetzliche Speicherung moeglich bleibt.
- **Alternatives considered**: Das Zaehlen aller Shared-Chat-Nachrichten wurde verworfen, weil es die Communities mischt. Historische Einzelvotes oder Chat-Historien wurden verworfen, weil sie nicht benoetigt sind und der Spec widersprechen.

## Decision 6: Centralize community-voting contract values in `@kgs/game-rules`

- **Decision**: Gemeinsame Voting-Kontextarten, erlaubte Connection-Statuswerte, Parsergrenzen und ggf. abgeleitete Konstanten fuer Vote-Kommandos werden in `packages/game-rules` exportiert und von Client, Server und Tests gemeinsam genutzt.
- **Rationale**: Client und Server definieren heute bereits mehrfach dieselben Community-Voting-Typen. Die Verfassung verlangt, gemeinsam genutzte Regelgrenzen in `packages/game-rules` zu halten, sobald mehr als ein Paket sie konsumiert.
- **Alternatives considered**: Duplizierte String-Unions in `client/src/types.ts` und `server/src/types.ts` wurden verworfen, weil sie bei Statuserweiterungen wie `warning_required` und `connecting` leicht auseinanderlaufen.

## Decision 7: Privacy-safe error handling beats verbose diagnostics

- **Decision**: OAuth-Fehler, Subscription-Fehler und Revocations liefern nur minimale, nicht-sensitive Nutzertexte; vollstaendige Chat-Nachrichten, OAuth-Codes, Tokens und Debug-Payloads werden nicht geloggt und nicht in den Client-State geschrieben.
- **Rationale**: Die Spec priorisiert Datenschutz vor Komfort. Die aktuelle Serverintegration loggt keine sensiblen Twitch-Werte; dieses Verhalten wird als bewusste Leitlinie festgeschrieben und bei neuen Fehlerpfaden beibehalten.
- **Alternatives considered**: Umfangreiche Debug-Logs mit Token- oder Message-Inhalt wurden verworfen, weil sie den Datenschutzanforderungen direkt widersprechen.