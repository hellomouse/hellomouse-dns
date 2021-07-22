const yaml = require('yaml');
const fs = require('fs');
// crappy configuration provider

/** Load configuration */
function loadConfig() {
  let configLocation = process.env.DNSD_CONFIG || process.cwd() + '/config.yaml';
  let loadedConfig = {};
  try {
    loadedConfig = yaml.parse(fs.readFileSync(configLocation).toString());
  } catch (err) {
    console.error('Error in configuration:', err);
  }

  module.exports = Object.assign({
    // seems to be a sane value (why would you ever have more than 10 CNAMEs if not intentionally)
    bind: '127.0.0.1:53530',
    maxRedirects: 10,
    debug: true
  }, loadedConfig, {
    reload: () => loadConfig()
  });
}

loadConfig();
