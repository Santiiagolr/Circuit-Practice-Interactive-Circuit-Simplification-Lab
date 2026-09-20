const VALID_MODES = new Set(['basic', 'advanced']);
const VALID_TYPES = new Set(['R', 'C']);
const VALID_DIFFICULTIES = new Set(['guided', 'practice', 'challenge']);
const VALID_VALUE_MODES = new Set(['varied', 'equal']);

function enumValue(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

export function parseQaConfig(search = '', enabled = false, fallbackSeed = Date.now()) {
  const defaults = {
    enabled: false,
    seed: fallbackSeed,
    mode: 'basic',
    compType: 'R',
    difficulty: 'guided',
    valueMode: 'varied',
  };
  if (!enabled) return defaults;

  const params = new URLSearchParams(search);
  const rawSeed = Number(params.get('seed'));
  const seed = Number.isSafeInteger(rawSeed) && rawSeed >= 0 ? rawSeed : fallbackSeed;
  return {
    enabled: true,
    seed,
    mode: enumValue(params.get('mode'), VALID_MODES, defaults.mode),
    compType: enumValue((params.get('type') || '').toUpperCase(), VALID_TYPES, defaults.compType),
    difficulty: enumValue(params.get('difficulty'), VALID_DIFFICULTIES, defaults.difficulty),
    valueMode: enumValue(params.get('values'), VALID_VALUE_MODES, defaults.valueMode),
  };
}

export function getQaConfig(fallbackSeed = Date.now()) {
  const enabled = Boolean(import.meta.env.DEV || import.meta.env.VITE_QA_MODE === 'true');
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return parseQaConfig(search, enabled, fallbackSeed);
}
