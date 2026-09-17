# Historial del Proyecto: Práctica de Circuitos

Este archivo fue generado para guardar el registro de los cambios y características que fuimos agregando durante nuestra sesión.

## Características Implementadas

### 1. Dos Modos de Juego
- **Modo Básico (Árboles):** Circuitos generados de forma recursiva que siempre se dividen limpiamente.
- **Modo Avanzado (Grillas/Mallas):** Circuitos generados a partir de plantillas complejas (Puente, Diamante, Escalera) con diagonales y uniones asimétricas. Todos fueron diseñados para que siempre se puedan resolver usando métodos puros de Serie y Paralelo, sin necesidad de usar transformaciones Delta-Estrella.

### 2. Generación de Componentes
- **Resistencias y Capacitores:** El usuario puede elegir con qué tipo de componente practicar. Las fórmulas matemáticas (inversas directas) se aplican correctamente según el componente.
- **Valores:** Se agregó un selector para jugar con componentes de valores diferentes (aleatorios) o todos de idéntico valor (R).
- **Cables puros (Cortocircuitos):** Agregamos un 20% de probabilidad de que aparezcan cables vacíos (0Ω o capacitancia infinita). El sistema matemático está preparado para resolver paralelos y series que involucren cortocircuitos sin que el programa colapse (manejando divisiones por cero e Infinito).

### 3. Solución de Bugs Visuales y Lógicos
- **Overlap de Paralelos:** Se arregló el "final boss" de los bugs donde, al crear un equivalente en paralelo en el modo avanzado, el motor SVG dibujaba la nueva línea exactamente encima de otra preexistente. Ahora, los cables paralelos se separan visualmente formando "panzas" o curvas.
- **T-Junctions:** Se aclaró la lógica de combinación en serie. Si un nodo intermedio tiene una tercera conexión (una ramificación), el sistema bloquea la operación hasta que el usuario resuelva esa otra rama.

### 4. Interfaz Adaptativa (Móviles)
- Se ajustó el panel de controles, los botones y el área del SVG para que se apilen verticalmente y no se aplasten cuando se abre la aplicación desde la pantalla pequeña de un celular.

### 5. Hosting
- El proyecto fue compilado para producción (`npm run build`) para poder ser subido directamente a servicios gratuitos como Netlify Drop sin requerir un servidor Node.js activo de fondo.
