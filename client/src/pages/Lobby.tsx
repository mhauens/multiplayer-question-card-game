import { useState } from 'react';
import { useGame } from '../context/GameContext';
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
  const [copied, setCopied] = useState(false);

  if (!gameState) return null;

  const shareUrl = `${window.location.origin}/join/${gameState.code}`;
  const isHost = gameState.players.find(p => p.id === gameState.myId)?.isHost || false;
  const playerCount = gameState.players.length;
  const canStart = isHost && playerCount >= 3;
  const activeVariant = availableVariants.find(variant => variant.id === gameState.activeVariant);
  const activeVariantTitle = activeVariant?.title || formatCatalogName(gameState.activeVariant);
  const activeExtensions = gameState.activeExtensions.map((extensionId) => {
    return activeVariant?.extensions.find((extension) => extension.id === extensionId) || {
      id: extensionId,
      title: formatCatalogName(extensionId),
    };
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="lobby-page">
      <div className="lobby-container">
        <h1 className="lobby-title">Lobby</h1>

        <div className="lobby-code-section">
          <p className="lobby-code-label">Spielcode:</p>
          <div className="lobby-code">{gameState.code}</div>
        </div>

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

        <div className="share-section">
          <p className="share-label">Lade Freunde ein:</p>
          <div className="share-link-row">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="input share-input"
            />
            <button className="btn btn-secondary" onClick={copyLink}>
              {copied ? '✓ Kopiert!' : 'Kopieren'}
            </button>
          </div>
        </div>

        <div className="player-list">
          <h2>Spieler ({playerCount}/8)</h2>
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
              {playerCount < 3
                ? `Noch ${3 - playerCount} Spieler benötigt`
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
