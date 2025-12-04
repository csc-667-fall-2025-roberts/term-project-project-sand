import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('games', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(200)',
      notNull: true,
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    game_code: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
    },
    status: {
      type: 'varchar(200)',
      notNull: true,
      default: 'waiting',
    },
    game_type: {
      type: 'varchar(200)',
    },
    max_players: {
      type: 'integer',
      notNull: true,
      default: 4,
    },
    turn_index: {
      type: 'integer',
      default: 0,
    },
    started_at: {
      type: 'timestamp',
    },
    ended_at: {
      type: 'timestamp',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('games', 'game_code');
  pgm.createIndex('games', 'status');
  pgm.createIndex('games', 'created_at');
  pgm.createIndex('games', 'created_by');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('games');
}

