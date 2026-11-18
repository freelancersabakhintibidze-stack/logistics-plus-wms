const express = require('express');
const helmet = require('helmet');
const { authRequired, allow, exportEnabled } = require('./auth');
const { boundedInt, toCsv } = require('./sql-utils');
const service = require('./service');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '32kb' }));

// Minimal request telemetry. Only method, path, status and duration are logged;
// no query text, credentials or row data are ever written to the log stream.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      event: 'http_request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start
    }));
  });
  next();
});

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function pagination(req, res, next) {
  const page = boundedInt(req.query.page, 1, 1, 1000000);
  const pageSize = boundedInt(req.query.pageSize, 20, 1, 100);
  if (page === null || pageSize === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'page must be >= 1 and pageSize must be between 1 and 100.' }
    });
  }
  req.paging = { page, pageSize };
  return next();
}

const PRODUCT_COLUMNS = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Product' },
  { key: 'categoryId', label: 'Category ID' },
  { key: 'unitPrice', label: 'Unit price' },
  { key: 'active', label: 'Active' }
];

const ORDER_COLUMNS = [
  { key: 'orderNumber', label: 'Order number' },
  { key: 'customerId', label: 'Customer ID' },
  { key: 'createdAt', label: 'Created at' },
  { key: 'status', label: 'Status' },
  { key: 'totalAmount', label: 'Total amount' }
];

app.get('/api/health', (_req, res) => {
  res.json({
    data: {
      status: 'ok',
      // Deliberately does not open a database connection: health must stay cheap.
      database: 'not checked',
      authentication: process.env.WMS_AUTH_MODE || 'not configured'
    }
  });
});

app.use('/api', (req, res, next) => (req.path === '/health' ? next() : authRequired(req, res, next)));

app.get('/api/products', pagination, asyncRoute(async (req, res) => {
  const result = await service.listProducts({
    page: req.paging.page,
    pageSize: req.paging.pageSize,
    search: String(req.query.search || '').slice(0, 200),
    categoryId: req.query.categoryId,
    sort: req.query.sort,
    direction: req.query.direction
  });
  res.json(result);
}));

app.get('/api/products/export.csv', allow('operator', 'supervisor', 'admin'), asyncRoute(async (req, res) => {
  if (!exportEnabled()) {
    return res.status(403).json({
      error: { code: 'EXPORT_DISABLED', message: 'CSV export is disabled by deployment policy.' }
    });
  }
  const result = await service.listProducts({
    page: 1,
    pageSize: 100,
    search: String(req.query.search || '').slice(0, 200),
    categoryId: req.query.categoryId
  });
  res.type('text/csv; charset=utf-8');
  res.attachment('products.csv');
  // BOM keeps Excel aligned with UTF-8 data without touching the stored values.
  return res.send('\uFEFF' + toCsv(result.data, PRODUCT_COLUMNS));
}));

app.get('/api/inventory', asyncRoute(async (req, res) => {
  res.json(await service.listInventory(req.query));
}));

app.get('/api/orders', pagination, asyncRoute(async (req, res) => {
  const result = await service.listOrders({
    page: req.paging.page,
    pageSize: req.paging.pageSize,
    status: req.query.status,
    customerId: req.query.customerId,
    from: req.query.from,
    to: req.query.to
  });
  res.json(result);
}));

app.get('/api/orders/export.csv', allow('operator', 'supervisor', 'admin'), asyncRoute(async (req, res) => {
  if (!exportEnabled()) {
    return res.status(403).json({
      error: { code: 'EXPORT_DISABLED', message: 'CSV export is disabled by deployment policy.' }
    });
  }
  const result = await service.listOrders({
    page: 1,
    pageSize: 100,
    status: req.query.status,
    customerId: req.query.customerId,
    from: req.query.from,
    to: req.query.to
  });
  res.type('text/csv; charset=utf-8');
  res.attachment('orders.csv');
  return res.send('\uFEFF' + toCsv(result.data, ORDER_COLUMNS));
}));

app.get('/api/orders/:id', asyncRoute(async (req, res) => {
  // Reject anything that is not a plausible identifier so malformed input never
  // reaches the query layer, and always answer with the same generic 404 body.
  if (!/^[A-Za-z0-9-]{1,80}$/.test(req.params.id)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } });
  }
  const item = await service.getOrder(req.params.id);
  if (!item) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } });
  return res.json({ data: item });
}));

// Guarded write surface: returns 501 instead of inventing transitions, roles or
// concurrency semantics that the existing schema has not been verified to support.
app.patch('/api/orders/:id/status', allow('supervisor', 'admin'), (_req, res) => {
  res.status(501).json({
    error: {
      code: 'READ_ONLY_SCHEMA_POLICY',
      message: 'Status changes are disabled. Verify the production schema, permitted transitions, authorization and concurrency rules before enabling writes.'
    }
  });
});

app.get('/api/reports/dashboard', asyncRoute(async (_req, res) => {
  res.json({ data: await service.dashboard() });
}));

app.get('/api/reports/daily-orders', (_req, res) => {
  res.status(501).json({
    error: {
      code: 'REPORT_SCHEMA_REQUIRED',
      message: 'The daily order trend requires a verified timestamp mapping and an approved business timezone.'
    }
  });
});

app.get('/api/reports/top-products', (_req, res) => {
  res.status(501).json({
    error: {
      code: 'REPORT_SCHEMA_REQUIRED',
      message: 'Top products requires verified order-line and product foreign-key mappings.'
    }
  });
});

// Optional single-process hosting for local runs. On Vercel the platform serves
// dist/wms itself and rewrites only /api to this function.
if (process.env.SERVE_STATIC === 'true') {
  const path = require('node:path');
  const staticRoot = path.join(__dirname, '..', 'dist', 'wms');
  app.use(express.static(staticRoot, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(staticRoot, 'index.html')));
}

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
});

// Central error handler: maps known codes, hides internals, never leaks stacks.
app.use((err, _req, res, _next) => {
  const code = err && err.code ? err.code : 'INTERNAL_ERROR';
  if (!['VALIDATION_ERROR', 'FILTER_UNAVAILABLE', 'SCHEMA_MAPPING_UNAVAILABLE', 'SCHEMA_MAPPING_AMBIGUOUS', 'DB_CONFIG_MISSING'].includes(code)) {
    console.error(JSON.stringify({ event: 'api_error', code, message: err && err.message }));
  }
  const statusByCode = {
    VALIDATION_ERROR: 400,
    FILTER_UNAVAILABLE: 422,
    SCHEMA_MAPPING_UNAVAILABLE: 503,
    SCHEMA_MAPPING_AMBIGUOUS: 503,
    DB_CONFIG_MISSING: 503
  };
  const status = statusByCode[code] || 500;
  const message = status === 500
    ? 'An unexpected server error occurred. Please retry or contact the platform administrator.'
    : err.message;
  res.status(status).json({ error: { code, message } });
});

module.exports = app;
