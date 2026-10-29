import { describe, expect, it } from 'vitest';
import { rational, combineValues, isExactValue, numericValue, parseAnswer, answersMatch, WIRE, OPEN, formatExact } from '../../src/lib/values.js';
import { oracleCombine, expectClose } from '../helpers/oracle.js';

describe.each(['R', 'C', 'L'])('%s exact values', type => {
  for (const rule of ['series', 'parallel']) for (const values of [[rational(10), rational(20), rational(30)], [rational(0), rational(10)], [WIRE, rational(10)], [OPEN, rational(10)], [WIRE, WIRE], [OPEN, OPEN], [WIRE, OPEN], [rational(1, 3), rational(2, 7)]]) {
    it(`${rule} ${JSON.stringify(values)}`, () => {
      expect(expectClose(numericValue(combineValues(values, rule, type), type), oracleCombine(type, values.map(value => numericValue(value, type)), rule))).toBe(true);
    });
  }
});
it.each([
  ['1,25 kΩ', { compType: 'R' }, 1250], ['2.5e-2 µF', { compType: 'C' }, 2.5e-8],
  ['10 mH', { compType: 'L', lUnit: 'mH' }, 1e-2], ['20 μH', { compType: 'L', lUnit: 'µH' }, 2e-5],
  ['25 uH', { compType: 'L', lUnit: 'H' }, 25e-6], ['1,5 H', { compType: 'L', lUnit: 'mH' }, 1.5],
  ['100 nF', { compType: 'C' }, 1e-7], ['25 / 2 Ω', { compType: 'R' }, 12.5],
  ['3/2R', { compType: 'R', representation: 'symbolic' }, 1.5], ['C', { compType: 'C', representation: 'symbolic' }, 1],
  ['1.2e3', { compType: 'R' }, 1200], ['2/3 C', { compType: 'C', representation: 'symbolic' }, 2/3],
])('parses %s without evaluating code', (text, settings, value) => expect(expectClose(numericValue(parseAnswer(text, settings), settings.compType), value)).toBe(true));
it.each(['alert(1)', '1/0', '1+2', 'NaN', '-1', '1e900', '', '2 F', '2C', '1/2/3', 'Infinity Ω'])('rejects invalid R input %s', text => expect(() => parseAnswer(text, { compType: 'R' })).toThrow());
it('uses exact symbolic coefficients and three significant digit numeric rounding', () => {
  expect(answersMatch(rational(333, 1000), rational(1, 3), { compType: 'R' })).toBe(true);
  expect(answersMatch(rational(333, 1000), rational(1, 3), { compType: 'R', representation: 'symbolic' })).toBe(false);
  expect(answersMatch(rational(34, 100), rational(1, 3), { compType: 'R' })).toBe(false);
  expect(parseAnswer('∞', { compType: 'C' })).toEqual(WIRE);
  expect(formatExact(rational(3, 2), { representation: 'symbolic', compType: 'R' })).toBe('3/2R');
});
it('calculates and formats inductance in series, parallel and symbolic forms', () => {
  expect(combineValues([rational(10, 1000), rational(20, 1000)], 'series', 'L')).toEqual(rational(30, 1000));
  expect(combineValues([rational(10, 1000), rational(20, 1000)], 'parallel', 'L')).toEqual(rational(1, 150));
  expect(parseAnswer('3/2L', { compType: 'L', representation: 'symbolic' })).toEqual(rational(3, 2));
  expect(formatExact(rational(3, 2), { representation: 'symbolic', compType: 'L' })).toBe('3/2L');
  expect(formatExact(rational(30, 1000), { compType: 'L', lUnit: 'mH' })).toBe('30 mH');
  expect(parseAnswer('∞', { compType: 'L' })).toEqual(OPEN);
  expect(parseAnswer('Cable', { compType: 'L' })).toEqual(WIRE);
});
it.each(['2 Ω', '2 kΩ', '2 µF', '2 nF', '2 F'])('rejects non-inductance units for L: %s', text => expect(() => parseAnswer(text, { compType: 'L' })).toThrow());
it('rejects malformed or non-canonical exact values before electrical arithmetic', () => {
  expect(isExactValue({ kind: 'finite', n: '2', d: '4' })).toBe(false);
  expect(isExactValue({ kind: 'finite', n: '01', d: '1' })).toBe(false);
  expect(isExactValue({ kind: 'finite', n: '0', d: '2' })).toBe(false);
  expect(() => combineValues([rational(2)], 'series', 'R')).toThrow();
  expect(() => combineValues([rational(2), rational(4)], 'star', 'R')).toThrow();
});
