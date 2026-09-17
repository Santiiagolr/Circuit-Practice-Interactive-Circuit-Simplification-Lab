# Contexto del Proyecto: Simulador de Circuitos (React + Vite)

Hola. Si estás leyendo esto, fuiste invocado para continuar el desarrollo, refinar y corregir bugs en este simulador de circuitos de física. A continuación tienes todo el contexto necesario para entender la arquitectura y los problemas pendientes.

## 1. ¿Qué es este programa y para qué sirve?
Es una aplicación educativa diseñada para estudiantes universitarios de física. Su objetivo es generar circuitos aleatorios compuestos exclusivamente por Resistencias o Capacitores (el usuario elige cuál usar). El estudiante debe ir simplificando el circuito paso a paso (uniendo componentes en Serie o en Paralelo) hasta llegar a un único componente equivalente. 

**Regla de oro:** El usuario pidió explícitamente que los circuitos DEBEN poder resolverse ÚNICAMENTE con transformaciones Serie y Paralelo. **NO se permite el uso de transformaciones Delta-Estrella (Δ-Y)** porque el estudiante no aprendió ese método.

## 2. Arquitectura del Código
El proyecto está construido en React y Vite. Utiliza TailwindCSS para los estilos. Todo el renderizado de los circuitos se hace a través de SVG puro (no hay librerías externas de canvas).

El programa tiene dos modos de juego distintos (que coexisten en `App.jsx`):

### Modo Básico (Árbol Recursivo)
- **Archivos Clave:** `src/lib/circuit.js` y `src/components/CircuitSVG.jsx`
- **Lógica:** Genera un AST (Abstract Syntax Tree) recursivo. Cada nodo es `leaf` (un componente), `series` o `parallel`. Es imposible que genere situaciones que requieran Delta-Estrella porque su naturaleza es estrictamente divisoria.
- **Renderizado:** Dibuja cajas con líneas de conexión y distribuye los nodos de forma jerárquica.

### Modo Avanzado (Grilla / Malla de Grafos)
- **Archivos Clave:** `src/lib/graphCircuit.js` y `src/components/GridCircuitSVG.jsx`
- **Lógica:** Funciona como un grafo puro (`nodes` y `edges`). Debido a la restricción de "no usar Delta-Estrella", los circuitos no se generan de forma 100% procedimental pura. En su lugar, utiliza un sistema de **Plantillas Base (Templates)** hardcodeadas (Puentes modificados, Diamantes, Escaleras) que matemáticamente se sabe que son reducibles por Serie/Paralelo. Estas plantillas luego se espejan y se les asignan valores y cables de forma aleatoria para generar variedad.
- **Renderizado:** Los componentes se dibujan sobre líneas (edges) utilizando coordenadas espaciales `(x, y)` multiplicadas por el tamaño de la grilla. Se usa un sistema de curvas de Bézier cuadráticas para cuando dos nodos tienen múltiples conexiones paralelas (para evitar que las líneas se superpongan visualmente).

### Matemáticas y "Cables Vacíos" (Cortocircuitos)
- Existe un 20% de probabilidad de que un componente se genere como un "Cable" (`compType === 'W'`).
- Matemáticamente, un cable es una resistencia de `0Ω` o un capacitor de capacitancia `Infinity`.
- Las funciones matemáticas (como `calcEq`) están adaptadas para no romper el programa (manejan divisiones por cero e Infinito correctamente).

## 3. Estado Actual y Problemas a Resolver (Tu Misión)
El núcleo matemático y lógico funciona bien, pero el sistema visual SVG y el manejo de estado interactivo aún tienen vulnerabilidades. Tu tarea es **realizar un pulido general y resolver inconsistencias visuales o crashes del sistema**.

Focos de atención donde suele romperse:
1. **Inconsistencias Visuales en SVG:** 
   - A veces, al simplificar agresivamente el grafo, los componentes pueden quedar cruzados de forma extraña, o los textos de valores se solapan con las líneas.
   - En el Modo Avanzado, revisa que los cálculos de las curvas (`multiOffset`) para componentes en paralelo escalen bien en todos los casos extremos.
2. **Crash Interactivo (Bugs Lógicos de UI):**
   - El sistema de selección de componentes (`selectedIds`) a veces se confunde si ocurren re-renderizados bruscos.
   - Revisa validaciones en el modo Grafo. Por ejemplo, si intentan combinar en serie dos componentes que comparten un nodo, pero ese nodo tiene una tercera conexión (grado > 2), el programa debería rechazarlo educadamente, no crashear ni permitirlo.
3. **Escalabilidad en Pantallas Diferentes:**
   - Hay que asegurar que el `viewBox` del SVG se adapte bien sin que los elementos se salgan de la pantalla en dispositivos muy chicos o resoluciones atípicas.
4. **Manejo de Errores de Estado:**
   - Asegúrate de que las transiciones de estado entre "Juego Terminado", "Modo Resistencias vs Capacitores", y "Modo Árbol vs Grafo" limpien correctamente todos los arrays para no arrastrar nodos o edges fantasma.

¡Éxitos refinando este simulador! Conserva siempre la restricción de evitar Delta-Estrellas.
