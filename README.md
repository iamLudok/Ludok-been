# Ludok Been

App personal para apuntar los países en los que has estado, tipo [been](https://been.app),
pero **gratis, sin cuentas y local-first**. App Android nativa (Expo/React Native): los
datos viven en el almacenamiento privado de la app (`/data/data/com.ludok.been/`) y solo
desaparecen si desinstalas — no hace falta pedirle permiso al navegador ni nada parecido.

- 🗺️ **Mapa mundial** interactivo: toca un país para marcarlo, pellizca para hacer zoom,
  arrastra para moverte.
- 📋 **Lista** con buscador, agrupada por continente.
- 📊 **Estadísticas**: % del mundo visitado y desglose por continente.
- ✅ Dos estados por país: **Visitado** y **Quiero ir**, con año opcional.
- 📸 **Imagen para compartir** (mapa + tu %) generada en el propio móvil.
- 💾 **Copia de seguridad** export/import en JSON, con aviso de "días sin copia".

## Por qué nativa

Antes fue una PWA (Vite + React + IndexedDB). Pasar a nativo da tacto real del sistema
(scroll, gestos) y almacenamiento que no depende de que el navegador decida no borrarlo.

## Arranque

```bash
npm install
npm run android      # compila e instala en un dispositivo/emulador conectado
npm run typecheck     # tsc sobre src/ y verify/
npm run verify        # capa de datos + reglas de negocio, en Node (sin dispositivo)
```

## Primer uso y copias de seguridad

La app arranca vacía. En **Ajustes** puedes **Exportar** una copia (JSON, se abre el menú
de compartir para mandarla a Archivos/Nextcloud/Drive) e **Importar** para restaurarla
(reemplaza los datos actuales). Si llevas varios días sin copia, un aviso te lo recuerda.

## Verificación de la capa de datos

Antes de tocar nada de interfaz, la lógica de negocio se prueba en Node contra un SQLite
de escritorio (mismo motor async que `expo-sqlite`, vía `@libsql/client`):

```bash
npm run verify:data       # ida y vuelta del backup (export/import)
npm run verify:library    # setStatus/setYear/clearStatus/computeStats
npm run verify:migration  # el esquema se crea de forma idempotente
```

## Estructura

```
app/                  rutas (expo-router)
  (tabs)/              Mapa · Lista · Stats · Ajustes
src/
  lib/                  esquema, base de datos, backup, mapa, países
  hooks/                useSettings, useVisits (useLiveQuery reactivo)
  ui/                    tema (paleta dark/light) y tokens de diseño
  components/            WorldMap, CountrySheet, BackupBanner, StatsShareCard
verify/                scripts Node, no se empaquetan en la app
scripts/build-apk.sh   compila y firma el release
```

## Datos de países

`src/data/countries.json` se genera a partir del paquete `world-countries`:

```bash
npm run gen:countries
```

El fichero está versionado en el repo; en tiempo de ejecución no se depende de `world-countries`.

## Compilar un APK

```bash
npm run build:apk
```

Necesita `keystore.properties` + una keystore `.jks` propias (gitignored, no se versionan).
**Guarda la keystore a buen recaudo**: si se pierde, ya no se puede actualizar la app
in-place — solo desinstalar (lo que borra los datos) y volver a instalar de cero.

## Stack

Expo SDK 57 · React Native · Drizzle + expo-sqlite (base de datos) · expo-router (rutas) ·
react-native-svg + react-native-gesture-handler + react-native-reanimated (mapa) ·
react-native-view-shot (imagen para compartir) · d3-geo + topojson-client + world-atlas
(geometría del mapa).
