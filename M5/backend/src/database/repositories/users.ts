import type { IDatabase } from "pg-promise";
import type { IClient } from "pg-promise/typescript/pg-subset.js";

interface User {
  email: string;
  display_name: string;
  password_hash: string;
}

export class UsersRepository {
  constructor(
    private readonly pgPool: IDatabase<Record<string, never>, IClient>,
  ) {}

  async createUser(user: User): Promise<User> {
    const { email, display_name, password_hash } = user;
    const query = `INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING *`;
    const values = [email, display_name, password_hash];
    const result = await this.pgPool.query(query, values);
    return result.rows[0];
  }
}
