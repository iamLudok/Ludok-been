# Ludok Been

App personal para apuntar los países en los que has estado, tipo [been](https://been.app),
pero **gratis, sin cuentas y local-first**. Es una PWA instalable: los datos viven en tu
dispositivo (IndexedDB) y nunca salen a ningún servidor.

- 🗺️ **Mapa mundial** interactivo: toca un país para marcarlo.
- 📋 **Lista** con buscador, agrupada por continente.
- 📊 **Estadísticas**: % del mundo visitado y desglose por continente.
- ✅ Dos estados por país: **Visitado** y **Quiero ir**, con año opcional.
- 📸 **Imagen para compartir** (mapa + tu %) generada en local.
- 💾 **Copia de seguridad** export/import en JSON, con aviso de "días sin copia".

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm run build      # build de producción (dist/)
npm run preview    # sirve el build (para probar la PWA)
npm run lint       # oxlint
```

Todo funciona **offline**: el mapa (topojson de `world-atlas`) y los metadatos de países van
empaquetados en la app. No hay API externa ni claves.

## Copia de seguridad (importante)

La prioridad del proyecto es **no perder los datos nunca**. Por eso:

1. Al arrancar, la app pide *almacenamiento persistente* al navegador (para que no borre tus datos).
2. En **Ajustes** puedes **Exportar** una copia (JSON). En el móvil se abre el menú de compartir
   para mandarla a Archivos/Nextcloud/Drive; en el PC se descarga.
3. Si llevas muchos días sin copia, un aviso te lo recuerda.
4. Para restaurar, usa **Importar** en Ajustes (reemplaza los datos actuales).

## Datos de países

`src/data/countries.json` se genera a partir del paquete `world-countries`:

```bash
npm run gen:countries
```

El fichero está versionado en el repo; en tiempo de ejecución no se depende de `world-countries`.

## Stack

React 19 · Vite · TypeScript · Dexie (IndexedDB) · react-router-dom · vite-plugin-pwa ·
d3-geo + topojson-client + world-atlas (mapa) · oxlint.
