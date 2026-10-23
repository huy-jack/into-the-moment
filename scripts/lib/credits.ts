export type CreditRow = { path: string; pexelsId: string };

/** Rows of fixtures/photos/CREDITS.md whose source is a Pexels photo page. */
export function parseCredits(md: string): CreditRow[] {
  const rows: CreditRow[] = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*([^|]+?\.jpg)\s*\|\s*https:\/\/www\.pexels\.com\/photo\/(\d+)\/?\s*\|/);
    if (m) rows.push({ path: m[1], pexelsId: m[2] });
  }
  return rows;
}

export const pexelsImageUrl = (id: string) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`;
