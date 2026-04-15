# Contract: `ClientGameState.communityVoting`

## Purpose

Beschreibt den einzigen an den Browser exponierten Twitch- und Voting-Zustand fuer den aktuellen Spieler.

## Shape

```ts
interface ClientCommunityVotingState {
  enabled: boolean;
  privacyWarningAcknowledgedForSession: boolean;
  connection: {
    status: 'disconnected' | 'warning_required' | 'connecting' | 'connected' | 'error';
    channelLogin: string | null;
    channelDisplayName: string | null;
    sharedChatActive: boolean;
    lastError: string | null;
  };
  context: null | {
    kind: 'SUBMIT_HAND' | 'JUDGE_SUBMISSIONS';
    roundNumber: number;
    totalUniqueVoters: number;
    options: Array<{
      targetId: string;
      voteNumber: number;
      voteCommand: string;
      votes: number;
      isLeading: boolean;
      isRecommended: boolean;
    }>;
  };
}
```

## Semantics

- `privacyWarningAcknowledgedForSession` ist rein sitzungsbezogen und nicht persistent.
- `status=warning_required` bedeutet: Der Spieler hat Connect initiiert, aber den verpflichtenden Warnhinweis dieser Sitzung noch nicht bestaetigt.
- `status=connecting` bedeutet: OAuth-Popup oder Callback-Flow laeuft.
- `status=connected` bedeutet: Kanal ist verbunden und kann fuer Voting aktiviert werden.
- `enabled=true` bedeutet: Beratendes Voting ist fuer diesen Spieler aktiv; es bleibt dennoch unverbindlich fuer die Spielentscheidung.
- `context=null` bedeutet: Es gibt aktuell keine abstimmbare Spielsituation oder Voting ist nicht aktiv.

## Privacy Constraints

- Keine Tokens
- Keine Refresh Tokens
- Keine OAuth-Codes
- Keine Chatter-Listen
- Keine Roh-Chat-Nachrichten
- Keine Vote-Historie ausser den aggregierten Tallies des aktuellen Kontexts

## Visibility Rule

Der Slice ist ausschliesslich fuer den aktuellen Spieler bestimmt. Andere Spieler duerfen weder Verbindung noch Tallies oder `!card`-Kommandos dieses Spielers sehen.