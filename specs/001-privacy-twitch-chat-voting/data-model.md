# Data Model: Privacy-First Twitch-Chat-Voting mit Minimalrechten

## Overview

Die Funktion erweitert den bestehenden serverautoritativen Spielzustand um eine strikt fluechtige Twitch-Runtime und einen sanitisierten Community-Voting-Blick fuer genau einen Spieler. Es gibt keine persistente Twitch-Entitaet.

## Entities

### 1. PlayerTwitchConnectionRuntime

**Represents**: Die serverseitige, fluechtige Twitch-Verbindung eines einzelnen Spielers innerhalb einer laufenden Partie.

**Fields**

- `gameCode`: Zugehoerige Partie.
- `playerId`: Zugehoeriger Spieler.
- `channelId`: Twitch-Broadcaster-ID des verbundenen Kanals.
- `channelLogin`: Twitch-Loginname.
- `channelDisplayName`: Sichtbarer Kanalname fuer die UI.
- `accessToken`: Fluechtiger User Access Token.
- `refreshToken`: Optionaler Refresh Token, nur serverseitig im RAM.
- `subscriptions[]`: Aktive EventSub-Subscription-IDs.
- `sharedChatActive`: Laufzeitflag fuer Shared Chat.

**Relationships**

- Gehoert zu genau einem `PlayerCommunityVotingState`.
- Ist ueber `gameCode + playerId` an eine laufende Partie gebunden.

**Validation Rules**

- Darf nur existieren, wenn `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` und `TWITCH_REDIRECT_URI` gesetzt sind.
- Darf nie in Client-State, Browser-Storage, URL oder persistente Server-Speicherung gelangen.
- Pro Partie darf dieselbe `channelId` hoechstens einem Spieler zugeordnet sein.

**Lifecycle / State Transitions**

- Created nach erfolgreichem OAuth-Code-Tausch und User-Lookup.
- Reused waehrend eines erlaubten Reconnect-Fensters.
- Destroyed bei Disconnect, Leave, Kick, Spielende, Cleanup, Revocation oder Server-Neustart.

### 2. OAuthStateChallenge

**Represents**: Kurzlebige Server-Zuordnung zwischen Twitch-OAuth-Start und Callback.

**Fields**

- `state`: Zufallswert fuer den OAuth-Flow.
- `gameCode`: Zielpartie.
- `playerId`: Zielspieler.
- `clientOrigin`: Erlaubter Ursprung fuer Popup-`postMessage`.
- `expiresAt`: Ablaufzeitpunkt.

**Validation Rules**

- Muss vor Bindung des Kanals vorhanden und nicht abgelaufen sein.
- Wird beim Callback sofort entfernt, unabhaengig von Erfolg oder Fehler.

### 3. PlayerCommunityVotingState

**Represents**: Der komplette serverseitige Voting-Zustand eines Spielers fuer die laufende Partie.

**Fields**

- `enabled`: Ob beratendes Voting fuer den Spieler aktiv ist.
- `connection.status`: `disconnected | warning_required | connecting | connected | error`.
- `connection.channelId`: Nur serverseitig; nicht im Clientvertrag exponieren.
- `connection.channelLogin`: Sichtbarer Loginname.
- `connection.channelDisplayName`: Sichtbarer Anzeigename.
- `connection.sharedChatActive`: Shared-Chat-Status.
- `connection.lastError`: Minimaler, nicht-sensitiver Fehlertext.
- `privacyWarningAcknowledgedForSession`: Sitzungsflag fuer den aktuellen Browser-Flow.
- `activeContextKey`: Eindeutiger Hash/Schluessel des aktuell gueltigen Voting-Kontexts.
- `votesByChatterId`: Letzte gueltige Stimme pro Chatter im aktiven Kontext.
- `votesByTargetId`: Aggregierte Stimmen pro Option.

**Relationships**

- Pro Spieler maximal ein Zustand pro laufender Partie.
- Nutzt optional eine `PlayerTwitchConnectionRuntime`.

**Validation Rules**

- `enabled` darf nur `true` sein, wenn `connection.status === connected`.
- Beim Kontextwechsel werden `votesByChatterId` und `votesByTargetId` geleert.
- Waehrend `reconnectWindow !== null` duerfen keine neuen Stimmen angenommen werden.

**Lifecycle / State Transitions**

- `disconnected -> warning_required`: Spieler initiiert Connect, aber hat den Hinweis noch nicht bestaetigt.
- `warning_required -> connecting`: Hinweis wurde bestaetigt und OAuth-Popup startet.
- `connecting -> connected`: Callback erfolgreich und Kanal fluechtig gebunden.
- `connecting -> error`: OAuth oder Subscription-Setup fehlgeschlagen.
- `connected -> disconnected`: Spieler trennt bewusst, verlaesst Partie oder Cleanup entfernt die Verbindung.
- `connected -> error`: Revocation oder Beobachtungsfehler.
- `error -> warning_required` oder `error -> connecting`: Spieler startet den Verbindungsversuch erneut.

### 4. CommunityVotingContextRuntime

**Represents**: Die aktuelle serverseitige Abstimmungssituation fuer genau einen Spieler.

**Fields**

- `key`: Eindeutige Ableitung aus Kontextart, Runde und sichtbaren Optionen.
- `kind`: `SUBMIT_HAND | JUDGE_SUBMISSIONS`.
- `roundNumber`: Aktuelle Runde.
- `recommendedCount`: Anzahl der empfohlenen Optionen, z. B. `question.blanks` oder `1`.
- `optionTargetIds[]`: Die aktuell sichtbaren Ziel-IDs.

**Validation Rules**

- `SUBMIT_HAND` nur fuer Nicht-Boss-Spieler in `SUBMITTING`, die noch nicht eingereicht haben und sichtbare Handkarten besitzen.
- `JUDGE_SUBMISSIONS` nur fuer den Boss in `JUDGING` mit vorhandenen Submissions.
- Kontext endet sofort, wenn Phase, Optionen oder Spielerrechte wechseln.

### 5. VoteOptionView

**Represents**: Eine einzelne fuer den Spieler sichtbare Abstimmungsoption im Client.

**Fields**

- `targetId`: Karten-ID oder Submission-/Spielerziel, je nach Kontext.
- `voteNumber`: 1-basierte Laufnummer fuer den Chatbefehl.
- `voteCommand`: Immer aus `voteNumber` abgeleitet, z. B. `!card 1`.
- `votes`: Aktueller aggregierter Stimmenstand.
- `isLeading`: Ob die Option aktuell an der Spitze liegt.
- `isRecommended`: Ob die Option zu den aktuell empfohlenen Optionen gehoert.

**Validation Rules**

- `voteNumber` muss ohne Luecken bei 1 beginnen.
- `voteCommand` wird nie separat gespeichert, sondern aus `voteNumber` erzeugt.
- `isRecommended` darf bei Mehrfachluecken mehreren Optionen gleichzeitig `true` sein.

### 6. ClientCommunityVotingState

**Represents**: Der einzig an den Browser gesendete Community-Voting-Zustand fuer den aktuellen Spieler.

**Fields**

- `enabled`
- `privacyWarningAcknowledgedForSession`
- `connection.status`
- `connection.channelLogin`
- `connection.channelDisplayName`
- `connection.sharedChatActive`
- `connection.lastError`
- `context: null | { kind, roundNumber, totalUniqueVoters, options[] }`

**Validation Rules**

- Darf keine Tokens, Refresh Tokens, OAuth-Codes, Subscription-IDs, Chatter-Listen oder Roh-Nachrichten enthalten.
- Ist fuer andere Spieler niemals sichtbar.

## Derived Rules

- Parser akzeptiert nur `trim(message)` matching `^!card\s+(\d+)$` ohne Beachtung der Gross-/Kleinschreibung und mit Bereich `1..N`.
- Pro `chatter_user_id` zaehlt im aktiven Kontext nur die letzte gueltige Stimme.
- Shared-Chat-Nachrichten zaehlen nur, wenn `source_broadcaster_user_id` leer oder gleich der eigenen `channelId` ist.
- Bei Mehrfachluecken besteht die Empfehlung aus den `recommendedCount` bestplatzierten Einzelkarten; das Spiel bildet daraus keine automatische Einreichung.