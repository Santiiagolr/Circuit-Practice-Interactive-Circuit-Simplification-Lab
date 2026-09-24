import { generateExercise, normalizeSettings, isComplete, prepareReduction, reduceExercise } from './exercise.js';
import { normalizeProgress, calculateReward, applyReward, PROGRESS_KEY } from './gameState.js';
import { parseAnswer, answersMatch } from './values.js';
import { inspectDrawing } from './technicalDrawing.js';

export const SESSION_KEY = 'circuit-practice:session:v2';
const currentExercise = (exercise, now) => ({ exercise, startedAt: now, selected: [], past: [], future: [], attempts: [], pending: null, notice: null, submitted: false });
function spawn(state, seed, now) {
  const exercise = generateExercise(state.settings, seed, state.recent[state.settings.difficulty] || []);
  return { ...state, recent: { ...state.recent, [state.settings.difficulty]: [...(state.recent[state.settings.difficulty] || []), exercise.signature].slice(-20) }, current: currentExercise(exercise, now) };
}
export function createSession({ settings, progress, seed = Date.now(), qaKey = null, now = Date.now() } = {}) {
  return spawn({ version: 2, settings: normalizeSettings(settings), progress: normalizeProgress(progress), recent: {}, history: [], exam: null, qaKey }, seed, now);
}
function record(state, event, now) {
  return { ...state, current: { ...state.current, attempts: [...state.current.attempts, { ...event, at: now }].slice(-1000) } };
}
function report(state, message, kind = 'info') {
  return { ...state, current: { ...state.current, notice: { message, kind } } };
}
function wrong(state, message, now, detail) {
  const next = record(state, { kind: 'error', message, ...detail }, now);
  return report({ ...next, progress: { ...next.progress, streak: 0 } }, state.exam?.status === 'active' ? 'Respuesta incorrecta. Podés reintentar.' : message, 'error');
}
function commit(state, ids, rule, now) {
  const result = reduceExercise(state.current.exercise, ids, rule);
  if (!result.valid) return report(state, result.message, 'warning');
  const next = record(state, { kind: 'reduction', rule, components: result.selected.map(edge => ({ id: edge.id, label: edge.label, value: edge.value })), equivalent: result.equivalent && { label: result.equivalent.label, value: result.equivalent.value } }, now);
  return { ...next, current: { ...next.current, exercise: result.exercise, past: [...next.current.past, state.current.exercise], future: [], selected: [], pending: null, notice: { kind: 'success', message: isComplete(result.exercise) ? 'Circuito reducido. Revisá el resultado y entregá cuando estés listo.' : rule === 'delete' ? 'Interruptor abierto eliminado; ramas desconectadas podadas.' : 'Reducción confirmada.' } } };
}
function resultRecord(state, now, status, reward = null) {
  const { exercise, attempts, startedAt } = state.current;
  return { id: exercise.id, seed: exercise.seed, settings: exercise.settings, family: exercise.family, initial: state.current.past[0] || exercise, final: exercise, attempts, status, reward,
    steps: attempts.filter(item => item.kind === 'reduction').length, errors: attempts.filter(item => item.kind === 'error').length, undos: attempts.filter(item => item.kind === 'undo').length, elapsed: Math.max(0, now - startedAt) };
}
function expire(state, now) {
  if (state.exam?.status !== 'active' || !state.exam.deadline || now < state.exam.deadline) return state;
  const item = resultRecord(state, state.exam.deadline, 'incomplete');
  const results = [...state.exam.results, item];
  while (results.length < state.exam.count) results.push({ id: `pending-${results.length}`, status: 'incomplete', steps: 0, errors: 0, undos: 0, elapsed: 0, attempts: [] });
  return { ...state, history: [...state.history, item].slice(-200), exam: { ...state.exam, status: 'finished', expired: true, results }, current: { ...state.current, pending: null, selected: [], submitted: true } };
}
export function sessionReducer(state, action) {
  const now = action.now ?? Date.now();
  const fresh = expire(state, now);
  if (fresh !== state) return fresh;
  const current = state.current;
  const seed = action.seed ?? Number(current.exercise.seed) + 1;
  const locked = current.submitted || (state.settings.mode === 'exam' && state.exam?.status !== 'active');
  switch (action.type) {
    case 'tick': return state;
    case 'select':
      if (locked || current.pending || isComplete(current.exercise)) return state;
      if (!current.exercise.edges.some(edge => edge.id === action.id)) return state;
      return { ...state, current: { ...current, notice: null, selected: current.selected.includes(action.id) ? current.selected.filter(id => id !== action.id) : [...current.selected, action.id] } };
    case 'clear': return { ...state, current: { ...current, selected: [], pending: null } };
    case 'reduce': {
      if (locked || current.pending || isComplete(current.exercise)) return state;
      const check = prepareReduction(current.exercise, current.selected, action.rule);
      if (!check.valid) return check.kind === 'interface' ? report(state, check.message) : wrong(state, check.message, now, { rule: action.rule, ids: current.selected });
      if (state.settings.manual && action.rule !== 'delete') return { ...state, current: { ...current, pending: { ids: [...current.selected], rule: action.rule, revision: current.exercise.revision, value: check.value }, notice: null } };
      return commit(state, current.selected, action.rule, now);
    }
    case 'answer': {
      if (locked || !current.pending) return state;
      if (current.pending.revision !== current.exercise.revision) return { ...state, current: { ...current, pending: null } };
      let answer;
      try { answer = parseAnswer(action.text, state.settings); } catch (error) { return report(state, error.message, 'warning'); }
      if (!answersMatch(answer, current.pending.value, state.settings)) return wrong(state, 'El valor no coincide. Revisá la fórmula, las unidades y el redondeo a tres cifras significativas.', now, { rule: current.pending.rule, answer: action.text, expected: current.pending.value });
      return commit(state, current.pending.ids, current.pending.rule, now);
    }
    case 'undo':
    case 'redo': {
      const undo = action.type === 'undo', list = undo ? current.past : current.future;
      if (locked || !list.length) return state;
      const next = record(state, { kind: action.type }, now);
      return { ...next, current: { ...next.current, exercise: list.at(-1), past: undo ? current.past.slice(0, -1) : [...current.past, current.exercise], future: undo ? [...current.future, current.exercise] : current.future.slice(0, -1), selected: [], pending: null, notice: { kind: 'info', message: undo ? 'Paso deshecho. Los intentos y errores se conservan.' : 'Paso rehecho.' } } };
    }
    case 'hint': {
      if (locked || state.settings.mode !== 'training') return state;
      const next = record(state, { kind: 'hint' }, now);
      const selected = current.selected.map(id => current.exercise.edges.find(edge => edge.id === id));
      const message = selected.length ? 'Seguí los terminales de tu selección. Dos terminales comunes indican paralelo; un nodo intermedio sin derivaciones permite serie. La orientación del dibujo no cambia la conexión.' : 'Buscá nodos, no formas. En serie, el nodo compartido tiene solo dos conexiones. En paralelo, las ramas comparten ambos extremos.';
      return report(next, message);
    }
    case 'settings': {
      if (state.exam?.status === 'active') return state;
      const settings = normalizeSettings({ ...state.settings, ...action.settings });
      const visualOnly = Object.keys(action.settings).every(key => ['flow', 'resistorStyle'].includes(key));
      if (visualOnly) return record({ ...state, settings }, { kind: 'configuration', settings: action.settings }, now);
      const recorded = record(state, { kind: 'configuration', settings: action.settings }, now);
      return spawn({ ...recorded, settings, exam: null, history: [...state.history, resultRecord(recorded, now, 'abandoned')].slice(-200) }, seed, now);
    }
    case 'new':
      if (state.exam?.status === 'active') return state;
      return spawn({ ...state, history: [...state.history, resultRecord(state, now, 'abandoned')].slice(-200), exam: null }, seed, now);
    case 'start-exam': {
      if (state.exam?.status === 'active') return state;
      return spawn({ ...state, settings: { ...state.settings, mode: 'exam' }, exam: { status: 'active', count: state.settings.examCount, startedAt: now, deadline: state.settings.examMinutes ? now + state.settings.examMinutes * 60000 : null, results: [] } }, seed, now);
    }
    case 'finish-exam': {
      if (state.exam?.status !== 'active') return state;
      return expire({ ...state, exam: { ...state.exam, deadline: now } }, now);
    }
    case 'submit': {
      if (locked || !isComplete(current.exercise)) return state;
      const reward = calculateReward(state.progress, state.settings.difficulty, current.attempts.some(item => item.kind === 'error'));
      const item = resultRecord(state, now, 'complete', reward);
      if (state.history.some(entry => entry.id === item.id && entry.status === 'complete')) return state;
      const next = { ...state, progress: applyReward(state.progress, reward), history: [...state.history, item].slice(-200), current: { ...current, submitted: true, selected: [], pending: null } };
      if (state.exam?.status === 'active') {
        next.exam = { ...state.exam, results: [...state.exam.results, item] };
        if (next.exam.results.length === next.exam.count) { next.exam.status = 'finished'; return next; }
      }
      return spawn(next, seed, now);
    }
    default: return state;
  }
}
function validStoredValue(value) {
  return Boolean(value && (value.kind === 'wire' || value.kind === 'open' || (value.kind === 'finite' && /^\d{1,200}$/.test(value.n) && /^[1-9]\d{0,199}$/.test(value.d))));
}
function validExercise(exercise) {
  if (!exercise || !Array.isArray(exercise.edges) || !exercise.edges.length || exercise.edges.length > 30 || !Array.isArray(exercise.nodes) || exercise.nodes.length > 60 || !exercise.settings || !Array.isArray(exercise.buses) || !Array.isArray(exercise.sourceRoute) || exercise.sourceRoute.length < 2 || !exercise.bounds || !Number.isFinite(exercise.bounds.width) || !Number.isFinite(exercise.bounds.height) || exercise.bounds.width < 1 || exercise.bounds.height < 1 || !Number.isInteger(exercise.revision) || exercise.revision < 0) return false;
  if (!exercise.sourceRoute.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))) return false;
  const nodeIds = new Set(exercise.nodes.map(node => node.id));
  if (!nodeIds.has('A') || !nodeIds.has('B') || exercise.nodes.some(node => !Number.isFinite(node.x) || !Number.isFinite(node.y))) return false;
  if (exercise.buses.some(bus => !nodeIds.has(bus.id) || !['x', 'y'].includes(bus.axis) || !Number.isFinite(bus[bus.axis === 'x' ? 'y' : 'x']))) return false;
  const ids = new Set(exercise.edges.map(edge => edge.id));
  if (ids.size !== exercise.edges.length) return false;
  for (const edge of exercise.edges) {
    if (!validStoredValue(edge.value)) return false;
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to) || typeof edge.label !== 'string' || !Array.isArray(edge.route) || edge.route.length < 2 || edge.route.length > 100 || !edge.route.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))) return false;
  }
  return !inspectDrawing(exercise).length;
}
function validAttempt(item) {
  if (!item || typeof item !== 'object' || typeof item.kind !== 'string') return false;
  if (item.kind === 'error') return typeof item.message === 'string';
  if (item.kind === 'reduction') return Array.isArray(item.components) && item.components.length > 0 && item.components.every(component => component && typeof component.label === 'string' && validStoredValue(component.value)) && (item.equivalent == null || typeof item.equivalent.label === 'string' && validStoredValue(item.equivalent.value));
  if (item.kind === 'configuration') return item.settings && typeof item.settings === 'object';
  return ['undo', 'redo', 'hint'].includes(item.kind);
}
function validHistoricalExercise(exercise) {
  return !exercise || Boolean(exercise && Array.isArray(exercise.edges) && exercise.edges.length > 0 && exercise.edges.length <= 30 && exercise.edges.every(edge => edge && validStoredValue(edge.value)));
}
function validHistoryItem(item) {
  return Boolean(item && typeof item.id === 'string' && ['complete', 'incomplete', 'abandoned'].includes(item.status) && ['steps', 'errors', 'undos', 'elapsed'].every(key => Number.isFinite(item[key]) && item[key] >= 0) && Array.isArray(item.attempts) && item.attempts.length <= 1000 && item.attempts.every(validAttempt) && (item.settings == null || typeof item.settings === 'object') && validHistoricalExercise(item.initial) && validHistoricalExercise(item.final) && (item.reward == null || Number.isFinite(item.reward.points) && item.reward.points >= 0));
}
function validSession(saved) {
  if (!saved || saved.version !== 2 || !validExercise(saved.current?.exercise)) return false;
  const current = saved.current, edgeIds = new Set(current.exercise.edges.map(edge => edge.id));
  if (!Array.isArray(current.past) || current.past.length > 30 || !current.past.every(validExercise) || !Array.isArray(current.future) || current.future.length > 30 || !current.future.every(validExercise)) return false;
  if (!Array.isArray(current.attempts) || current.attempts.length > 1000 || !current.attempts.every(validAttempt) || !Array.isArray(current.selected) || new Set(current.selected).size !== current.selected.length || current.selected.some(id => !edgeIds.has(id))) return false;
  if (!Number.isFinite(current.startedAt) || typeof current.submitted !== 'boolean' || current.notice != null && (typeof current.notice.message !== 'string' || typeof current.notice.kind !== 'string')) return false;
  if (current.pending != null && (!Array.isArray(current.pending.ids) || current.pending.ids.length < 2 || current.pending.ids.some(id => !edgeIds.has(id)) || !['series', 'parallel'].includes(current.pending.rule) || current.pending.revision !== current.exercise.revision || !validStoredValue(current.pending.value))) return false;
  if (!Array.isArray(saved.history) || saved.history.length > 200 || !saved.history.every(validHistoryItem) || !saved.recent || typeof saved.recent !== 'object' || Object.values(saved.recent).some(items => !Array.isArray(items) || items.length > 20 || items.some(signature => typeof signature !== 'string'))) return false;
  if (saved.exam == null) return true;
  const exam = saved.exam;
  if (!['active', 'finished'].includes(exam.status) || ![3, 5, 10].includes(exam.count) || !Number.isFinite(exam.startedAt) || !(exam.deadline == null || Number.isFinite(exam.deadline)) || !Array.isArray(exam.results) || exam.results.length > exam.count || !exam.results.every(validHistoryItem) || saved.settings?.mode !== 'exam' || exam.count !== saved.settings.examCount) return false;
  return exam.status === 'active' ? exam.results.length < exam.count : exam.results.length === exam.count;
}
export function loadSession({ storage, qa, now = Date.now() } = {}) {
  let warning = null, progress;
  try {
    storage ??= globalThis.localStorage;
    progress = normalizeProgress(JSON.parse(storage?.getItem(PROGRESS_KEY) || '{}'));
    const raw = storage?.getItem(SESSION_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const matchesQa = !qa?.enabled || !qa.explicit || saved.qaKey === qa.key;
      if (matchesQa) {
        if (!validSession(saved)) throw new Error('Sesión dañada');
        saved.settings = normalizeSettings(saved.settings); saved.progress = normalizeProgress(saved.progress);
        return { state: sessionReducer(saved, { type: 'tick', now }), warning };
      }
    }
  } catch { warning = 'No se pudo recuperar la sesión guardada. Podés practicar; el progreso anterior se conserva cuando está disponible.'; }
  const settings = qa?.enabled ? qa : undefined;
  return { state: createSession({ settings, progress, seed: qa?.enabled ? qa.seed : now, qaKey: qa?.enabled && qa.explicit ? qa.key : null, now }), warning };
}
export function saveSession(state, storage) {
  try {
    storage ??= globalThis.localStorage;
    // Numeric Infinity is legacy interoperability only. Recreate it from the explicit value tag.
    storage.setItem(SESSION_KEY, JSON.stringify(state, (key, value) => key === 'val' && !Number.isFinite(value) ? undefined : value));
    storage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
    return true;
  } catch { return false; }
}
