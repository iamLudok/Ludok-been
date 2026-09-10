/**
 * Subida de copias a un Nextcloud propio por WebDAV.
 *
 * Sin dependencias: WebDAV sobre HTTP es `PUT` para subir y `MKCOL` para crear
 * carpeta, y eso `fetch` ya lo hace. La autenticación es Basic con una
 * contraseña de aplicación de Nextcloud (no la del usuario: se puede revocar
 * desde Nextcloud sin cambiar nada más).
 */

export interface NextcloudConfig {
  /** Base del servidor, p. ej. https://cloud.example.com */
  url: string
  user: string
  /** Contraseña de aplicación de Nextcloud. */
  password: string
  /** Carpeta destino dentro de tus ficheros. */
  folder: string
}

/**
 * Base64 sin dependencias: el motor de React Native no trae `btoa` de forma
 * fiable, y esto solo se usa para la cabecera de autenticación.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64(input: string): string {
  // Se codifica a UTF-8 primero: una contraseña con acentos daría bytes >255.
  const bytes: number[] = []
  for (const ch of unescape(encodeURIComponent(input))) bytes.push(ch.charCodeAt(0))

  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    out += B64[b0 >> 2]
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]
    out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]
    out += b2 === undefined ? '=' : B64[b2 & 63]
  }
  return out
}

/** Quita barras sobrantes para poder pegar trozos de ruta sin duplicarlas. */
function trim(part: string): string {
  return part.replace(/^\/+|\/+$/g, '')
}

function authHeader(config: NextcloudConfig): string {
  return 'Basic ' + base64(`${config.user}:${config.password}`)
}

/** Raíz WebDAV de los ficheros del usuario. */
function davRoot(config: NextcloudConfig): string {
  return `${trim(config.url)}/remote.php/dav/files/${encodeURIComponent(config.user)}`
}

/** URL completa de un fichero dentro de la carpeta configurada. */
function fileUrl(config: NextcloudConfig, filename: string): string {
  const folder = trim(config.folder)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  const base = davRoot(config)
  return folder ? `${base}/${folder}/${encodeURIComponent(filename)}` : `${base}/${encodeURIComponent(filename)}`
}

/** Traduce los códigos de WebDAV a algo que se entienda sin saber qué es WebDAV. */
function describe(status: number): string {
  if (status === 401) return 'Usuario o contraseña incorrectos.'
  if (status === 403) return 'Sin permiso para escribir en esa carpeta.'
  if (status === 404) return 'No se encuentra esa ruta. Revisa la dirección del servidor.'
  if (status === 507) return 'No queda espacio en el servidor.'
  return `El servidor respondió ${status}.`
}

/**
 * Da un mensaje útil cuando `fetch` ni siquiera llega. El caso típico en un
 * servidor casero es un certificado que el móvil no acepta.
 */
function describeNetworkError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/certificate|SSL|trust anchor|CERT/i.test(msg)) {
    return 'El móvil no acepta el certificado del servidor. Prueba con http:// o pon un certificado válido.'
  }
  return `No se pudo conectar: ${msg}. Comprueba que estás en la misma red que el servidor.`
}

/** Crea la carpeta destino si no existe. No falla si ya estaba. */
async function ensureFolder(config: NextcloudConfig): Promise<void> {
  const parts = trim(config.folder).split('/').filter(Boolean)
  let path = davRoot(config)
  for (const part of parts) {
    path += '/' + encodeURIComponent(part)
    const res = await fetch(path, {
      method: 'MKCOL',
      headers: { Authorization: authHeader(config) },
    })
    // 201 creada · 405 ya existía · 301/302 el servidor redirige y ya está
    if (res.status !== 201 && res.status !== 405 && res.status < 300) {
      throw new Error(describe(res.status))
    }
  }
}

/** Comprueba que las credenciales y la ruta funcionan, sin subir nada. */
export async function testConnection(config: NextcloudConfig): Promise<void> {
  try {
    const res = await fetch(davRoot(config), {
      method: 'PROPFIND',
      headers: { Authorization: authHeader(config), Depth: '0' },
    })
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new Error(describe(res.status))
    }
    if (!res.ok && res.status !== 207) throw new Error(describe(res.status))
  } catch (e) {
    if (e instanceof Error && !/^(Usuario|Sin permiso|No se encuentra|El servidor)/.test(e.message)) {
      throw new Error(describeNetworkError(e))
    }
    throw e
  }
}

/** Sube (o reemplaza) un fichero en la carpeta configurada. */
export async function uploadFile(
  config: NextcloudConfig,
  filename: string,
  content: string,
): Promise<void> {
  try {
    await ensureFolder(config)
    const res = await fetch(fileUrl(config, filename), {
      method: 'PUT',
      headers: {
        Authorization: authHeader(config),
        'Content-Type': 'application/json',
      },
      body: content,
    })
    // 201 creado · 204 reemplazado
    if (!res.ok && res.status !== 201 && res.status !== 204) {
      throw new Error(describe(res.status))
    }
  } catch (e) {
    if (e instanceof Error && !/^(Usuario|Sin permiso|No se encuentra|No queda|El servidor)/.test(e.message)) {
      throw new Error(describeNetworkError(e))
    }
    throw e
  }
}

/** Config completa, o null si falta algo. */
export function configFrom(settings: {
  nextcloudUrl?: string
  nextcloudUser?: string
  nextcloudPassword?: string
  nextcloudFolder?: string
}): NextcloudConfig | null {
  const url = settings.nextcloudUrl?.trim()
  const user = settings.nextcloudUser?.trim()
  const password = settings.nextcloudPassword
  if (!url || !user || !password) return null
  return { url, user, password, folder: settings.nextcloudFolder?.trim() || 'Ludok Been' }
}
