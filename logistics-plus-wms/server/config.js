function envBool(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function dbConfig() {
  const required = ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    const err = new Error('Missing database configuration: ' + missing.join(', '));
    err.code = 'DB_CONFIG_MISSING';
    throw err;
  }
  return {
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: envBool('DB_ENCRYPT', true),
      trustServerCertificate: envBool('DB_TRUST_SERVER_CERTIFICATE', false),
      enableArithAbort: true
    },
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15000),
    requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT_MS || 20000),
    pool: { max: Number(process.env.DB_POOL_MAX || 10), min: 0, idleTimeoutMillis: 30000 }
  };
}

module.exports = { dbConfig, envBool };
