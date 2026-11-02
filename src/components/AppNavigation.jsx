const destinations = [['bench', 'Práctica libre'], ['topics', 'Por temas'], ['exam', 'Parcial'], ['progress', 'Progreso'], ['history', 'Historial']];

export default function AppNavigation({ activeView, activeExam, onNavigate }) {
  return <nav className="app-nav" aria-label="Secciones principales">{destinations.map(([view, label]) => <button key={view} aria-current={activeView === view ? 'page' : undefined} disabled={activeExam && ['bench', 'topics'].includes(view)} onClick={event => { event.currentTarget.focus({ preventScroll: true }); onNavigate(view); }}>{label}</button>)}</nav>;
}
