# Contract: GET /api/twitch/oauth/callback

## Purpose

Schliesst den Twitch-OAuth-Popup-Flow ab, bindet den Twitch-Kanal fluechtig an `gameCode + playerId` und liefert eine minimale HTML-Popup-Seite, die den Opener per `postMessage` informiert.

## Request

**Method**: `GET`  
**Path**: `/api/twitch/oauth/callback`

### Query Parameters

- `code`: Twitch OAuth authorization code
- `state`: Serverseitig erzeugter OAuth-State

## Server Behavior

1. `state` muss existieren, gueltig und nicht abgelaufen sein.
2. `code` wird serverseitig gegen einen User Access Token getauscht.
3. Der authentifizierte Twitch-User wird geladen.
4. Der Kanal wird nur fluechtig an den erwarteten Spieler gebunden.
5. Der Server erstellt noetige EventSub-Subscriptions.
6. Bei Fehlern wird keine Teilbindung behalten.
7. Weder `code` noch Tokens oder Chatdaten werden geloggt oder an den Browser gesendet.

## Responses

### Success

- **Status**: `200`
- **Content-Type**: `text/html`
- **Body**: Minimale Popup-Seite mit erfolgreicher Rueckmeldung und folgendem `postMessage` an `window.opener`:

```json
{
  "type": "twitch-oauth-complete",
  "status": "success",
  "message": "Twitch wurde verbunden. Du kannst das Fenster jetzt schliessen."
}
```

### Failure

- **Status**: `400`
- **Content-Type**: `text/html`
- **Body**: Minimale Popup-Seite mit Fehlerhinweis und folgendem `postMessage` an `window.opener`:

```json
{
  "type": "twitch-oauth-complete",
  "status": "error",
  "message": "Nicht-sensitiver Fehlertext"
}
```

## Privacy Constraints

- Kein Token, Refresh Token, OAuth-Code oder Twitch-Payload darf im Response-Body oder im `postMessage` enthalten sein.
- `postMessage` darf nur an den validierten Client-Origin gehen.
- Die HTML-Antwort bleibt minimal und enthaelt keine Debugdaten.