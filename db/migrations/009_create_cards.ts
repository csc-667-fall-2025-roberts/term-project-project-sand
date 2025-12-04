import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('cards', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    deck_type: {
      type: 'varchar(50)',
      notNull: true, // 'chance' or 'community_chest'
    },
    card_order: {
      type: 'integer',
      notNull: true,
    },
    message: {
      type: 'text',
      notNull: true,
    },
    action_type: {
      type: 'varchar(100)',
      notNull: true, // 'move', 'pay', 'collect', 'jail', etc.
    },
    action_value: {
      type: 'text', // JSON string for complex actions
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('cards', 'deck_type');
  pgm.createIndex('cards', ['deck_type', 'card_order'], { unique: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('cards');
}

