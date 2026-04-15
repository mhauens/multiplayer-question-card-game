import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameManager } from './game/GameManager';
import { registerSocketHandlers } from './socket/handlers';
import { TwitchService } from './twitch/TwitchService';
import { loadLocalEnv } from './loadLocalEnv';

loadLocalEnv();

const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

const gameManager = new GameManager();
const twitchService = new TwitchService({
  gameManager,
  clientUrl: CLIENT_URL,
  clientId: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET,
  redirectUri: process.env.TWITCH_REDIRECT_URI,
  emitPlayerState: (gameCode, playerId) => {
    const gameState = gameManager.getGame(gameCode);
    const player = gameState?.getPlayer(playerId);
    if (!gameState || !player?.socketId) {
      return;
    }

    io.to(player.socketId).emit('game-state', gameState.getClientState(playerId));
  },
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Available extensions endpoint
app.get('/api/extensions', (_req, res) => {
  res.json({ extensions: gameManager.getAvailableExtensions() });
});

app.get('/api/variants', (_req, res) => {
  res.json({ variants: gameManager.getAvailableVariants() });
});

app.get('/api/games/:code/preview', (req, res) => {
  const preview = gameManager.getGamePreview(req.params.code);
  if (!preview) {
    res.status(404).json({ error: 'Spiel nicht gefunden.' });
    return;
  }

  res.json(preview);
});

app.get('/api/twitch/oauth/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const result = await twitchService.handleOAuthCallback({ code, state });
  res.status(result.ok ? 200 : 400).type('html').send(result.html);
});

registerSocketHandlers(io, gameManager, twitchService);

// Periodic cleanup of old games
setInterval(() => {
  const deletedGameCodes = gameManager.cleanup();
  deletedGameCodes.forEach((gameCode) => {
    void twitchService.cleanupGame(gameCode);
  });
}, 30 * 60 * 1000); // every 30 minutes

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Accepting connections from ${CLIENT_URL}`);
});
