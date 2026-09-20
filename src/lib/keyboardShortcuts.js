const SHORTCUT_ACTIONS = Object.freeze({
  KeyQ: 'series',
  KeyE: 'parallel',
});

export function getReductionAction(event = {}) {
  const code = typeof event.code === 'string' ? event.code : '';
  if (SHORTCUT_ACTIONS[code]) return SHORTCUT_ACTIONS[code];

  const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
  if (key === 'q') return 'series';
  if (key === 'e') return 'parallel';
  return null;
}
