const DEFAULT_THEME = 'base';
const CUSTOM_THEMES = new Set(['peppa-wutz']);

export function resolveVariantTheme(variantId?: string | null): string {
  const normalizedVariant = typeof variantId === 'string' && variantId.trim().length > 0
    ? variantId.trim()
    : DEFAULT_THEME;

  return CUSTOM_THEMES.has(normalizedVariant) ? normalizedVariant : DEFAULT_THEME;
}

export function applyVariantTheme(variantId?: string | null): void {
  if (typeof document === 'undefined') {
    return;
  }

  const theme = resolveVariantTheme(variantId);
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
}