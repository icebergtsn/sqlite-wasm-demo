import {sqlite3Worker1Promiser} from '@sqlite.org/sqlite-wasm';
declare module '@sqlite.org/sqlite-wasm' {
  export function sqlite3Worker1Promiser(...args: any): any
}

class SQLiteWorkerServiceV2 {
  private isInitialized = false;
  private pendingOperations: Array<() => void> = [];
  private promiser: any = null;
  private dbId: string | null = null;

  constructor() {
    this.init();
  }

  async init() {
    try {
      console.log("Initializing SQLite Worker...");

      this.promiser = await new Promise((resolve) => {
        const promiserInstance = sqlite3Worker1Promiser({
          onready: () => resolve(promiserInstance),
        });
      });

      console.log("SQLite Worker initialized.");

      const openResponse = await this.promiser("open", {
        filename: 'file:worker-promiser.sqlite3?vfs=opfs',
      });
      this.dbId = openResponse.dbId;

      console.log('OPFS is available, created persisted database at', openResponse)

      console.log("Database opened with ID:", this.dbId);

      await this.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          age INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users (id)
        );
      `);

      this.isInitialized = true;

      this.pendingOperations.forEach((operation) => operation());
      this.pendingOperations = [];
    } catch (error) {
      console.error("Error initializing SQLite Worker:", error);
    }
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

    if (!this.promiser || !this.dbId) {
      throw new Error("Database not initialized");
    }

    try {
      const queryResponse = await this.promiser("exec", {
        dbId: this.dbId,
        sql,
        bind: params,
      });
      return queryResponse.result.rows || [];
    } catch (error) {
      console.error("SQL 查询发生错误：", error);
      return [];
    }
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.isInitialized) {
      this.pendingOperations.push(() => this.execute(sql, params));
      return;
    }

    if (!this.promiser || !this.dbId) {
      throw new Error("Database not initialized");
    }

    try {
      await this.promiser("exec", {
        dbId: this.dbId,
        sql,
        bind: params,
      });
    } catch (error) {
      console.error("SQL 执行发生错误：", error);
    }
  }

  async close(): Promise<void> {
    if (!this.promiser || !this.dbId) {
      throw new Error("Database not initialized");
    }

    try {
      await this.promiser("close", { dbId: this.dbId });
      console.log("Database closed.");
    } catch (error) {
      console.error("Error closing database:", error);
    }
  }
}

export default new SQLiteWorkerServiceV2();
