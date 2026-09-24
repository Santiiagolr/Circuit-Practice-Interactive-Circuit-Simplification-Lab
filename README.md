# Circuit Practice / Circuitos en equilibrio

Interactive physics laboratory for practicing the simplification of electrical circuits with resistors and capacitors using series and parallel rules.

Laboratorio educativo interactivo para practicar la simplificación de circuitos eléctricos con resistencias y capacitores mediante reglas de serie y paralelo.

## English

### Overview

**Circuit Practice** is a web application for university students studying Physics and Electronics. The player inspects a circuit, selects related components, and decides whether they form a **series** or **parallel** combination, or whether an **open switch** must be removed.

The challenge ends when the network is manually reduced to one equivalent component connected to the battery terminals. The application provides visual feedback and formula explanations, but it never solves the circuit automatically: the student must reason through and execute every reduction.

### Features

- Three reasoning levels: **Basic** (4–6 elements), **Intermediate** (7–10), and **Advanced** (11–15).
- **Training** and configurable mock exams (3, 5, or 10 exercises, with an optional timer).
- Six geometric circuit families: rectangular frames, ladders, stacked cells, crossbars, triangular cells, and integrated diagonals.
- Seeded random circuits; electrical validity and drawing geometry are checked before an exercise is shown.
- Support for:
  - resistors;
  - capacitors;
  - wires and short circuits;
  - open and closed switches;
  - a battery as the absolute circuit terminal.
- Physical rules specific to resistors and capacitors.
- Numeric values in Ω/kΩ and µF/nF, or exact symbolic multiples of `R`/`C`.
- Optional manual equivalent-value entry with a restricted parser (fractions, decimal commas, scientific notation, and units; no code evaluation).
- Short-circuit detection and visual dead-branch pruning after removing open switches.
- Manual interaction: the student must select, reason, and execute every operation.
- Visual feedback for selections, topology errors, successful combinations, and circuit state.
- Manual undo/redo, formula substitutions, optional conceptual hints in Training, and a reviewable exercise history.
- Persistent score, clean-solve streaks, best streak, and difficulty-based bonuses stored locally.
- Optional illustrative current-flow animation for resistor exercises.
- Responsive SVG rendering for desktop, tablet, and mobile screens.
- Keyboard support: `Q` applies Series, `E` applies Parallel, and `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` undo and redo.
- Optional full-screen workbench and mobile **Enlarge / Fit** controls.
- A synchronized component list with 44 px touch targets and action controls that remain reachable while scrolling on portrait and landscape phones.
- Offline self-hosted typography: no external font request is required.
- No Delta-Star transformations.

### Technology stack

- React 19
- Vite
- TailwindCSS
- SVG for interactive circuit rendering
- Lucide React for icons
- Oxlint for static validation
- Vitest and Testing Library for unit/component tests
- Playwright and axe-core for browser, visual, mobile, and accessibility QA
- Lighthouse for mobile performance and accessibility budgets

### Requirements

- Node.js 18 or newer.
- npm 9 or newer.

### Installation

Clone the repository and enter the project directory:

```bash
git clone https://github.com/<username>/circuit-practice.git
cd circuit-practice
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite will print the local URL, usually `http://localhost:5173`.

### Windows launcher

The repository includes `CircuitPractice.exe` as a Windows launcher. Double-click it from the project root to start Vite and open the application in the default browser.

The launcher requires Node.js and an installed `node_modules/` directory. It selects an available local port between `5173` and `5199`, keeps the Vite console open while the application is running, and stops the development server when you press `Ctrl+C`.

The launcher source is available at `tools/CircuitPracticeLauncher/CircuitPracticeLauncher.cs`.

### Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the development server with hot reload. |
| `npm run build` | Creates the optimized production build. |
| `npm run preview` | Serves the production build locally. |
| `npm run lint` | Runs Oxlint on the project. |
| `npm run test:unit` | Runs physics, topology, state, persistence, SVG, and component tests. |
| `npm run test:circuits` | Runs deterministic generation, solvability, diversity, and switch-deletion smoke tests. |
| `npm run test:stress` | Generates 24,000 circuits (1,000 per type/level/representation/value combination) and validates two reduction orders against an independent evaluator. |
| `npm run test:e2e` | Runs browser flows on Chromium, Edge, WebKit, Android, iPhone, tablet, and mobile landscape. |
| `npm run test:e2e:firefox` | Runs the same flow on Playwright Firefox. |
| `npm run test:visual` | Compares desktop, tablet, iPhone portrait, and phone landscape screenshots, including interaction states. |
| `npm run test:a11y` | Runs axe-core and keyboard/focus checks. |
| `npm run test:lighthouse` | Enforces mobile performance ≥85 and accessibility ≥95. |
| `npm run test:launcher` | Tests the Windows launcher, port fallback, paths with spaces, and cleanup. |
| `npm run qa` | Runs the complete local quality gate. |

### Reproducible QA mode

Reproducible query parameters are accepted only when Vite's `qa` mode is explicitly enabled (for example, with `npm run dev:qa`). They never add a solver and are ignored by production builds:

```text
?seed=2026&mode=training&type=C&difficulty=challenge&values=equal&representation=symbolic&manual=true
```

Supported values are `training|exam`, `R|C`, `guided|practice|challenge`, and `varied|equal`; `representation` accepts `numeric|symbolic`. A matching QA URL restores the saved session after reload; changing its explicit seed/config starts a fresh reproducible exercise. To update approved screenshots intentionally, run:

```bash
npm run test:visual -- --update-snapshots
```

Firefox is available as a separate project. On this Windows host, its Playwright binary currently fails to start with `spawn UNKNOWN` before the application loads; the run is recorded in `DEBUG_REPORT.md`.

### How to play

1. Choose Training or Mock Exam, a difficulty, and resistors or capacitors.
2. Select two or more components that can be reduced together; the component list and diagram stay synchronized.
3. Decide whether they are connected in series or in parallel. `Q` and `E` apply those rules.
4. If an open switch appears, select it and use **Remove (Open)**.
5. In Training, optionally request a hint or review a formula after reducing. In an exam, review is available after submission.
6. Continue until one equivalent remains, then deliver the exercise to record its reward.

Correctly delivered exercises build a streak and award difficulty-based points plus the existing streak bonus. An incorrect electrical or numeric answer resets the active streak; hints, undo/redo, and interface-only issues do not. Progress and in-progress mock exams are saved locally when browser storage is available.

The interface does not apply reductions on its own. Every operation requires an explicit user selection and passes through the corresponding validation.

### Implemented physics rules

#### Resistors

- Series: `R_eq = R₁ + R₂ + ...`
- Parallel: `1 / R_eq = 1 / R₁ + 1 / R₂ + ...`

#### Capacitors

- Parallel: `C_eq = C₁ + C₂ + ...`
- Series: `1 / C_eq = 1 / C₁ + 1 / C₂ + ...`

#### Wires and switches

- A wire behaves as an ideal conductor.
- A closed switch behaves as a wire.
- An open switch behaves as infinite resistance and must be removed before continuing.
- A wire in parallel can create a short circuit and cancel the parallel component.

### Project structure

```text
src/
├── App.jsx                     # Game composition and keyboard/fullscreen flows
├── App.css / index.css         # Responsive technical-notebook design system
├── components/
│   ├── TechnicalCircuit.jsx    # Interactive SVG, touch panel, zoom, and symbols
│   ├── PracticeSettings.jsx    # Training/exam, difficulty, values, and options
│   ├── PracticeHistory.jsx     # Results and reduction explanations
│   └── AppErrorBoundary.jsx    # Safe recovery
└── lib/
    ├── exercise.js             # Seeded generator and atomic reductions
    ├── topology.js             # Shared series/parallel validation
    ├── technicalDrawing.js     # Geometric routing, labels, and collision checks
    ├── values.js               # Exact rational arithmetic and safe input parsing
    ├── session.js              # Reducer, exams, undo/redo, and session storage
    ├── gameState.js            # Backward-compatible score/streak storage
    ├── circuit.js / graphCircuit.js # Legacy-compatible engine adapters
    └── qaConfig.js             # Explicit development-only reproduction settings
```

Electrical rules and topology validation stay in `src/lib/`; React and SVG components render the exercise without solving it for the student.

### Local validation

Before publishing changes, run:

```bash
npm run lint
npm run build
npm run qa
```

The build creates the `dist/` directory, which is excluded from version control by `.gitignore`.

### License

This project is distributed under the [MIT License](LICENSE).

---

## Español

### Descripción

**Circuitos en equilibrio** es una aplicación web para estudiantes universitarios de Física y Electrónica. El usuario inspecciona el circuito, selecciona componentes relacionados y decide si forman una combinación en **serie**, en **paralelo** o si corresponde **eliminar un interruptor abierto**.

El desafío termina cuando la red se reduce manualmente a un único componente equivalente conectado a los terminales de la batería. La aplicación acompaña el razonamiento con feedback visual y explicaciones de las fórmulas, pero no resuelve el circuito automáticamente: el estudiante debe pensar y ejecutar cada reducción.

### Características

- Tres niveles de razonamiento: **Básico** (4–6 elementos), **Intermedio** (7–10) y **Avanzado** (11–15).
- **Entrenamiento** y simulacros configurables (3, 5 o 10 ejercicios, con reloj opcional).
- Seis familias geométricas: marcos rectangulares, escaleras, celdas apiladas, travesaños, celdas triangulares y diagonales integradas.
- Circuitos aleatorios con semilla; la validez eléctrica y geométrica se comprueba antes de mostrarlos.
- Soporte para resistencias, capacitores, cables, cortocircuitos, interruptores abiertos o cerrados y batería.
- Reglas físicas específicas para resistencias y capacitores.
- Valores numéricos en Ω/kΩ y µF/nF, o múltiplos simbólicos exactos de `R`/`C`.
- Ingreso opcional del equivalente con analizador restringido (fracciones, coma decimal, notación científica y unidades; nunca evalúa código).
- Detección de cortocircuitos y poda visual de ramas muertas después de eliminar interruptores abiertos.
- Interacción manual: el estudiante debe seleccionar, razonar y ejecutar cada operación.
- Feedback visual para selección, errores topológicos, combinaciones exitosas y estado del circuito.
- Deshacer/rehacer, sustitución de fórmulas, pistas conceptuales opcionales en Entrenamiento e historial revisable.
- Puntos, racha de resoluciones limpias, mejor racha y bonus según dificultad, persistidos localmente.
- Animación opcional e ilustrativa del flujo de corriente para ejercicios de resistencias.
- Renderizado SVG responsive para escritorio, tablet y móvil.
- Teclado: `Q` aplica Serie, `E` aplica Paralelo y `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` deshacen y rehacen.
- Mesa de trabajo en pantalla completa y controles móviles **Ampliar / Ajustar**.
- Lista de componentes sincronizada, controles táctiles de 44 px y acciones accesibles al desplazarse en teléfonos verticales y horizontales.
- Tipografías locales: la aplicación no depende de Google Fonts ni de conexión externa.
- No utiliza transformaciones Delta-Estrella.

### Requisitos e instalación

- Node.js 18 o superior.
- npm 9 o superior.

```bash
git clone https://github.com/<usuario>/circuit-practice.git
cd circuit-practice
npm install
npm run dev
```

Vite mostrará la URL local, normalmente `http://localhost:5173`.

### Launcher para Windows

El repositorio incluye `CircuitPractice.exe` como launcher para Windows. Hacé doble clic sobre el archivo desde la carpeta raíz del proyecto para iniciar Vite y abrir la aplicación en el navegador predeterminado.

El launcher requiere Node.js y la carpeta `node_modules/` instalada. Selecciona un puerto local disponible entre `5173` y `5199`, mantiene abierta la consola de Vite mientras la aplicación está activa y detiene el servidor cuando presionás `Ctrl+C`.

El código fuente del launcher está en `tools/CircuitPracticeLauncher/CircuitPracticeLauncher.cs`.

### Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo con recarga en caliente. |
| `npm run build` | Genera la versión optimizada para producción. |
| `npm run preview` | Sirve localmente la compilación de producción. |
| `npm run lint` | Ejecuta Oxlint sobre el proyecto. |
| `npm run test:unit` | Prueba física, topología, estado, persistencia, SVG y componentes React. |
| `npm run test:circuits` | Ejecuta smoke tests deterministas de generación, reducibilidad, variedad y eliminación de interruptores. |
| `npm run test:stress` | Genera 24.000 circuitos (1.000 por tipo/nivel/representación/valores) y compara dos órdenes de reducción con un evaluador independiente. |
| `npm run test:e2e` | Prueba Chromium, Edge, WebKit, Android, iPhone, tablet y móvil horizontal. |
| `npm run test:e2e:firefox` | Ejecuta por separado la matriz de Firefox. |
| `npm run test:visual` | Verifica capturas de escritorio, tablet, iPhone vertical y teléfono horizontal, incluidos estados de interacción. |
| `npm run test:a11y` | Ejecuta axe-core y pruebas de teclado/foco. |
| `npm run test:lighthouse` | Exige rendimiento móvil ≥85 y accesibilidad ≥95. |
| `npm run test:launcher` | Prueba rutas con espacios, dependencias faltantes, puertos y cierre del launcher. |
| `npm run qa` | Ejecuta la compuerta integral de calidad. |

### Modo QA reproducible

Los parámetros reproducibles de URL solo se habilitan si se inicia Vite explícitamente en modo `qa` (por ejemplo, con `npm run dev:qa`); no incorporan un solucionador y se ignoran en producción:

```text
?seed=2026&mode=training&type=C&difficulty=challenge&values=equal&representation=symbolic&manual=true
```

Para actualizar intencionalmente los snapshots visuales:

```bash
npm run test:visual -- --update-snapshots
```

### Cómo se juega

1. Elegí Entrenamiento o Simulacro, una dificultad y resistencias o capacitores.
2. Seleccioná dos o más componentes reducibles; la lista y el dibujo permanecen sincronizados.
3. Indicá si están en serie o en paralelo. `Q` y `E` aplican esas reglas.
4. Si aparece un interruptor abierto, seleccionalo y usá **Eliminar (abierto)**.
5. En Entrenamiento podés pedir una pista y revisar la fórmula después de reducir. En el parcial, la revisión queda disponible al entregar.
6. Continuá hasta dejar un equivalente y entregá el ejercicio para registrar los puntos.

Los ejercicios entregados correctamente construyen una racha y suman puntos según dificultad, más el bonus vigente. Una respuesta eléctrica o numérica incorrecta corta la racha; las pistas, deshacer/rehacer y los problemas puramente de interfaz no. El progreso y los parciales en curso se guardan localmente si el navegador permite almacenamiento.

La interfaz no aplica reducciones por su cuenta: cada operación requiere una selección explícita del usuario y pasa por la validación correspondiente.

### Arquitectura principal

```text
src/
├── App.jsx                         # Composición, atajos y pantalla completa
├── App.css / index.css             # Diseño responsive de apunte técnico
├── components/
│   ├── TechnicalCircuit.jsx        # SVG interactivo, panel táctil, zoom y símbolos
│   ├── PracticeSettings.jsx        # Entrenamiento/parcial, dificultad y valores
│   ├── PracticeHistory.jsx         # Resultados y explicaciones de reducciones
│   └── AppErrorBoundary.jsx        # Recuperación segura
└── lib/
    ├── exercise.js                 # Generador con semilla y reducciones atómicas
    ├── topology.js                 # Validación común de serie/paralelo
    ├── technicalDrawing.js         # Rutas geométricas, etiquetas y colisiones
    ├── values.js                   # Aritmética racional exacta y entrada segura
    ├── session.js                  # Estado, parciales, deshacer/rehacer y persistencia
    ├── gameState.js                # Persistencia compatible de puntaje y racha
    ├── circuit.js / graphCircuit.js # Adaptadores de motores existentes
    └── qaConfig.js                 # Reproducción explícita solo para desarrollo
```

Las reglas eléctricas y validaciones topológicas permanecen en `src/lib/`; React y SVG muestran e interactúan con el ejercicio sin resolverlo por el estudiante.

### Validación local

```bash
npm run lint
npm run build
npm run test:circuits
```

El build genera la carpeta `dist/`, que está excluida del control de versiones mediante `.gitignore`.

### Licencia

Este proyecto se distribuye bajo la [Licencia MIT](LICENSE).
