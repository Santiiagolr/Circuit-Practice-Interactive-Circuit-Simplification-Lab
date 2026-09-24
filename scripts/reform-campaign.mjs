import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateExercise, LEVELS, treeDepth } from '../src/lib/exercise.js';
import { inspectDrawing } from '../src/lib/technicalDrawing.js';
import { evaluateGraphNetwork, expectClose } from '../tests/helpers/oracle.js';
import { reduceAll } from '../tests/helpers/manualMoves.js';

const seeds = Number(process.env.STRESS_SEEDS || 1000);
assert.ok(Number.isInteger(seeds) && seeds > 0);
const results = []; let reductions = 0;
for (const compType of ['R', 'C']) for (const difficulty of Object.keys(LEVELS)) for (const representation of ['numeric', 'symbolic']) for (const valueMode of ['equal', 'varied']) {
  const times = [], signatures = new Set(), recent = [], families = new Set(); let fallback = 0, special = 0, diagonal = 0;
  for (let seed = 0; seed < seeds; seed++) {
    const start = performance.now(), exercise = generateExercise({ compType, difficulty, representation, valueMode }, seed, recent);
    times.push(performance.now() - start);
    assert.ok(!recent.includes(exercise.signature));
    recent.push(exercise.signature); if (recent.length > 20) recent.shift();
    signatures.add(exercise.signature); families.add(exercise.family); fallback += Number(exercise.fallback);
    special += Number(exercise.edges.some(edge => ['W', 'S'].includes(edge.compType)));
    diagonal += Number(exercise.edges.some(edge => edge.route.some((p, i, route) => i && p.x !== route[i - 1].x && p.y !== route[i - 1].y)));
    assert.ok(exercise.edges.length >= LEVELS[difficulty].min && exercise.edges.length <= LEVELS[difficulty].max);
    assert.ok(treeDepth(exercise.tree) <= LEVELS[difficulty].depth);
    const expected = evaluateGraphNetwork(exercise.nodes, exercise.edges, compType);
    assert.ok(expected > 0 && Number.isFinite(expected));
    for (const reverse of [false, true]) reduceAll(exercise, reverse, reverse, current => {
      assert.equal(new Set(current.edges.map(edge => edge.id)).size, current.edges.length);
      assert.deepEqual(inspectDrawing(current), []);
      assert.ok(expectClose(evaluateGraphNetwork(current.nodes, current.edges, compType), expected), `Electrical mismatch ${JSON.stringify({ compType, difficulty, representation, valueMode, seed, reverse })}`);
      reductions++;
    });
  }
  times.sort((a, b) => a - b);
  const result = { compType, difficulty, representation, valueMode, seeds, structures: signatures.size, families: families.size, special, diagonal, fallback, p95ms: Number(times[Math.floor(times.length * .95)].toFixed(2)), maxMs: Number(times.at(-1).toFixed(2)) };
  console.log(JSON.stringify(result)); results.push(result);
  assert.ok(result.p95ms < 50, 'Generation p95 exceeds 50ms');
}
mkdirSync('test-results', { recursive: true });
writeFileSync('test-results/reform-campaign.json', JSON.stringify({ generated: seeds * 24, checkedStates: reductions, results }, null, 2));
console.log(`Validated ${seeds * 24} circuits, ${reductions} states, two different reduction orders each.`);
