export interface DbClient {
  one<T = unknown>(query: string, values?: unknown[]): Promise<T>;
  oneOrNone<T = unknown>(query: string, values?: unknown[]): Promise<T | null>;
  manyOrNone<T = unknown>(query: string, values?: unknown[]): Promise<T[]>;
  none(query: string, values?: unknown[]): Promise<null>;
  result(
    query: string,
    values?: unknown[],
  ): Promise<{ rowCount: number } & Record<string, unknown>>;
}
