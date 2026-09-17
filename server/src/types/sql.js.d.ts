declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string, params?: any[]): Array<{ columns: string[]; values: any[][] }>;
    prepare(sql: string, params?: any[]): any;
    export(): Uint8Array;
    close(): void;
  }
  export default function initSqlJs(config?: any): Promise<{
    Database: new (data?: ArrayLike<number> | Buffer) => Database;
  }>;
}
