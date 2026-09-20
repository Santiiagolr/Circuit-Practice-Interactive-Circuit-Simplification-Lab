# Circuit Practice — integral stabilization report

Date: 2026-09-20

## Scope

The audit covered resistor/capacitor physics, AST and graph reductions, switches and wires, React interaction state, persistence, both SVG renderers, responsive layouts, keyboard/touch flows, visual regression, accessibility, performance, and the Windows launcher. The game remains manual and no Delta-Star or production solver was added.

## Root causes found and corrected

1. **Incorrect capacitor result after reducing a wire.** `combineNodes` cloned the AST through JSON; JavaScript serializes `Infinity` as `null`. Capacitor wires therefore lost their physical sentinel and produced a wrong final equivalent. The engine now uses a structural clone that preserves `Infinity`, with a dedicated regression test.
2. **Unreliable basic-mode clicks.** The intended SVG hitbox had `pointerEvents="none"`, so clicks depended on a 28 px proximity fallback. The hitbox is now directly interactive and both renderers guarantee at least 44 px touch height.
3. **Blocked/corrupt storage could crash updates.** Progress reads and writes are now normalized and exception-safe. Existing key and shape remain compatible.
4. **Scattered interaction transitions.** Selection, feedback, steps, mistakes, exercise cleanliness, and reward state now pass through a tested reducer. A short action lock prevents duplicate synchronous reductions.
5. **No safe render recovery.** An Error Boundary now restores the application without deleting saved progress.
6. **External font failures.** Google Fonts was removed. Space Grotesk and IBM Plex Mono are bundled locally, eliminating offline console/resource errors.
7. **Insufficient AA contrast.** Four small-text combinations were below 4.5:1. Signal and muted tones were darkened; axe-core now reports no serious/critical violations in Chromium or WebKit.
8. **Launcher process leak.** The launcher previously controlled an npm/cmd intermediary and could leave Vite detached. It now launches Vite through `node.exe` directly and terminates that process deterministically.

## Added safeguards

- 29 Vitest/Testing Library tests for formulas, zero/Infinity semantics, 2-to-N selections, stale IDs, false parallel groups, switch pruning, persistence, scoring, QA parsing, geometry, hitboxes, and keyboard behavior.
- A 2,400-circuit generative campaign (100 seeds per mode/type/difficulty/value combination), 15,221 verified reductions, independent AST/network evaluation, uniqueness/integrity checks, geometry checks, diversity floors, and a 50 ms p95 generation budget.
- Playwright projects for Chromium, Edge, Firefox, WebKit, Pixel 7, iPhone 13, tablet, and mobile landscape.
- Approved visual baselines for desktop, tablet, and iPhone.
- axe-core checks plus focus/dialog verification.
- Lighthouse mobile budgets of performance ≥85 and accessibility ≥95.
- Development-only reproducibility parameters: `seed`, `mode`, `type`, `difficulty`, and `values`.
- Launcher smoke tests for paths with spaces, occupied port fallback, missing package/dependencies/npm, and server cleanup.

## Evidence

- Unit/component: 29 passing.
- Generation stress: 2,400 circuits and 15,221 reductions passing; generation p95 6.14 ms in the recorded run.
- Browser coverage: Chromium, Edge, WebKit, Pixel 7, iPhone 13, tablet, and mobile landscape passed the interaction suite.
- Accessibility: Chromium and WebKit axe checks passed; victory dialog focus passed.
- Lighthouse production preview: performance 97–98, accessibility 100.
- Launcher smoke: passed, including alternate port and process cleanup.
- `npm audit`: 0 known vulnerabilities after updating Vitest.

## Residual host-specific risk

The Playwright Firefox project is configured but the downloaded Firefox binary cannot start on this Windows installation because Windows reports an invalid side-by-side runtime configuration (`spawn UNKNOWN`). This happens before application code loads. Run `npm run test:e2e:firefox` after repairing/installing the Microsoft Visual C++ runtime. Firefox is kept separate so the main cross-device quality gate remains reproducible while this host dependency is explicit.

Visual snapshots are platform-specific. Update them only after intentional UI changes and review the resulting PNGs before committing.
