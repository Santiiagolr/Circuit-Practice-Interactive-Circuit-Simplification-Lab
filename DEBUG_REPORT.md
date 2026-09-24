# Circuit Practice — implementation and QA report

Date: 2026-09-24

## Delivered

- Replaced the split visual paths with one exercise contract, exact R/C arithmetic, shared topology checks, atomic reductions, and six checked geometric diagram families. Existing circuit-engine exports remain available through adapters.
- Added difficulty-scaled generation (4–6, 7–10, 11–15), exact symbolic `R`/`C`, numeric units, manually entered equivalent values, switch/wire semantics, formula feedback, and reproducible QA seeds.
- Added Training and mock exams, optional clock, review/history, persistent session, manual undo/redo with attempts retained, and exactly-once exercise rewards.
- Rebuilt the workbench around the complete SVG, a synchronized component list, touch-friendly controls, fullscreen/zoom, reduced-motion-aware flow, and distinct electrical symbols.
- Retained the manual-only constraint. No automatic solver or Delta-Star rule was added.

## Defects found and corrected in this implementation

1. **Seeded QA reload discarded the active session.** QA mode always skipped saved state, so a timed exam reverted to its initial settings. Sessions now retain a normalized QA-config key: the same reproduction URL restores progress; a changed seed/config starts a fresh circuit.
2. **Mobile reduction controls scrolled out of reach.** Selecting from the component list could move Series/Parallel above the viewport, especially in landscape. The action bar now sticks while the user scrolls, with a regression assertion that a physical tap target remains onscreen.
3. **Zoom controls and the drawing caption overlapped SVG content.** The toolbar and caption now use dedicated rows; the SVG sizes itself to the remaining drawing region. Resistor labels, battery text, and controls no longer share the same pixels.
4. **The legacy circuit smoke test attempted to combine an open switch.** The common validator correctly rejects that reduction; the compatibility test now explicitly removes and prunes the open branch before continuing.
5. **Fullscreen Escape behavior was inconsistent.** Escape now exits native fullscreen and clears the CSS fallback state.
6. **Manual-answer E2E used an incorrect expected value for a selected group.** The test now derives the answer from the actual selected IDs.
7. **Valid JSON could still contain an invalid saved exam/history shape.** Session restore now validates active/finished exam results, attempts, selected IDs, undo/redo stacks, and history entries; malformed session data falls back safely while the separate saved score remains intact.
8. **Two advertised geometric families did not actually render diagonals.** The triangle template was attached at the wrong tree level and could be silently retried as an unrelated family. It is now a nested series-parallel cell; the diagonal uses existing terminal ports so node connectivity stays intact and no resistor is drawn over a bus. Unit and browser tests assert a non-orthogonal component angle. The depth-limited guided mode remains orthogonal; intermediate and advanced modes include the triangular variants.

## Verification evidence

- `npm run lint`: passed.
- `npm run build`: passed; production JS 278.72 kB (89.21 kB gzip), CSS 20.12 kB (5.11 kB gzip).
- `npm run test:unit`: 108 tests passed across 10 files, including malformed session/exam recovery and real-diagonal geometry.
- `npm run test:circuits`: passed; 245 unique basic and 283 unique advanced legacy signatures, 25 open-switch deletion cases.
- `npm run test:stress`: 24,000 generated circuits and 388,396 post-reduction states checked across R/C, three levels, numeric/symbolic, equal/varied. Two reduction orders were compared against an independent evaluator. No geometry failures or fallback circuits; worst observed generation p95 was 0.62 ms (limit: 50 ms). The campaign recorded 5,644 diagonal cases in intermediate/advanced families.
- `npm run test:e2e -- --workers=1 --reporter=line`: 50 passed, 6 intentionally skipped across Chromium, Edge, WebKit, Pixel 7, iPhone 13, tablet, and mobile landscape. The touch flows physically tap reductions and open-switch removal; no horizontal document overflow or runtime errors.
- `npm run test:visual -- --workers=1 --reporter=line`: 7 passed, 9 skipped by project-specific coverage; desktop/tablet/iPhone portrait/landscape baselines and all six geometric families plus Chromium selection/error/equivalent/result/open-switch states were updated and reviewed.
- `npm run test:a11y -- --workers=1 --reporter=line`: 3 passed, 3 project-specific skips; axe reported no serious or critical violations in its Chromium/WebKit initial-state checks.
- `npm run test:lighthouse`: passed in the final QA run; performance 97, accessibility 100.
- `npm run test:launcher`: passed for missing requirements, a project path containing spaces, occupied-port fallback, and process/port cleanup.
- Firefox launch was attempted separately; Playwright failed before loading the application with `browserType.launch: spawn UNKNOWN` for the installed Firefox binary.

## Remaining limits

- Firefox is not verified on this Windows host until its Playwright runtime launches successfully. This is an environment/browser startup failure, not an application assertion failure.
- Pixel/iPhone touch checks use Playwright's device emulation and touchscreen API; a physical-device pass remains useful before release.
- Browser storage remains best-effort by design. When disabled or corrupt, the interface continues without durable session persistence and displays a warning.

Visual snapshots are platform-specific. If the design changes intentionally, regenerate them with `npm run test:visual -- --update-snapshots` and inspect the resulting images before accepting them.
