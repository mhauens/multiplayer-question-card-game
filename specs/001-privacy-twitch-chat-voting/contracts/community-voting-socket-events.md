# Contract: Community-Voting Socket Events

## Events

### `twitch-connect:start`

**Direction**: Client -> Server  
**Purpose**: Startet den OAuth-Flow nach bestaetigtem Privacy-Hinweis.

**Payload**

```json
{
  "clientOrigin": "http://localhost:5173"
}
```

**Success Ack**

```json
{
  "url": "https://id.twitch.tv/oauth2/authorize?..."
}
```

**Error Ack**

```json
{
  "error": "Twitch-Integration ist gerade nicht verfuegbar."
}
```

### `twitch-connect:disconnect`

**Direction**: Client -> Server  
**Purpose**: Trennt die fluechtige Twitch-Verbindung des aktuellen Spielers und entfernt deren Runtime-Daten.

**Payload**: none

**Success Ack**

```json
{
  "success": true
}
```

### `community-vote:set-enabled`

**Direction**: Client -> Server  
**Purpose**: Aktiviert oder deaktiviert beratendes Voting fuer den aktuellen Spieler.

**Payload**

```json
{
  "enabled": true
}
```

**Success Ack**

```json
{
  "success": true
}
```

**Error Ack**

```json
{
  "error": "Twitch muss zuerst verbunden werden."
}
```

## Server Push

### `game-state`

Der Server sendet nach erfolgreichen Aenderungen den aktualisierten `ClientGameState` an genau den betroffenen Spieler oder broadcastet den allgemeinen Spielzustand wie bisher. Der `communityVoting`-Slice bleibt strikt spielerbezogen.

## Behavioral Guarantees

- Events werden waehrend einer Reconnect-Pause nicht genutzt, um neue Votes anzunehmen.
- `community-vote:set-enabled` darf `enabled=true` nur akzeptieren, wenn eine verbundene Twitch-Verbindung vorliegt.
- Der Socketvertrag liefert keine Tokens, Roh-Nachrichten, Chatter-Listen oder Subscription-IDs.