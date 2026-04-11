import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { CardCatalogOption, GamePreview } from '../types';
import { resolveServerUrl } from '../serverUrl';
import { applyVariantTheme } from '../theme';
import '../styles/global.css';

const fallbackVariants: CardCatalogOption[] = [
  {
    id: 'base',
    title: 'Basic',
    description: 'Der klassische Kartensatz mit dem normalen Spiessertum-Humor.',
    questionCount: 60,
    answerCount: 120,
    extensions: [],
  },
];

export default function Home() {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { createGame, joinGame, isConnected, availableVariants } = useGame();

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>(code ? 'join' : 'menu');
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState(code?.toUpperCase() || '');
  const [maxTrophies, setMaxTrophies] = useState(5);
  const [selectedVariant, setSelectedVariant] = useState('base');
  const [selectedExtensionsByVariant, setSelectedExtensionsByVariant] = useState<Record<string, string[]>>({});
  const [gamePreview, setGamePreview] = useState<GamePreview | null>(null);
  const [loading, setLoading] = useState(false);

  const variantOptions = availableVariants.length > 0 ? availableVariants : fallbackVariants;

  useEffect(() => {
    if (code) {
      setGameCode(code.toUpperCase());
      setMode('join');
    }
  }, [code]);

  useEffect(() => {
    if (variantOptions.some(option => option.id === selectedVariant)) {
      return;
    }

    const baseVariant = variantOptions.find(option => option.id === 'base');
    setSelectedVariant(baseVariant?.id || variantOptions[0]?.id || 'base');
  }, [selectedVariant, variantOptions]);

  useEffect(() => {
    if (mode !== 'join') {
      setGamePreview(null);
      return;
    }

    const normalizedGameCode = gameCode.trim().toUpperCase();
    if (normalizedGameCode.length !== 6) {
      setGamePreview(null);
      return;
    }

    const controller = new AbortController();

    void fetch(`${resolveServerUrl()}/api/games/${encodeURIComponent(normalizedGameCode)}/preview`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return await response.json() as GamePreview;
      })
      .then((preview) => {
        setGamePreview(preview);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setGamePreview(null);
        }
      });

    return () => {
      controller.abort();
    };
  }, [gameCode, mode]);

  useEffect(() => {
    const themeVariant = mode === 'create'
      ? selectedVariant
      : mode === 'join'
        ? gamePreview?.activeVariant
        : 'base';

    applyVariantTheme(themeVariant);
  }, [gamePreview?.activeVariant, mode, selectedVariant]);

  const handleExtensionToggle = (variantId: string, extensionId: string) => {
    setSelectedExtensionsByVariant((currentState) => {
      const currentSelection = currentState[variantId] || [];
      const nextSelection = currentSelection.includes(extensionId)
        ? currentSelection.filter((currentId) => currentId !== extensionId)
        : [...currentSelection, extensionId];

      if (nextSelection.length === 0) {
        const { [variantId]: _removed, ...rest } = currentState;
        return rest;
      }

      return {
        ...currentState,
        [variantId]: nextSelection,
      };
    });
  };

  const handleVariantKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, variantId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    setSelectedVariant(variantId);
  };

  const handleCreate = async () => {
    if (!playerName.trim()) return;
    setLoading(true);
    const selectedExtensions = selectedExtensionsByVariant[selectedVariant] || [];
    const resultCode = await createGame(playerName.trim(), maxTrophies, selectedVariant, selectedExtensions);
    setLoading(false);
    if (resultCode) {
      navigate(`/lobby/${resultCode}`);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim() || !gameCode.trim()) return;
    setLoading(true);
    const resultCode = await joinGame(gameCode.trim(), playerName.trim());
    setLoading(false);
    if (resultCode) {
      navigate(`/lobby/${resultCode}`);
    }
  };

  return (
    <div className="home-page">
      <div className="home-container">
        <div className="home-logo">
          <img src="/skull-logo.svg" alt="Logo" className="home-skull" />
        </div>
        <h1 className="home-title">Kampf gegen das Spießertum</h1>
        <p className="home-subtitle">Das Partyspiel für lustige Fieslinge</p>

        {mode === 'menu' && (
          <div className="home-buttons">
            <button
              className="btn btn-primary btn-large"
              onClick={() => setMode('create')}
              disabled={!isConnected}
            >
              Neues Spiel erstellen
            </button>
            <button
              className="btn btn-secondary btn-large"
              onClick={() => setMode('join')}
              disabled={!isConnected}
            >
              Spiel beitreten
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="home-form">
            <input
              type="text"
              placeholder="Dein Name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              maxLength={20}
              className="input"
              autoFocus
            />
            <div className="trophy-selector">
              <label>Trophäen zum Sieg:</label>
              <div className="trophy-buttons">
                {[3, 5, 7, 10].map(n => (
                  <button
                    key={n}
                    className={`btn btn-small ${maxTrophies === n ? 'btn-active' : 'btn-outline'}`}
                    onClick={() => setMaxTrophies(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="variant-selector">
              <label>Kartenset:</label>
              <div className="variant-options" role="radiogroup" aria-label="Kartenset auswaehlen">
                {variantOptions.map((option) => (
                  <div
                    key={option.id}
                    className={`variant-option ${selectedVariant === option.id ? 'variant-option-active' : ''}`}
                    onClick={() => setSelectedVariant(option.id)}
                    onKeyDown={(event) => handleVariantKeyDown(event, option.id)}
                    role="radio"
                    aria-checked={selectedVariant === option.id}
                    tabIndex={0}
                  >
                    <span className="variant-option-header">
                      <span className="variant-option-title">{option.title}</span>
                      <span className="variant-option-counts">{option.questionCount} Fragen · {option.answerCount} Antworten</span>
                    </span>
                    <span className="variant-option-description">{option.description}</span>

                    {option.extensions.length > 0 && (
                      <div className="variant-extensions">
                        <span className="variant-extensions-label">Erweiterungen</span>
                        <div className="variant-extension-list">
                          {option.extensions.map((extension) => {
                            const isVariantActive = selectedVariant === option.id;
                            const isChecked = (selectedExtensionsByVariant[option.id] || []).includes(extension.id);

                            return (
                              <label
                                key={extension.id}
                                className={`variant-extension-toggle ${isChecked ? 'variant-extension-toggle-active' : ''} ${!isVariantActive ? 'variant-extension-toggle-disabled' : ''}`}
                              >
                                <input
                                  className="variant-extension-toggle-input"
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={!isVariantActive}
                                  onChange={() => handleExtensionToggle(option.id, extension.id)}
                                />
                                <span className="variant-extension-slider" aria-hidden="true" />
                                <span className="variant-extension-copy">
                                  <span className="variant-extension-name">{extension.title}</span>
                                  <span className="variant-extension-meta">{extension.questionCount} Fragen · {extension.answerCount} Antworten</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {selectedVariant !== option.id && (
                          <span className="variant-extension-hint">Variante auswaehlen, um Erweiterungen zu aktivieren.</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button
              className="btn btn-primary btn-large"
              onClick={handleCreate}
              disabled={loading || !playerName.trim()}
            >
              {loading ? 'Erstelle Spiel...' : 'Spiel erstellen'}
            </button>
            <button className="btn btn-text" onClick={() => setMode('menu')}>
              ← Zurück
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="home-form">
            <input
              type="text"
              placeholder="Dein Name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              maxLength={20}
              className="input"
              autoFocus
            />
            <input
              type="text"
              placeholder="Spielcode (z.B. ABC123)"
              value={gameCode}
              onChange={e => setGameCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="input input-code"
            />
            <button
              className="btn btn-primary btn-large"
              onClick={handleJoin}
              disabled={loading || !playerName.trim() || !gameCode.trim()}
            >
              {loading ? 'Trete bei...' : 'Beitreten'}
            </button>
            <button className="btn btn-text" onClick={() => { setMode('menu'); setGameCode(''); }}>
              ← Zurück
            </button>
          </div>
        )}

        {!isConnected && (
          <p className="home-connecting">Verbinde mit Server...</p>
        )}
      </div>
    </div>
  );
}
