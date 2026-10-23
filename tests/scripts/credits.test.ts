import { describe, expect, it } from 'vitest';
import { parseCredits, pexelsImageUrl } from '@/scripts/lib/credits';

const md = `# Test photo credits

| Path | Source | Author | License |
|---|---|---|---|
| templates/man-action.jpg | https://www.pexels.com/photo/3760259/ | Pexels contributor (see source page) | Pexels License |
| man-a/1.jpg | https://www.pexels.com/photo/3778602/ | Pexels contributor | Pexels License |
| other/x.jpg | https://example.com/x.jpg | someone | CC0 |
`;

describe('parseCredits', () => {
  it('reads one row per Pexels photo and skips the header and other sources', () => {
    expect(parseCredits(md)).toEqual([
      { path: 'templates/man-action.jpg', pexelsId: '3760259' },
      { path: 'man-a/1.jpg', pexelsId: '3778602' },
    ]);
  });

  it('builds the 1600 px image server link the photos were first downloaded from', () => {
    expect(pexelsImageUrl('3760259')).toBe(
      'https://images.pexels.com/photos/3760259/pexels-photo-3760259.jpeg?auto=compress&cs=tinysrgb&w=1600',
    );
  });
});
