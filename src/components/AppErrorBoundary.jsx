import React from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { SESSION_KEY } from '../lib/session.js';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Circuit Practice recovered from a render error.', error, info);
  }

  handleRecovery = () => {
    try { window.localStorage.removeItem(SESSION_KEY); } catch { /* Recovery works without storage. */ }
    // A deterministic failing QA seed must not reload into the same failure.
    window.history.replaceState(null, '', window.location.pathname);
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatal-error" role="alert">
        <div className="fatal-error__card">
          <TriangleAlert size={30} aria-hidden="true" />
          <p className="eyebrow">Recuperación del laboratorio</p>
          <h1>No se pudo dibujar este circuito</h1>
          <p>Tu puntuación sigue guardada. Reiniciá el ejercicio para volver a una mesa de trabajo segura.</p>
          <button type="button" className="button button--primary" onClick={this.handleRecovery}>
            <RefreshCw size={17} /> Nuevo circuito
          </button>
        </div>
      </main>
    );
  }
}
