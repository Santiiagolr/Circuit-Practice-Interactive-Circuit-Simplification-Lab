import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CircuitSVG from '../../src/components/CircuitSVG';
import GridCircuitSVG from '../../src/components/GridCircuitSVG';
import { ReductionExplanation } from '../../src/components/PracticeHistory';
import { rational, WIRE } from '../../src/lib/values';

it('supports direct pointer and keyboard selection in the basic SVG', () => {
  const onSelect = vi.fn();
  const tree = { type: 'leaf', id: 'r1', compType: 'R', label: 'R1', val: 10 };
  const { container } = render(<CircuitSVG tree={tree} selectedIds={[]} onSelect={onSelect} />);
  const component = screen.getByRole('button', { name: /Resistencia R1/ });
  expect(container.querySelector('[data-component-hitbox]')).toHaveAttribute('pointer-events', 'all');
  fireEvent.click(component);
  fireEvent.keyDown(component, { key: 'Enter' });
  expect(onSelect).toHaveBeenNthCalledWith(1, 'r1');
  expect(onSelect).toHaveBeenNthCalledWith(2, 'r1');
});

it('renders advanced hitboxes with accessible component metadata', () => {
  const nodes = [{ id: 'A', x: 0, y: 0, terminal: 'A' }, { id: 'B', x: 4, y: 0, terminal: 'B' }];
  const edges = [{ id: 'e1', from: 'A', to: 'B', compType: 'C', label: 'C1', val: 10, route: nodes }];
  const { container } = render(<GridCircuitSVG nodes={nodes} edges={edges} selectedIds={[]} onSelect={() => {}} />);
  expect(screen.getByRole('button', { name: /Capacitor C1/ })).toBeInTheDocument();
  expect(container.querySelector('[data-component-type="C"]')).toBeInTheDocument();
});

it('renders the new workbench component controls with real 44px targets in the side panel', async () => {
  const { default: App } = await import('../../src/App.jsx');
  render(<App />);
  const component = screen.getByTestId('component-c1');
  expect(component).toHaveAttribute('aria-pressed', 'false');
  expect(component).toHaveAccessibleName(/R1/);
});
it('explains conductor reductions using physical zero and infinity instead of dividing by Cable', () => {
  const resistorSettings = { compType: 'R', representation: 'numeric', rUnit: 'Ω' };
  const short = { rule: 'parallel', components: [{ label: 'R1', value: rational(10) }, { label: 'W1', value: WIRE }], equivalent: { value: WIRE } };
  const { rerender } = render(<ReductionExplanation step={short} settings={resistorSettings} />);
  expect(screen.getByText(/cortocircuita los terminales/)).toBeInTheDocument();
  expect(screen.getByText(/Req = 0 Ω → Cable/)).toBeInTheDocument();
  const capacitorSettings = { compType: 'C', representation: 'numeric', cUnit: 'µF' };
  const wireInSeries = { rule: 'series', components: [{ label: 'C1', value: rational(1, 1000000) }, { label: 'W1', value: WIRE }], equivalent: { value: rational(1, 1000000) } };
  rerender(<ReductionExplanation step={wireInSeries} settings={capacitorSettings} />);
  expect(screen.getByText(/1\/Ceq = 1\/C1/)).toBeInTheDocument();
  expect(screen.getByText(/\+ 0\) = 1 µF/)).toBeInTheDocument();
  expect(screen.queryByText(/1\/\(Cable\)/)).not.toBeInTheDocument();
});
