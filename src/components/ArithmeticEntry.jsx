import { formatExact, unitForType } from '../lib/values.js';

export default function ArithmeticEntry({ current, settings, dispatch }) {
  const { pending, exercise, notice } = current;
  const selection = pending.ids.map(id => exercise.edges.find(edge => edge.id === id)).filter(Boolean);
  const answer = pending.text || '';
  return <form className="arithmetic-entry" onSubmit={event => { event.preventDefault(); dispatch({ type: 'answer', text: answer }); }} aria-label="Calcular equivalente">
    <p className="arithmetic-selection">{selection.map(edge => `${edge.label}: ${formatExact(edge.value, settings)}`).join(' · ')}</p>
    <label htmlFor="equivalent-answer">Equivalente en {settings.representation === 'symbolic' ? settings.compType : unitForType(settings)} ({pending.rule === 'series' ? 'serie' : 'paralelo'})</label>
    <div className="answer-row"><input id="equivalent-answer" autoFocus value={answer} onChange={event => dispatch({ type: 'answer-draft', text: event.target.value })} placeholder={settings.representation === 'symbolic' ? `3/2${settings.compType}` : 'Ej.: 12,5 o 25/2'} autoComplete="off" spellCheck="false" aria-invalid={notice?.kind === 'error' || notice?.kind === 'warning' ? true : undefined} aria-describedby={`answer-help${notice ? ' answer-notice' : ''}`} /><button className="primary" type="submit">Confirmar valor</button><button type="button" onClick={() => dispatch({ type: 'clear' })}>Cancelar</button></div>
    <p id="answer-help">Acepta fracciones, decimales y notación científica. {settings.representation === 'numeric' ? 'Redondeá a tres cifras significativas. Sin unidad, se usa la indicada.' : 'Ingresá un múltiplo exacto de la base.'} También podés escribir “cable” o “abierto”.</p>
    {notice && <p id="answer-notice" className={notice.kind === 'error' ? 'error-text' : ''} role="status">{notice.kind === 'warning' ? 'Formato inválido. ' : notice.kind === 'error' ? 'Valor incorrecto. ' : ''}{notice.message}</p>}
  </form>;
}
