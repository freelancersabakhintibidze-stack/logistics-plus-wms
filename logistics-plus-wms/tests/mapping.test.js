const test = require('node:test');
const assert = require('node:assert/strict');
const { pick, field, qualified, requireEntity, optionalEntity, normalize } = require('../server/schema');

const products = {
  schema: 'dbo',
  name: 'Products',
  columns: [
    { name: 'ProductId', type: 'int', nullable: false, ordinal: 1 },
    { name: 'SKU', type: 'nvarchar', nullable: false, ordinal: 2 },
    { name: 'ProductName', type: 'nvarchar', nullable: false, ordinal: 3 },
    { name: 'UnitPrice', type: 'decimal', nullable: true, ordinal: 4 }
  ]
};

test('normalize ignores case, punctuation and a trailing plural s', () => {
  assert.equal(normalize('Sales_Orders'), 'salesorder');
  assert.equal(normalize('ORDERS'), 'order');
});

test('pick resolves conventional column names case-insensitively', () => {
  assert.equal(pick(products, ['productid', 'id']).name, 'ProductId');
  assert.equal(pick(products, ['missing']), null);
});

test('field maps logical names to discovered columns', () => {
  assert.equal(field(products, 'sku').name, 'SKU');
  assert.equal(field(products, 'name').name, 'ProductName');
  assert.equal(field(products, 'price').name, 'UnitPrice');
  assert.equal(field(products, 'reserved'), null);
});

test('qualified never invents a column when mapping is absent', () => {
  assert.equal(qualified('t', field(products, 'sku')), 't.[SKU]');
  assert.equal(qualified('t', null), 'NULL');
});

test('requireEntity reports a mapping error instead of guessing', () => {
  assert.throws(
    () => requireEntity({ entities: { products: null } }, 'products'),
    err => err.code === 'SCHEMA_MAPPING_UNAVAILABLE'
  );
});


test('order identifier mapping prefers OrderId over unrelated foreign keys', () => {
  const orders = { schema: 'dbo', name: 'Orders', columns: [
    { name: 'CustomerId', type: 'int' }, { name: 'OrderId', type: 'int' }
  ] };
  assert.equal(field(orders, 'id').name, 'OrderId');
});


test('ambiguous optional entity mappings fail closed', () => {
  const ambiguous = { schema: 'dbo', name: 'Products', ambiguousWith: ['legacy.Products'] };
  assert.throws(
    () => optionalEntity({ entities: { products: ambiguous } }, 'products'),
    err => err.code === 'SCHEMA_MAPPING_AMBIGUOUS'
  );
});
