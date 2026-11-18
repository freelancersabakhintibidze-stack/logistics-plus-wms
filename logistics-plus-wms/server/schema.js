const { getPool } = require('./db');
const { quoteId } = require('./sql-utils');

// Candidate identifiers are hypotheses only. Discovery decides which object is
// actually used, and every identifier is quoted after it comes from sys metadata.
const ALIASES = {
  products: ['products', 'product', 'items', 'item', 'skus', 'sku', 'catalog'],
  categories: ['categories', 'category', 'productcategories', 'productcategory'],
  inventory: ['stock', 'stocks', 'inventory', 'inventories', 'warehouseinventory',
    'warehousestock', 'stockbalances', 'stockbalance'],
  warehouses: ['warehouses', 'warehouse', 'locations', 'location', 'sites', 'site'],
  orders: ['orders', 'order', 'salesorders', 'salesorder', 'customerorders'],
  orderItems: ['orderitems', 'orderitem', 'orderdetails', 'orderdetail',
    'salesorderlines', 'orderlines', 'orderline'],
  customers: ['customers', 'customer', 'accounts', 'account', 'clients', 'client'],
  shipments: ['shipments', 'shipment', 'deliveries', 'delivery']
};

const FIELD_ALIASES = {
  id: ['id', 'productid', 'itemid', 'skuid', 'orderid', 'customerid', 'warehouseid', 'stockid', 'inventoryid'],
  sku: ['sku', 'skucode', 'productcode', 'itemcode', 'code'],
  name: ['name', 'title', 'productname', 'itemname'],
  categoryId: ['categoryid', 'productcategoryid'],
  categoryName: ['categoryname', 'name'],
  price: ['unitprice', 'price', 'saleprice', 'listprice'],
  active: ['isactive', 'active', 'enabled'],
  qty: ['quantity', 'qty', 'onhand', 'onhandquantity', 'stockquantity', 'unitsinstock', 'availablequantity'],
  reserved: ['reserved', 'reservedquantity', 'allocatedquantity'],
  orderNo: ['ordernumber', 'orderno', 'ordercode', 'number'],
  customerId: ['customerid', 'accountid', 'clientid'],
  customerName: ['customername', 'companyname', 'name'],
  status: ['status', 'orderstatus', 'state'],
  created: ['createdat', 'createddate', 'orderdate', 'createdon', 'datecreated'],
  total: ['totalamount', 'ordertotal', 'grandtotal', 'total'],
  productId: ['productid', 'itemid', 'skuid'],
  warehouseId: ['warehouseid', 'locationid', 'siteid'],
  warehouseName: ['warehousename', 'locationname', 'name'],
  orderFk: ['orderid', 'salesorderid', 'orderheaderid'],
  unitPrice: ['unitprice', 'price'],
  quantity: ['quantity', 'qty'],
  tracking: ['trackingnumber', 'trackingno', 'trackingcode']
};

function normalize(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
}

let cachedSchema = null;

async function discoverSchema(force = false) {
  if (cachedSchema && !force) return cachedSchema;

  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
    ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;`);

  const byTable = new Map();
  for (const row of result.recordset) {
    const key = row.TABLE_SCHEMA + '.' + row.TABLE_NAME;
    if (!byTable.has(key)) {
      byTable.set(key, { schema: row.TABLE_SCHEMA, name: row.TABLE_NAME, columns: [] });
    }
    byTable.get(key).columns.push({
      name: row.COLUMN_NAME,
      type: String(row.DATA_TYPE).toLowerCase(),
      nullable: row.IS_NULLABLE === 'YES',
      ordinal: row.ORDINAL_POSITION
    });
  }

  const tables = [...byTable.values()];
  const preferredSchema = (process.env.DB_SCHEMA || 'dbo').toLowerCase();
  const entities = {};

  for (const [entity, aliases] of Object.entries(ALIASES)) {
    const matches = tables.filter(table => aliases.includes(normalize(table.name)));
    matches.sort((a, b) => {
      const preferA = a.schema.toLowerCase() === preferredSchema ? 0 : 1;
      const preferB = b.schema.toLowerCase() === preferredSchema ? 0 : 1;
      return preferA - preferB || a.name.localeCompare(b.name);
    });
    entities[entity] = matches.length ? matches[0] : null;
    // Record ambiguity explicitly instead of silently trusting the first candidate.
    if (matches.length > 1) {
      entities[entity].ambiguousWith = matches.slice(1).map(m => m.schema + '.' + m.name);
    }
  }

  cachedSchema = { tables, entities, discoveredAt: new Date().toISOString() };
  return cachedSchema;
}

function pick(table, aliases) {
  if (!table) return null;
  const columns = new Map(table.columns.map(column => [normalize(column.name), column]));
  for (const candidate of aliases) {
    const found = columns.get(normalize(candidate));
    if (found) return found;
  }
  return null;
}

function field(table, key) {
  if (key === 'id' && table) {
    const tableName = normalize(table.name);
    if (['order', 'salesorder', 'customerorder'].includes(tableName)) {
      return pick(table, ['orderid', 'salesorderid', 'customerorderid', 'id']);
    }
    if (['product', 'item', 'sku', 'catalog'].includes(tableName)) {
      return pick(table, ['productid', 'itemid', 'skuid', 'id']);
    }
    if (['warehouse', 'location', 'site'].includes(tableName)) {
      return pick(table, ['warehouseid', 'locationid', 'siteid', 'id']);
    }
    if (['customer', 'account', 'client'].includes(tableName)) {
      return pick(table, ['customerid', 'accountid', 'clientid', 'id']);
    }
    if (['stock', 'inventory', 'warehousestock', 'warehouseinventory'].includes(tableName)) {
      return pick(table, ['stockid', 'inventoryid', 'id']);
    }
  }
  return pick(table, FIELD_ALIASES[key] || [key]);
}

function qualified(alias, column, fallback = 'NULL') {
  return column ? alias + '.' + quoteId(column.name) : fallback;
}

function optionalEntity(schema, key) {
  const table = schema.entities[key];
  if (table && table.ambiguousWith && table.ambiguousWith.length) {
    const err = new Error('Multiple existing tables could map to entity \"' + key +
      '\" (' + [table.schema + '.' + table.name, ...table.ambiguousWith].join(', ') +
      '). Pin the approved identifier before using this endpoint.');
    err.code = 'SCHEMA_MAPPING_AMBIGUOUS';
    throw err;
  }
  return table;
}

function requireEntity(schema, key) {
  const table = schema.entities[key];
  if (!table) {
    const err = new Error('No existing table was recognized for entity \"' + key +
      '\". Review schema discovery and configure the production identifier explicitly.');
    err.code = 'SCHEMA_MAPPING_UNAVAILABLE';
    throw err;
  }
  if (table.ambiguousWith && table.ambiguousWith.length) {
    const err = new Error('Multiple existing tables could map to entity \"' + key +
      '\" (' + [table.schema + '.' + table.name, ...table.ambiguousWith].join(', ') +
      '). Pin the approved identifier before using this endpoint.');
    err.code = 'SCHEMA_MAPPING_AMBIGUOUS';
    throw err;
  }
  return table;
}

module.exports = {
  discoverSchema, pick, field, qualified, requireEntity, optionalEntity,
  ALIASES, FIELD_ALIASES, normalize
};
