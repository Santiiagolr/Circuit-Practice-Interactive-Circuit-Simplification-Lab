const VALID_MODES = new Set(['training', 'exam']);
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
    mode: 'training',
    compType: 'R',
    difficulty: 'guided',
    valueMode: 'varied',
  };
  if (!enabled) return defaults;

  const params = new URLSearchParams(search);
  const explicit = ['seed', 'mode', 'type', 'difficulty', 'values', 'representation', 'manual'].some(key => params.has(key));
  const seedText = params.get('seed');
  const rawSeed = Number(seedText);
  const seed = seedText?.trim() && Number.isSafeInteger(rawSeed) && rawSeed >= 0 ? rawSeed : fallbackSeed;
  const config = {
    enabled: true,
    seed,
    mode: enumValue(params.get('mode'), VALID_MODES, defaults.mode),
    compType: enumValue((params.get('type') || '').toUpperCase(), VALID_TYPES, defaults.compType),
    difficulty: enumValue(params.get('difficulty'), VALID_DIFFICULTIES, defaults.difficulty),
    valueMode: enumValue(params.get('values'), VALID_VALUE_MODES, defaults.valueMode),
    representation: params.get('representation') === 'symbolic' ? 'symbolic' : 'numeric',
    manual: params.get('manual') === 'true',
  };
  return { ...config, explicit, key: JSON.stringify({ seed: config.seed, mode: config.mode, compType: config.compType, difficulty: config.difficulty, valueMode: config.valueMode, representation: config.representation, manual: config.manual }) };
}

export function getQaConfig(fallbackSeed = Date.now()) {
  const enabled = import.meta.env.MODE === 'qa';
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return parseQaConfig(search, enabled, fallbackSeed);
}
