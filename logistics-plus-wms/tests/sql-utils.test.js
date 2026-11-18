const test = require('node:test');
const assert = require('node:assert/strict');
const {
  quoteId, quoteTable, boundedInt, escapeLike, csvCell, toCsv, isNumericType, isDateType
} = require('../server/sql-utils');

test('quoteId escapes closing brackets so identifiers cannot break out', () => {
  assert.equal(quoteId('orders'), '[orders]');
  assert.equal(quoteId('odd]name'), '[odd]]name]');
});

test('quoteTable qualifies schema and table', () => {
  assert.equal(quoteTable({ schema: 'dbo', name: 'Orders' }), '[dbo].[Orders]');
});

test('pagination integers are bounded and reject non-integers', () => {
  assert.equal(boundedInt(undefined, 20, 1, 100), 20);
  assert.equal(boundedInt('1', 20, 1, 100), 1);
  assert.equal(boundedInt('100', 20, 1, 100), 100);
  assert.equal(boundedInt('101', 20, 1, 100), null);
  assert.equal(boundedInt('0', 20, 1, 100), null);
  assert.equal(boundedInt('1.5', 20, 1, 100), null);
  assert.equal(boundedInt('-3', 20, 1, 100), null);
});

test('untrusted values inlike patterns cannot reintroduce wildcards', () => {
  assert.equal(escapeLike('100%'), '100\\%');
  assert.equal(escapeLike('a_b'), 'a\\_b');
  assert.equal(escapeLike('[x]'), '\\[x]');
});

test('CSV cells are quoted and formula injection is neutralised', () => {
  assert.equal(csvCell('plain'), '"plain"');
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('@sum'), '"\'@sum"');
});

test('CSV output has a header row and one row per record', () => {
  const csv = toCsv([{ sku: 'A-1', qty: 2 }], [{ key: 'sku', label: 'SKU' }, { key: 'qty', label: 'Qty' }]);
  assert.equal(csv, '"SKU","Qty"\r\n"A-1","2"');
});

test('SQL type families are classified for parameter typing', () => {
  assert.equal(isNumericType('decimal'), true);
  assert.equal(isNumericType('nvarchar'), false);
  assert.equal(isDateType('datetime2'), true);
});
