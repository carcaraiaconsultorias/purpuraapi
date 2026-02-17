const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");

type QueryFilter = {
  column: string;
  operator: "eq";
  value: unknown;
};

type QueryPayload = {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  columns?: string;
  filters?: QueryFilter[];
  orderBy?: { column: string; ascending?: boolean };
  values?: unknown;
  returning?: boolean;
};

type QueryResult<T = any> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

function buildHeaders(extra: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  return headers;
}

async function postJson(path: string, payload: unknown): Promise<QueryResult<any>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: buildHeaders(),
      credentials: "include",
      body: JSON.stringify(payload ?? {}),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        data: null,
        error: { message: json?.error?.message || json?.error || `Request failed (${response.status})` },
      };
    }
    if (Object.prototype.hasOwnProperty.call(json, "data")) {
      return { data: json.data, error: null, count: json.count ?? null };
    }
    return { data: json, error: null };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : "Network error" } };
  }
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

class QueryBuilder {
  private table: string;
  private action: "select" | "insert" | "update" | "delete" = "select";
  private columns = "*";
  private filters: QueryFilter[] = [];
  private orderBy?: { column: string; ascending?: boolean };
  private values: unknown = null;
  private returning = false;
  private mode: "many" | "single" | "maybeSingle" = "many";

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*") {
    if (this.action === "insert" || this.action === "update" || this.action === "delete") {
      this.returning = true;
      this.columns = columns;
      return this;
    }
    this.action = "select";
    this.columns = columns;
    return this;
  }

  insert(values: unknown) {
    this.action = "insert";
    this.values = values;
    return this;
  }

  update(values: unknown) {
    this.action = "update";
    this.values = values;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  single() {
    this.mode = "single";
    return this;
  }

  maybeSingle() {
    this.mode = "maybeSingle";
    return this;
  }

  private async execute(): Promise<QueryResult<any>> {
    const payload: QueryPayload = {
      table: this.table,
      action: this.action,
      columns: this.columns,
      filters: this.filters,
      orderBy: this.orderBy,
      values: this.values,
      returning: this.returning,
    };

    const result = await postJson("/db/query", payload);
    if (result.error) return result;

    let data = result.data;
    if (this.mode === "single") {
      if (!Array.isArray(data) || data.length !== 1) {
        return { data: null, error: { message: "Expected a single row" } };
      }
      data = data[0];
    } else if (this.mode === "maybeSingle") {
      if (!Array.isArray(data)) {
        return { data: null, error: { message: "Expected an array response" } };
      }
      if (data.length > 1) {
        return { data: null, error: { message: "Expected zero or one row" } };
      }
      data = data[0] ?? null;
    }

    return { data, error: null, count: result.count ?? null };
  }

  then<TResult1 = QueryResult<any>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const supabase = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  functions: {
    async invoke(name: string, options?: { body?: unknown }) {
      const result = await postJson(`/functions/${name}`, options?.body ?? {});
      return {
        data: result.data,
        error: result.error,
      };
    },
  },
  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < bytes.length; i += 1) {
              binary += String.fromCharCode(bytes[i]);
            }
            const dataBase64 = btoa(binary);
            const result = await postJson("/storage/upload", {
              bucket,
              path,
              dataBase64,
              contentType: file.type || "application/octet-stream",
            });
            return {
              data: result.data,
              error: result.error,
            };
          } catch (error) {
            return {
              data: null,
              error: { message: error instanceof Error ? error.message : "Upload failed" },
            };
          }
        },
        getPublicUrl(path: string) {
          return {
            data: {
              publicUrl: `${API_BASE_URL}/uploads/${encodePath(path)}`,
            },
          };
        },
      };
    },
  },
};
