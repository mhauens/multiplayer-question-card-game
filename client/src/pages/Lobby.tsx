import { MAX_PLAYERS, MIN_PLAYERS_TO_START } from '@kgs/game-rules';
import { useGame } from '../context/GameContext';
import ShareAccessPanel from '../components/ShareAccessPanel';
import '../styles/global.css';

function formatCatalogName(name: string): string {
  return name
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function Lobby() {
  const { gameState, startGame, leaveGame, availableVariants } = useGame();

  if (!gameState) return null;

  const isHost = gameState.players.find(p => p.id === gameState.myId)?.isHost || false;
  const playerCount = gameState.players.length;
  const canStart = isHost && playerCount >= MIN_PLAYERS_TO_START;
  const activeVariant = availableVariants.find(variant => variant.id === gameState.activeVariant);
  const activeVariantTitle = activeVariant?.title || formatCatalogName(gameState.activeVariant);
  const activeExtensions = gameState.activeExtensions.map((extensionId) => {
    return activeVariant?.extensions.find((extension) => extension.id === extensionId) || {
      id: extensionId,
      title: formatCatalogName(extensionId),
    };
  });

  return (
    <div className="lobby-page">
      <div className="lobby-container">
        <h1 className="lobby-title">Lobby</h1>

        <ShareAccessPanel code={gameState.code} className="lobby-share-panel" />

        <div className="lobby-variant-section">
          <p className="lobby-variant-label">Kartenset:</p>
          <div className="lobby-variant-card">
            <strong>{activeVariantTitle}</strong>
            {activeVariant?.description && (
              <p>{activeVariant.description}</p>
            )}
            {activeExtensions.length > 0 && (
              <div className="lobby-extension-list" aria-label="Aktive Erweiterungen">
                {activeExtensions.map((extension) => (
                  <span key={extension.id} className="lobby-extension-chip">{extension.title}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="player-list">
          <h2>Spieler ({playerCount}/{MAX_PLAYERS})</h2>
          <ul>
            {gameState.players.map(p => (
              <li key={p.id} className={`player-item ${!p.isConnected ? 'disconnected' : ''}`}>
                <span className="player-name">
                  {p.name}
                  {p.isHost && <span className="host-badge">Host</span>}
                  {p.id === gameState.myId && <span className="you-badge">Du</span>}
                </span>
                <span className={`player-status ${p.isConnected ? 'online' : 'offline'}`}>
                  {p.isConnected ? '●' : '○'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {isHost && (
          <div className="lobby-actions">
            <button
              className="btn btn-primary btn-large"
              onClick={startGame}
              disabled={!canStart}
            >
              {playerCount < MIN_PLAYERS_TO_START
                ? `Noch ${MIN_PLAYERS_TO_START - playerCount} Spieler benötigt`
                : 'Spiel starten!'}
            </button>
          </div>
        )}

        {!isHost && (
          <p className="lobby-waiting">Warte auf den Host, um das Spiel zu starten...</p>
        )}

        <button className="btn btn-text lobby-leave" onClick={leaveGame}>
          Spiel verlassen
        </button>
      </div>
    </div>
  );
}
