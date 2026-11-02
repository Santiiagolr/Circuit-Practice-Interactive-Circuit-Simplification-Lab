# Contexto actual — Circuit Practice

## Producto y límites

Aplicación local React/Vite para preparar parciales de circuitos de resistencias, capacitores e inductores ideales. El estudiante selecciona manualmente 2 o más elementos y confirma Serie, Paralelo o la eliminación de un interruptor abierto. No hay solucionador automático ni transformaciones Delta-Estrella. La meta es un único equivalente entre los terminales de la batería.

Configuración inicial: Entrenamiento, dificultad Básica, resistencias, valores numéricos variados, zigzag, cálculo manual y flujo ilustrativo desactivados. Las opciones, el ejercicio activo, el historial y un simulacro en curso se guardan localmente cuando `localStorage` está disponible.

## Arquitectura

- `src/lib/exercise.js`: contrato compartido de ejercicio, AST serie/paralelo, generación aleatoria con semilla, verificación eléctrica y reducciones atómicas. Dificultades: Básica 4–6 elementos/profundidad 2; Intermedia 7–10/profundidad 3; Avanzada 11–15/profundidad 5.
- `src/lib/topology.js`: conversión AST-red y validación de grupos de 2 a N; distingue falsos paralelos, nodos de serie, terminales, cables, interruptores e IDs obsoletos.
- `src/lib/technicalDrawing.js`: seis marcos geométricos, distribución de símbolos/rutas/etiquetas y verificación de colisiones antes de mostrar un diagrama.
- `src/lib/values.js`: R/C/L, unidades, racionales exactos para múltiplos simbólicos y análisis restringido de respuestas ingresadas.
- `src/lib/session.js`: reducer de sesión, selección, feedback, intentos, historial, manual de valores, deshacer/rehacer, parcial, temporizador, entrega única y recuperación de sesión.
- `src/lib/gameState.js`: puntaje y racha con la clave/estructura anterior compatibles.
- `src/lib/circuit.js` y `src/lib/graphCircuit.js`: APIs anteriores conservadas mediante adaptadores y regresiones.
- `src/components/TechnicalCircuit.jsx`: SVG interactivo, símbolos R/C/L/W/S/batería, hitboxes, panel sincronizado, zoom/desplazamiento y selector de componentes cercanos.
- `src/components/PracticeSettings.jsx`, `PracticeHistory.jsx`: configuración, revisión e historial.
- `src/App.jsx`: navegación, continuidad, temporizador, persistencia y atajos limitados a la mesa visible.
- `Workbench.jsx`: mesa, panel plegable, concentración y fullscreen nativo/CSS. `AppNavigation.jsx` y `AppDialog.jsx`: navegación y confirmaciones accesibles.
- `PracticeSettings.jsx`: borrador de ejercicio con aplicación conjunta; apariencia inmediata. `ArithmeticEntry.jsx`: ingreso persistido y errores asociados al campo.
- `src/refinement.css`: escala compartida de 4/8/12/16/24/32 px y composición adaptable; `theme.css` conserva la paleta de ambos temas.

Atajos: `Q` = Serie, `E` = Paralelo, `Ctrl/Cmd+Z` = Deshacer, `Ctrl/Cmd+Shift+Z` = Rehacer. Se ignoran campos de entrada y estados bloqueados. En móvil las operaciones quedan en una barra inferior persistente con espacio reservado y área segura. Al ingresar un valor, esa barra se oculta para dejar libre el teclado; zoom y caption tienen filas propias para no tapar símbolos o etiquetas.

## QA local

- `npm run lint`, `npm run build`, `npm run test:unit`: validación estática, compilación y pruebas Vitest/Testing Library.
- `npm run test:circuits`: humo de motores/adaptadores anteriores, diversidad y switches.
- `npm run test:stress`: 1.000 semillas para cada uno de 36 cruces de tipo, nivel, representación y distribución; dos órdenes válidos de reducción, geometría e independencia matemática.
- `npm run test:e2e`: Chromium, Edge, WebKit, Pixel emulado, iPhone emulado, tablet y teléfono horizontal.
- `npm run test:e2e:firefox`: Firefox por separado. La ejecución del 2026-11-02 pasó 11 recorridos aplicables y omitió 5 por alcance de proyecto. El fallo `spawn UNKNOWN` documentado anteriormente es histórico.
- `npm run test:visual`: capturas de escritorio, tablet, teléfono vertical/horizontal y estados del ejercicio.
- `npm run test:a11y`: axe-core sobre Chromium/WebKit y comprobaciones de foco/acciones.
- `npm run test:lighthouse`: producción local, umbrales de rendimiento y accesibilidad.
- `npm run test:launcher`: launcher de Windows, ruta con espacios, puertos, requisitos y cierre.
- `npm run qa`: compuerta completa.

El modo reproducible solo se activa al ejecutar `npm run dev:qa`; acepta `seed`, `mode` (`training|exam`), `type`, `difficulty`, `values`, `representation` y `manual`. Una misma URL/configuración permite restaurar la sesión al recargar; cambiar la semilla/config explícita inicia otra reproducción. La configuración no incorpora un solucionador y se ignora en builds de producción.

## Reglas para futuras modificaciones

- Mantener la resolución manual y no añadir Delta-Estrella.
- No cambiar fórmulas ni contratos de los motores sin pruebas de resistencias, capacitores e inductores ideales, incluidas capacidades infinitas, cero, cables y switches.
- Revalidar diagramas antes y después de cada reducción; no permitir cruces ambiguos, etiquetas tapadas, ramas desprendidas o hitboxes insuficientes.
- Probar entrada táctil real emulada y scroll en vertical/horizontal, además de teclado y clic.
- Conservar cambios de trabajo y datos existentes. No hacer commit/push ni operaciones destructivas fuera de lo que el usuario solicite.

## Refinamiento integral — 2026-11-02

- Cinco vistas: Práctica libre, Por temas, Parcial, Progreso e Historial. Consultar Progreso/Historial conserva el circuito y el reloj del parcial; Volver al ejercicio recupera su contexto.
- Las acciones que sustituyen una práctica con intentos o cálculo pendiente solicitan confirmación. Cancelar conserva ejercicio, selección y borrador; confirmar ejecuta una sola transición del reducer.
- El historial filtra por componente, modalidad y estado; muestra 20 registros por página sin alterar los datos. Se eliminó el recorte anterior a 200 entradas y la recuperación admite historiales mayores; la persistencia sigue sujeta a la disponibilidad de almacenamiento del navegador. La revisión separa resumen, intentos y reproducción verificada con fórmula del paso.
- Por temas agrupa R/C/L y mantiene los seis recorridos. Puras/Mixtas sigue siendo manual, sin desbloqueo automático; ambos símbolos de inductor están disponibles.
- Progreso prioriza circuitos y actividad. Las rachas y los puntos están en un desplegable. Los contadores derivados del historial indican su alcance y no se presentan como medidas de dominio.
- La sesión sigue en versión 2. `current.pending.text` es opcional, admite hasta 500 caracteres y preserva la respuesta al navegar o recargar. Las sesiones anteriores siguen siendo válidas. Los ajustes visuales pueden cambiar durante un parcial sin regenerarlo.
- Ayuda conserva atajos y manejo de la mesa; durante un parcial omite las explicaciones conceptuales de serie/paralelo. Los diálogos usan la modalidad nativa y restauran foco.
- El alcance y la matriz de aceptación están en `docs/REFINAMIENTO_INTEGRAL.md`. La evidencia actual se registra en `docs/QA_REFINAMIENTO.md`; las cifras históricas de DEBUG_REPORT no prueban el estado actual.

El cierre del refinamiento incluye `npm run test:native-zoom`: prueba el zoom nativo real al 200% en perfiles sintéticos de Chromium, sin modificar el perfil personal. La evidencia y las medidas comparativas 100%/200% están en `docs/QA_REFINAMIENTO.md`.
