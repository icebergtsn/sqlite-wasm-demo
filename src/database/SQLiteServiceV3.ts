import sqlite3InitModule, {Database} from '@sqlite.org/sqlite-wasm';


class SQLiteServiceV3 {
  private isInitialized = false;
  private pendingOperations: Array<() => void> = [];
  observers: any;
  queryDependencies: any;
  queryFunctions: any;
  db: Database | null;

  constructor() {
    this.db = null;
    this.observers = {};
    this.queryDependencies = {};
    this.queryFunctions = {};
    this.init();
  }

  async init() {
    const sqlite3 = await sqlite3InitModule();
    const opfsVfs = sqlite3.capi.sqlite3_vfs_find("opfs");
    if (opfsVfs) {
      console.log("OPFS VFS is available!");
    } else {
      console.log("OPFS VFS is not available in this build.");
    }
    this.db = new sqlite3.oo1.JsStorageDb({filename : 'local'})

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users
      (
        id
        INTEGER
        PRIMARY
        KEY,
        name
        TEXT,
        age
        INTEGER
      );
      CREATE TABLE IF NOT EXISTS orders
      (
        id
        INTEGER
        PRIMARY
        KEY,
        user_id
        INTEGER,
        amount
        REAL,
        FOREIGN
        KEY
      (
        user_id
      ) REFERENCES users
      (
        id
      )
        );
    `);
    this.isInitialized = true;

    this.pendingOperations.forEach((operation) => operation());
    this.pendingOperations = [];

  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.isInitialized) {
      return new Promise((resolve, reject) => {
        this.pendingOperations.push(async () => {
          try {
            const result = await this.query(sql, params);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    if (!this.db) throw new Error("Database not initialized");

    try {
      const results: any[] = [];
      this.db.exec({
        sql,
        bind: params,
        callback: (row: any) => {
          results.push(row);
        }
      });
      return results;
    } catch (error) {
      console.error("SQL 查询发生错误：", error);
      return [];
    }
  }


  execute(sql: string, params: any[] = []): void {
    if (!this.isInitialized) {
      this.pendingOperations.push(() => this.execute(sql, params));
      return;
    }

    if (!this.db) throw new Error("Database not initialized");
    try {
      this.db.exec({
        sql,
        bind: params
      });
    } catch (error) {
      console.error("SQL 执行发生错误：", error);
    }

    const affectedTables = this.getAffectedTables(sql);

    for (const queryKey in this.queryDependencies) {
      const tables = this.queryDependencies[queryKey];
      if (tables.some((table: any) => affectedTables.includes(table))) {
        const result = this.queryFunctions[queryKey]();
        this.notifyObservers(queryKey, result);
      }
    }
  }

  getAffectedTables(sql: string): string[] {
    const lowerSQL = sql.toLowerCase();
    const tables: string[] = [];

    if (lowerSQL.includes("insert into")) {
      tables.push(lowerSQL.split("insert into")[1].trim().split(" ")[0]);
    } else if (lowerSQL.includes("update")) {
      tables.push(lowerSQL.split("update")[1].trim().split(" ")[0]);
    } else if (lowerSQL.includes("delete from")) {
      tables.push(lowerSQL.split("delete from")[1].trim().split(" ")[0]);
    }

    return tables;
  }

  observeQuery(
    queryKey: string,
    queryFn: () => Promise<any[]> | any[],
    tables: string[],
    callback: (data: any) => void
  ) {
    if (!this.isInitialized) {
      this.pendingOperations.push(() => {
        this.observeQuery(queryKey, queryFn, tables, callback);
      });
      return;
    }

    const executeQuery = async () => {
      try {
        const result = await queryFn();
        if (!this.observers[queryKey]) {
          this.observers[queryKey] = [];
        }
        this.observers[queryKey].push(callback);

        this.queryDependencies[queryKey] = tables;
        this.queryFunctions[queryKey] = queryFn;

        callback(result);
      } catch (error) {
        console.error(`Error executing query for key "${queryKey}":`, error);
      }
    };

    executeQuery();
  }


  notifyObservers(queryKey: string, data: any) {
    if (this.observers[queryKey]) {
      this.observers[queryKey].forEach((callback: any) => callback(data));
    }
  }

  unobserveQuery(queryKey: string): void {
    if (this.observers[queryKey]) {
      delete this.observers[queryKey];
    }

    if (this.queryDependencies[queryKey]) {
      delete this.queryDependencies[queryKey];
    }

    if (this.queryFunctions[queryKey]) {
      delete this.queryFunctions[queryKey];
    }

    console.log(`已取消订阅：${queryKey}`);
  }
}

export default new SQLiteServiceV3();
