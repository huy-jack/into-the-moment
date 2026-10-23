import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

// Applies drizzle/ to DATABASE_URL. drizzle-kit migrate hides the error on failure; this prints it.
// Never prints the URL: it holds the database password.
const url = (process.env.DATABASE_URL ?? '').trim();

async function main() {
  if (!url) throw new Error('DATABASE_URL is empty in .env.local');
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error('DATABASE_URL must start with postgresql:// (no psql, no quotes around it)');
  }
  await migrate(drizzle(neon(url)), { migrationsFolder: 'drizzle' });
  console.log('Migrations applied.');
}

main().catch((e) => {
  const cause = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message})` : '';
  const msg = (e instanceof Error ? e.message : String(e)) + cause;
  console.error('Migration failed:', url ? msg.replaceAll(url, '<DATABASE_URL>') : msg);
  process.exit(1);
});
