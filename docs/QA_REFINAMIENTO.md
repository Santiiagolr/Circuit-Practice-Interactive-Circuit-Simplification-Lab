# QA del refinamiento integral — 2026-11-02

## Alcance y referencia

Implementación del plan `REFINAMIENTO_INTEGRAL.md` sobre el checkout existente. Se conservaron los motores, adaptadores y contratos R/C/L, el modelo v2 y la resolución manual. La revisión utiliza datos sintéticos reproducibles; las cifras de informes anteriores no se tomaron como resultados actuales.

La referencia inicial de Chromium tenía dos diferencias previas: Temas todavía se comparaba con un catálogo de cuatro temas pese a existir seis, y Resultado difería de su captura guardada. Se clasificaron como referencias pendientes de revisión, no como pruebas aprobadas.

## Cobertura por requisito

| Área | Implementación y evidencia |
| --- | --- |
| Sistema visual | Tokens de paleta existentes, escala de espaciado compartida, tipografías locales, superficies sin sombras decorativas y estados de foco/selección/equivalente. Capturas de las cinco áreas en seis tamaños y ambos temas. |
| Navegación | Cinco destinos y retorno al contexto de entrenamiento, minis o parcial. `refinement.test.jsx` verifica selección y atajos fuera de la mesa; `refinement.spec.js` verifica navegación y regreso tras un parcial. |
| Configuración | Tres grupos, borrador conjunto, aplicar/cancelar y apariencia inmediata. Pruebas de componente y navegador verifican una sola transición y cancelación sin perder trabajo. |
| Continuidad | Confirmación de abandono para acciones que sustituyen trabajo, entrega única y conservación de recompensas. La prueba compara identidad de ejercicio y un único registro de abandono. |
| Mesa | Panel plegable, concentración, zoom conservado y fullscreen independiente. Botones móviles de operaciones persistentes; controles de tablet accesibles durante el scroll. La prueba táctil utiliza contactos reales de la API emulada. |
| Cálculo | Selección/operación/unidad junto al campo, respuesta opcional persistida en v2 y errores de formato separados de respuestas evaluadas incorrectas. Pruebas verifican recarga y navegación, conservación del texto y conteo de penalizaciones. |
| Temas | Agrupación R/C/L, seis temas, dos minis y circuito completo. Puras/Mixtas manual y ambos símbolos de L. Recorridos existentes y combinaciones R/C/L siguen cubiertos. |
| Parciales | Preparación/ejecución/revisión, reloj continuo, apariencia sin reinicio y cierre por diálogo. Historial mantiene visibles los registros pero retiene fórmulas y replay hasta finalizar; no hay acceso indirecto a Temas desde Progreso. |
| Progreso | Actividad principal y recompensas desplegables. Minis/circuitos/repeticiones separados; contadores derivados del historial identificados. Los parciales no se cuentan como práctica libre. |
| Historial | Filtros por componente/modalidad/estado y páginas de 20 sin recorte. Regresión de 202 entradas verifica agregado y recuperación. Resumen, intentos y replay con fórmula del paso se abren por separado. |
| Compatibilidad | Campo `pending.text` opcional y validado (hasta 500 caracteres), sin cambio de versión ni eventos de animación persistidos. Los adaptadores antiguos permanecen cubiertos por unitarias y humo. |
| Accesibilidad | Foco circular en diálogos, Escape y retorno al disparador en Chromium/WebKit; contraste de atajos corregido; teclado sin acciones sobre vistas ocultas. Axe, movimiento reducido y reflow equivalente a 200% se prueban por separado. |

## Revisión independiente y correcciones

Una revisión independiente, de solo lectura, encontró tres problemas: explicaciones del historial disponibles durante un parcial, retorno a una mesa bloqueada desde preparación/revisión y acceso a Temas desde el estado vacío de Progreso. Se corrigieron y se agregaron regresiones. Las pruebas de historial de parcial y retorno a preparación se observaron fallar antes de la corrección.

La matriz de navegadores también encontró foco de botones en WebKit, una carrera al salir de fullscreen y acciones de tablet que quedaban fuera de pantalla al desplazarse a la lista. Se corrigieron y se ejecutaron los recorridos dirigidos. El caso de ambigüedad táctil ahora distingue el tipo del evento nativo; la prueba centra el objetivo antes de un tap de bajo nivel para no tocar por debajo de la barra fija.

## Aceptación visual

Se inspeccionaron 60 capturas de las cinco áreas en 360×800, 390×844, 768×1024, 844×390, 1280×900 y 2560×1440, con tema claro y oscuro. Además se revisaron 19 capturas recibidas de la regresión visual: seis familias geométricas, selección, error, equivalente, resultado, interruptor abierto, dos temas ultrawide, mini y catálogo de temas y cuatro vistas de mesa por dispositivo.

Solo después de esa inspección se copiaron explícitamente esas 19 imágenes a sus referencias correspondientes. No se ejecutó una actualización masiva de snapshots. El registro local conserva los hashes anterior/aceptado; las pruebas mantienen sus umbrales y las comprobaciones de colisión, legibilidad y objetivos táctiles.

Capturas reproducibles y hojas de revisión: `output/playwright/refinement/` y `output/playwright/refinement-visual/`. Son artefactos locales ignorados por Git. Las referencias de regresión sí forman parte de los cambios revisables.

## Resultados finales

Pendientes de consolidar al terminar los procesos de la matriz completa y generación. Los registros completos están en `.superpowers/refinement/` (artefactos locales ignorados por Git).

## Límites de la evidencia

Pixel, iPhone, tablet y teléfono horizontal son perfiles emulados de Playwright, no dispositivos físicos. La prueba de zoom valida reflow equivalente a 200% (viewport CSS de 640 px respecto de una ventana de 1280 px); no certifica los menús o preferencias de zoom de cada navegador del usuario. El almacenamiento local depende de disponibilidad/cuota: ante fallo la aplicación informa que no puede guardar, sin descartar registros para ocultarlo.
