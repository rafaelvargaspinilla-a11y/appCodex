# Modelo de la primera versión

`Data.version = 1` agrupa sesiones y peso corporal. La raíz se escribe en una transacción de IndexedDB; las escrituras están serializadas. El mensaje de guardado solo confirma una transacción terminada. Si falla, la interfaz mantiene los datos de la sesión en memoria y ofrece exportarlos.

Una sesión contiene ID UUID, bloque, semana, día, fecha elegida, fecha de creación y estado de finalización. Contiene una copia de los objetivos por ejercicio y serie; modificar la plantilla futura no cambia las sesiones existentes. Para la primera versión hay una sesión por bloque/semana/día: seleccionar una combinación existente la abre.

Cada ejercicio conserva nombre, convención de carga, identificador de equipo, notas, condición unilateral y series. Cada serie contiene ID, objetivo, RIR objetivo, estado registrado, modo de lados y dos resultados. Si no se diferencian lados, el resultado principal corresponde a ambos. Activar lados copia el resultado inicial; ambos pueden editarse después.

Un resultado separa carga, repeticiones completas, RIR (incluidos intervalos), intento fallido y parciales. Carga, repeticiones y parciales pueden ser `null`; RIR vacío significa desconocido. No se confunden campos vacíos con cero. Para marcar una serie hace falta un número entero de repeticiones; modificar sus resultados quita la marca hasta volver a confirmarla. Las series no marcadas no cuentan como resultados en el resumen.

La carga puede precargarse desde una serie registrada de una sesión anterior del mismo ejercicio, convención y equipo. No se precargan repeticiones, RIR, fallo ni parciales. Cambiar equipo evita mostrar comparaciones de otra máquina. Las notas pueden heredarse al crear una sesión.

Peso corporal: ID, fecha local, kg y nota. Guardar otra medición con la misma fecha la actualiza. La media usa únicamente registros presentes entre la última fecha y seis días antes; no rellena días ausentes. Las gráficas usan distancias temporales reales.

Las copias incluyen todos los registros de esta versión. Se validan estructura, fechas, números, IDs y resultados antes de restaurar. Restaurar sustituye el almacenamiento tras descargar una copia del estado actual; la escritura se confirma antes de mostrar éxito.

## Próximas etapas

1. Importación con texto original, referencia a línea, campos aproximados, reglas derivadas y revisión de ambigüedades. No importar un TXT como si fuera JSON de copia.
2. Series con etapas de dropset y tandas de cluster; unidades y cantidades desconocidas de parciales.
3. Estadísticas por ejercicio, variante y máquina, con exclusiones explícitas de datos arrastrados o inciertos.
4. Servidor privado con autenticación, IDs estables, cola de operaciones persistente, reintentos idempotentes y revisiones. Conflictos deben conservar alternativas; no sobrescribir por hora del dispositivo.
5. Coordinación entre pestañas, edición de rutinas y mejoras de instalación/actualización de la PWA.

Ni exportar JSON ni instalar la PWA habilitan sincronización. Los originales de `docs/sources` se conservan fuera de los assets públicos y no se han incorporado como resultados válidos.
