import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('turns', {
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
    participant_id: {
      type: 'uuid',
      notNull: true,
      references: 'game_participants(id)',
      onDelete: 'CASCADE',
    },
    turn_number: {
      type: 'integer',
      notNull: true,
    },
    dice_roll_1: {
      type: 'integer',
    },
    dice_roll_2: {
      type: 'integer',
    },
    is_double: {
      type: 'boolean',
      default: false,
    },
    previous_position: {
      type: 'integer',
    },
    new_position: {
      type: 'integer',
    },
    action_taken: {
      type: 'varchar(200)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('turns', 'game_id');
  pgm.createIndex('turns', 'participant_id');
  pgm.createIndex('turns', ['game_id', 'turn_number']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('turns');
}

