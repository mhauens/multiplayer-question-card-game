import { randomUUID } from 'crypto';
import { TWITCH_MINIMAL_SCOPES } from '@kgs/game-rules';
import { GameManager } from '../game/GameManager';
import { parseCommunityVoteCommand, shouldCountCommunityVoteFromSource } from './communityVoting';

const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_USERS_URL = 'https://api.twitch.tv/helix/users';
const TWITCH_EVENTSUB_SUBSCRIPTIONS_URL = 'https://api.twitch.tv/helix/eventsub/subscriptions';
const TWITCH_EVENTSUB_WEBSOCKET_URL = 'wss://eventsub.wss.twitch.tv/ws';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const EVENTSUB_RECONNECT_DELAY_MS = 2_000;
type EventSubMessageType =
  | 'session_welcome'
  | 'session_keepalive'
  | 'notification'
  | 'session_reconnect'
  | 'revocation';

interface OAuthStateEntry {
  gameCode: string;
  playerId: string;
  clientOrigin: string;
  expiresAt: number;
}

interface TwitchTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string[];
}

interface TwitchUserResponse {
  data?: Array<{
    id: string;
    login: string;
    display_name: string;
  }>;
}

interface EventSubSubscriptionResponse {
  data?: Array<{
    id: string;
    type: string;
  }>;
}

interface EventSubEnvelope {
  metadata?: {
    message_type?: EventSubMessageType;
    subscription_type?: string;
  };
  payload?: {
    session?: {
      id?: string;
      reconnect_url?: string;
    };
    subscription?: {
      id?: string;
      type?: string;
      status?: string;
    };
    event?: Record<string, unknown>;
  };
}

interface TwitchPlayerConnection {
  playerId: string;
  gameCode: string;
  channelId: string;
  channelLogin: string;
  channelDisplayName: string;
  accessToken: string;
  refreshToken: string | null;
  subscriptions: string[];
  sharedChatActive: boolean;
}

interface EventSubSubscriptionConfig {
  type: 'channel.chat.message' | 'channel.shared_chat.begin' | 'channel.shared_chat.update' | 'channel.shared_chat.end';
  version: '1';
  condition: Record<string, string>;
}

interface WebSocketLike {
  close: () => void;
  addEventListener?: (type: string, listener: (event: any) => void) => void;
  onopen?: ((event: unknown) => void) | null;
  onmessage?: ((event: { data: string }) => void) | null;
  onerror?: ((event: unknown) => void) | null;
  onclose?: ((event: unknown) => void) | null;
}

type EmitPlayerState = (gameCode: string, playerId: string) => void;

function escapeForSingleQuotedScript(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

export class TwitchService {
  private readonly gameManager: GameManager;
  private readonly emitPlayerState: EmitPlayerState;
  private readonly clientUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly oauthStates = new Map<string, OAuthStateEntry>();
  private readonly connectionsByGameCode = new Map<string, Map<string, TwitchPlayerConnection>>();
  private readonly subscriptionIndex = new Map<string, { gameCode: string; playerId: string }>();
  private eventSubSocket: WebSocketLike | null = null;
  private eventSubSessionId: string | null = null;
  private eventSubSessionReady: Promise<string> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(params: {
    gameManager: GameManager;
    emitPlayerState: EmitPlayerState;
    clientUrl: string;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
  }) {
    this.gameManager = params.gameManager;
    this.emitPlayerState = params.emitPlayerState;
    this.clientUrl = params.clientUrl;
    this.clientId = params.clientId?.trim() || '';
    this.clientSecret = params.clientSecret?.trim() || '';
    this.redirectUri = params.redirectUri?.trim() || '';
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  async createOAuthUrl(params: {
    gameCode: string;
    playerId: string;
    clientOrigin?: string;
  }): Promise<{ url: string } | { error: string }> {
    if (!this.isConfigured()) {
      return { error: 'Twitch-Integration ist gerade nicht verfuegbar.' };
    }

    const state = randomUUID();
    this.oauthStates.set(state, {
      gameCode: params.gameCode,
      playerId: params.playerId,
      clientOrigin: this.normalizeClientOrigin(params.clientOrigin),
      expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
    });
    this.cleanupExpiredOAuthStates();

    const query = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: TWITCH_MINIMAL_SCOPES.join(' '),
      state,
    });

    return { url: `${TWITCH_AUTH_URL}?${query.toString()}` };
  }

  async handleOAuthCallback(params: {
    code?: string;
    state?: string;
  }): Promise<{ html: string; ok: boolean }> {
    const clientOrigin = this.normalizeClientOrigin();
    const state = params.state?.trim();
    const code = params.code?.trim();

    if (!state || !code) {
      console.warn('[twitch-oauth] Callback rejected because code or state was missing.');
      return { ok: false, html: this.renderPopupHtml(clientOrigin, false, 'Twitch-Verbindung konnte nicht abgeschlossen werden.') };
    }

    const oauthState = this.oauthStates.get(state);
    this.oauthStates.delete(state);
    if (!oauthState || oauthState.expiresAt < Date.now()) {
      console.warn('[twitch-oauth] Callback rejected because the oauth state was missing or expired.');
      return { ok: false, html: this.renderPopupHtml(clientOrigin, false, 'Die Twitch-Anfrage ist abgelaufen. Bitte starte die Verbindung erneut.') };
    }

    const gameState = this.gameManager.getGame(oauthState.gameCode);
    const player = gameState?.getPlayer(oauthState.playerId);
    if (!gameState || !player) {
      console.warn('[twitch-oauth] Callback rejected because the game or player no longer existed.');
      return {
        ok: false,
        html: this.renderPopupHtml(oauthState.clientOrigin, false, 'Die Partie oder der Spieler wurde nicht mehr gefunden.'),
      };
    }

    try {
      const tokens = await this.exchangeCodeForTokens(code);
      this.assertMinimalScopes(tokens.scope);
      const user = await this.fetchAuthenticatedUser(tokens.access_token);

      if (this.isChannelConnectedToAnotherPlayer(oauthState.gameCode, oauthState.playerId, user.id)) {
        gameState.setCommunityVotingError(oauthState.playerId, 'Dieser Twitch-Kanal ist in dieser Partie bereits mit einem anderen Spieler verbunden.');
        this.emitPlayerState(oauthState.gameCode, oauthState.playerId);
        return {
          ok: false,
          html: this.renderPopupHtml(oauthState.clientOrigin, false, 'Dieser Twitch-Kanal ist in dieser Partie bereits verbunden.'),
        };
      }

      await this.disconnectPlayer(oauthState.gameCode, oauthState.playerId, { preserveGameState: true });
      const connection = await this.createConnection({
        gameCode: oauthState.gameCode,
        playerId: oauthState.playerId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        channelId: user.id,
        channelLogin: user.login,
        channelDisplayName: user.display_name,
      });

      gameState.setCommunityVotingConnection(oauthState.playerId, {
        channelId: connection.channelId,
        channelLogin: connection.channelLogin,
        channelDisplayName: connection.channelDisplayName,
      });
      this.emitPlayerState(oauthState.gameCode, oauthState.playerId);

      return {
        ok: true,
        html: this.renderPopupHtml(oauthState.clientOrigin, true, 'Twitch wurde verbunden. Du kannst das Fenster jetzt schliessen.'),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[twitch-oauth] Callback failed: ${message}`);
      gameState.setCommunityVotingError(oauthState.playerId, 'Twitch-Verbindung konnte nicht hergestellt werden.');
      this.emitPlayerState(oauthState.gameCode, oauthState.playerId);
      return {
        ok: false,
        html: this.renderPopupHtml(oauthState.clientOrigin, false, 'Twitch-Verbindung konnte nicht hergestellt werden.'),
      };
    }
  }

  async disconnectPlayer(
    gameCode: string,
    playerId: string,
    options?: { preserveGameState?: boolean },
  ): Promise<void> {
    const gameConnections = this.connectionsByGameCode.get(gameCode);
    const connection = gameConnections?.get(playerId);
    if (connection) {
      for (const subscriptionId of connection.subscriptions) {
        this.subscriptionIndex.delete(subscriptionId);
        await this.deleteSubscription(connection, subscriptionId);
      }
      gameConnections?.delete(playerId);
      if (gameConnections && gameConnections.size === 0) {
        this.connectionsByGameCode.delete(gameCode);
      }
    }

    if (!this.hasActiveConnections()) {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.eventSubSocket?.close();
      this.eventSubSocket = null;
      this.eventSubSessionId = null;
      this.eventSubSessionReady = null;
    }

    if (!options?.preserveGameState) {
      const gameState = this.gameManager.getGame(gameCode);
      gameState?.clearCommunityVoting(playerId);
      if (gameState?.getPlayer(playerId)) {
        this.emitPlayerState(gameCode, playerId);
      }
    }
  }

  async cleanupPlayer(gameCode: string, playerId: string): Promise<void> {
    await this.disconnectPlayer(gameCode, playerId);
  }

  async cleanupGame(gameCode: string): Promise<void> {
    const gameConnections = this.connectionsByGameCode.get(gameCode);
    if (!gameConnections) {
      return;
    }

    const playerIds = [...gameConnections.keys()];
    for (const playerId of playerIds) {
      await this.disconnectPlayer(gameCode, playerId, { preserveGameState: true });
    }
  }

  private stopEventSubSocketIfUnused(): void {
    if (this.hasActiveConnections()) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.eventSubSocket?.close();
    this.eventSubSocket = null;
    this.eventSubSessionId = null;
    this.eventSubSessionReady = null;
  }

  private async rollbackSubscriptionIds(connection: TwitchPlayerConnection, subscriptionIds: string[]): Promise<void> {
    for (const subscriptionId of subscriptionIds) {
      this.subscriptionIndex.delete(subscriptionId);
      await this.deleteSubscription(connection, subscriptionId);
    }
  }

  private async subscribeConnection(connection: TwitchPlayerConnection, sessionId: string): Promise<void> {
    const createdSubscriptionIds: string[] = [];

    try {
      const subscriptions = this.getSubscriptionConfigs(connection);
      for (const subscription of subscriptions) {
        const subscriptionId = await this.createSubscription(connection, sessionId, subscription);
        connection.subscriptions.push(subscriptionId);
        createdSubscriptionIds.push(subscriptionId);
        this.subscriptionIndex.set(subscriptionId, {
          gameCode: connection.gameCode,
          playerId: connection.playerId,
        });
      }
    } catch (error) {
      await this.rollbackSubscriptionIds(connection, createdSubscriptionIds);
      connection.subscriptions = connection.subscriptions.filter((subscriptionId) => !createdSubscriptionIds.includes(subscriptionId));
      this.stopEventSubSocketIfUnused();
      throw error;
    }
  }

  private async createConnection(params: {
    gameCode: string;
    playerId: string;
    accessToken: string;
    refreshToken: string | null;
    channelId: string;
    channelLogin: string;
    channelDisplayName: string;
  }): Promise<TwitchPlayerConnection> {
    const connection: TwitchPlayerConnection = {
      playerId: params.playerId,
      gameCode: params.gameCode,
      channelId: params.channelId,
      channelLogin: params.channelLogin,
      channelDisplayName: params.channelDisplayName,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      subscriptions: [],
      sharedChatActive: false,
    };

    const sessionId = await this.ensureEventSubSession();
    await this.subscribeConnection(connection, sessionId);

    const gameConnections = this.connectionsByGameCode.get(params.gameCode) || new Map<string, TwitchPlayerConnection>();
    gameConnections.set(params.playerId, connection);
    this.connectionsByGameCode.set(params.gameCode, gameConnections);
    return connection;
  }

  private getSubscriptionConfigs(connection: TwitchPlayerConnection): EventSubSubscriptionConfig[] {
    return [
      {
        type: 'channel.chat.message',
        version: '1',
        condition: {
          broadcaster_user_id: connection.channelId,
          user_id: connection.channelId,
        },
      },
      {
        type: 'channel.shared_chat.begin',
        version: '1',
        condition: {
          broadcaster_user_id: connection.channelId,
        },
      },
      {
        type: 'channel.shared_chat.update',
        version: '1',
        condition: {
          broadcaster_user_id: connection.channelId,
        },
      },
      {
        type: 'channel.shared_chat.end',
        version: '1',
        condition: {
          broadcaster_user_id: connection.channelId,
        },
      },
    ];
  }

  private async ensureEventSubSession(): Promise<string> {
    if (this.eventSubSessionId) {
      return this.eventSubSessionId;
    }

    if (this.eventSubSessionReady) {
      return this.eventSubSessionReady;
    }

    this.eventSubSessionReady = new Promise<string>((resolve, reject) => {
      const WebSocketCtor = (globalThis as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket;
      if (!WebSocketCtor) {
        reject(new Error('WebSocket nicht verfuegbar.'));
        this.eventSubSessionReady = null;
        return;
      }

      const socket = new WebSocketCtor(TWITCH_EVENTSUB_WEBSOCKET_URL);
      this.bindEventSubSocket(socket, resolve, reject);
    });

    return this.eventSubSessionReady;
  }

  private bindEventSubSocket(
    socket: WebSocketLike,
    resolve: (sessionId: string) => void,
    reject: (error: Error) => void,
  ): void {
    const handleMessage = (rawData: string) => {
      let envelope: EventSubEnvelope;
      try {
        envelope = JSON.parse(rawData) as EventSubEnvelope;
      } catch {
        return;
      }

      const messageType = envelope.metadata?.message_type;
      if (messageType === 'session_welcome') {
        const sessionId = envelope.payload?.session?.id;
        if (!sessionId) {
          reject(new Error('EventSub-Session ohne ID.'));
          this.eventSubSessionReady = null;
          return;
        }

        const shouldResubscribe = this.eventSubSessionId !== null && this.eventSubSessionId !== sessionId;
        this.eventSubSocket = socket;
        this.eventSubSessionId = sessionId;
        this.eventSubSessionReady = null;
        if (shouldResubscribe) {
          void this.resubscribeAllConnections(sessionId);
        }
        resolve(sessionId);
        return;
      }

      if (messageType === 'notification') {
        void this.handleNotification(envelope);
        return;
      }

      if (messageType === 'session_reconnect') {
        const reconnectUrl = envelope.payload?.session?.reconnect_url;
        if (reconnectUrl) {
          this.reconnectEventSubSocket(reconnectUrl);
        }
        return;
      }

      if (messageType === 'revocation') {
        const subscriptionId = envelope.payload?.subscription?.id;
        if (subscriptionId) {
          void this.handleSubscriptionRevocation(subscriptionId);
        }
      }
    };

    const handleClose = () => {
      if (this.eventSubSocket === socket) {
        this.eventSubSocket = null;
      }

      if (this.eventSubSessionId) {
        this.eventSubSessionId = null;
        this.scheduleEventSubReconnect();
      }
    };

    if (socket.addEventListener) {
      socket.addEventListener('message', (event) => handleMessage(String(event.data)));
      socket.addEventListener('close', handleClose);
      socket.addEventListener('error', () => {
        this.eventSubSessionReady = null;
        reject(new Error('EventSub-Verbindung fehlgeschlagen.'));
      });
    } else {
      socket.onmessage = (event) => handleMessage(String(event.data));
      socket.onclose = handleClose;
      socket.onerror = () => {
        this.eventSubSessionReady = null;
        reject(new Error('EventSub-Verbindung fehlgeschlagen.'));
      };
    }
  }

  private reconnectEventSubSocket(reconnectUrl: string): void {
    const WebSocketCtor = (globalThis as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket;
    if (!WebSocketCtor) {
      return;
    }

    this.eventSubSessionId = null;
    this.eventSubSessionReady = new Promise<string>((resolve, reject) => {
      const socket = new WebSocketCtor(reconnectUrl);
      this.bindEventSubSocket(socket, resolve, reject);
    });
  }

  private scheduleEventSubReconnect(): void {
    if (this.reconnectTimer || !this.hasActiveConnections()) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureEventSubSession()
        .then((sessionId) => this.resubscribeAllConnections(sessionId))
        .catch(() => undefined);
    }, EVENTSUB_RECONNECT_DELAY_MS);
  }

  private hasActiveConnections(): boolean {
    return [...this.connectionsByGameCode.values()].some((connections) => connections.size > 0);
  }

  private async handleSubscriptionRevocation(subscriptionId: string): Promise<void> {
    const subscriptionTarget = this.subscriptionIndex.get(subscriptionId);
    this.subscriptionIndex.delete(subscriptionId);
    if (!subscriptionTarget) {
      return;
    }

    const gameState = this.gameManager.getGame(subscriptionTarget.gameCode);
    gameState?.setCommunityVotingError(subscriptionTarget.playerId, 'Twitch-Chat konnte nicht weiter beobachtet werden.');
    await this.disconnectPlayer(subscriptionTarget.gameCode, subscriptionTarget.playerId, { preserveGameState: true });
    if (gameState?.getPlayer(subscriptionTarget.playerId)) {
      this.emitPlayerState(subscriptionTarget.gameCode, subscriptionTarget.playerId);
    }
  }

  private async resubscribeAllConnections(sessionId: string): Promise<void> {
    for (const connections of this.connectionsByGameCode.values()) {
      for (const connection of connections.values()) {
        for (const subscriptionId of connection.subscriptions) {
          this.subscriptionIndex.delete(subscriptionId);
        }
        connection.subscriptions = [];

        try {
          await this.subscribeConnection(connection, sessionId);
        } catch {
          const gameState = this.gameManager.getGame(connection.gameCode);
          gameState?.setCommunityVotingError(connection.playerId, 'Twitch-Chat konnte nicht weiter beobachtet werden.');
          if (gameState?.getPlayer(connection.playerId)) {
            this.emitPlayerState(connection.gameCode, connection.playerId);
          }
        }
      }
    }
  }

  private async handleNotification(envelope: EventSubEnvelope): Promise<void> {
    const subscriptionId = envelope.payload?.subscription?.id;
    if (!subscriptionId) {
      return;
    }

    const subscriptionTarget = this.subscriptionIndex.get(subscriptionId);
    if (!subscriptionTarget) {
      return;
    }

    const gameState = this.gameManager.getGame(subscriptionTarget.gameCode);
    const player = gameState?.getPlayer(subscriptionTarget.playerId);
    const connection = this.connectionsByGameCode.get(subscriptionTarget.gameCode)?.get(subscriptionTarget.playerId);
    if (!gameState || !player || !connection) {
      return;
    }

    const subscriptionType = envelope.payload?.subscription?.type || envelope.metadata?.subscription_type;
    if (subscriptionType === 'channel.chat.message') {
      const event = envelope.payload?.event || {};
      const chatterId = String(event.chatter_user_id || '');
      const messageText = String((event.message as { text?: string } | undefined)?.text || '');
      const sourceBroadcasterUserId = typeof event.source_broadcaster_user_id === 'string'
        ? event.source_broadcaster_user_id
        : null;

      if (!chatterId || !messageText) {
        return;
      }

      if (!shouldCountCommunityVoteFromSource(sourceBroadcasterUserId, connection.channelId)) {
        return;
      }

      const optionCount = gameState.getClientCommunityVotingState(subscriptionTarget.playerId).context?.options.length || 0;
      if (optionCount === 0) {
        return;
      }

      const voteNumber = parseCommunityVoteCommand(messageText, optionCount);
      if (!voteNumber) {
        return;
      }

      if (gameState.recordCommunityVote(subscriptionTarget.playerId, chatterId, voteNumber)) {
        this.emitPlayerState(subscriptionTarget.gameCode, subscriptionTarget.playerId);
      }
      return;
    }

    if (subscriptionType === 'channel.shared_chat.begin' || subscriptionType === 'channel.shared_chat.update') {
      connection.sharedChatActive = true;
      gameState.setCommunityVotingSharedChatActive(subscriptionTarget.playerId, true);
      this.emitPlayerState(subscriptionTarget.gameCode, subscriptionTarget.playerId);
      return;
    }

    if (subscriptionType === 'channel.shared_chat.end') {
      connection.sharedChatActive = false;
      gameState.setCommunityVotingSharedChatActive(subscriptionTarget.playerId, false);
      this.emitPlayerState(subscriptionTarget.gameCode, subscriptionTarget.playerId);
    }
  }

  private async createSubscription(
    connection: TwitchPlayerConnection,
    sessionId: string,
    subscription: EventSubSubscriptionConfig,
  ): Promise<string> {
    const response = await this.authorizedFetch(connection, TWITCH_EVENTSUB_SUBSCRIPTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: subscription.type,
        version: subscription.version,
        condition: subscription.condition,
        transport: {
          method: 'websocket',
          session_id: sessionId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('EventSub-Subscription fehlgeschlagen.');
    }

    const payload = await response.json() as EventSubSubscriptionResponse;
    const subscriptionId = payload.data?.[0]?.id;
    if (!subscriptionId) {
      throw new Error('EventSub-Subscription ohne ID.');
    }

    return subscriptionId;
  }

  private async deleteSubscription(connection: TwitchPlayerConnection, subscriptionId: string): Promise<void> {
    if (!subscriptionId) {
      return;
    }

    const url = new URL(TWITCH_EVENTSUB_SUBSCRIPTIONS_URL);
    url.searchParams.set('id', subscriptionId);

    try {
      await this.authorizedFetch(connection, url.toString(), {
        method: 'DELETE',
      });
    } catch {
      // Intentionally ignored: cleanup should be best-effort and must not leak sensitive details.
    }
  }

  private async authorizedFetch(
    connection: TwitchPlayerConnection,
    input: string,
    init: RequestInit,
    allowRefresh = true,
  ): Promise<Response> {
    const response = await fetch(input, {
      ...init,
      headers: {
        'Client-Id': this.clientId,
        Authorization: `Bearer ${connection.accessToken}`,
        ...(init.headers || {}),
      },
    });

    if (response.status === 401 && allowRefresh && connection.refreshToken) {
      const refreshedTokens = await this.refreshAccessToken(connection.refreshToken);
      connection.accessToken = refreshedTokens.access_token;
      connection.refreshToken = refreshedTokens.refresh_token || connection.refreshToken;

      return this.authorizedFetch(connection, input, init, false);
    }

    return response;
  }

  private async exchangeCodeForTokens(code: string): Promise<TwitchTokenResponse> {
    const response = await fetch(TWITCH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('OAuth-Code konnte nicht ausgetauscht werden.');
    }

    return await response.json() as TwitchTokenResponse;
  }

  private async refreshAccessToken(refreshToken: string): Promise<TwitchTokenResponse> {
    const response = await fetch(TWITCH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Twitch-Token konnte nicht erneuert werden.');
    }

    return await response.json() as TwitchTokenResponse;
  }

  private async fetchAuthenticatedUser(accessToken: string): Promise<{ id: string; login: string; display_name: string }> {
    const response = await fetch(TWITCH_USERS_URL, {
      headers: {
        'Client-Id': this.clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Twitch-Benutzer konnte nicht geladen werden.');
    }

    const payload = await response.json() as TwitchUserResponse;
    const user = payload.data?.[0];
    if (!user) {
      throw new Error('Twitch-Benutzer fehlt.');
    }

    return user;
  }

  private assertMinimalScopes(scopes?: string[]): void {
    if (!Array.isArray(scopes) || scopes.length === 0) {
      return;
    }

    const normalizedScopes = [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))].sort();
    const expectedScopes = [...TWITCH_MINIMAL_SCOPES].sort();
    if (normalizedScopes.length !== expectedScopes.length) {
      throw new Error('Twitch-Scopes sind ungueltig.');
    }

    for (let index = 0; index < expectedScopes.length; index += 1) {
      if (normalizedScopes[index] !== expectedScopes[index]) {
        throw new Error('Twitch-Scopes sind ungueltig.');
      }
    }
  }

  private isChannelConnectedToAnotherPlayer(gameCode: string, playerId: string, channelId: string): boolean {
    const gameConnections = this.connectionsByGameCode.get(gameCode);
    if (!gameConnections) {
      return false;
    }

    return [...gameConnections.values()].some((connection) => {
      return connection.playerId !== playerId && connection.channelId === channelId;
    });
  }

  private normalizeClientOrigin(clientOrigin?: string): string {
    const candidate = clientOrigin?.trim();
    if (!candidate) {
      return this.clientUrl;
    }

    try {
      const url = new URL(candidate);
      return url.origin === this.clientUrl ? url.origin : this.clientUrl;
    } catch {
      return this.clientUrl;
    }
  }

  private cleanupExpiredOAuthStates(): void {
    const now = Date.now();
    for (const [state, entry] of this.oauthStates) {
      if (entry.expiresAt < now) {
        this.oauthStates.delete(state);
      }
    }
  }

  private renderPopupHtml(clientOrigin: string, ok: boolean, message: string): string {
    const escapedOrigin = escapeForSingleQuotedScript(clientOrigin);
    const escapedMessage = escapeForSingleQuotedScript(message);
    const escapedStatus = ok ? 'success' : 'error';

    return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Twitch-Verbindung</title>
    <style>
      body { font-family: Arial, sans-serif; background: #111; color: #f4f4f4; display: grid; place-items: center; min-height: 100vh; margin: 0; }
      main { max-width: 32rem; padding: 2rem; text-align: center; }
    </style>
  </head>
  <body>
    <main>
      <p>${ok ? 'Twitch wurde verbunden.' : 'Twitch-Verbindung fehlgeschlagen.'}</p>
      <p>${message}</p>
    </main>
    <script>
      (function () {
        var payload = { type: 'twitch-oauth-complete', status: '${escapedStatus}', message: '${escapedMessage}' };
        if (window.opener) {
          window.opener.postMessage(payload, '${escapedOrigin}');
        }
        window.close();
      })();
    </script>
  </body>
</html>`;
  }
}
