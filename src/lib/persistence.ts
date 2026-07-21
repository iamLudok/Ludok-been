// Pide al navegador que NO desaloje el almacenamiento (evita perder datos al
// actualizar el móvil o liberar espacio). Es la primera línea de defensa.

export async function requestPersistentStorage(): Promise<boolean> {
  if (!('storage' in navigator) || !navigator.storage.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!('storage' in navigator) || !navigator.storage.persisted) return false
  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}
