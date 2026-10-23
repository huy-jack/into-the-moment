import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { Db } from './repo';
import * as schema from './schema';

let db: Db | null = null;

/** Neon over HTTP: no connection pool to hold open between serverless calls. */
export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('missing env DATABASE_URL');
    db = drizzle(neon(url), { schema }) as unknown as Db;
  }
  return db;
}
