import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('trades', {
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
    initiator_id: {
      type: 'uuid',
      notNull: true,
      references: 'game_participants(id)',
      onDelete: 'CASCADE',
    },
    recipient_id: {
      type: 'uuid',
      notNull: true,
      references: 'game_participants(id)',
      onDelete: 'CASCADE',
    },
    initiator_cash: {
      type: 'integer',
      default: 0,
    },
    recipient_cash: {
      type: 'integer',
      default: 0,
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'pending', // 'pending', 'accepted', 'rejected', 'cancelled'
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

  pgm.createIndex('trades', 'game_id');
  pgm.createIndex('trades', 'initiator_id');
  pgm.createIndex('trades', 'recipient_id');
  pgm.createIndex('trades', 'status');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('trades');
}

