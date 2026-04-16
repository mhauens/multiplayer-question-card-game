import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RulesModal from './RulesModal';

describe('RulesModal', () => {
  it('shows the updated 10-player lobby limit', () => {
    render(
      <RulesModal
        isOpen
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText('Gespielt wird online mit 3 bis 10 Personen.')).toBeTruthy();
  });
});
