// The rules T3 Code enforces on a theme file, as one function. Used by tools/validate.mjs and by theme tests.
const ROLES = new Set('canvas chrome toolbar toolbarForeground toolbarBorder toolbarControl toolbarControlForeground toolbarControlHover surface surfaceRaised surfaceOverlay text textMuted border input focus accent accentForeground secondary secondaryForeground muted mutedForeground placeholder secondaryLabel iconMuted error errorForeground errorSurface warning warningForeground warningSurface update updateForeground updateSurface accentSurface accentSurfaceForeground messageSurface messageForeground messageAction messageActionForeground messageActionHover codeBackground codeForeground searchMatchBackground searchMatchForeground searchMatchActiveBackground searchMatchActiveForeground sidebar sidebarForeground sidebarMutedForeground sidebarControlSurface sidebarRowHover sidebarRowActive sidebarRowSelected sidebarBorder terminalBackground terminalForeground terminalCursor terminalSelection terminalScrollbar terminalScrollbarHover'.split(' '));
export const BUILT_IN = new Set(['t3-chat', 'grove', 'ocean', 'ember', 'iris']);
const KEYS = new Set(['version', 'name', 'appearance', 'canvas', 'accent', 'colors', 'variants', 'css']);
const HEX = /^#[0-9a-fA-F]{6}$/;
export const LIMITS = { css: 20000, file: 32768, name: 48, preview: 600000 };

function colorMap(map, where, bad) {
  if (map === null || typeof map !== 'object' || Array.isArray(map)) return bad.push(`${where} must be an object of role: "#rrggbb"`);
  for (const [role, value] of Object.entries(map)) {
    if (!ROLES.has(role)) bad.push(`${where}.${role} is not a colour role (a nested object here makes T3 Code drop the file)`);
    else if (typeof value !== 'string' || !HEX.test(value)) bad.push(`${where}.${role} must be "#rrggbb"`);
  }
}

export function checkTheme(theme, bytes) {
  const bad = [];
  if (bytes > LIMITS.file) bad.push(`the file is ${bytes} bytes; the limit is ${LIMITS.file}`);
  for (const key of Object.keys(theme)) if (!KEYS.has(key)) bad.push(`unknown field "${key}"`);
  if (theme.version !== 1) bad.push('version must be 1');
  if (typeof theme.name !== 'string' || !theme.name.trim() || theme.name.length > LIMITS.name) bad.push(`name must be 1 to ${LIMITS.name} characters`);
  if (theme.appearance !== 'light' && theme.appearance !== 'dark') bad.push('appearance must be "light" or "dark"');
  for (const key of ['canvas', 'accent']) if (theme[key] !== undefined && !(typeof theme[key] === 'string' && HEX.test(theme[key]))) bad.push(`${key} must be "#rrggbb"`);
  if (theme.colors !== undefined) colorMap(theme.colors, 'colors', bad);
  if (theme.variants !== undefined) {
    if (theme.variants === null || typeof theme.variants !== 'object') bad.push('variants must be an object');
    else for (const [mode, map] of Object.entries(theme.variants)) mode === 'light' || mode === 'dark' ? colorMap(map, `variants.${mode}`, bad) : bad.push(`variants.${mode}: only light and dark exist`);
  }
  const hasColors = (theme.canvas && theme.accent) || (theme.colors && Object.keys(theme.colors).length);
  if (!hasColors && !theme.css) bad.push('the theme changes nothing: give canvas and accent, or colors, or css');
  if (theme.css !== undefined) {
    const css = theme.css;
    if (typeof css !== 'string') bad.push('css must be a string');
    else {
      if (css.length > LIMITS.css) bad.push(`css is ${css.length} characters; the limit is ${LIMITS.css}`);
      if (css.includes('\\')) bad.push('css has a backslash; T3 Code removes every property that has one');
      if (/@import/i.test(css)) bad.push('css uses @import; a theme cannot load files');
      if (/image-set\(|\bsrc\(/i.test(css)) bad.push('css uses image-set() or src(); a theme cannot load files');
      if (/url\((?![ \t\n\f\r]*["']?(?:data:|#))/i.test(css)) bad.push('css has a url() that is not a data: address or a #id');
    }
  }
  return bad;
}
