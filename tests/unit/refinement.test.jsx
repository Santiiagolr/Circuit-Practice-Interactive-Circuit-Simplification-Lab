import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PracticeSettings from '../../src/components/PracticeSettings.jsx';
import PracticeHistory from '../../src/components/PracticeHistory.jsx';
import App from '../../src/App.jsx';
import { createSession, loadSession, saveSession, sessionReducer, SESSION_KEY } from '../../src/lib/session.js';

beforeEach(() => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);

it('preserves history beyond 200 records when appending and restoring a v2 session', () => {
  const state = createSession({ seed: 301 });
  state.history = Array.from({ length: 201 }, (_, index) => ({ id: `saved-${index}`, settings: state.settings, status: 'abandoned', attempts: [], errors: 0, steps: 0, stepPoints: 0, undos: 0, elapsed: 0 }));
  const next = sessionReducer(state, { type: 'new' });
  expect(next.history).toHaveLength(202);
  expect(next.history[0].id).toBe('saved-0');
  expect(saveSession(next)).toBe(true);
  const restored = loadSession();
  expect(restored.warning).toBeNull();
  expect(restored.state.history).toEqual(next.history);
});

it('applies exercise changes together and cancels a draft without changing the session', () => {
  const onChange = vi.fn();
  const { settings } = createSession({ seed: 301 });
  render(<PracticeSettings settings={settings} onChange={onChange} />);
  fireEvent.click(screen.getByText('Configurar práctica'));
  fireEvent.change(screen.getByLabelText('Componentes'), { target: { value: 'L' } });
  fireEvent.change(screen.getByLabelText('Dificultad'), { target: { value: 'challenge' } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar y comenzar' }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ compType: 'L', difficulty: 'challenge' });
  fireEvent.change(screen.getByLabelText('Componentes'), { target: { value: 'C' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar cambios' }));
  expect(screen.getByLabelText('Componentes')).toHaveValue('R');
  expect(onChange).toHaveBeenCalledTimes(1);
});

it('applies appearance immediately while an exercise draft is pending', () => {
  const onChange = vi.fn();
  render(<PracticeSettings settings={createSession({ seed: 301 }).settings} onChange={onChange} />);
  fireEvent.click(screen.getByText('Configurar práctica'));
  fireEvent.change(screen.getByLabelText('Dificultad'), { target: { value: 'practice' } });
  fireEvent.change(screen.getByLabelText('Símbolo de resistencia'), { target: { value: 'rectangle' } });
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ resistorStyle: 'rectangle' });
  expect(screen.getByLabelText('Dificultad')).toHaveValue('practice');
});

it('paginates history without deleting entries and resets pagination when filtering', () => {
  const history = Array.from({ length: 24 }, (_, index) => ({ id: `item-${index}`, settings: { compType: index % 2 ? 'L' : 'R', mode: 'training' }, status: 'abandoned', attempts: [], errors: 0, steps: 0, undos: 0, elapsed: 0 }));
  const { container } = render(<PracticeHistory history={history} />);
  expect(container.querySelectorAll('.history-entry')).toHaveLength(20);
  fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
  expect(container.querySelectorAll('.history-entry')).toHaveLength(4);
  fireEvent.change(screen.getByLabelText('Componente del historial'), { target: { value: 'L' } });
  expect(container.querySelectorAll('.history-entry')).toHaveLength(12);
  expect(history).toHaveLength(24);
});

it('keeps selection across history navigation and ignores circuit shortcuts outside the bench', () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(createSession({ seed: 301 })));
  render(<App />);
  fireEvent.click(screen.getAllByTestId(/^component-/)[0]);
  const selected = JSON.parse(localStorage.getItem(SESSION_KEY)).current.selected;
  fireEvent.click(screen.getByRole('button', { name: 'Historial', exact: true }));
  expect(screen.getByRole('region', { name: 'Historial de ejercicios' })).toBeVisible();
  fireEvent.keyDown(window, { key: 'q' });
  expect(JSON.parse(localStorage.getItem(SESSION_KEY)).current.attempts).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Volver al ejercicio' }));
  expect(JSON.parse(localStorage.getItem(SESSION_KEY)).current.selected).toEqual(selected);
});

it('returns to exam preparation instead of a locked training bench', () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(createSession({ seed: 301, settings: { mode: 'exam' } })));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Progreso', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Volver al ejercicio' }));
  expect(screen.getByRole('heading', { name: 'Prepará tu parcial' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Comenzar parcial' })).toBeVisible();
});

it('protects an unfinished exercise and cancels abandonment without clearing it', () => {
  const session = createSession({ seed: 301 });
  session.current.attempts.push({ kind: 'hint', at: Date.now() });
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo circuito' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.keyDown(window, { key: 'q' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar practicando' }));
  expect(JSON.parse(localStorage.getItem(SESSION_KEY)).current.exercise.id).toBe(session.current.exercise.id);
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo circuito' }));
  fireEvent.click(screen.getByRole('button', { name: 'Abandonar y continuar' }));
  const next = JSON.parse(localStorage.getItem(SESSION_KEY));
  expect(next.current.exercise.id).not.toBe(session.current.exercise.id);
  expect(next.history.filter(item => item.id === session.current.exercise.id)).toHaveLength(1);
});
