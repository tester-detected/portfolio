// Config for running on the test server (Docker or directly)

const { defineConfig } = require('cypress');
const defaultConfig = require('./cypress.config');

module.exports = defineConfig({
  ...defaultConfig,
  e2e: {
    ...defaultConfig.e2e,
    baseUrl: 'https://your-server-ip:443/',
  },
});
