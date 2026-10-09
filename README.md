# Beast Log

PWA en español para registrar entrenamientos y peso corporal desde móvil y ordenador.

## Primera versión

- Rutinas A/B/C/Brazos basadas en los objetivos del bloque 7; sesiones nuevas con resultados vacíos.
- Siguiente sesión preparada automáticamente: A → B → C → Brazos → A de la siguiente semana. Una sesión abierta se retoma sin avanzar; el bloque se cambia manualmente.
- Registro de carga, repeticiones, RIR exacto o intervalo, intento fallido y parciales.
- Resultados comunes o separados por lado, series extra, notas y equipo.
- Guardado automático en IndexedDB; terminar una sesión no rellena las series pendientes con cero.
- Historial editable, peso corporal diario y media de los registros de la última ventana de siete días.
- Exportación JSON y restauración validada con copia previa.
- Manifest y service worker de producción para uso sin conexión tras la primera carga.

La sincronización privada por internet, la importación revisable del histórico, las estadísticas por ejercicio, los clusters y los dropsets aún no están implementados. Los TXT originales están en `docs/sources`; no se sirven ni se importan automáticamente. No se han inventado fechas para el histórico.

## Desarrollo

Requiere Node.js 22.12 o posterior; validado con Node 24.19.0. Usa el checkout existente; cada tarea de nube ya está aislada y no necesita un worktree adicional.

```bash
cd /workspace/appCodex
npm ci --cache /tmp/beast-npm-cache --no-audit --no-fund
npm run dev
```

La caché en `/tmp` evita depender de permisos de escritura en el directorio personal. En otra máquina puedes omitir `--cache`. No se requieren cuentas, servicios externos ni secretos para esta versión.

## Compilación y pruebas

```bash
npm run build
npm test
```

Las pruebas utilizan Chromium en `/usr/bin/chromium` en este entorno. En otra máquina configura `CHROMIUM_PATH` con la ruta a tu Chromium, o adapta `playwright.config.ts` para usar el navegador instalado por Playwright. Se prueban los flujos reales en tamaños de escritorio y móvil: validación de series, lados, persistencia, peso corporal, exportación/restauración y guardado con red desactivada.

```bash
npm run preview
```

`preview` sirve la compilación en el puerto 4173; es el modo utilizado para verificar el service worker. El modo de desarrollo no activa la caché PWA.

Para utilizarla en un teléfono debe alojarse la carpeta `dist/` bajo HTTPS. `localhost` en el teléfono se refiere al propio teléfono. La aplicación no está desplegada aún y publicar la configuración del entorno de Codex no publica la web.

## Datos y copias

Los datos viven en el navegador y origen que uses. Cambiar de dirección, navegador o dispositivo crea un almacenamiento distinto. La transferencia entre dispositivos en esta versión es mediante exportación/restauración. Exporta una copia antes de borrar los datos del navegador. Usa una sola pestaña para editar el diario: no hay coordinación de ediciones simultáneas entre pestañas todavía.

La carga es numérica y se muestra en kg para registros nuevos. La importación futura conservará las unidades originales (incluidas lbs). Las comparaciones con una sesión previa requieren coincidir en ejercicio, convención de carga y texto de equipo. Identifica la máquina antes de registrar si quieres mantener separados sus resultados.

`docs/CONTEXTO.md` conserva las reglas confirmadas. `docs/MODELO.md` describe el modelo actual y el trabajo pendiente.

## Publicación

Consulta [docs/PUBLICACION.md](docs/PUBLICACION.md) para activar GitHub Pages. El flujo de Actions publica solo la compilación estática, bajo `/appCodex/`. Los originales y documentos personales permanecen únicamente en el entorno local y están excluidos de Git.

### Importar histórico privado

En **Mis datos → Importar histórico**, selecciona juntos los archivos TXT originales de tus bloques, o un JSON con formato `beast-log-history`, versión `1` y una lista `files` de objetos `{name, text}`. Cada texto contiene un bloque con encabezados `Bloque N`, `Semana N`, `Dia A/B/C` o `Brazos`. La importación conserva los originales, añade bloques sin borrar sesiones actuales y evita duplicados. Los bloques con contenido distinto se rechazan sin modificar datos.

El Historial permite filtrar y buscar las anotaciones completas. No se inventan fechas ni sesiones ausentes. El histórico participa en la propuesta del siguiente día y en las estadísticas de las series que se pueden interpretar sin ambigüedad. No precarga cargas automáticamente. Las copias de seguridad incluyen todos los originales. Los archivos personales no se publican ni se incluyen en el repositorio.


### Progreso y calendario

**Progreso** muestra récords de carga con sus repeticiones y RIR, mejores series por peso, gráficos semanales de carga y de repeticiones a carga fija, comparación con las últimas cuatro semanas y constancia en entrenamientos. Los gráficos permiten consultar cada punto. No hay estadística de diferencias entre lados.

La referencia inicial fija es B7/S5 = semana del 5 al 11 de octubre de 2026, según la indicación del usuario. Las fechas históricas son rangos semanales estimados; no se inventa el día de cada sesión. La duración inicial de un bloque es la última semana anotada, incluyendo huecos internos. La referencia y duraciones se pueden corregir en Progreso y viajan en las copias de seguridad. Una visita posterior no desplaza las fechas.

La extracción conserva la fuente y usa únicamente series normales inequívocas. Objetivos, comentarios, clusters y etapas de dropset no se tratan como series normales. Las repeticiones aproximadas y las exclusiones confirmadas no generan récords. Cargas omitidas heredan solo dentro del mismo ejercicio de una sesión. Los valores sin carga se muestran como carga desconocida. No se suman lados ni parciales. Mancuernas, cargas añadidas, unidades y variantes se separan; la vista general reúne todos los bloques manteniendo separadas unidades y convenciones. Las marcas de máquinas desconocidas son provisionales y los cambios de equipo no se conectan en las gráficas. Se puede filtrar un equipo o un bloque concreto. La sección de revisión conserva entradas excluidas y extracciones parciales.

La constancia cuenta días completados únicos por bloque/semana con objetivo A, B, C y Brazos. Conserva semanas vacías y excluye sesiones abiertas. El porcentaje de semanas completas no penaliza la semana actual mientras está en curso.

### Actualizaciones

La app muestra **Actualizar app** cuando una nueva versión está lista. Este botón se habilita después de guardar los cambios locales y conserva IndexedDB. En **Mis datos → Buscar actualización** se puede comprobar manualmente; también se comprueba al regresar a la app y cada hora con conexión. Una instalación de una versión anterior sin este aviso debe cerrar todas las pestañas y ventanas de la app y volver a abrir tras finalizar GitHub Actions. No borrar los datos del sitio para actualizar.

La vista inicial de Progreso es **Todo mi historial**. El selector **Periodo** filtra opcionalmente un bloque y afecta a las marcas, gráficas y constancia. La tabla general presenta una marca por ejercicio, unidad y convención de carga en vez de repetirla por bloque. No se calcula una diferencia de carga entre récord y resultado reciente si corresponden a equipos distintos.


### Importación directa de Excel

En **Mis datos** o **Peso corporal → Importar Excel**, selecciona los originales «Bloque N…xlsx». La vista previa indica pesos nuevos, repetidos y diferentes para la misma fecha. Por defecto conserva los valores existentes; se puede elegir explícitamente un valor del Excel. Cancelar no cambia datos. Volver a importar los mismos archivos no duplica pesajes ni originales.

Solo las filas diarias de las hojas «Datos S1 - S4», «Datos S5 - S8» y «Datos S9 - S12» aportan pesajes. Las medias semanales, pesos iniciales, errores de fórmula y plantillas futuras no se importan como pesajes. Los valores vacíos no se rellenan con cero. Los XLSX se leen en el navegador con `read-excel-file` y se guardan íntegros en IndexedDB, incluidos dietas, rutinas y notas, junto con un SHA-256. Las copias JSON incluyen esos originales. No se publican archivos personales en el repositorio ni se envían a un servicio externo.

Las semanas reales del Excel pueden sustituir el calendario estimado, conservando los huecos. Solo una coincidencia única de bloque/semana/día permite asignar una fecha exacta a una sesión TXT; varias fechas se señalan para revisión. Las rutinas prescritas no generan resultados. Los días de entrenamiento registrados en Excel se reúnen con los TXT y sesiones nuevas por bloque/semana/día para evitar contar dos veces el mismo entrenamiento. Los días extra del Excel sin series se muestran como registros sin resultados en Historial.

El inicio conserva el total de sesiones terminadas y muestra en lugar de series registradas las sesiones terminadas del bloque seleccionado. Se retiraron las tarjetas «En tu diario» y «Un poco mejor. Una vez más.». Queda pendiente diseñar una nueva propuesta motivacional. Las sesiones abiertas se retoman mediante **Empezar entrenamiento**; el avance A → B → C → Brazos sigue vigente.
