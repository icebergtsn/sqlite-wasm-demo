import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

let db: any | null = null;
let initPromise: any = null;

const subscriptions = new Map<string, { sql: string; params: any[]; tables: string[] }>(); // 记录订阅信息

async function initDB() {
  const sqlite3 = await sqlite3InitModule();

  const opfsVfs = sqlite3.capi.sqlite3_vfs_find("opfs");
  if (!opfsVfs) {
    console.log("OPFS VFS is not available in this environment.");
  }

  const poolUtil = await sqlite3.installOpfsSAHPoolVfs({
    clearOnInit: false,
    directory: "/sqlite3",
  });
  console.log({ poolUtil });

  db = new poolUtil.OpfsSAHPoolDb(`/test2.db`);

  console.log(
    "opfs" in sqlite3
      ? `OPFS is available, created persisted database at ${db.filename}`
      : `OPFS is not available, created transient database ${db.filename}`
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS users
    (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders
    (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `);

  return "Database initialized with OPFS.";
}

async function ensureInit() {
  if (!initPromise) {
    initPromise = initDB();
  }
  return initPromise;
}

function notifySubscribers(affectedTables: string[]) {
  if (!db) {
    console.warn("Database is not initialized. Skipping notifySubscribers.");
    return;
  }

  for (const [id, { sql, params, tables }] of subscriptions) {
    if (tables.some((table) => affectedTables.includes(table))) {
      const results: any[] = [];
      db.exec({
        sql,
        bind: params,
        callback: (row: Record<string, any>) => {
          results.push(row);
        },
      });
      self.postMessage({ id, type: "subscribe", result: results });
    }
  }
}


self.onmessage = async (event) => {
  const { id, type, payload } = event.data;

  try {
    if (type === "init") {
      if (!initPromise) {
        initPromise = initDB();
      }
      const result = await initPromise;
      self.postMessage({ id, type: "init", result });
    } else if (type === "close") {
      if (db) {
        db.close();
        db = null;
        initPromise = null;
        self.postMessage({ id, type: "close", result: "Database closed successfully." });
      } else {
        self.postMessage({ id, type: "error", error: "Database is not initialized." });
      }
    } else {
      await ensureInit();

      if (!db) {
        self.postMessage({
          id,
          type: "error",
          error: "Database initialization failed.",
        });
        return;
      }

      if (type === "execute") {
        const { sql, params } = payload;

        db.exec({ sql, bind: params });
        self.postMessage({ id, type: "execute", result: "Success" });

        const affectedTables = getAffectedTables(sql);
        if (affectedTables.length > 0) {
          notifySubscribers(affectedTables);
        }
      } else if (type === "query") {
        const { sql, params } = payload;

        const results: any[] = [];
        db.exec({
          sql,
          bind: params,
          callback: (row: any) => results.push(row),
        });

        self.postMessage({ id, type: "query", result: results });

      } else if (type === "subscribe") {
        const { sql, params, tables } = payload;

        const results: any[] = [];
        db.exec({
          sql,
          bind: params,
          callback: (row: any) => results.push(row),
        });

        self.postMessage({ id, type: "subscribe", result: results });

        subscriptions.set(id, { sql, params, tables });
      } else if (type === "unsubscribe") {
        subscriptions.delete(id);
        self.postMessage({ id, type: "unsubscribe", result: "Unsubscribed successfully." });
      }
    }
  } catch (error: any) {
    self.postMessage({ id, type: "error", error: error.message });
  }
};

function getAffectedTables(sql: string): string[] {
  const tables: string[] = [];

  const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
  const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
  const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);

  if (insertMatch) tables.push(insertMatch[1]);
  if (updateMatch) tables.push(updateMatch[1]);
  if (deleteMatch) tables.push(deleteMatch[1]);

  return tables;
}
