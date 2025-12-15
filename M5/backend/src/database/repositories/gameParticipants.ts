import { pgPool } from "../index.js";
import type { DbClient } from "../dbClient.js";

export interface GameParticipantRecord {
  id: string;
  game_id: string;
  user_id: string;
  cash: number;
  token_color: string | null;
  position: number;
  in_jail: boolean;
  jail_turns: number;
  goojf_cards: number;
  is_bankrupt: boolean;
  joined_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ParticipantWithUser {
  participant: GameParticipantRecord;
  user: {
    id: string;
    display_name: string;
    email: string;
  };
}

interface ParticipantWithUserRow {
  gp_id: string;
  gp_game_id: string;
  gp_user_id: string;
  gp_cash: number;
  gp_token_color: string | null;
  gp_position: number;
  gp_in_jail: boolean;
  gp_jail_turns: number;
  gp_goojf_cards: number;
  gp_is_bankrupt: boolean;
  gp_joined_at: Date;
  gp_created_at: Date;
  gp_updated_at: Date;
  u_id: string;
  u_display_name: string;
  u_email: string;
}

export class GameParticipantsRepository {
  private readonly db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async useGoojfAndReleaseFromJail(participantId: string): Promise<void> {
    const query = `
      UPDATE game_participants
      SET
        goojf_cards = GREATEST(goojf_cards - 1, 0),
        in_jail = false,
        jail_turns = 0,
        updated_at = now()
      WHERE id = $1
    `;
    await this.db.none(query, [participantId]);
  }

  async payJailFeeAndRelease(
    participantId: string,
    fee: number,
  ): Promise<number> {
    const query = `
      UPDATE game_participants
      SET
        cash = cash - $2,
        in_jail = false,
        jail_turns = 0,
        updated_at = now()
      WHERE id = $1
      RETURNING cash
    `;
    const row = await this.db.one<{ cash: number }>(query, [
      participantId,
      fee,
    ]);
    return row.cash;
  }

  async incrementJailTurns(participantId: string): Promise<void> {
    const query = `
      UPDATE game_participants
      SET jail_turns = jail_turns + 1, updated_at = now()
      WHERE id = $1
    `;
    await this.db.none(query, [participantId]);
  }

  async releaseFromJail(participantId: string): Promise<void> {
    const query = `
      UPDATE game_participants
      SET in_jail = false, jail_turns = 0, updated_at = now()
      WHERE id = $1
    `;
    await this.db.none(query, [participantId]);
  }

  async goToJail(participantId: string): Promise<void> {
    const query = `
      UPDATE game_participants
      SET position = 9, in_jail = true, jail_turns = 0, updated_at = now()
      WHERE id = $1
    `;
    await this.db.none(query, [participantId]);
  }

  async incrementGoojfCards(participantId: string, amount = 1): Promise<void> {
    const query = `
      UPDATE game_participants
      SET goojf_cards = goojf_cards + $2, updated_at = now()
      WHERE id = $1
    `;
    await this.db.none(query, [participantId, amount]);
  }

  async listTokenColorsByGame(
    gameId: string,
  ): Promise<{ token_color: string | null }[]> {
    const query = `
      SELECT token_color
      FROM game_participants
      WHERE game_id = $1
    `;
    return this.db.manyOrNone(query, [gameId]);
  }

  async isTokenColorTaken(
    gameId: string,
    tokenColor: string,
  ): Promise<boolean> {
    const query = `
      SELECT 1
      FROM game_participants
      WHERE game_id = $1 AND lower(token_color) = lower($2)
      LIMIT 1
    `;
    const row = await this.db.oneOrNone(query, [gameId, tokenColor]);
    return Boolean(row);
  }

  async findByIdAndGameForUpdate(
    participantId: string,
    gameId: string,
  ): Promise<GameParticipantRecord | null> {
    const query = `
      SELECT
        id,
        game_id,
        user_id,
        cash,
        token_color,
        position,
        in_jail,
        jail_turns,
        goojf_cards,
        is_bankrupt,
        joined_at,
        created_at,
        updated_at
      FROM game_participants
      WHERE id = $1 AND game_id = $2
      FOR UPDATE
    `;
    return this.db.oneOrNone(query, [participantId, gameId]);
  }

  async applyBankruptcyReset(participantId: string): Promise<void> {
    const query = `
      UPDATE game_participants
      SET
        is_bankrupt = true,
        cash = 0,
        in_jail = false,
        jail_turns = 0,
        goojf_cards = 0,
        updated_at = now()
      WHERE id = $1
    `;
    await this.db.none(query, [participantId]);
  }

  async findCashByIdAndGame(
    participantId: string,
    gameId: string,
  ): Promise<number | null> {
    const row = await this.db.oneOrNone<{ cash: number }>(
      "SELECT cash FROM game_participants WHERE id = $1 AND game_id = $2",
      [participantId, gameId],
    );
    return row?.cash ?? null;
  }

  async findByGameAndUserForUpdate(
    gameId: string,
    userId: string,
  ): Promise<GameParticipantRecord | null> {
    const query = `
      SELECT
        id,
        game_id,
        user_id,
        cash,
        token_color,
        position,
        in_jail,
        jail_turns,
        goojf_cards,
        is_bankrupt,
        joined_at,
        created_at,
        updated_at
      FROM game_participants
      WHERE game_id = $1 AND user_id = $2
      FOR UPDATE
    `;
    return this.db.oneOrNone(query, [gameId, userId]);
  }

  async findCashById(participantId: string): Promise<number | null> {
    const row = await this.db.oneOrNone<{ cash: number }>(
      "SELECT cash FROM game_participants WHERE id = $1",
      [participantId],
    );
    return row?.cash ?? null;
  }

  async decrementCash(participantId: string, amount: number): Promise<number> {
    const query = `
      UPDATE game_participants
      SET cash = cash - $2, updated_at = now()
      WHERE id = $1
      RETURNING cash
    `;
    const row = await this.db.one<{ cash: number }>(query, [
      participantId,
      amount,
    ]);
    return row.cash;
  }

  async listActiveByGame(
    gameId: string,
  ): Promise<{ id: string; user_id: string }[]> {
    const query = `
      SELECT id, user_id
      FROM game_participants
      WHERE game_id = $1 AND is_bankrupt = false
      ORDER BY joined_at ASC
    `;
    return this.db.manyOrNone(query, [gameId]);
  }

  async create(params: {
    gameId: string;
    userId: string;
    cash: number;
    tokenColor?: string | null;
  }): Promise<GameParticipantRecord> {
    const query = `
      INSERT INTO game_participants (game_id, user_id, cash, token_color)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        game_id,
        user_id,
        cash,
        token_color,
        position,
        in_jail,
        jail_turns,
        goojf_cards,
        is_bankrupt,
        joined_at,
        created_at,
        updated_at
    `;

    return this.db.one(query, [
      params.gameId,
      params.userId,
      params.cash,
      params.tokenColor ?? null,
    ]);
  }

  async findByGameAndUser(
    gameId: string,
    userId: string,
  ): Promise<GameParticipantRecord | null> {
    const query = `
      SELECT
        id,
        game_id,
        user_id,
        cash,
        token_color,
        position,
        in_jail,
        jail_turns,
        goojf_cards,
        is_bankrupt,
        joined_at,
        created_at,
        updated_at
      FROM game_participants
      WHERE game_id = $1 AND user_id = $2
    `;

    return this.db.oneOrNone(query, [gameId, userId]);
  }

  async listByGame(gameId: string): Promise<GameParticipantRecord[]> {
    const query = `
      SELECT
        id,
        game_id,
        user_id,
        cash,
        token_color,
        position,
        in_jail,
        jail_turns,
        goojf_cards,
        is_bankrupt,
        joined_at,
        created_at,
        updated_at
      FROM game_participants
      WHERE game_id = $1
      ORDER BY joined_at ASC
    `;

    return this.db.manyOrNone(query, [gameId]);
  }

  async listByGameForUpdate(gameId: string): Promise<GameParticipantRecord[]> {
    const query = `
      SELECT
        id,
        game_id,
        user_id,
        cash,
        token_color,
        position,
        in_jail,
        jail_turns,
        goojf_cards,
        is_bankrupt,
        joined_at,
        created_at,
        updated_at
      FROM game_participants
      WHERE game_id = $1
      ORDER BY joined_at ASC
      FOR UPDATE
    `;

    return this.db.manyOrNone(query, [gameId]);
  }

  async listWithUsersByGame(gameId: string): Promise<ParticipantWithUser[]> {
    const query = `
      SELECT
        gp.id AS gp_id,
        gp.game_id AS gp_game_id,
        gp.user_id AS gp_user_id,
        gp.cash AS gp_cash,
        gp.token_color AS gp_token_color,
        gp.position AS gp_position,
        gp.in_jail AS gp_in_jail,
        gp.jail_turns AS gp_jail_turns,
        gp.goojf_cards AS gp_goojf_cards,
        gp.is_bankrupt AS gp_is_bankrupt,
        gp.joined_at AS gp_joined_at,
        gp.created_at AS gp_created_at,
        gp.updated_at AS gp_updated_at,
        u.id AS u_id,
        u.display_name AS u_display_name,
        u.email AS u_email
      FROM game_participants gp
      JOIN users u ON u.id = gp.user_id
      WHERE gp.game_id = $1
      ORDER BY gp.joined_at ASC
    `;

    const rows = await this.db.manyOrNone<ParticipantWithUserRow>(query, [
      gameId,
    ]);

    return rows.map((row) => ({
      participant: {
        id: row.gp_id,
        game_id: row.gp_game_id,
        user_id: row.gp_user_id,
        cash: row.gp_cash,
        token_color: row.gp_token_color,
        position: row.gp_position,
        in_jail: row.gp_in_jail,
        jail_turns: row.gp_jail_turns,
        goojf_cards: row.gp_goojf_cards,
        is_bankrupt: row.gp_is_bankrupt,
        joined_at: row.gp_joined_at,
        created_at: row.gp_created_at,
        updated_at: row.gp_updated_at,
      },
      user: {
        id: row.u_id,
        display_name: row.u_display_name,
        email: row.u_email,
      },
    }));
  }

  async countByGame(gameId: string): Promise<number> {
    const query = `
      SELECT COUNT(*)::int AS count
      FROM game_participants
      WHERE game_id = $1
    `;

    const row = await this.db.one<{ count: number }>(query, [gameId]);
    return row.count;
  }

  async updatePosition(
    participantId: string,
    position: number,
    previousPosition?: number | null,
  ): Promise<GameParticipantRecord> {
    const query = `
      UPDATE game_participants
      SET position = $2,
          updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        game_id,
        user_id,
        cash,
        token_color,
        position,
        in_jail,
        jail_turns,
        goojf_cards,
        is_bankrupt,
        joined_at,
        created_at,
        updated_at
    `;

    void previousPosition;
    return this.db.one<GameParticipantRecord>(query, [participantId, position]);
  }

  async setInJail(participantId: string, inJail: boolean): Promise<void> {
    const query = `
      UPDATE game_participants
      SET in_jail = $2, updated_at = now()
      WHERE id = $1
    `;

    await this.db.none(query, [participantId, inJail]);
  }

  async updateCash(participantId: string, cash: number): Promise<void> {
    const query = `
      UPDATE game_participants
      SET cash = $2, updated_at = now()
      WHERE id = $1
    `;

    await this.db.none(query, [participantId, cash]);
  }

  async incrementCash(participantId: string, amount: number): Promise<number> {
    const query = `
      UPDATE game_participants
      SET cash = cash + $2, updated_at = now()
      WHERE id = $1
      RETURNING cash
    `;

    const row = await this.db.one<{ cash: number }>(query, [
      participantId,
      amount,
    ]);
    return row.cash;
  }

  async markBankrupt(participantId: string): Promise<void> {
    const query = `
      UPDATE game_participants
      SET is_bankrupt = true, updated_at = now()
      WHERE id = $1
    `;

    await this.db.none(query, [participantId]);
  }
}

export const gameParticipantsRepository = new GameParticipantsRepository(
  pgPool,
);

export function createGameParticipantsRepository(
  db: DbClient,
): GameParticipantsRepository {
  return new GameParticipantsRepository(db);
}
