#!/usr/bin/env bash
# Compila el APK de release, firmado con tu keystore propio.
#
#   ./scripts/build-apk.sh              todas las arquitecturas
#   ./scripts/build-apk.sh --compartir  solo arm64-v8a, para mandar a gente
#
# Se usa el mecanismo de "firma inyectada" de Gradle en vez de tocar
# android/app/build.gradle porque `expo prebuild` regenera esa carpeta entera y
# se llevaría por delante cualquier cambio hecho a mano ahí. Por lo mismo, la
# arquitectura se pasa como propiedad y no editando gradle.properties.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f keystore.properties ]; then
  echo "Falta keystore.properties. Recupéralo de tus copias de seguridad." >&2
  exit 1
fi

# shellcheck disable=SC1091
source <(grep -E '^(storeFile|storePassword|keyAlias|keyPassword)=' keystore.properties)

export JAVA_HOME="${JAVA_HOME:-$HOME/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$PATH"

# arm64-v8a cubre cualquier móvil de los últimos ~10 años. Las variantes x86
# solo sirven para emuladores: en un APK que se reparte a gente son peso muerto.
ARCHS=""
if [ "${1:-}" = "--compartir" ]; then
  ARCHS="-PreactNativeArchitectures=arm64-v8a"
  echo "Compilando solo para arm64-v8a (para repartir)."
fi

[ -d android ] || npx expo prebuild --platform android --no-install

cd android
# shellcheck disable=SC2086
./gradlew assembleRelease --no-daemon $ARCHS \
  -Pandroid.injected.signing.store.file="$(cd .. && pwd)/$storeFile" \
  -Pandroid.injected.signing.store.password="$storePassword" \
  -Pandroid.injected.signing.key.alias="$keyAlias" \
  -Pandroid.injected.signing.key.password="$keyPassword"

APK="app/build/outputs/apk/release/app-release.apk"
echo
echo "APK listo: android/$APK"
ls -lh "$APK"
