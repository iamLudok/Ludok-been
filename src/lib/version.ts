/**
 * Versión del formato de datos (esquema local Y copias de seguridad).
 *
 * v1 → v2: ajustes de Nextcloud y medios de transporte por país. Los dos son
 * campos añadidos: una copia v1 se sigue importando sin problema.
 *
 * v2 → v3: logros ya vistos (`seenAchievements` en los ajustes). Campo
 * añadido: las copias v1 y v2 se siguen importando. Se sube la versión para
 * que una app vieja rechace con aviso una copia nueva, en vez de importarla
 * perdiendo en silencio lo que no entiende.
 *
 * v3 → v4: tu país (`homeCode` en los ajustes), para los extremos. Campo
 * añadido, mismo motivo para subir la versión.
 */
export const SCHEMA_VERSION = 4
