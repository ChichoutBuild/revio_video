export const THEME_STORAGE_KEY = 'revio-theme';

export function getStoredTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  } catch (e) {
    return 'light';
  }
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    /* stockage indisponible (navigation privée stricte...) — le thème reste actif pour la session */
  }
}

// Script exécuté de façon synchrone AVANT le premier rendu (voir layout.jsx),
// pour éviter un flash de thème clair avant que React ne prenne le relais.
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored || 'light';
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;
