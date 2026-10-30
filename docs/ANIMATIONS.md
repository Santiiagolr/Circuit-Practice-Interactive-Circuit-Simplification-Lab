# Animaciones y recompensas de Circuit Practice

## Comportamiento implementado

Las reducciones válidas en serie/paralelo conceden 1, 2 o 3 puntos por componente eliminado con avance nuevo, según dificultad. `stepRewardFloor` conserva la menor cantidad alcanzada: deshacer, rehacer o cambiar la agrupación no permiten volver a cobrar. Los puntos ganados permanecen ante errores y abandono. La eliminación de abiertos baja el mínimo sin conceder puntos.

La entrega conserva 10/20/35 puntos y el bonus de circuitos sin errores. La racha de pasos aumenta una vez por reducción recompensada. Los minis no la aumentan; los errores evaluados cortan ambas rachas. Las repeticiones sin puntos no alteran ningún contador global, incluso al cometer errores.

La sesión conserva su versión 2 y sus claves anteriores. Los campos nuevos ausentes se completan sin premios retroactivos; los presentes se validan. El historial distingue puntos de pasos, entrega y total.

| Efecto | Duración | Disparador |
| --- | --- | --- |
| Reducción | 320 ms; eliminación de abierto 160 ms | Reducción confirmada por el motor |
| Puntos | 500 ms; acumulación rápida hasta 320 ms | Premio real por paso o entrega |
| Racha | Hasta 400 ms, desde los 220 ms del paso | Avance recompensado; hitos 3, 5, 10 y múltiplos de 10 |
| Entrega | 700 ms de movimiento | Entrega aceptada; aviso de parcial visible 1760 ms |

Los símbolos antiguos usan la geometría SVG previa; el equivalente usa la geometría final. Las etiquetas se funden por separado para evitar texto superpuesto. Las rutas y la cámara no reciben interpolaciones. Los efectos son silenciosos y no bloquean los controles.

Los eventos visuales viven fuera de la sesión persistida. El reducer de negocio actualiza puntos y ejercicios inmediatamente. El controlador transitorio reúne premios rápidos, cancela capas obsoletas y limpia temporizadores. Cambiar movimiento reducido cancela el movimiento del evento existente sin permitir su reproducción al restaurar la preferencia.

En parciales, el aviso sobrevive al reemplazo del circuito y al desmontaje de la última mesa. Usa un portal para permanecer visible en pantalla completa. Las repeticiones e historial no reproducen premios ni partículas.

## Verificación realizada

| Comprobación | Resultado |
| --- | --- |
| `npm run lint` | Aprobado, sin advertencias |
| `npm run build` | Aprobado |
| `npm run test:unit` | 197 aprobadas |
| Matriz E2E completa | 112 aprobadas, 28 omitidas por perfil |
| Regresión movimiento reducido → normal | 7 aprobadas, uno por perfil de navegador |
| Revisión focalizada del indicador móvil | 4 aprobadas: Pixel, iPhone, tablet y horizontal |
| `test:a11y`, Chromium y WebKit | 7 aprobadas, 3 omitidas |
| `test:visual` | 5 aprobadas, 15 omitidas, 4 diferencias de referencia |
| Zoom y limpieza por visibilidad | Capas retiradas y puntaje conservado |
| `git diff --check` | Aprobado |

La prueba de contador utiliza reloj controlado y comprueba retargeting, número final y cancelación del frame. Las capturas deterministas revisan 120, 320, 500 y 700 ms. Se revisaron claro/oscuro, escritorio 1440×900, móvil 390×844 y horizontal 844×390, teclado, controles táctiles y pantalla completa.

La auditoría de contraste del resultado espera a que termine el fundido decorativo `+N`; el puntaje canónico y el anuncio consolidado mantienen su contraste durante ese efecto. Vite excluye `test-results/`, `playwright-report/` y `output/playwright/` de su observador para que los HTML de QA no provoquen recargas de la aplicación durante las pruebas.

Se corrigieron tres hallazgos durante la verificación: reproducción del borde/aviso al restaurar movimiento normal, contraste transitorio de la palabra «pasos» y segmentos recortados en móvil. Cada caso tuvo una prueba fallida seguida de su comprobación aprobada. El fundido ordinario del contador mantiene una opacidad mínima de 0,85 para conservar contraste.

### Referencias visuales conservadas

No se modificó ningún archivo de snapshots. Las cuatro diferencias se inspeccionaron:

- `topics-overview`: diferencia previa de cuatro a seis tarjetas; altura 587 → 797 px. No procede de estas animaciones.
- `workbench-result`: puntos ganados durante la resolución, racha de pasos, mensaje de recompensa y foco en Entregar.
- `workbench-iphone-13`: indicador de racha y segunda línea del marcador móvil. La barra queda contenida después de la corrección.
- `workbench-mobile-landscape`: nuevos textos y segmentos del HUD.

Las diferencias son cambios esperados de presentación. Las referencias permanecen disponibles para una actualización manual posterior. El informe visual está en `playwright-report/` y el log en `output/playwright/visual-final.log`.

### Límites de la comprobación

Chromium headless mantuvo visibles ambas pestañas. La limpieza de visibilidad se verificó emitiendo el evento con `document.hidden` simulado; no se comprobó la ocultación mediante una ventana real del sistema operativo. Se usaron Axe y navegación de teclado, sin una sesión con lector de pantalla externo.

## Grabación y capturas

`npm run capture:animations` registra una resolución real mediante los controles visibles, con cambio de tema, ambos símbolos de bobina, hitos de racha y entrega. Guarda WebM y capturas en `output/playwright/animations/`, incluido móvil de 390×844 y horizontal de 844×390. No inyecta soluciones ni modifica la sesión fuera de la interfaz.

La entrega local incluye `circuit-practice-animations.webm`, su conversión `circuit-practice-animations.gif`, `gameplay-light.png`, `gameplay-dark.png` y las capturas móviles. Los artefactos generados están ignorados por Git.

## Estado del checkout

Durante el trabajo, el checkout recibió desde otra ejecución los commits `3e9366e` y `4233e6f`. Se conservó su contenido. Esta ejecución no emitió comandos de commit, push, merge ni publicación; los ajustes finales de estilo móvil, captura y entorno de QA permanecen como cambios locales junto con esta documentación.
