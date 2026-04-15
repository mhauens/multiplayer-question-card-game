import { describe, expect, it, vi } from 'vitest';
import { GameManager } from '../src/game/GameManager';
import { TwitchService } from '../src/twitch/TwitchService';

describe('TwitchService', () => {
  it('creates an OAuth URL with only the minimal Twitch scope', async () => {
    const service = new TwitchService({
      gameManager: {
        getGame: () => undefined,
      } as unknown as GameManager,
      emitPlayerState: () => undefined,
      clientUrl: 'http://localhost:5173',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'http://localhost:3001/api/twitch/oauth/callback',
    });

    const response = await service.createOAuthUrl({
      gameCode: 'ABCD',
      playerId: 'player-1',
      clientOrigin: 'http://localhost:5173',
    });

    expect('url' in response).toBe(true);
    if (!('url' in response)) {
      return;
    }

    const url = new URL(response.url);
    expect(url.searchParams.get('scope')).toBe('user:read:chat');
  });

  it('rejects OAuth callbacks that return broader scopes than expected', async () => {
    const setCommunityVotingError = vi.fn();
    const emitPlayerState = vi.fn();
    const service = new TwitchService({
      gameManager: {
        getGame: vi.fn(() => ({
          getPlayer: vi.fn(() => ({ id: 'player-1' })),
          setCommunityVotingError,
        })),
      } as unknown as GameManager,
      emitPlayerState,
      clientUrl: 'http://localhost:5173',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'http://localhost:3001/api/twitch/oauth/callback',
    }) as any;

    service.oauthStates.set('state-1', {
      gameCode: 'ABCD',
      playerId: 'player-1',
      clientOrigin: 'http://localhost:5173',
      expiresAt: Date.now() + 10_000,
    });
    service.exchangeCodeForTokens = vi.fn().mockResolvedValue({
      access_token: 'token',
      refresh_token: 'refresh',
      scope: ['user:read:chat', 'channel:manage:redemptions'],
    });
    service.fetchAuthenticatedUser = vi.fn();

    const result = await service.handleOAuthCallback({ code: 'oauth-code', state: 'state-1' });

    expect(result.ok).toBe(false);
    expect(service.fetchAuthenticatedUser).not.toHaveBeenCalled();
    expect(setCommunityVotingError).toHaveBeenCalledWith('player-1', 'Twitch-Verbindung konnte nicht hergestellt werden.');
    expect(emitPlayerState).toHaveBeenCalledWith('ABCD', 'player-1');
  });

  it('rejects duplicate channel bindings for another player in the same game', async () => {
    const setCommunityVotingError = vi.fn();
    const emitPlayerState = vi.fn();
    const service = new TwitchService({
      gameManager: {
        getGame: vi.fn(() => ({
          getPlayer: vi.fn(() => ({ id: 'player-1' })),
          setCommunityVotingError,
        })),
      } as unknown as GameManager,
      emitPlayerState,
      clientUrl: 'http://localhost:5173',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'http://localhost:3001/api/twitch/oauth/callback',
    }) as any;

    service.oauthStates.set('state-1', {
      gameCode: 'ABCD',
      playerId: 'player-1',
      clientOrigin: 'http://localhost:5173',
      expiresAt: Date.now() + 10_000,
    });
    service.exchangeCodeForTokens = vi.fn().mockResolvedValue({
      access_token: 'token',
      refresh_token: 'refresh',
      scope: ['user:read:chat'],
    });
    service.fetchAuthenticatedUser = vi.fn().mockResolvedValue({
      id: 'channel-1',
      login: 'anna',
      display_name: 'AnnaTV',
    });
    service.createConnection = vi.fn();
    service.connectionsByGameCode.set('ABCD', new Map([['player-2', {
      playerId: 'player-2',
      gameCode: 'ABCD',
      channelId: 'channel-1',
      channelLogin: 'anna',
      channelDisplayName: 'AnnaTV',
      accessToken: 'token',
      refreshToken: null,
      subscriptions: [],
      sharedChatActive: false,
    }]]));

    const result = await service.handleOAuthCallback({ code: 'oauth-code', state: 'state-1' });

    expect(result.ok).toBe(false);
    expect(service.createConnection).not.toHaveBeenCalled();
    expect(setCommunityVotingError).toHaveBeenCalledWith('player-1', 'Dieser Twitch-Kanal ist in dieser Partie bereits mit einem anderen Spieler verbunden.');
    expect(emitPlayerState).toHaveBeenCalledWith('ABCD', 'player-1');
  });

  it('rolls back partially created subscriptions when connection setup fails', async () => {
    const service = new TwitchService({
      gameManager: {
        getGame: () => undefined,
      } as unknown as GameManager,
      emitPlayerState: () => undefined,
      clientUrl: 'http://localhost:5173',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'http://localhost:3001/api/twitch/oauth/callback',
    }) as any;

    const closeSocket = vi.fn();
    service.eventSubSocket = { close: closeSocket };
    service.eventSubSessionId = 'session-1';
    service.eventSubSessionReady = Promise.resolve('session-1');
    service.ensureEventSubSession = vi.fn().mockResolvedValue('session-1');
    service.createSubscription = vi
      .fn()
      .mockResolvedValueOnce('sub-1')
      .mockRejectedValueOnce(new Error('subscription failed'));

    const deletedSubscriptionIds: string[] = [];
    service.deleteSubscription = vi.fn(async (_connection: unknown, subscriptionId: string) => {
      deletedSubscriptionIds.push(subscriptionId);
    });

    await expect(service.createConnection({
      gameCode: 'ABCD',
      playerId: 'player-1',
      accessToken: 'token',
      refreshToken: null,
      channelId: 'channel-1',
      channelLogin: 'anna',
      channelDisplayName: 'AnnaTV',
    })).rejects.toThrow('subscription failed');

    expect(deletedSubscriptionIds).toEqual(['sub-1']);
    expect(service.subscriptionIndex.size).toBe(0);
    expect(service.connectionsByGameCode.size).toBe(0);
    expect(closeSocket).toHaveBeenCalledOnce();
    expect(service.eventSubSocket).toBeNull();
    expect(service.eventSubSessionId).toBeNull();
    expect(service.eventSubSessionReady).toBeNull();
  });

  it('disconnects the player and surfaces an error when Twitch revokes a subscription', async () => {
    const setCommunityVotingError = vi.fn();
    const getPlayer = vi.fn(() => ({ id: 'player-1' }));
    const emitPlayerState = vi.fn();
    const service = new TwitchService({
      gameManager: {
        getGame: vi.fn(() => ({
          setCommunityVotingError,
          getPlayer,
        })),
      } as unknown as GameManager,
      emitPlayerState,
      clientUrl: 'http://localhost:5173',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'http://localhost:3001/api/twitch/oauth/callback',
    }) as any;

    const connection = {
      playerId: 'player-1',
      gameCode: 'ABCD',
      channelId: 'channel-1',
      channelLogin: 'anna',
      channelDisplayName: 'AnnaTV',
      accessToken: 'token',
      refreshToken: null,
      subscriptions: ['sub-1', 'sub-2'],
      sharedChatActive: false,
    };

    service.connectionsByGameCode.set('ABCD', new Map([['player-1', connection]]));
    service.subscriptionIndex.set('sub-1', { gameCode: 'ABCD', playerId: 'player-1' });
    service.subscriptionIndex.set('sub-2', { gameCode: 'ABCD', playerId: 'player-1' });
    service.deleteSubscription = vi.fn(async () => undefined);
    service.eventSubSocket = { close: vi.fn() };
    service.eventSubSessionId = 'session-1';
    service.eventSubSessionReady = Promise.resolve('session-1');

    await service.handleSubscriptionRevocation('sub-1');

    expect(setCommunityVotingError).toHaveBeenCalledWith('player-1', 'Twitch-Chat konnte nicht weiter beobachtet werden.');
    expect(service.deleteSubscription).toHaveBeenCalledTimes(2);
    expect(service.connectionsByGameCode.size).toBe(0);
    expect(service.subscriptionIndex.size).toBe(0);
    expect(emitPlayerState).toHaveBeenCalledWith('ABCD', 'player-1');
  });
});
