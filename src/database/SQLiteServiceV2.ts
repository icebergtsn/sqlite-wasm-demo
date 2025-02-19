import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

let db : any = null;

async function initDB() {
  const sqlite3 = await sqlite3InitModule();

  const opfsVfs = sqlite3.capi.sqlite3_vfs_find("opfs");
  if (!opfsVfs) {
    console.log("OPFS VFS is not available in this environment.");
  }

  // db = new sqlite3.oo1.DB("file:mydb.sqlite3?vfs=opfs");

  const db =
    'opfs' in sqlite3
      ? new sqlite3.oo1.OpfsDb('/mydb.sqlite3')
      : new sqlite3.oo1.DB('/mydb.sqlite3', 'ct');
  console.log(
    'opfs' in sqlite3
      ? `OPFS is available, created persisted database at ${db.filename}`
      : `OPFS is not available, created transient database ${db.filename}`,
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL
    );
  `);

  return "Database initialized with OPFS.";
}

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  try {
    if (type === "init") {
      const result = await initDB();
      self.postMessage({ type: "init", result });
    } else if (type === "execute") {
      const { sql, params } = payload;
      db.exec({ sql, bind: params });
      self.postMessage({ type: "execute", result: "Success" });
    } else if (type === "query") {
      const { sql, params } = payload;
      const results : any[] = [];
      db.exec({
        sql,
        bind: params,
        callback: (row : any) => results.push(row),
      });
      self.postMessage({ type: "query", result: results });
    }
  } catch (error : any) {
    self.postMessage({ type: "error", error: error.message });
  }
};
