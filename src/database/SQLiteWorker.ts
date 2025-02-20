import sqlite3InitModule, {OpfsSAHPoolDatabase} from "@sqlite.org/sqlite-wasm";

let db: OpfsSAHPoolDatabase | null = null;
let initPromise : any = null;

async function initDB() {
  const sqlite3 = await sqlite3InitModule();

  // const opfsVfs = sqlite3.capi.sqlite3_vfs_find("opfs");
  // if (!opfsVfs) {
  //   console.log("OPFS VFS is not available in this environment.");
  // }
  //
  // const poolUtil = await sqlite3.installOpfsSAHPoolVfs({
  //   clearOnInit: false,
  //   directory: "/sqlite3",
  // });
  // console.log({poolUtil});
  //
  // db = new poolUtil.OpfsSAHPoolDb(`/test.db`);

  console.log('Running SQLite3 version', sqlite3.version.libVersion);
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
    CREATE TABLE IF NOT EXISTS users
    (
      id
      INTEGER
      PRIMARY
      KEY
      AUTOINCREMENT,
      name
      TEXT
      NOT
      NULL,
      age
      INTEGER
      NOT
      NULL
    );
  `);

  db.exec(`CREATE TABLE IF NOT EXISTS orders
  (
    id
    INTEGER
    PRIMARY
    KEY
    AUTOINCREMENT,
    user_id
    INTEGER
    NOT
    NULL,
    amount
    REAL
    NOT
    NULL,
    FOREIGN
    KEY
           (
    user_id
           ) REFERENCES users
           (
             id
           )
    );`)

  return "Database initialized with OPFS.";
}

async function ensureInit() {
  if (!initPromise) {
    initPromise = initDB();
  }
  return initPromise;
}

self.onmessage = async (event) => {
  const {id, type, payload} = event.data;

  try {
    if (type === "init") {
      if (!initPromise) {
        initPromise = initDB();
      }
      const result = await initPromise;
      self.postMessage({id, type: "init", result});
    }else if (type === "close") {
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
        const {sql, params} = payload;
        db.exec({sql, bind: params});
        self.postMessage({id, type: "execute", result: "Success"});
      } else if (type === "query") {
        const {sql, params} = payload;
        const results: any = [];
        db.exec({
          sql,
          bind: params,
          callback: (row: any) => results.push(row),
        });
        self.postMessage({id, type: "query", result: results});
      }
    }
  } catch (error: any) {
    self.postMessage({id, type: "error", error: error.message});
  }
};
