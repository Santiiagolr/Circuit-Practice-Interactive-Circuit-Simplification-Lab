# Refinamiento integral de Circuit Practice

## Objetivo y criterio de diseño

Convertir el programa en una mesa de laboratorio más clara, cómoda y consistente, manteniendo la resolución manual y todas las capacidades actuales: resistencias, capacitores, inductores, práctica libre, temas, parciales, progreso e historial.

La dirección elegida es **dar protagonismo al circuito y mostrar las herramientas según el momento de la práctica**. Se conservarán React/Vite, los motores actuales, las tipografías locales y los temas claro/oscuro.

Base revisada: `main` sin cambios locales; lint aprobado; pruebas visuales de Chromium con cuatro aprobadas y dos diferencias en Temas y Resultado. La suite unitaria se interrumpió sin resultado final; no se considera verificada. Las demás plataformas quedan pendientes de validación.

## 1. Sistema visual y organización general

- Centralizar colores, espaciados, tipografía, bordes y estados en los tokens existentes. Mantener blanco y azul grisáceo como superficies, verde petróleo para selección, ámbar para equivalentes y rojo para errores; conservar sus variantes oscuras.
- Usar Space Grotesk para la interfaz e IBM Plex Mono para valores, fórmulas y unidades. Texto general de 16 px, secundario de 14 px y controles táctiles de al menos 44 × 44 px.
- Aplicar una escala de espaciado de 4, 8, 12, 16, 24 y 32 px. Reducir sombras y tarjetas anidadas; reservar elevación para elementos superpuestos.
- Compactar encabezado y navegación. Mantener cinco destinos claros: **Práctica libre, Por temas, Parcial, Progreso e Historial**. El historial tendrá vista propia, en lugar de aparecer al pie de otra pantalla.
- Incorporar una ayuda accesible con atajos, selección, zoom, reglas de entrega y significado de puntos y rachas. Sin tutorial obligatorio.
- Unificar textos en español y voseo. Los controles deshabilitados tendrán una explicación visible cuando el motivo no sea evidente.

## 2. Mesa de trabajo, configuración y aprendizaje

### Circuito y controles

- En escritorio, usar una zona principal flexible y un panel lateral de componentes de 280–320 px, plegable. En tablet y móvil, disponer la lista debajo del circuito mediante un desplegable.
- Incorporar **modo concentración**, independiente de pantalla completa: ocultar navegación secundaria y métricas accesorias, conservando circuito, selección, acciones y salida visible.
- Mantener pasos y errores junto al ejercicio; agrupar puntos y racha en un indicador compacto. Trasladar información secundaria, como la semilla, a detalles del ejercicio.
- En móvil, situar Serie, Paralelo y selección en una barra inferior persistente. Reservar espacio para ella y respetar áreas seguras; no superponerla a fórmulas, resultados ni al teclado virtual.
- Mantener sincronización bidireccional entre SVG y lista. Distinguir selección, foco y equivalente mediante contorno, forma y texto, además del color.
- Conservar zoom, ajuste y desplazamiento. No reajustar la vista al seleccionar; ajustar al iniciar otro circuito o cuando el usuario lo solicite.
- Mantener etiquetas legibles y objetivos táctiles amplios. Cuando el dibujo sea demasiado denso, explicar qué información está disponible en la lista y al ampliar.

### Configuración y continuidad

- Separar **Ejercicio**, **Representación y cálculo** y **Apariencia**.
- Aplicar tema, símbolos y flujo inmediatamente, sin reiniciar el circuito.
- Editar las opciones que regeneran el ejercicio como un borrador y aplicarlas juntas mediante **Aplicar y comenzar**. Cancelar conserva la sesión original.
- Proteger el abandono al crear otro circuito, iniciar un tema, repetir o cambiar de modalidad si existen intentos o un cálculo pendiente. Mostrar un diálogo con **Continuar practicando** y **Abandonar y continuar**.
- Cambiar a Progreso o Historial no debe abandonar la práctica. Durante un parcial, mantener el temporizador y ofrecer un retorno claro al ejercicio activo.
- Evitar registros duplicados de abandono o entrega.

### Cálculo y devoluciones

- Ordenar el flujo visual: **seleccionar → elegir operación → ingresar valor si corresponde → revisar → entregar**.
- Mostrar componentes seleccionados, operación y unidad junto al campo de respuesta. Conservar el texto ingresado ante errores y asociar el mensaje al campo.
- Diferenciar formato inválido, valor incorrecto y conexión inválida, respetando las reglas actuales de penalización.
- Mostrar explicaciones conceptuales y fórmulas bajo demanda durante entrenamiento; mantenerlas ocultas durante el parcial.
- Al completar, presentar equivalente, errores y desglose de puntos, con una acción principal inequívoca para entregar o continuar.
- Conservar las animaciones existentes, sin bloquear acciones ni reproducir recompensas al recargar. Respetar cambios de movimiento reducido en tiempo real.

## 3. Temas, parciales, progreso e historial

| Área | Refinamiento previsto |
|---|---|
| **Por temas** | Agrupar por Resistencias, Capacitores e Inductores, con accesos Serie/Paralelo. Mantener los seis temas y mostrar el ciclo Mini 1 → Mini 2 → Circuito completo. |
| **Inductores** | Conservar Puras/Mixtas como elección manual y ambos símbolos. Explicar brevemente el supuesto de inductores ideales sin acoplamiento ni transitorios. |
| **Miniejercicios** | Destacar componentes y nodos relevantes, separar pregunta y explicación, y colocar la siguiente acción junto a la respuesta. No adelantar la solución. |
| **Parcial** | Separar preparación, ejecución y revisión. Mostrar antes de comenzar cantidad, dificultad, tipo y duración; durante la sesión, ejercicio actual y tiempo restante. |
| **Cierre del parcial** | Sustituir la confirmación nativa por un diálogo accesible con el efecto de finalizar. Mantener entrega única, vencimiento y recuperación tras recarga. |
| **Progreso** | Priorizar circuitos entregados y actividad por tema. Agrupar puntos y rachas como información secundaria; conservar la distinción entre minis, circuitos, práctica libre y repeticiones. |
| **Historial** | Incorporar filtros por componente, modalidad y estado. Mostrar primero los últimos registros, en páginas de 20, sin eliminar datos. |
| **Revisión** | Separar resumen, intentos y reproducción gráfica. Mantener pasos anterior/siguiente, fórmula del paso y repetición sin puntos. Informar si un registro no permite reconstrucción segura. |

No se convertirán puntos o porcentajes en una supuesta medida de dominio. Los estados vacíos explicarán qué actividad falta y ofrecerán una acción directa para practicar.

## 4. Implementación y compatibilidad

Ejecutar en este orden, cerrando cada etapa con pruebas focalizadas:

1. **Referencia inicial:** clasificar las diferencias visuales actuales y registrar capturas reproducibles de las cinco áreas, ambos temas y pantallas pequeñas.
2. **Base visual y navegación:** consolidar tokens, controles compartidos, navegación e historial independiente.
3. **Mesa y configuración:** implementar distribución adaptable, concentración, panel plegable y aplicación conjunta de ajustes.
4. **Flujos de aprendizaje:** refinar cálculo, devoluciones, temas y parcial.
5. **Seguimiento:** completar progreso, filtros y revisión del historial.
6. **Cierre integral:** regresión, accesibilidad, rendimiento, launcher y documentación.

Separar de `App.jsx` la navegación, la mesa y los diálogos conforme se modifiquen; mantener `sessionReducer` como autoridad sobre ejercicio, intentos y recompensas.

**Contratos e interfaces:**

- Conservar contratos de ejercicios, semillas, valores exactos, topología, historial y recompensas; no introducir APIs remotas.
- Añadir un borrador de configuración en la interfaz y enviar una única actualización al reducer al confirmar.
- Mantener concentración, filtros y paneles como estado de presentación, fuera del historial eléctrico.
- Conservar compatibilidad con sesiones versión 2. Cualquier preferencia nueva persistida será opcional y tendrá un valor predeterminado seguro.
- Mantener operativos los adaptadores anteriores; no eliminar renderizadores o APIs sin comprobar sus consumidores.

Actualizar README, contexto técnico y documentación de animaciones para reflejar R/C/L, los flujos finales y la cobertura realmente ejecutada.

## 5. Pruebas y criterios de cierre

- **Lógica:** verificar R/C/L, tres dificultades, valores numéricos y simbólicos, cálculo manual, interruptores, cables y conexiones puras/mixtas de inductores.
- **Continuidad:** comprobar aplicar/cancelar configuración, abandono, navegación sin pérdida, recarga durante cálculo y parcial, almacenamiento bloqueado o corrupto.
- **Recompensas:** comprobar que deshacer, rehacer, recargar, entregar repetidamente y repetir desde historial no duplican puntos ni alteran indebidamente las rachas.
- **Interacción:** completar recorridos mediante teclado y tacto; verificar foco al cerrar diálogos, salir de concentración y volver al circuito.
- **Visual:** revisar 360 y 390 px de ancho, móvil horizontal, tablet, escritorio y ultrawide; ambos temas, zoom del navegador al 200 %, errores, selección, cálculo y resultado.
- **Accesibilidad:** ausencia de desbordamiento horizontal de la página, controles alcanzables, contraste suficiente, anuncios sin duplicación y movimiento reducido.
- **Regresión:** ejecutar lint, build, unitarias, generación, estrés, E2E, visuales, accesibilidad, Lighthouse y launcher. Reintentar Firefox y documentar cualquier bloqueo del entorno.
- **Rendimiento:** mantener los umbrales existentes de Lighthouse: rendimiento ≥85 y accesibilidad ≥95.
- **Capturas:** revisar cada diferencia antes de aceptar una nueva referencia; no actualizar baselines masivamente para ocultar fallos.

**Cierre:** todas las áreas deben tener recorrido funcional y revisión visual documentados, sin pérdida de datos ni regresiones reproducibles pendientes. Diferenciar pruebas emuladas de comprobaciones en dispositivos físicos.

**Supuestos elegidos:** refinamiento sobre la aplicación existente, sin backend, cuentas, sincronización, nuevos tipos de circuitos, solucionador automático ni Delta‑Estrella. Conservar datos y funcionalidades útiles; no incluir commit ni push dentro de este trabajo.
