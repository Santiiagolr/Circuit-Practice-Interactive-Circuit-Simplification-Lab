import { inspectExercise, isComplete, reduceExercise } from './exercise.js';

function canonicalExercise(exercise) {
  const nodes = [...exercise.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, x, y, terminal }) => [id, x, y, terminal ?? null]);
  const buses = [...exercise.buses].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, axis, x, y }) => [id, axis, x ?? null, y ?? null]);
  const edges = [...exercise.edges].sort((a, b) => a.id.localeCompare(b.id)).map(edge => [
    edge.id, edge.from, edge.to, edge.compType, edge.switchState ?? null, edge.value,
    edge.route, edge.equivalent === true, edge.origin ?? null,
  ]);
  return JSON.stringify({ nodes, buses, edges, sourceRoute: exercise.sourceRoute, bounds: exercise.bounds, revision: exercise.revision });
}

function describe(attempt) {
  if (attempt.kind === 'reduction') {
    const names = attempt.components.map(component => component.label).join(', ');
    return attempt.rule === 'delete' ? `Se eliminó ${names}.` : `${names}: combinación en ${attempt.rule === 'series' ? 'serie' : 'paralelo'}.`;
  }
  return attempt.kind === 'undo' ? 'Se deshizo el paso anterior.' : 'Se rehizo el paso anterior.';
}

/** Replay only recorded learner actions and reject a history that cannot reproduce its saved final state. */
export function reconstructHistory(item) {
  if (!item?.initial || !item?.final || !Array.isArray(item.attempts)) return { valid: false, reason: 'No hay datos suficientes para reconstruir el circuito.' };
  const initialIntegrity = inspectExercise(item.initial);
  if (!initialIntegrity.valid) return { valid: false, reason: 'El circuito inicial guardado no superó la verificación.' };

  let exercise = item.initial;
  const past = [], future = [];
  const frames = [{ exercise, description: 'Circuito inicial.' }];
  for (const attempt of item.attempts) {
    if (attempt.kind === 'reduction') {
      const ids = attempt.components?.map(component => component.id);
      if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) return { valid: false, reason: 'El historial contiene una selección incompleta o repetida.' };
      const result = reduceExercise(exercise, ids, attempt.rule);
      if (!result.valid) return { valid: false, reason: 'Un paso guardado ya no es válido para la topología actual.' };
      if (attempt.equivalent && JSON.stringify(attempt.equivalent.value) !== JSON.stringify(result.equivalent?.value)) return { valid: false, reason: 'El equivalente registrado no coincide con la reducción verificada.' };
      past.push(exercise); future.length = 0; exercise = result.exercise;
      frames.push({ exercise, description: describe(attempt) });
    } else if (attempt.kind === 'undo') {
      if (!past.length) return { valid: false, reason: 'El historial intenta deshacer sin un paso previo.' };
      future.push(exercise); exercise = past.pop();
      frames.push({ exercise, description: describe(attempt) });
    } else if (attempt.kind === 'redo') {
      if (!future.length) return { valid: false, reason: 'El historial intenta rehacer sin un paso deshecho.' };
      past.push(exercise); exercise = future.pop();
      frames.push({ exercise, description: describe(attempt) });
    }
  }

  if (canonicalExercise(exercise) !== canonicalExercise(item.final)) return { valid: false, reason: 'La secuencia registrada no reproduce el estado final guardado.' };
  if (item.status === 'complete' && !isComplete(exercise)) return { valid: false, reason: 'El resultado está marcado como completo, pero queda más de un componente.' };
  return { valid: true, frames };
}
