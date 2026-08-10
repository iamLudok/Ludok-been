module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // Tiene que ir el último del array (lo exige react-native-worklets).
    plugins: ['react-native-worklets/plugin'],
  }
}
