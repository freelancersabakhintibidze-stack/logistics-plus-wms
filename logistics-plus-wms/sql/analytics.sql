/* =========================================================================
   Logistics Plus WMS - analytical SELECT templates (parameterised)
   READ-ONLY. Replace [bracketed] identifiers only after the discovery output
   and the owner-approved data dictionary confirm them. Every statement is
   parameterised; no index, table or column is created by this file.

   Bind: @from datetime2, @to datetime2 (exclusive upper bound),
         @lowStockThreshold decimal(38,4), @customerId as appropriate.
   ========================================================================= */

/* 1. TOP PRODUCTS
   "Best selling" is ambiguous: line frequency and units sold are both shown so
   the business can choose the authoritative definition.
   Join strategy: order lines -> products -> orders, driven by the IDs the
   discovery step verified. NULL handling: products with no lines never appear
   (INNER JOIN), which matches "best selling".
   Risk: without an index on the order date column the range predicate scans;
   confirm the existing plan before relying on it in production. */
SELECT TOP (10)
       p.[ProductId],
       p.[SKU],
       p.[Name]                        AS product_name,
       COUNT_BIG(*)                    AS order_line_frequency,
       SUM(CONVERT(decimal(38,4), oi.[Quantity])) AS units_sold
FROM [dbo].[OrderItems] AS oi
JOIN [dbo].[Products]   AS p  ON p.[ProductId] = oi.[ProductId]
JOIN [dbo].[Orders]     AS o  ON o.[OrderId]   = oi.[OrderId]
WHERE o.[CreatedAt] >= @from
  AND o.[CreatedAt] <  @to
GROUP BY p.[ProductId], p.[SKU], p.[Name]
ORDER BY order_line_frequency DESC, p.[ProductId];

/* 2. ORDER VOLUME BY STATUS - trailing 30 days
   @from / @to are supplied as an explicit half-open window in the agreed
   business timezone so the predicate remains sargable.
   NULL status is grouped explicitly and labelled rather than silently dropped. */
SELECT COALESCE(CONVERT(nvarchar(100), o.[Status]), N'(unspecified)') AS status_label,
       COUNT_BIG(*) AS order_count
FROM [dbo].[Orders] AS o
WHERE o.[CreatedAt] >= @from
  AND o.[CreatedAt] <  @to
GROUP BY COALESCE(CONVERT(nvarchar(100), o.[Status]), N'(unspecified)')
ORDER BY order_count DESC, status_label;

/* 3. LOW STOCK AUDIT BY WAREHOUSE
   The HAVING clause works whether stock is one row per product/warehouse or
   several batch rows, and keeps NULL quantities out of the "low" bucket. */
SELECT w.[WarehouseId],
       w.[WarehouseName]                AS warehouse_name,
       p.[ProductId],
       p.[SKU],
       p.[Name]                         AS product_name,
       SUM(CONVERT(decimal(38,4), s.[Quantity])) AS on_hand
FROM [dbo].[Stock]      AS s
JOIN [dbo].[Warehouses] AS w ON w.[WarehouseId] = s.[WarehouseId]
JOIN [dbo].[Products]   AS p ON p.[ProductId]   = s.[ProductId]
GROUP BY w.[WarehouseId], w.[WarehouseName], p.[ProductId], p.[SKU], p.[Name]
HAVING SUM(CONVERT(decimal(38,4), s.[Quantity])) <= @lowStockThreshold
ORDER BY w.[WarehouseId], p.[SKU];

/* 4. CUSTOMER SPEND SUMMARY
   TRY_CONVERT protects against legacy text amounts; the outer IS NOT NULL keeps
   unparseable amounts visible in a separate reconciliation query rather than
   being silently counted as zero. Cancel/refund treatment must be agreed before
   this is used for finance. */
SELECT c.[CustomerId],
       c.[CustomerName]                 AS customer_name,
       COUNT_BIG(o.[OrderId])           AS order_count,
       SUM(TRY_CONVERT(decimal(38,4), o.[TotalAmount])) AS total_spend
FROM [dbo].[Customers] AS c
JOIN [dbo].[Orders]    AS o ON o.[CustomerId] = c.[CustomerId]
WHERE o.[CreatedAt] >= @from
  AND o.[CreatedAt] <  @to
GROUP BY c.[CustomerId], c.[CustomerName]
ORDER BY total_spend DESC;

/* Reconciliation companion for (4): rows whose amount could not be parsed. */
SELECT o.[OrderId], o.[TotalAmount]
FROM [dbo].[Orders] AS o
WHERE TRY_CONVERT(decimal(38,4), o.[TotalAmount]) IS NULL
  AND o.[TotalAmount] IS NOT NULL;

/* 5. DAILY RUN RATE - 7-day trailing window
   Grouping on a date expression only; the WHERE predicate stays sargable.
   Empty calendar days are intentionally absent: joining a calendar table would
   require an object this schema may not own, so the chart layer fills gaps. */
SELECT CONVERT(date, o.[CreatedAt]) AS order_date,
       COUNT_BIG(*)                 AS order_count
FROM [dbo].[Orders] AS o
WHERE o.[CreatedAt] >= @from
  AND o.[CreatedAt] <  @to
GROUP BY CONVERT(date, o.[CreatedAt])
ORDER BY order_date;

/* 6. Verification queries used by the demo script.
   These must return the same numbers the dashboard shows. */
SELECT COUNT_BIG(*) AS total_orders FROM [dbo].[Orders];

SELECT SUM(TRY_CONVERT(decimal(38,4), [TotalAmount])) AS total_order_value
FROM [dbo].[Orders];

SELECT COUNT_BIG(*) AS low_stock_rows
FROM [dbo].[Stock]
WHERE [Quantity] <= 10;
