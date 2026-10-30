import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { rational } from '../../src/lib/values.js';
import { CompletionPresentation, ScoreFeedback, StepStreakIndicator } from '../../src/components/GameAnimations.jsx';
afterEach(cleanup);

it('keeps the real score accessible while showing one decorative reward amount', () => {
  render(<ScoreFeedback value={17} event={{ id: 'score-1', amount: 6, color: 'step', duration: 500 }} />);
  expect(screen.getByTestId('score')).toHaveTextContent('17');
  expect(screen.getByLabelText('Puntos: 17')).toBeInTheDocument();
  expect(screen.getByText('+6')).toHaveAttribute('aria-hidden', 'true');
});

it('counts with a controlled clock, retargets rapid gains, and cancels its frame on unmount', () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  try {
    const { container, rerender, unmount } = render(<ScoreFeedback value={10} />);
    rerender(<ScoreFeedback value={16} event={{ id: 'one', amount: 6, color: 'step', duration: 500 }} />);
    expect(screen.getByTestId('score')).toHaveTextContent('16');
    act(() => vi.advanceTimersByTime(240));
    const intermediate = Number(container.querySelector('.score-feedback__visual').textContent);
    expect(intermediate).toBeGreaterThan(10);
    expect(intermediate).toBeLessThan(16);
    rerender(<ScoreFeedback value={20} event={{ id: 'two', amount: 10, color: 'step', duration: 320 }} />);
    expect(container.querySelectorAll('.score-feedback__gain')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(400));
    expect(container.querySelector('.score-feedback__visual')).toHaveTextContent('20');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});

it('labels the step streak correctly and fills only the ten visible segments', () => {
  const { container } = render(<StepStreakIndicator value={12} event={{ id: 'streak-12', value: 12, milestone: true }} />);
  expect(screen.getByLabelText('12 reducciones correctas consecutivas')).toBeInTheDocument();
  expect(container.querySelectorAll('.streak-segment.is-filled')).toHaveLength(10);
  expect(screen.getByText('12')).toBeInTheDocument();
  fireEvent.animationEnd(container.querySelector('.step-streak-indicator'));
});

it('shows the exact completion outcome and omits the reward effects for a repeat', () => {
  const event = {
    id: 'complete-1', source: 'workbench', exerciseId: 'exercise-1', settings: { compType: 'R', representation: 'numeric', rUnit: 'Ω' },
    equivalent: rational(30), errors: 2, repeat: false, stepPoints: 6, rewardPoints: 20,
  };
  const { rerender, container } = render(<CompletionPresentation event={event} />);
  expect(screen.getByText('¡Circuito resuelto!')).toBeInTheDocument();
  expect(screen.getByText(/Equivalente: 30 Ω · 2 errores/)).toBeInTheDocument();
  expect(screen.getByText(/Puntos de pasos: \+6 · entrega: \+20/)).toBeInTheDocument();
  expect(container.querySelectorAll('.completion-particle')).toHaveLength(10);
  rerender(<CompletionPresentation event={{ ...event, id: 'complete-2', repeat: true, rewardPoints: 0, stepPoints: 0 }} />);
  expect(screen.getByText('Repaso completado')).toBeInTheDocument();
  expect(container.querySelectorAll('.completion-particle')).toHaveLength(0);
  expect(screen.queryByText(/Puntos de pasos/)).not.toBeInTheDocument();
});
