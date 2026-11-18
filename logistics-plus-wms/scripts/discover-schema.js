// Read-only schema discovery CLI. Prints candidate mappings for review; it never
// alters the database and never writes metadata to disk.
const { discoverSchema } = require('../server/schema');
const { field } = require('../server/schema');

(async () => {
  try {
    const schema = await discoverSchema(true);
    const summary = {
      discoveredAt: schema.discoveredAt,
      preferredSchema: process.env.DB_SCHEMA || 'dbo',
      entities: Object.fromEntries(Object.entries(schema.entities).map(([key, table]) => [
        key,
        table
          ? {
            resolved: table.schema + '.' + table.name,
            ambiguousWith: table.ambiguousWith || [],
            mappedFields: {
              sku: field(table, 'sku'),
              name: field(table, 'name'),
              quantity: field(table, 'qty'),
              status: field(table, 'status')
            }
          }
          : null
      ])),
      tables: schema.tables.map(table => ({
        table: table.schema + '.' + table.name,
        columns: table.columns.map(column => column.name + ' : ' + column.type + (column.nullable ? ' NULL' : ' NOT NULL'))
      }))
    };
    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error('Schema discovery failed: ' + err.message);
    process.exitCode = 1;
  }
})();
