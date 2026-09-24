# Contexto actual — Circuit Practice

## Producto y límites

Aplicación local React/Vite para preparar parciales de circuitos de resistencias y capacitores. El estudiante selecciona manualmente 2 o más elementos y confirma Serie, Paralelo o la eliminación de un interruptor abierto. No hay solucionador automático ni transformaciones Delta-Estrella. La meta es un único equivalente entre los terminales de la batería.

Configuración inicial: Entrenamiento, dificultad Básica, resistencias, valores numéricos variados, zigzag, cálculo manual y flujo ilustrativo desactivados. Las opciones, el ejercicio activo, el historial y un simulacro en curso se guardan localmente cuando `localStorage` está disponible.

## Arquitectura

- `src/lib/exercise.js`: contrato compartido de ejercicio, AST serie/paralelo, generación aleatoria con semilla, verificación eléctrica y reducciones atómicas. Dificultades: Básica 4–6 elementos/profundidad 2; Intermedia 7–10/profundidad 3; Avanzada 11–15/profundidad 5.
- `src/lib/topology.js`: conversión AST-red y validación de grupos de 2 a N; distingue falsos paralelos, nodos de serie, terminales, cables, interruptores e IDs obsoletos.
- `src/lib/technicalDrawing.js`: seis marcos geométricos, distribución de símbolos/rutas/etiquetas y verificación de colisiones antes de mostrar un diagrama.
- `src/lib/values.js`: resistencias/capacitores, unidades, racionales exactos para múltiplos simbólicos y análisis restringido de respuestas ingresadas.
- `src/lib/session.js`: reducer de sesión, selección, feedback, intentos, historial, manual de valores, deshacer/rehacer, parcial, temporizador, entrega única y recuperación de sesión.
- `src/lib/gameState.js`: puntaje y racha con la clave/estructura anterior compatibles.
- `src/lib/circuit.js` y `src/lib/graphCircuit.js`: APIs anteriores conservadas mediante adaptadores y regresiones.
- `src/components/TechnicalCircuit.jsx`: SVG interactivo, símbolos R/C/W/S/batería, hitboxes, panel sincronizado, zoom/desplazamiento y selector de componentes cercanos.
- `src/components/PracticeSettings.jsx`, `PracticeHistory.jsx`: configuración, revisión e historial.
- `src/App.jsx`, `src/App.css`, `src/index.css`: composición, teclado, fullscreen nativo/CSS, responsive y accesibilidad.

Atajos: `Q` = Serie, `E` = Paralelo, `Ctrl/Cmd+Z` = Deshacer, `Ctrl/Cmd+Shift+Z` = Rehacer. Se ignoran campos de entrada y estados bloqueados. En móvil la barra de acciones queda accesible durante el scroll; zoom y caption tienen filas propias para no tapar símbolos o etiquetas.

## QA local

- `npm run lint`, `npm run build`, `npm run test:unit`: validación estática, compilación y pruebas Vitest/Testing Library.
- `npm run test:circuits`: humo de motores/adaptadores anteriores, diversidad y switches.
- `npm run test:stress`: 1.000 semillas para cada uno de 24 cruces de tipo, nivel, representación y distribución; dos órdenes válidos de reducción, geometría e independencia matemática.
- `npm run test:e2e`: Chromium, Edge, WebKit, Pixel emulado, iPhone emulado, tablet y teléfono horizontal.
- `npm run test:e2e:firefox`: Firefox por separado. En el host Windows observado, Playwright falla antes de abrir la app con `browserType.launch: spawn UNKNOWN`; revisar el runtime del navegador/Windows antes de adjudicar cobertura.
- `npm run test:visual`: capturas de escritorio, tablet, teléfono vertical/horizontal y estados del ejercicio.
- `npm run test:a11y`: axe-core sobre Chromium/WebKit y comprobaciones de foco/acciones.
- `npm run test:lighthouse`: producción local, umbrales de rendimiento y accesibilidad.
- `npm run test:launcher`: launcher de Windows, ruta con espacios, puertos, requisitos y cierre.
- `npm run qa`: compuerta completa.

El modo reproducible solo se activa al ejecutar `npm run dev:qa`; acepta `seed`, `mode` (`training|exam`), `type`, `difficulty`, `values`, `representation` y `manual`. Una misma URL/configuración permite restaurar la sesión al recargar; cambiar la semilla/config explícita inicia otra reproducción. La configuración no incorpora un solucionador y se ignora en builds de producción.

## Reglas para futuras modificaciones

- Mantener la resolución manual y no añadir Delta-Estrella.
- No cambiar fórmulas ni contratos de los motores sin pruebas de resistencias y capacitores, incluidas capacidades infinitas, cero, cables y switches.
- Revalidar diagramas antes y después de cada reducción; no permitir cruces ambiguos, etiquetas tapadas, ramas desprendidas o hitboxes insuficientes.
- Probar entrada táctil real emulada y scroll en vertical/horizontal, además de teclado y clic.
- Conservar cambios de trabajo y datos existentes. No hacer commit/push ni operaciones destructivas fuera de lo que el usuario solicite.
