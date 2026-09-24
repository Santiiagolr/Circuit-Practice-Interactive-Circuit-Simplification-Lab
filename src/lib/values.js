const abs = n => n < 0n ? -n : n;
const gcd = (a, b) => b ? gcd(b, a % b) : abs(a);
export const WIRE = Object.freeze({ kind: 'wire' });
export const OPEN = Object.freeze({ kind: 'open' });

// JSON-safe exact rationals. BigInt is confined to arithmetic, never persistence.
export function rational(numerator, denominator = 1) {
  let n = BigInt(numerator), d = BigInt(denominator);
  if (!d) throw new Error('Denominador cero');
  if (d < 0n) { n = -n; d = -d; }
  const divisor = gcd(n, d);
  return { kind: 'finite', n: String(n / divisor), d: String(d / divisor) };
}
export function decimalRational(text) {
  const match = /^([+-]?)(\d+(?:\.\d*)?|\.\d+)(?:e([+-]?\d{1,3}))?$/i.exec(text);
  if (!match || Math.abs(Number(match[3] || 0)) > 30) throw new Error('Número no válido');
  const digits = match[2].split('.');
  const power = Number(match[3] || 0) - (digits[1]?.length || 0);
  let n = BigInt((digits[0] || '0') + (digits[1] || '')) * (match[1] === '-' ? -1n : 1n);
  let d = 1n;
  if (power >= 0) n *= 10n ** BigInt(power); else d = 10n ** BigInt(-power);
  return rational(n, d);
}
export const multiply = (a, b) => rational(BigInt(a.n) * BigInt(b.n), BigInt(a.d) * BigInt(b.d));
export const add = (a, b) => rational(BigInt(a.n) * BigInt(b.d) + BigInt(b.n) * BigInt(a.d), BigInt(a.d) * BigInt(b.d));
export const invert = a => rational(a.d, a.n);
export function numericValue(value, type) {
  if (value.kind === 'wire') return type === 'R' ? 0 : Infinity;
  if (value.kind === 'open') return type === 'R' ? Infinity : 0;
  return Number(value.n) / Number(value.d);
}
export function combineValues(values, rule, type) {
  const additive = (type === 'R') === (rule === 'series');
  const short = type === 'R' ? 'wire' : 'open';
  const infinite = type === 'R' ? 'open' : 'wire';
  const zero = value => value.kind === short || (value.kind === 'finite' && value.n === '0');
  if (additive) {
    if (values.some(value => value.kind === infinite)) return { kind: infinite };
    return values.filter(value => value.kind === 'finite').reduce(add, rational(0));
  }
  if (values.some(zero)) return { kind: short };
  const finite = values.filter(value => value.kind === 'finite');
  if (!finite.length) return { kind: infinite };
  return invert(finite.map(invert).reduce(add, rational(0)));
}
export const UNIT_FACTORS = { 'Ω': ['R', rational(1)], 'kΩ': ['R', rational(1000)], 'µF': ['C', rational(1, 1000000)], 'nF': ['C', rational(1, 1000000000)], F: ['C', rational(1)] };
export function formatExact(value, settings, compact = false) {
  if (value.kind !== 'finite') return value.kind === 'wire' ? 'Cable' : 'Abierto';
  if (settings.representation === 'symbolic') {
    const coefficient = value.d === '1' ? (value.n === '1' ? '' : value.n) : `${value.n}/${value.d}`;
    return `${coefficient}${settings.compType}`;
  }
  const unit = settings.compType === 'R' ? (settings.rUnit || 'Ω') : (settings.cUnit || 'µF');
  const scaled = multiply(value, invert(UNIT_FACTORS[unit][1]));
  const number = Number(scaled.n) / Number(scaled.d);
  return `${Number(number.toPrecision(compact ? 3 : 6)).toLocaleString('es-AR', { maximumSignificantDigits: compact ? 3 : 6 })} ${unit}`;
}

export function parseAnswer(input, settings) {
  let text = String(input).trim().replaceAll(',', '.').replaceAll('μ', 'µ').replaceAll('uF', 'µF');
  if (text.length > 100) throw new Error('La respuesta es demasiado larga.');
  if (/^(cable|cortocircuito)$/i.test(text)) return WIRE;
  if (/^abierto$/i.test(text)) return OPEN;
  if (/^(infinito|infinity|∞)$/i.test(text)) return settings.compType === 'R' ? OPEN : WIRE;
  const suffix = /(kΩ|Ω|µF|nF|F|R|C)$/i.exec(text)?.[0];
  if (suffix) text = text.slice(0, -suffix.length).trim();
  text = text.replace(/\s*\*\s*$/, '').trim();
  if (!text && suffix) text = '1';
  const parts = text.split('/').map(part => part.trim());
  if (parts.length > 2) throw new Error('Usá un número o una fracción, por ejemplo 3/2.');
  let result = decimalRational(parts[0]);
  if (parts.length === 2) result = multiply(result, invert(decimalRational(parts[1])));
  if (BigInt(result.n) < 0n) throw new Error('El equivalente no puede ser negativo.');
  if (settings.representation === 'symbolic') {
    if (suffix && suffix.toUpperCase() !== settings.compType) throw new Error(`Usá múltiplos de ${settings.compType}.`);
  } else {
    const defaultUnit = settings.compType === 'R' ? settings.rUnit || 'Ω' : settings.cUnit || 'µF';
    const unit = suffix ? Object.keys(UNIT_FACTORS).find(key => key.toLowerCase() === suffix.toLowerCase()) : defaultUnit;
    if (!unit || UNIT_FACTORS[unit][0] !== settings.compType) throw new Error('La unidad no corresponde a este ejercicio.');
    result = multiply(result, UNIT_FACTORS[unit][1]);
  }
  return result;
}
export function answersMatch(answer, expected, settings) {
  if (expected.kind !== 'finite' || answer.kind !== 'finite') {
    return numericValue(answer, settings.compType) === numericValue(expected, settings.compType);
  }
  if (settings.representation === 'symbolic') return answer.n === expected.n && answer.d === expected.d;
  const a = numericValue(answer), e = numericValue(expected);
  if (e === 0) return a === 0;
  // Half a unit in the last place of a three-significant-digit answer.
  const tolerance = 0.5 * 10 ** (Math.floor(Math.log10(Math.abs(e))) - 2);
  return Math.abs(a - e) <= tolerance + Math.abs(e) * Number.EPSILON * 4;
}
