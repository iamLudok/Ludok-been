import Svg, { Path } from 'react-native-svg'
import { isKnownTransport, type TransportKey } from '../lib/transports'

/**
 * Siluetas dibujadas a mano en un lienzo de 24×24. Son vectores monocromos y
 * no emojis a propósito: en «Sala oscura» el color solo aparece cuando
 * significa algo, y un emoji a color rompería justo eso.
 */
const PATHS: Record<TransportKey, string> = {
  plane:
    'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z',
  train:
    'M12 2c-4 0-8 .5-8 4v9.5A3.5 3.5 0 0 0 7.5 19L6 20.5v.5h12v-.5L16.5 19a3.5 3.5 0 0 0 3.5-3.5V6c0-3.5-3.6-4-8-4zM7.5 17A1.5 1.5 0 1 1 9 15.5 1.5 1.5 0 0 1 7.5 17zM11 10H6V6h5v4zm2 0V6h5v4h-5zm3.5 7a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5z',
  car:
    'M18.92 6.01A1.5 1.5 0 0 0 17.5 5h-11a1.5 1.5 0 0 0-1.42 1.01L3 12v8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-8l-2.08-5.99zM6.5 16A1.5 1.5 0 1 1 8 14.5 1.5 1.5 0 0 1 6.5 16zm11 0a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',
  bus:
    'M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.6-4-8-4S4 2.5 4 6v10zm3.5 1A1.5 1.5 0 1 1 9 15.5 1.5 1.5 0 0 1 7.5 17zm9 0a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5zM18 11H6V6h12v5z',
  boat:
    'M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99a8.8 8.8 0 0 0 8 0c1.26.64 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68a1 1 0 0 0-.66-1.28L20 10.62V6a2 2 0 0 0-2-2h-3V1H9v3H6a2 2 0 0 0-2 2v4.62l-1.29.42a1 1 0 0 0-.66 1.28L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z',
  moto:
    'M19.44 9.03L15.41 5H11v2h3.59l2 2H5a5 5 0 1 0 4.9 6h1.65l2.77-2.77c-.21.54-.32 1.14-.32 1.77a5 5 0 1 0 5.44-4.97zM7.82 15A3 3 0 1 1 5 11a3 3 0 0 1 2.82 2H5v2h2.82zM19 17a3 3 0 1 1 3-3 3 3 0 0 1-3 3z',
  bike:
    'M15.5 5.5a2 2 0 1 0-2-2 2 2 0 0 0 2 2zM5 12a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8.5A3.5 3.5 0 1 1 8.5 17 3.5 3.5 0 0 1 5 20.5zm5.8-10l2.4-2.4.8.8a5.35 5.35 0 0 0 3.5 1.6V8.8a3.72 3.72 0 0 1-2.4-1.1l-1.9-1.9a1.9 1.9 0 0 0-1.3-.5 1.9 1.9 0 0 0-1.4.5L7.8 8.2a1.9 1.9 0 0 0-.5 1.3 1.9 1.9 0 0 0 .5 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8.5a3.5 3.5 0 1 1 3.5-3.5 3.5 3.5 0 0 1-3.5 3.5z',
  walk:
    'M13.5 5.5a2 2 0 1 0-2-2 2 2 0 0 0 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5.2 5.2 0 0 1-4.4-2.5l-1-1.6a1.9 1.9 0 0 0-1.6-1c-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z',
}

/** Para los transportes escritos a mano: tres puntos, «algún otro». */
const OTHER =
  'M6 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z'

export function TransportIcon({
  value,
  color,
  size = 16,
}: {
  value: string
  color: string
  size?: number
}) {
  const d = isKnownTransport(value) ? PATHS[value] : OTHER
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} fill={color} />
    </Svg>
  )
}
