import { prepareReduction, reduceExercise, isComplete } from '../../src/lib/exercise.js';

// TEST ONLY: chooses a topologically valid move; never shipped to the application.
export function nextMove(exercise, reverse = false, multi = false) {
  const open = exercise.edges.find(edge => edge.compType === 'S' && edge.switchState === 'open');
  if (open) return { ids: [open.id], rule: 'delete' };
  const ids = exercise.edges.map(edge => edge.id);
  if (reverse) ids.reverse();
  for (const rule of reverse ? ['series', 'parallel'] : ['parallel', 'series']) {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      let selected = [ids[i], ids[j]];
      if (!prepareReduction(exercise, selected, rule).valid) continue;
      if (multi) {
        let changed = true;
        while (changed) {
          changed = false;
          for (const id of ids) if (!selected.includes(id) && prepareReduction(exercise, [...selected, id], rule).valid) { selected.push(id); changed = true; }
        }
      }
      return { ids: selected, rule };
    }
  }
  throw new Error(`No manual move for seed ${exercise.seed}`);
}
export function reduceAll(initial, reverse = false, multi = false, visit = () => {}) {
  let exercise = initial;
  visit(exercise);
  while (!isComplete(exercise)) {
    const move = nextMove(exercise, reverse, multi);
    const result = reduceExercise(exercise, move.ids, move.rule);
    if (!result.valid) throw new Error(`${initial.seed}: ${JSON.stringify(result.issues)} ${move.rule} ${move.ids}`);
    exercise = result.exercise;
    visit(exercise);
  }
  return exercise;
}
