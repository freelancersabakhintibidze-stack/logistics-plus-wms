// The SQL driver is loaded lazily so syntax checks, the health route and the
// static documentation build never need a live database connection.
let driver = null;
function sqlLib() {
  if (!driver) driver = require('mssql');
  return driver;
}
const sql = new Proxy({}, {
  get(_target, prop) {
    const lib = sqlLib();
    const value = lib[prop];
    return typeof value === 'function' ? value.bind(lib) : value;
  }
});
let poolPromise = null;
function getPool() {
  const { dbConfig } = require('./config');
  if (!poolPromise) {
    poolPromise = new (sqlLib().ConnectionPool)(dbConfig()).connect().catch(err => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}
module.exports = { sql, sqlLib, getPool };
