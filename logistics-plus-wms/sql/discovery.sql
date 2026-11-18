/* =========================================================================
   Logistics Plus WMS - READ-ONLY schema discovery
   These statements read metadata only. They create, alter and drop nothing.
   Run with an approved, least-privilege account in a controlled session.
   ========================================================================= */

-- 1. Base tables
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;

-- 2. Column telemetry (the shape the API consumes at runtime)
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION
FROM INFORMATION_SCHEMA.COLUMNS
ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;

-- 3. Full detail including precision, scale, identity and computed flags
SELECT s.name AS schema_name, t.name AS table_name, c.name AS column_name,
       ty.name AS data_type, c.max_length, c.precision, c.scale,
       c.is_nullable, c.is_identity, c.is_computed, c.column_id
FROM sys.tables AS t
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
JOIN sys.columns AS c ON c.object_id = t.object_id
JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id
ORDER BY s.name, t.name, c.column_id;

-- 4. Primary keys, unique constraints and check constraints
SELECT tc.TABLE_SCHEMA, tc.TABLE_NAME, tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE,
       kcu.COLUMN_NAME, kcu.ORDINAL_POSITION
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
       ON kcu.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
      AND kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
ORDER BY tc.TABLE_SCHEMA, tc.TABLE_NAME, tc.CONSTRAINT_TYPE, kcu.ORDINAL_POSITION;

-- 5. Foreign keys (relationship mapping for orders, lines, stock, warehouses)
SELECT fk.name AS foreign_key_name,
       ps.name AS parent_schema, pt.name AS parent_table, pc.name AS parent_column,
       rs.name AS referenced_schema, rt.name AS referenced_table, rc.name AS referenced_column
FROM sys.foreign_key_columns AS fkc
JOIN sys.foreign_keys AS fk ON fk.object_id = fkc.constraint_object_id
JOIN sys.tables AS pt ON pt.object_id = fkc.parent_object_id
JOIN sys.schemas AS ps ON ps.schema_id = pt.schema_id
JOIN sys.columns AS pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
JOIN sys.tables AS rt ON rt.object_id = fkc.referenced_object_id
JOIN sys.schemas AS rs ON rs.schema_id = rt.schema_id
JOIN sys.columns AS rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
ORDER BY parent_schema, parent_table, foreign_key_name;

-- 6. Existing indexes (evidence for query-plan review; no index is created here)
SELECT s.name AS schema_name, t.name AS table_name, i.name AS index_name,
       i.type_desc, i.is_unique, i.is_primary_key,
       STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS key_columns
FROM sys.indexes AS i
JOIN sys.tables AS t ON t.object_id = i.object_id
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE ic.is_included_column = 0
GROUP BY s.name, t.name, i.name, i.type_desc, i.is_unique, i.is_primary_key
ORDER BY s.name, t.name, i.name;

-- 7. Confirm whether a concurrency token already exists (required before any write feature)
SELECT s.name AS schema_name, t.name AS table_name, c.name AS column_name, ty.name AS data_type
FROM sys.columns AS c
JOIN sys.tables AS t ON t.object_id = c.object_id
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id
WHERE ty.name = 'timestamp'
ORDER BY s.name, t.name;

-- 8. Confirm no application audit table exists yet (do not create one here)
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%Audit%' OR TABLE_NAME LIKE '%Log%'
ORDER BY TABLE_SCHEMA, TABLE_NAME;
