import { useEffect, useState } from 'react';

interface ShareAccessPanelProps {
  code: string;
  className?: string;
}

type CopyTarget = 'code' | 'link' | null;

function fallbackCopy(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function ShareAccessPanel({ code, className }: ShareAccessPanelProps) {
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget>(null);

  const shareUrl = `${window.location.origin}/join/${code}`;
  const maskedCode = '*'.repeat(code.length);
  const panelClassName = className ? `share-card ${className}` : 'share-card';

  useEffect(() => {
    if (!copiedTarget) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedTarget(null);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedTarget]);

  const copyText = async (text: string, target: Exclude<CopyTarget, null>) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      fallbackCopy(text);
    }

    setCopiedTarget(target);
  };

  const blockManualCopy = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
  };

  const blockManualSelection = (event: React.MouseEvent<HTMLInputElement>) => {
    event.preventDefault();
  };

  return (
    <section className={panelClassName} aria-label="Spielzugang teilen">
      <div className="share-card-row">
        <p className="share-card-label">Spielcode</p>
        <div className="share-card-control">
          <div className="share-code-display" aria-label="Verdeckter Spielcode">
            {maskedCode}
          </div>
          <button
            className="btn btn-secondary share-copy-button"
            onClick={() => void copyText(code, 'code')}
          >
            {copiedTarget === 'code' ? '✓ Code kopiert!' : 'Code kopieren'}
          </button>
        </div>
      </div>

      <div className="share-card-row">
        <p className="share-card-label">Einladungslink</p>
        <div className="share-card-control">
          <input
            type="password"
            value={shareUrl}
            readOnly
            tabIndex={-1}
            spellCheck={false}
            autoComplete="off"
            className="input share-input share-link-input"
            aria-label="Verdeckter Einladungslink"
            onCopy={blockManualCopy}
            onCut={blockManualCopy}
            onMouseDown={blockManualSelection}
          />
          <button
            className="btn btn-secondary share-copy-button"
            onClick={() => void copyText(shareUrl, 'link')}
          >
            {copiedTarget === 'link' ? '✓ Link kopiert!' : 'Link kopieren'}
          </button>
        </div>
      </div>
    </section>
  );
}