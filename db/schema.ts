import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', { id:text('id').primaryKey(), owner:text('owner').notNull(), kind:text('kind').notNull(), data:text('data').notNull(), created:integer('created').notNull() }, t => [index('records_owner').on(t.owner),index('records_kind').on(t.kind)]);
