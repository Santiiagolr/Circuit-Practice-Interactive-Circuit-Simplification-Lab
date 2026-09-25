# Circuit Practice — implementation and QA report

Date: 2026-09-24

## Delivered

- Replaced the split visual paths with one exercise contract, exact R/C arithmetic, shared topology checks, atomic reductions, and six checked geometric diagram families. Existing circuit-engine exports remain available through adapters.
- Added difficulty-scaled generation (4–6, 7–10, 11–15), exact symbolic `R`/`C`, numeric units, manually entered equivalent values, switch/wire semantics, formula feedback, and reproducible QA seeds.
- Added four focused topic cycles (R/C × series/parallel), node-reasoning mini exercises, topic progress, verified history replay, and no-reward repeats.
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
9. **Dense diagrams made SVG text and hit targets too small after fitting.** Browser measurements found IDs as small as 3.8 px, values as small as 1.4 px, and some hitboxes smaller than 44 px in advanced exercises. Label layout and electrical-symbol gaps now use the actual rendered SVG scale. Values move to the synchronized detail list when the overview is dense; labels that cannot fit without collision are omitted from the drawing until zoomed. Across a dense challenge at desktop, iPhone portrait, and mobile landscape, visible IDs measure at least 11 px and SVG hitboxes at least 44 px. The view prompts users to zoom or use the list if labels are hidden.
10. **Conductor formula feedback was misleading.** It could display `1/(Cable)` in a reciprocal reduction. The explanation now distinguishes wire/open outcomes and substitutes zero or infinity where appropriate; unit tests cover resistor and capacitor cases.
11. **Appearance-only changes were absent from the attempt log.** Flow and resistor-style changes now record a configuration event without resetting the exercise or breaking the streak.
12. **Focused basic exercises could exhaust the recent-diagram filter.** The topology-only pool for a focused basic rule contained fewer than 20 variants, so a correct no-repeat policy could reject every candidate. Generation now keeps an electrical `topologySignature` separate from a drawing signature that includes the geometric family; all focused topic/difficulty combinations are exercised against the rolling 20-item filter.
13. **Leaving or repeating during a topic mini round could duplicate an abandoned exercise or retain an incompatible topic session.** History is now appended only for an exercise owned by the current phase; incompatible settings clear the topic, and repeating history returns to the workbench without restoring topic state or issuing rewards.
14. **Several browser assertions encoded the wrong exam label or assumed a mobile component was already in the viewport.** The E2E helper now recognizes both delivery labels, scrolls the real SVG hitbox into view, and verifies ambiguity selection only when component centers are actually within the touch radius.
15. **Launcher smoke tests reused a fixed directory under the repository.** Their scratch files now go in a unique temporary directory, leaving existing repository artifacts untouched.

## Verification evidence

- `npm run lint`: passed.
- `npm run build`: passed; production JS 315.04 kB (99.55 kB gzip), CSS 30.03 kB (7.01 kB gzip).
- `npm run test:unit`: 139 tests passed across 12 files, including exhaustive topology comparisons, malformed session/exam recovery, focused topic generation, and history/session transitions.
- `npm run test:circuits`: passed; 245 unique basic and 283 unique advanced legacy signatures, 25 open-switch deletion cases.
- `npm run test:stress`: 24,000 generated circuits and 387,188 post-reduction states checked across R/C, three levels, numeric/symbolic, equal/varied. Two reduction orders were compared against an independent evaluator. No geometry failures or fallback circuits; per-matrix generation p95 ranged from 0.18 to 0.73 ms (limit: 50 ms). The campaign recorded integrated diagonals only in intermediate/advanced families.
- `npm run test:e2e`: 76 passed, 22 intentionally skipped by project-specific scope across Chromium, Edge, WebKit, Pixel 7, iPhone 13, tablet, and mobile landscape. Browser flows cover all six R/C × difficulty combinations, topic progression and reload, symbolic capacitor fractions, exam delivery, verified replay/no-reward repeat, touch selection, and dense-layout measurements. No horizontal document overflow or runtime errors.
- `npm run test:visual`: 8 passed, 12 skipped by project-specific coverage; desktop/tablet/iPhone portrait/landscape baselines matched, and the refreshed Chromium selection/error snapshots were visually inspected. The six geometric families and equivalent/result/open-switch states passed their snapshot and overlap checks.
- `npm run test:a11y`: 5 passed, 3 project-specific skips; axe reported no serious or critical violations in its Chromium/WebKit checks.
- `npm run test:lighthouse`: passed; performance 96, accessibility 100.
- `npm run test:launcher`: passed for missing requirements, a project path containing spaces, occupied-port fallback, and process/port cleanup.
- Firefox launch was attempted separately; Playwright failed before loading the application with `browserType.launch: spawn UNKNOWN` for the installed Firefox binary.

## Remaining limits

- Firefox is not verified on this Windows host until its Playwright runtime launches successfully. This is an environment/browser startup failure, not an application assertion failure.
- Finite automated testing cannot prove a literal universal “never” for every imaginable graph. Reductions therefore fail closed at runtime: the exercise/network is validated, a topology certificate is checked before arithmetic, and the resulting exercise and geometry are validated before state is committed. The separate exhaustive graph specification tested over 500,000 rule/selection cases for multigraphs up to five nodes and six components; the 24,000-circuit campaign independently checked 387,188 resulting states. This is strong evidence, not a formal proof over unbounded inputs.
- Pixel/iPhone touch checks use Playwright's device emulation and touchscreen API; a physical-device pass remains useful before release.
- On especially dense mobile landscape diagrams, not all IDs can fit at a legible size in the complete overview. Zoom and the synchronized list expose every component, and the drawing caption explains this tradeoff. This is intentional rather than allowing text collisions or sub-11-pixel labels.
- Browser storage remains best-effort by design. When disabled or corrupt, the interface continues without durable session persistence and displays a warning.

Visual snapshots are platform-specific. If the design changes intentionally, regenerate them with `npm run test:visual -- --update-snapshots` and inspect the resulting images before accepting them.
