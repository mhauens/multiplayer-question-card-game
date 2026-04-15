import { useGame } from '../context/GameContext';

interface CommunityVotingPanelProps {
  className?: string;
}

export default function CommunityVotingPanel({ className }: CommunityVotingPanelProps) {
  const {
    gameState,
    isTwitchConnecting,
    connectTwitchCommunity,
    disconnectTwitchCommunity,
    setCommunityVotingEnabled,
  } = useGame();

  if (!gameState) {
    return null;
  }

  const panelClassName = className ? `community-voting-panel ${className}` : 'community-voting-panel';
  const communityVoting = gameState.communityVoting;
  const connectionStatus = communityVoting.connection.status;
  const isConnected = connectionStatus === 'connected';
  const isEnabled = communityVoting.enabled;
  const isConnecting = connectionStatus === 'connecting';
  const requiresWarningConfirmation = connectionStatus === 'warning_required';

  return (
    <section className={panelClassName} aria-label="Twitch Community-Voting">
      <div className="community-voting-panel-header">
        <div>
          <p className="community-voting-eyebrow">Optional</p>
          <h3>Twitch Community-Voting</h3>
        </div>
        {isConnected && (
          <label className={`community-voting-toggle ${isEnabled ? 'is-active' : ''}`}>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(event) => void setCommunityVotingEnabled(event.target.checked)}
            />
            <span>{isEnabled ? 'Aktiv' : 'Aus'}</span>
          </label>
        )}
      </div>

      <p className="community-voting-copy">
        Dein Chat kann mit <strong>!card 1</strong>, <strong>!card 2</strong> und so weiter abstimmen.
        Die Stimmen sind nur fuer dich sichtbar und dienen als Empfehlung.
      </p>

      {!isConnected && (
        <div className="community-voting-actions">
          <button
            className="btn btn-secondary"
            onClick={() => void connectTwitchCommunity()}
            disabled={isTwitchConnecting || isConnecting}
          >
            {isConnecting
              ? 'Verbinde mit Twitch...'
              : requiresWarningConfirmation
                ? 'Privacy-Hinweis bestätigen'
                : 'Mit Twitch verbinden'}
          </button>
        </div>
      )}

      {!isConnected && requiresWarningConfirmation && (
        <p className="community-voting-status">
          Vor dem OAuth-Start muss der Privacy-Hinweis dieser Sitzung bestätigt werden.
        </p>
      )}

      {!isConnected && isConnecting && (
        <p className="community-voting-status">
          Twitch-Autorisierung läuft. Nach Abschluss wird nur dein eigener Kanal in dieser Partie verbunden.
        </p>
      )}

      {isConnected && (
        <>
          <div className="community-voting-connection">
            <div className="community-voting-meta">
              <span className="community-voting-channel">
                Verbunden mit <strong>{communityVoting.connection.channelDisplayName || communityVoting.connection.channelLogin}</strong>
              </span>
              <span className="community-voting-status">
                {communityVoting.connection.sharedChatActive
                  ? 'Gemeinsamer Chat erkannt. Es zaehlen nur Stimmen aus deiner eigenen Community.'
                  : 'Es werden nur Stimmen aus deinem eigenen Kanal gezaehlt.'}
              </span>
            </div>
            <button className="btn btn-text btn-small" onClick={() => void disconnectTwitchCommunity()}>
              Twitch trennen
            </button>
          </div>

          {communityVoting.context && isEnabled && (
            <div className="community-voting-live">
              <span>
                {communityVoting.context.kind === 'SUBMIT_HAND'
                  ? 'Dein Chat stimmt gerade über deine sichtbaren Handkarten ab.'
                  : 'Dein Chat stimmt gerade über die sichtbaren Antwortgruppen ab.'}
              </span>
              <span>
                {communityVoting.context.totalUniqueVoters} eindeutige Chat-Stimmen in dieser Ansicht
              </span>
            </div>
          )}
        </>
      )}

      {communityVoting.connection.lastError && (
        <p className="community-voting-error">{communityVoting.connection.lastError}</p>
      )}
    </section>
  );
}
