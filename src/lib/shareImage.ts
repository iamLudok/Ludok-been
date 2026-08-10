import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import type { RefObject } from 'react'
import type { View } from 'react-native'

/** Captura la tarjeta de estadísticas (renderizada fuera de pantalla) y la comparte como PNG. */
export async function shareStatsImage(ref: RefObject<View | null>): Promise<void> {
  if (!ref.current) return
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' })
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Mi mapa de Ludok Been' })
  }
}
