# Circuit Practice / Circuitos en equilibrio

Interactive physics laboratory for practicing the simplification of electrical circuits with resistors and capacitors using series and parallel rules.

Laboratorio educativo interactivo para practicar la simplificación de circuitos eléctricos con resistencias y capacitores mediante reglas de serie y paralelo.

## English

### Overview

**Circuit Practice** is a web application for university students studying Physics and Electronics. The player inspects a circuit, selects related components, and decides whether they form a **series** or **parallel** combination, or whether an **open switch** must be removed.

The challenge ends when the network is manually reduced to one equivalent component connected to the battery terminals. The application provides visual feedback and formula explanations, but it never solves the circuit automatically: the student must reason through and execute every reduction.

### Features

- **Basic mode**, powered by a recursive abstract syntax tree.
- **Advanced mode**, powered by graph nodes, edges, and topological validation.
- Randomly generated circuits that are guaranteed to be reducible with series and parallel rules.
- Support for:
  - resistors;
  - capacitors;
  - wires and short circuits;
  - open and closed switches;
  - a battery as the absolute circuit terminal.
- Physical rules specific to resistors and capacitors.
- Short-circuit detection and visual dead-branch pruning after removing open switches.
- Manual interaction: the student must select, reason, and execute every operation.
- Visual feedback for selections, topology errors, successful combinations, and circuit state.
- Responsive SVG rendering for desktop, tablet, and mobile screens.
- Keyboard support for selecting components and operating the main controls.
- No Delta-Star transformations.

### Technology stack

- React 19
- Vite
- TailwindCSS
- SVG for interactive circuit rendering
- Lucide React for icons
- Oxlint for static validation

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

### How to play

1. Choose the component type: resistor or capacitor.
2. Choose Basic or Advanced mode.
3. Select two or more components that can be reduced together.
4. Decide whether they are connected in series or in parallel.
5. If an open switch appears, select it and use **Remove (Open)**.
6. Read the application feedback and continue until one equivalent component remains.

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
├── App.jsx                     # Game state, controls, and feedback
├── index.css                   # Visual system, responsive layout, and accessibility
├── components/
│   ├── CircuitSVG.jsx          # Basic mode rendering
│   └── GridCircuitSVG.jsx      # Advanced mode rendering
└── lib/
    ├── circuit.js              # AST and Basic mode operations
    └── graphCircuit.js         # Graphs, topology, and Advanced mode operations
```

Mathematical logic and topology validation live in `src/lib/`. The SVG components handle visual representation and interaction while keeping domain rules separate from presentation.

### Local validation

Before publishing changes, run:

```bash
npm run lint
npm run build
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

- Modo **Básico**, basado en un árbol de sintaxis abstracta recursivo.
- Modo **Avanzado**, basado en grafos, nodos y aristas con validación topológica.
- Circuitos generados con estructuras reducibles mediante reglas de serie y paralelo.
- Soporte para resistencias, capacitores, cables, cortocircuitos, interruptores abiertos o cerrados y batería.
- Reglas físicas específicas para resistencias y capacitores.
- Detección de cortocircuitos y poda visual de ramas muertas después de eliminar interruptores abiertos.
- Interacción manual: el estudiante debe seleccionar, razonar y ejecutar cada operación.
- Feedback visual para selección, errores topológicos, combinaciones exitosas y estado del circuito.
- Renderizado SVG responsive para escritorio, tablet y móvil.
- Soporte de teclado para seleccionar componentes y operar los controles principales.
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

### Cómo se juega

1. Elegí el tipo de componente: resistencia o capacitor.
2. Elegí el modo Básico o Avanzado.
3. Seleccioná dos o más componentes que puedan reducirse juntos.
4. Indicá si están conectados en serie o en paralelo.
5. Si aparece un interruptor abierto, seleccionálo y utilizá la acción **Eliminar (abierto)**.
6. Leé el feedback de la aplicación y continuá hasta obtener un único componente equivalente.

La interfaz no aplica reducciones por su cuenta: cada operación requiere una selección explícita del usuario y pasa por la validación correspondiente.

### Arquitectura principal

```text
src/
├── App.jsx                     # Estado de la partida, controles y feedback
├── index.css                   # Sistema visual, responsive y accesibilidad
├── components/
│   ├── CircuitSVG.jsx          # Renderizado del modo Básico
│   └── GridCircuitSVG.jsx      # Renderizado del modo Avanzado
└── lib/
    ├── circuit.js              # AST y operaciones del modo Básico
    └── graphCircuit.js         # Grafos, topología y operaciones avanzadas
```

La lógica matemática y las validaciones topológicas viven en `src/lib/`. Los componentes SVG se ocupan de la representación visual y de la interacción, manteniendo separadas las reglas del dominio y la presentación.

### Validación local

```bash
npm run lint
npm run build
```

El build genera la carpeta `dist/`, que está excluida del control de versiones mediante `.gitignore`.

### Licencia

Este proyecto se distribuye bajo la [Licencia MIT](LICENSE).
