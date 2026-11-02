import { useState } from 'react';
import { LEVELS } from '../lib/exercise.js';
import { UNITS_BY_TYPE } from '../lib/values.js';

function Select({ label, name, value, options, onChange, disabled }) {
  return <label className="setting"><span>{label}</span><select name={name} value={value} disabled={disabled} onChange={event => onChange({ [name]: typeof value === 'number' ? Number(event.target.value) : event.target.value })}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}
const appearanceKeys = ['theme', 'resistorStyle', 'inductorStyle', 'flow'];

export default function PracticeSettings({ settings: saved, onChange, activeExam = false, topicActive = false }) {
  const [draft, setDraft] = useState({});
  const exerciseKey = JSON.stringify(Object.entries(saved).filter(([key]) => !appearanceKeys.includes(key)));
  const [baseKey, setBaseKey] = useState(exerciseKey);
  if (baseKey !== exerciseKey) { setBaseKey(exerciseKey); setDraft({}); }
  const settings = { ...saved, ...draft };
  const change = next => setDraft(previous => ({ ...previous, ...next }));
  const pending = Object.keys(draft).some(key => draft[key] !== saved[key]);
  const props = { onChange: change, disabled: activeExam || topicActive };
  return <details className="practice-settings">
    <summary>Configurar práctica{pending && <span className="draft-indicator">Cambios pendientes</span>}</summary>
    <div className="settings-sections">
      <fieldset><legend>Ejercicio</legend><div className="settings-grid">
        <Select {...props} label="Modalidad" name="mode" value={settings.mode} options={[["training", "Entrenamiento"], ["exam", "Simulacro de parcial"]]} />
        <Select {...props} label="Dificultad" name="difficulty" value={settings.difficulty} options={Object.entries(LEVELS).map(([key, level]) => [key, `${level.label} (${level.min}–${level.max})`])} />
        <Select {...props} label="Componentes" name="compType" value={settings.compType} options={[["R", "Resistencias"], ["C", "Capacitores"], ["L", "Inductores"]]} />
        {settings.mode === 'exam' && <><Select {...props} label="Ejercicios del parcial" name="examCount" value={settings.examCount} options={[3, 5, 10].map(n => [n, `${n} ejercicios`])} /><Select {...props} label="Tiempo límite" name="examMinutes" value={settings.examMinutes} options={[[0, 'Sin reloj'], [15, '15 minutos'], [30, '30 minutos'], [60, '60 minutos']]} /></>}
      </div></fieldset>
      <fieldset><legend>Representación y cálculo</legend><div className="settings-grid">
        <Select {...props} label="Representación" name="representation" value={settings.representation} options={[["numeric", "Valores numéricos"], ["symbolic", "Múltiplos de R / C / L"]]} />
        <Select {...props} label="Distribución de valores" name="valueMode" value={settings.valueMode} options={[["varied", "Variados"], ["equal", "Iguales"]]} />
        {settings.representation === 'numeric' && <Select {...props} label="Unidad" name={settings.compType === 'R' ? 'rUnit' : settings.compType === 'C' ? 'cUnit' : 'lUnit'} value={settings.compType === 'R' ? settings.rUnit : settings.compType === 'C' ? settings.cUnit : settings.lUnit} options={UNITS_BY_TYPE[settings.compType].map(unit => [unit, unit])} />}
        <label className="check-setting"><input type="checkbox" checked={settings.manual} disabled={props.disabled} onChange={event => change({ manual: event.target.checked })} />Calcular el equivalente manualmente</label>
      </div></fieldset>
      <fieldset><legend>Apariencia · se aplica al instante</legend><div className="settings-grid">
        {saved.compType === 'R' && <Select label="Símbolo de resistencia" name="resistorStyle" value={saved.resistorStyle} onChange={onChange} options={[["zigzag", "Zigzag"], ["rectangle", "Rectángulo"]]} />}
        {saved.compType === 'L' && <Select label="Estilo de inductor" name="inductorStyle" value={saved.inductorStyle} onChange={onChange} options={[["schematic", "Bobina técnica"], ["copper", "Bobina cobre"]]} />}
        <label className="check-setting"><input type="checkbox" checked={saved.flow} disabled={saved.compType !== 'R'} onChange={event => onChange({ flow: event.target.checked })} />Mostrar flujo ilustrativo (solo resistencias)</label>
      </div></fieldset>
      {props.disabled && <p className="muted">{activeExam ? 'El ejercicio y el cálculo se conservan durante el parcial.' : 'Para cambiar el ejercicio, salí de la práctica por tema. Podés cambiar la apariencia.'}</p>}
      {pending && !props.disabled && <div className="settings-actions"><p>Se comenzará otro ejercicio con estos cambios.</p><button className="primary" onClick={event => {
        event.currentTarget.focus({ preventScroll: true });
        const changes = Object.fromEntries(Object.entries(draft).filter(([key, value]) => saved[key] !== value));
        if (onChange(changes) !== false) setDraft({});
      }}>Aplicar y comenzar</button><button onClick={() => setDraft({})}>Cancelar cambios</button></div>}
    </div>
  </details>;
}
