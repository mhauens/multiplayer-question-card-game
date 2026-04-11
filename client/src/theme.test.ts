import { afterEach, describe, expect, it } from 'vitest';
import { applyVariantTheme, resolveVariantTheme } from './theme';

describe('resolveVariantTheme', () => {
  it('returns the dedicated theme for known variants', () => {
    expect(resolveVariantTheme('peppa-wutz')).toBe('peppa-wutz');
  });

  it('falls back to the base theme for empty or unknown variants', () => {
    expect(resolveVariantTheme('')).toBe('base');
    expect(resolveVariantTheme('unknown-variant')).toBe('base');
    expect(resolveVariantTheme(null)).toBe('base');
  });
});

describe('applyVariantTheme', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    delete document.body.dataset.theme;
  });

  it('applies the resolved theme to both document roots', () => {
    applyVariantTheme('peppa-wutz');

    expect(document.documentElement.dataset.theme).toBe('peppa-wutz');
    expect(document.body.dataset.theme).toBe('peppa-wutz');
  });

  it('uses the base theme when the variant is unknown', () => {
    applyVariantTheme('totally-unknown');

    expect(document.documentElement.dataset.theme).toBe('base');
    expect(document.body.dataset.theme).toBe('base');
  });
});