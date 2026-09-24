export const PROGRESS_KEY = 'circuit-practice:progress:v1';

export const EMPTY_PROGRESS = Object.freeze({
  score: 0,
  streak: 0,
  bestStreak: 0,
  completed: 0,
});

export const INITIAL_INTERACTION_STATE = Object.freeze({
  selectedIds: [],
  feedback: null,
  steps: 0,
  mistakes: 0,
  exerciseHadMistake: false,
  reward: null,
});

export const POINTS_BY_DIFFICULTY = Object.freeze({
  guided: 10,
  practice: 20,
  challenge: 35,
});

export function safeProgressValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : 0;
}

export function normalizeProgress(value = {}) {
  return {
    score: safeProgressValue(value?.score),
    streak: safeProgressValue(value?.streak),
    bestStreak: safeProgressValue(value?.bestStreak),
    completed: safeProgressValue(value?.completed),
  };
}

export function readProgress(storage) {
  try {
    storage ??= globalThis.localStorage;
    if (!storage) return { ...EMPTY_PROGRESS };
    return normalizeProgress(JSON.parse(storage.getItem(PROGRESS_KEY) || '{}'));
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export function writeProgress(progress, storage) {
  try {
    storage ??= globalThis.localStorage;
    if (!storage) return false;
    storage.setItem(PROGRESS_KEY, JSON.stringify(normalizeProgress(progress)));
    return true;
  } catch {
    return false;
  }
}

export function calculateReward(progress, difficulty, exerciseHadMistake) {
  const clean = !exerciseHadMistake;
  const nextStreak = clean ? normalizeProgress(progress).streak + 1 : 0;
  const basePoints = POINTS_BY_DIFFICULTY[difficulty] || POINTS_BY_DIFFICULTY.guided;
  const streakBonus = clean ? Math.min(30, Math.max(0, (nextStreak - 1) * 5)) : 0;
  return {
    points: basePoints + streakBonus,
    streak: nextStreak,
    clean,
  };
}

export function applyReward(progress, reward) {
  const current = normalizeProgress(progress);
  return {
    ...current,
    score: current.score + reward.points,
    streak: reward.streak,
    bestStreak: Math.max(current.bestStreak, reward.streak),
    completed: current.completed + 1,
  };
}

export function interactionReducer(state, action) {
  switch (action.type) {
    case 'reset':
      return { ...INITIAL_INTERACTION_STATE, selectedIds: [] };
    case 'toggle-selection': {
      if (!action.id) return { ...state, selectedIds: [], feedback: null };
      const selectedIds = state.selectedIds.includes(action.id)
        ? state.selectedIds.filter((id) => id !== action.id)
        : state.selectedIds.concat(action.id);
      return { ...state, selectedIds, feedback: null };
    }
    case 'clear-selection':
      return { ...state, selectedIds: [] };
    case 'feedback':
      return { ...state, feedback: action.feedback };
    case 'error':
      return {
        ...state,
        feedback: action.feedback,
        mistakes: state.mistakes + 1,
        exerciseHadMistake: true,
      };
    case 'step':
      return { ...state, selectedIds: [], steps: state.steps + 1 };
    case 'complete':
      return {
        ...state,
        reward: action.reward,
        feedback: action.feedback || state.feedback,
      };
    default:
      return state;
  }
}
