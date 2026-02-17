import { TABLE_CONFIG } from "./allowed-tables.mjs";

function quoteIdentifier(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

function parseColumnList(rawColumns, allowedColumns) {
  if (!rawColumns || rawColumns === "*") return [...allowedColumns];
  if (Array.isArray(rawColumns)) {
    const columns = rawColumns.map((item) => String(item).trim()).filter(Boolean);
    for (const column of columns) {
      if (!allowedColumns.includes(column)) throw new Error(`Column not allowed: ${column}`);
    }
    return columns;
  }
  const columns = String(rawColumns)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  for (const column of columns) {
    if (!allowedColumns.includes(column)) throw new Error(`Column not allowed: ${column}`);
  }
  return columns;
}

function buildWhereClause(filters, allowedColumns, startIndex = 1) {
  const clauses = [];
  const values = [];
  let index = startIndex;

  for (const filter of filters ?? []) {
    const column = String(filter?.column ?? "").trim();
    const operator = String(filter?.operator ?? filter?.op ?? "eq").trim().toLowerCase();
    if (!column || !allowedColumns.includes(column)) throw new Error(`Filter column not allowed: ${column}`);
    if (operator !== "eq") throw new Error(`Unsupported filter operator: ${operator}`);

    clauses.push(`${quoteIdentifier(column)} = $${index}`);
    values.push(filter.value);
    index += 1;
  }

  return {
    sql: clauses.length > 0 ? clauses.join(" and ") : "",
    values,
    nextIndex: index,
  };
}

function parseRowsInput(values) {
  if (!values || typeof values !== "object") throw new Error("Invalid values payload");
  return Array.isArray(values) ? values : [values];
}

export async function executeTableQuery(pool, payload) {
  const table = String(payload?.table ?? "").trim();
  const action = String(payload?.action ?? "select").toLowerCase();

  if (!TABLE_CONFIG[table]) throw new Error(`Table not allowed: ${table}`);
  const tableConfig = TABLE_CONFIG[table];
  const dbTable = quoteIdentifier(table);

  if (action === "select") {
    const selectedColumns = parseColumnList(payload.columns, tableConfig.columns);
    const selectSql = selectedColumns.map(quoteIdentifier).join(", ");
    const where = buildWhereClause(payload.filters, tableConfig.columns, 1);
    let sql = `select ${selectSql} from ${dbTable}`;
    if (where.sql) sql += ` where ${where.sql}`;

    const orderBy = payload?.orderBy?.column ? String(payload.orderBy.column).trim() : "";
    if (orderBy) {
      if (!tableConfig.columns.includes(orderBy)) throw new Error(`Order by not allowed: ${orderBy}`);
      const ascending = payload?.orderBy?.ascending !== false;
      sql += ` order by ${quoteIdentifier(orderBy)} ${ascending ? "asc" : "desc"}`;
    }

    const result = await pool.query(sql, where.values);
    return result.rows;
  }

  if (action === "insert") {
    const rows = parseRowsInput(payload.values);
    const candidateColumns = Array.from(
      new Set(
        rows.flatMap((row) => Object.keys(row ?? {})).filter((column) => tableConfig.insertColumns.includes(column)),
      ),
    );
    if (candidateColumns.length === 0) throw new Error("No insertable columns supplied");

    const columnSql = candidateColumns.map(quoteIdentifier).join(", ");
    const values = [];
    const valuesSql = [];
    let paramIndex = 1;

    for (const row of rows) {
      const placeholders = [];
      for (const column of candidateColumns) {
        placeholders.push(`$${paramIndex}`);
        values.push(row?.[column] ?? null);
        paramIndex += 1;
      }
      valuesSql.push(`(${placeholders.join(", ")})`);
    }

    const returning = payload?.returning === true;
    const returningColumns = returning ? parseColumnList(payload.columns, tableConfig.columns) : ["id"];
    const returningSql = returningColumns.map(quoteIdentifier).join(", ");

    const sql = `insert into ${dbTable} (${columnSql}) values ${valuesSql.join(", ")} returning ${returningSql}`;
    const result = await pool.query(sql, values);
    return returning ? result.rows : null;
  }

  if (action === "update") {
    if (!payload.values || typeof payload.values !== "object" || Array.isArray(payload.values)) {
      throw new Error("Update values must be an object");
    }
    const updateKeys = Object.keys(payload.values).filter((column) => tableConfig.updateColumns.includes(column));
    if (updateKeys.length === 0) throw new Error("No updatable columns supplied");

    const filters = Array.isArray(payload.filters) ? payload.filters : [];
    if (filters.length === 0) throw new Error("Update requires at least one filter");

    const sets = [];
    const values = [];
    let paramIndex = 1;
    for (const key of updateKeys) {
      sets.push(`${quoteIdentifier(key)} = $${paramIndex}`);
      values.push(payload.values[key]);
      paramIndex += 1;
    }

    const where = buildWhereClause(filters, tableConfig.columns, paramIndex);
    let sql = `update ${dbTable} set ${sets.join(", ")}`;
    if (where.sql) sql += ` where ${where.sql}`;

    const returning = payload?.returning === true;
    if (returning) {
      const returningColumns = parseColumnList(payload.columns, tableConfig.columns);
      sql += ` returning ${returningColumns.map(quoteIdentifier).join(", ")}`;
    }

    const result = await pool.query(sql, [...values, ...where.values]);
    return returning ? result.rows : null;
  }

  if (action === "delete") {
    const filters = Array.isArray(payload.filters) ? payload.filters : [];
    if (filters.length === 0) throw new Error("Delete requires at least one filter");

    const where = buildWhereClause(filters, tableConfig.columns, 1);
    let sql = `delete from ${dbTable}`;
    if (where.sql) sql += ` where ${where.sql}`;

    const returning = payload?.returning === true;
    if (returning) {
      const returningColumns = parseColumnList(payload.columns, tableConfig.columns);
      sql += ` returning ${returningColumns.map(quoteIdentifier).join(", ")}`;
    }

    const result = await pool.query(sql, where.values);
    return returning ? result.rows : null;
  }

  throw new Error(`Unsupported action: ${action}`);
}

