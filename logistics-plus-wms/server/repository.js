const { getPool, sql } = require('./db');
const { discoverSchema, field, pick, qualified, requireEntity, optionalEntity } = require('./schema');
const { quoteId, quoteTable, escapeLike, isNumericType, isDateType, boundedInt } = require('./sql-utils');

// Bind a value with a type derived from the discovered SQL column. Values are
// always parameters; only identifiers discovered from metadata enter SQL text.
function paramType(column) {
  if (column && isNumericType(column.type)) return sql.Decimal(38, 10);
  if (column && column.type === 'uniqueidentifier') return sql.UniqueIdentifier;
  if (column && isDateType(column.type)) return sql.DateTime2;
  return sql.NVarChar(200);
}

function bind(request, name, column, value) {
  request.input(name, paramType(column), value);
}

function whereClause(parts) {
  return parts.length ? ' WHERE ' + parts.join(' AND ') : '';
}

function invalid(message) {
  const err = new Error(message);
  err.code = 'VALIDATION_ERROR';
  return err;
}

function unavailable(message) {
  const err = new Error(message);
  err.code = 'FILTER_UNAVAILABLE';
  return err;
}

function searchPredicate(table, skuColumn, nameColumn, prefix) {
  const terms = [];
  if (skuColumn) terms.push('t.' + quoteId(skuColumn.name) + ' LIKE @' + prefix + " ESCAPE '\\'");
  if (nameColumn) terms.push('t.' + quoteId(nameColumn.name) + ' LIKE @' + prefix + " ESCAPE '\\'");
  return terms.length ? '(' + terms.join(' OR ') + ')' : null;
}

// The pattern is bounded and wildcards are escaped, so user text can only match
// literal content. The value is always a bound parameter.
function applySearch(request, table, skuColumn, nameColumn, prefix, raw) {
  const predicate = searchPredicate(table, skuColumn, nameColumn, prefix);
  if (!predicate) return null;
  request.input(prefix, sql.NVarChar(402), '%' + escapeLike(String(raw).slice(0, 200)) + '%');
  return predicate;
}

async function listProducts(query = {}) {
  const schema = await discoverSchema();
  const table = requireEntity(schema, 'products');
  const sku = field(table, 'sku');
  const name = field(table, 'name');
  const category = field(table, 'categoryId');
  const price = field(table, 'price');
  const active = field(table, 'active');

  if (!sku && !name) {
    const err = new Error('No recognized SKU or product-name column was discovered for the products table.');
    err.code = 'SCHEMA_MAPPING_UNAVAILABLE';
    throw err;
  }

  const page = boundedInt(query.page, 1, 1, 1000000);
  const pageSize = boundedInt(query.pageSize, 20, 1, 100);
  if (page === null || pageSize === null) throw invalid('page must be >= 1 and pageSize must be between 1 and 100.');

  const pool = await getPool();
  const request = pool.request();
  const parts = [];

  if (query.search) {
    const predicate = applySearch(request, table, sku, name, 'search', query.search);
    if (predicate) parts.push(predicate);
  }

  if (query.categoryId !== undefined && query.categoryId !== '') {
    if (!category) throw unavailable('Category filtering is unavailable: no category key was discovered.');
    bind(request, 'categoryId', category, query.categoryId);
    parts.push('t.' + quoteId(category.name) + ' = @categoryId');
  }

  const sortable = { sku, name, price };
  const orderColumn = sortable[query.sort] || sku || name;
  const direction = query.direction === 'desc' ? 'DESC' : 'ASC';
  request.input('offset', sql.Int, (page - 1) * pageSize);
  request.input('take', sql.Int, pageSize);

  const columns = [
    qualified('t', sku) + ' AS sku',
    qualified('t', name) + ' AS name',
    qualified('t', category) + ' AS categoryId',
    qualified('t', price) + ' AS unitPrice',
    qualified('t', active) + ' AS active'
  ].join(', ');

  const ordered = orderColumn ? 't.' + quoteId(orderColumn.name) + ' ' + direction : '(SELECT NULL)';
  const dataQuery = 'SELECT ' + columns + ' FROM ' + quoteTable(table) + ' t' + whereClause(parts) +
    ' ORDER BY ' + ordered + ' OFFSET @offset ROWS FETCH NEXT @take ROWS ONLY;';
  const data = await request.query(dataQuery);

  const countRequest = pool.request();
  const countParts = [];
  if (query.search) {
    const predicate = applySearch(countRequest, table, sku, name, 'search', query.search);
    if (predicate) countParts.push(predicate);
  }
  if (query.categoryId !== undefined && query.categoryId !== '' && category) {
    bind(countRequest, 'categoryId', category, query.categoryId);
    countParts.push('t.' + quoteId(category.name) + ' = @categoryId');
  }
  const countResult = await countRequest.query(
    'SELECT COUNT_BIG(1) AS total FROM ' + quoteTable(table) + ' t' + whereClause(countParts) + ';'
  );
  const total = Number(countResult.recordset[0].total);

  return {
    data: data.recordset,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
  };
}

async function listInventory(query = {}) {
  const schema = await discoverSchema();
  const table = requireEntity(schema, 'inventory');
  const qty = field(table, 'qty');
  const productId = field(table, 'productId');
  const warehouseId = field(table, 'warehouseId');
  const reserved = field(table, 'reserved');

  if (!qty) {
    const err = new Error('No recognized on-hand stock quantity column was discovered for the inventory table.');
    err.code = 'SCHEMA_MAPPING_UNAVAILABLE';
    throw err;
  }

  const products = optionalEntity(schema, 'products');
  const warehouses = optionalEntity(schema, 'warehouses');
  const productKey = field(products, 'id');
  const productSku = pick(products, ['sku', 'skucode', 'productcode', 'itemcode', 'code']);
  const productName = field(products, 'name');
  const warehouseKey = field(warehouses, 'id');
  const warehouseName = field(warehouses, 'warehouseName');

  const request = (await getPool()).request();
  const parts = [];
  let joins = '';

  if (productId && products && productKey) {
    joins += ' LEFT JOIN ' + quoteTable(products) + ' p ON p.' + quoteId(productKey.name) + ' = t.' + quoteId(productId.name);
  }
  if (warehouseId && warehouses && warehouseKey) {
    joins += ' LEFT JOIN ' + quoteTable(warehouses) + ' h ON h.' + quoteId(warehouseKey.name) + ' = t.' + quoteId(warehouseId.name);
  }

  if (query.warehouseId !== undefined && query.warehouseId !== '') {
    if (!warehouseId) throw unavailable('Warehouse filtering is unavailable for the discovered inventory table.');
    bind(request, 'warehouseId', warehouseId, query.warehouseId);
    parts.push('t.' + quoteId(warehouseId.name) + ' = @warehouseId');
  }

  if (query.lowStockOnly === 'true') {
    const threshold = query.lowStockThreshold === undefined || query.lowStockThreshold === ''
      ? 10 : Number(query.lowStockThreshold);
    if (!Number.isFinite(threshold) || threshold < 0) throw invalid('lowStockThreshold must be zero or greater.');
    request.input('threshold', sql.Decimal(38, 10), threshold);
    parts.push('t.' + quoteId(qty.name) + ' <= @threshold');
  }

  if (query.zeroStockOnly === 'true') {
    parts.push('t.' + quoteId(qty.name) + ' = 0');
  }

  const orderBy = productId ? 't.' + quoteId(productId.name) : '(SELECT NULL)';
  const sqlText = 'SELECT ' +
    qualified('t', productId) + ' AS productId, ' +
    (products && productSku ? 'p.' + quoteId(productSku.name) : 'NULL') + ' AS sku, ' +
    (products && productName ? 'p.' + quoteId(productName.name) : 'NULL') + ' AS productName, ' +
    qualified('t', warehouseId) + ' AS warehouseId, ' +
    (warehouses && warehouseName ? 'h.' + quoteId(warehouseName.name) : 'NULL') + ' AS warehouseName, ' +
    't.' + quoteId(qty.name) + ' AS onHand, ' +
    qualified('t', reserved) + ' AS reserved, ' +
    (reserved ? '(t.' + quoteId(qty.name) + ' - t.' + quoteId(reserved.name) + ')' : 'NULL') + ' AS available' +
    ' FROM ' + quoteTable(table) + ' t' + joins + whereClause(parts) +
    ' ORDER BY ' + orderBy + ' OFFSET 0 ROWS FETCH NEXT 500 ROWS ONLY;';

  const data = await request.query(sqlText);
  return {
    data: data.recordset,
    pagination: { page: 1, pageSize: 500, total: data.recordset.length, totalPages: 1 },
    capabilities: { reserved: !!reserved, available: !!reserved }
  };
}

async function listOrders(query = {}) {
  const schema = await discoverSchema();
  const table = requireEntity(schema, 'orders');
  const id = field(table, 'id');
  const orderNo = field(table, 'orderNo');
  const customer = field(table, 'customerId');
  const status = field(table, 'status');
  const created = field(table, 'created');
  const total = field(table, 'total');

  if (!id) {
    const err = new Error('No recognized order identifier column was discovered.');
    err.code = 'SCHEMA_MAPPING_UNAVAILABLE';
    throw err;
  }

  const page = boundedInt(query.page, 1, 1, 1000000);
  const pageSize = boundedInt(query.pageSize, 20, 1, 100);
  if (page === null || pageSize === null) throw invalid('page must be >= 1 and pageSize must be between 1 and 100.');

  const pool = await getPool();
  const request = pool.request();

  function applyFilters(target, parts) {
    if (query.status) {
      if (!status) throw unavailable('Status filtering is unavailable in this schema.');
      bind(target, 'status', status, query.status);
      parts.push('t.' + quoteId(status.name) + ' = @status');
    }
    if (query.customerId) {
      if (!customer) throw unavailable('Customer filtering is unavailable in this schema.');
      bind(target, 'customerId', customer, query.customerId);
      parts.push('t.' + quoteId(customer.name) + ' = @customerId');
    }
    for (const key of ['from', 'to']) {
      if (!query[key]) continue;
      if (!created) throw unavailable('Date filtering is unavailable in this schema.');
      const parsed = new Date(query[key]);
      if (!Number.isFinite(parsed.getTime())) throw invalid('Date filters must be valid dates.');
      const name = key === 'from' ? 'fromDate' : 'toDate';
      target.input(name, sql.DateTime2, parsed);
      // An inclusive end date compares with "< next day" so the predicate stays sargable.
      parts.push(key === 'to'
        ? 't.' + quoteId(created.name) + ' < DATEADD(day, 1, @' + name + ')'
        : 't.' + quoteId(created.name) + ' >= @' + name);
    }
    return parts;
  }

  const parts = applyFilters(request, []);
  request.input('offset', sql.Int, (page - 1) * pageSize);
  request.input('take', sql.Int, pageSize);

  const select = [
    't.' + quoteId(id.name) + ' AS id',
    qualified('t', orderNo, 't.' + quoteId(id.name)) + ' AS orderNumber',
    qualified('t', customer) + ' AS customerId',
    qualified('t', status) + ' AS status',
    qualified('t', created) + ' AS createdAt',
    qualified('t', total) + ' AS totalAmount'
  ].join(', ');

  const orderBy = created ? 't.' + quoteId(created.name) + ' DESC' : 't.' + quoteId(id.name) + ' DESC';
  const data = await request.query(
    'SELECT ' + select + ' FROM ' + quoteTable(table) + ' t' + whereClause(parts) +
    ' ORDER BY ' + orderBy + ' OFFSET @offset ROWS FETCH NEXT @take ROWS ONLY;'
  );

  const countRequest = pool.request();
  const countParts = applyFilters(countRequest, []);
  const countResult = await countRequest.query(
    'SELECT COUNT_BIG(1) AS total FROM ' + quoteTable(table) + ' t' + whereClause(countParts) + ';'
  );
  const totalCount = Number(countResult.recordset[0].total);

  return {
    data: data.recordset,
    pagination: { page, pageSize, total: totalCount, totalPages: Math.ceil(totalCount / pageSize) }
  };
}

async function getOrder(value) {
  const schema = await discoverSchema();
  const table = requireEntity(schema, 'orders');
  const id = field(table, 'id');
  if (!id) {
    const err = new Error('Order identifier mapping unavailable.');
    err.code = 'SCHEMA_MAPPING_UNAVAILABLE';
    throw err;
  }

  const request = (await getPool()).request();
  request.input('id', paramType(id), value);

  const header = await request.query(
    'SELECT TOP (1) t.' + quoteId(id.name) + ' AS id, ' +
    qualified('t', field(table, 'orderNo'), 't.' + quoteId(id.name)) + ' AS orderNumber, ' +
    qualified('t', field(table, 'customerId')) + ' AS customerId, ' +
    qualified('t', field(table, 'status')) + ' AS status, ' +
    qualified('t', field(table, 'created')) + ' AS createdAt, ' +
    qualified('t', field(table, 'total')) + ' AS totalAmount' +
    ' FROM ' + quoteTable(table) + ' t WHERE t.' + quoteId(id.name) + ' = @id;'
  );

  if (!header.recordset.length) return null;
  const order = header.recordset[0];

  const lines = optionalEntity(schema, 'orderItems');
  const items = [];
  let lineItemTotal = null;

  if (lines) {
    const orderFk = pick(lines, ['orderid', 'salesorderid', 'orderheaderid']);
    const quantity = field(lines, 'quantity');
    const unitPrice = field(lines, 'unitPrice');
    const lineProduct = field(lines, 'productId');

    if (orderFk) {
      const lineRequest = (await getPool()).request();
      lineRequest.input('id', paramType(id), value);
      const products = optionalEntity(schema, 'products');
      const productKey = field(products, 'id');
      const productName = field(products, 'name');
      const join = products && productKey && lineProduct
        ? ' LEFT JOIN ' + quoteTable(products) + ' p ON p.' + quoteId(productKey.name) + ' = l.' + quoteId(lineProduct.name)
        : '';
      const lineSelect = [
        qualified('l', orderFk) + ' AS orderId',
        qualified('l', lineProduct) + ' AS productId',
        (products && productName ? 'p.' + quoteId(productName.name) : 'NULL') + ' AS productName',
        qualified('l', quantity) + ' AS quantity',
        qualified('l', unitPrice) + ' AS unitPrice',
        (quantity && unitPrice
          ? '(l.' + quoteId(quantity.name) + ' * l.' + quoteId(unitPrice.name) + ')'
          : 'NULL') + ' AS subtotal'
      ].join(', ');

      const lineResult = await lineRequest.query(
        'SELECT ' + lineSelect + ' FROM ' + quoteTable(lines) + ' l' + join +
        ' WHERE l.' + quoteId(orderFk.name) + ' = @id;'
      );
      items.push(...lineResult.recordset);
      if (quantity && unitPrice) {
        lineItemTotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      }
    }
  }

  return {
    ...order,
    items,
    lineItemTotal,
    // Reconciliation is reported, never silently rewritten.
    totalReconciled: lineItemTotal === null ? null : Number(order.totalAmount) === lineItemTotal
  };
}

async function dashboard() {
  const schema = await discoverSchema();
  const orders = requireEntity(schema, 'orders');
  const status = field(orders, 'status');
  const amount = field(orders, 'total');
  const pool = await getPool();

  const countResult = await pool.request().query(
    'SELECT COUNT_BIG(1) AS total FROM ' + quoteTable(orders) + ';'
  );
  const totalOrders = Number(countResult.recordset[0].total);

  let ordersByStatus = [];
  if (status) {
    const statusResult = await pool.request().query(
      'SELECT t.' + quoteId(status.name) + ' AS status, COUNT_BIG(1) AS count FROM ' +
      quoteTable(orders) + ' t GROUP BY t.' + quoteId(status.name) + ' ORDER BY COUNT_BIG(1) DESC;'
    );
    ordersByStatus = statusResult.recordset;
  }

  let totalOrderValue = null;
  if (amount) {
    const valueResult = await pool.request().query(
      'SELECT SUM(TRY_CONVERT(decimal(38,4), t.' + quoteId(amount.name) + ')) AS value FROM ' +
      quoteTable(orders) + ' t;'
    );
    totalOrderValue = valueResult.recordset[0].value;
  }

  let lowStockItems = null;
  const inventory = optionalEntity(schema, 'inventory');
  const qty = field(inventory, 'qty');
  if (inventory && qty) {
    const lowResult = await pool.request().query(
      'SELECT COUNT_BIG(1) AS total FROM ' + quoteTable(inventory) + ' t WHERE t.' +
      quoteId(qty.name) + ' <= 10;'
    );
    lowStockItems = Number(lowResult.recordset[0].total);
  }

  const pendingOrders = ordersByStatus.length
    ? ordersByStatus
      .filter(row => /pending|new|open|processing/i.test(String(row.status || '')))
      .reduce((sum, row) => sum + Number(row.count), 0)
    : null;

  return {
    totalOrders,
    pendingOrders,
    lowStockItems,
    totalOrderValue,
    ordersByStatus,
    asOf: new Date().toISOString(),
    notes: [
      'Pending is inferred by matching existing status labels; confirm the mapping with operations.',
      'The dashboard low-stock count uses a provisional threshold of 10 units; confirm before operational use.',
      'Daily trend and top-product reports stay explicitly unconfigured until relationship mappings are approved.'
    ]
  };
}

module.exports = { listProducts, listInventory, listOrders, getOrder, dashboard };
