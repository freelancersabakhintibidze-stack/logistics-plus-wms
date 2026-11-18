function quoteId(identifier) {
  return '[' + String(identifier).replace(/]/g, ']]') + ']';
}

function quoteTable(table) {
  return quoteId(table.schema) + '.' + quoteId(table.name);
}

function boundedInt(value, fallback, min, max) {
  if (value === undefined || value === '') return fallback;
  if (!/^[0-9]+$/.test(String(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_\[]/g, ch => '\\' + ch);
}

function isNumericType(type) {
  return ['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric',
    'money', 'smallmoney', 'float', 'real'].includes(type);
}

function isDateType(type) {
  return ['date', 'datetime', 'datetime2', 'smalldatetime', 'datetimeoffset'].includes(type);
}

function csvCell(value) {
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  // Neutralise spreadsheet formula injection without altering legitimate text.
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function toCsv(rows, columns) {
  const header = columns.map(column => csvCell(column.label)).join(',');
  const body = rows.map(row => columns.map(column => csvCell(row[column.key])).join(','));
  return [header, ...body].join('\r\n');
}

module.exports = { quoteId, quoteTable, boundedInt, escapeLike, isNumericType, isDateType, csvCell, toCsv };
