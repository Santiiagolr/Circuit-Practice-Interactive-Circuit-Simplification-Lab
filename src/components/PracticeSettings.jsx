import { LEVELS } from '../lib/exercise.js';
function Select({ label, name, value, options, onChange, disabled }) {
  return <label className="setting"><span>{label}</span><select name={name} value={value} disabled={disabled} onChange={event => onChange({ [name]: typeof value === 'number' ? Number(event.target.value) : event.target.value })}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}
export default function PracticeSettings({ settings, onChange, activeExam }) {
  const props = { onChange, disabled: activeExam };
  return <details className="practice-settings"><summary>Configurar práctica</summary><div className="settings-grid">
    <Select {...props} label="Modalidad" name="mode" value={settings.mode} options={[["training", "Entrenamiento"], ["exam", "Simulacro de parcial"]]} />
    <Select {...props} label="Dificultad" name="difficulty" value={settings.difficulty} options={Object.entries(LEVELS).map(([key, level]) => [key, `${level.label} (${level.min}–${level.max})`])} />
    <Select {...props} label="Componentes" name="compType" value={settings.compType} options={[["R", "Resistencias"], ["C", "Capacitores"]]} />
    <Select {...props} label="Representación" name="representation" value={settings.representation} options={[["numeric", "Valores numéricos"], ["symbolic", "Múltiplos de R / C"]]} />
    <Select {...props} label="Distribución de valores" name="valueMode" value={settings.valueMode} options={[["varied", "Variados"], ["equal", "Iguales"]]} />
    {settings.representation === 'numeric' && <Select {...props} label="Unidad" name={settings.compType === 'R' ? 'rUnit' : 'cUnit'} value={settings.compType === 'R' ? settings.rUnit : settings.cUnit} options={(settings.compType === 'R' ? ['Ω', 'kΩ'] : ['µF', 'nF']).map(unit => [unit, unit])} />}
    <Select {...props} label="Símbolo de resistencia" name="resistorStyle" value={settings.resistorStyle} options={[["zigzag", "Zigzag"], ["rectangle", "Rectángulo"]]} />
    <label className="check-setting"><input type="checkbox" checked={settings.manual} disabled={activeExam} onChange={event => onChange({ manual: event.target.checked })} />Calcular el equivalente manualmente</label>
    <label className="check-setting"><input type="checkbox" checked={settings.flow} disabled={activeExam || settings.compType !== 'R'} onChange={event => onChange({ flow: event.target.checked })} />Mostrar flujo ilustrativo (solo resistencias)</label>
    {settings.mode === 'exam' && <><Select {...props} label="Ejercicios del parcial" name="examCount" value={settings.examCount} options={[3, 5, 10].map(n => [n, `${n} ejercicios`])} /><Select {...props} label="Tiempo límite" name="examMinutes" value={settings.examMinutes} options={[[0, 'Sin reloj'], [15, '15 minutos'], [30, '30 minutos'], [60, '60 minutos']]} /></>}
  </div>{activeExam && <p>La configuración se conserva durante el parcial.</p>}</details>;
}
