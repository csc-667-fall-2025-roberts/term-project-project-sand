import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('card_decks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    game_id: {
      type: 'uuid',
      notNull: true,
      references: 'games(id)',
      onDelete: 'CASCADE',
    },
    deck_type: {
      type: 'varchar(50)',
      notNull: true, // 'chance' or 'community_chest'
    },
    current_index: {
      type: 'integer',
      default: 0,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('card_decks', 'game_id');
  pgm.createIndex('card_decks', ['game_id', 'deck_type'], { unique: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('card_decks');
}

