const preferenceKey = 'ucell.ui-theme-preference.v1';
const system = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  let preference;
  try { preference = localStorage.getItem(preferenceKey); } catch {}
  const dark = preference === 'DARK' || (preference !== 'LIGHT' && system.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}
applyTheme();
system.addEventListener('change', applyTheme);
window.addEventListener('storage', applyTheme);
