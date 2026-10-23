# Test photo credits

Free-license stock photos only. One row per file: path, source URL, author, license.

The photo files are not committed. Run `pnpm photos` to download every row below into this folder.
Your own photos go in `private/` (git-ignored), named `1.jpg` to `3.jpg`.

Needed (see `fixtures/pairs.json` and `fixtures/people.json`):

- `man-a/1-3.jpg`, `woman-a/1-3.jpg`, `man-b/1-3.jpg`, `child-a/1-3.jpg`: 3 or more photos of the same stock model each, clear face, one full-body if possible.
- `templates/man-action.jpg`, `woman-action.jpg`, `adult-action.jpg`, `child-action.jpg`, `wide-shot.jpg`: one person doing something; the wide shot has a small face (under 15% of image height).

| Path | Source | Author | License |
|---|---|---|---|
| templates/man-action.jpg | https://www.pexels.com/photo/3760259/ | Pexels contributor (see source page) | Pexels License |
| templates/woman-action.jpg | https://www.pexels.com/photo/3756690/ | Pexels contributor (see source page) | Pexels License |
| templates/adult-action.jpg | https://www.pexels.com/photo/3769704/ | Pexels contributor (see source page) | Pexels License |
| templates/child-action.jpg | https://www.pexels.com/photo/4473632/ | Pexels contributor (see source page) | Pexels License |
| templates/wide-shot.jpg | https://www.pexels.com/photo/3769735/ | Pexels contributor (see source page) | Pexels License |
| man-a/1.jpg | https://www.pexels.com/photo/3778602/ | Pexels contributor (see source page) | Pexels License |
| man-a/2.jpg | https://www.pexels.com/photo/3778603/ | Pexels contributor (see source page) | Pexels License |
| man-a/3.jpg | https://www.pexels.com/photo/3778607/ | Pexels contributor (see source page) | Pexels License |
| man-b/1.jpg | https://www.pexels.com/photo/3785074/ | Pexels contributor (see source page) | Pexels License |
| man-b/2.jpg | https://www.pexels.com/photo/3785079/ | Pexels contributor (see source page) | Pexels License |
| man-b/3.jpg | https://www.pexels.com/photo/3785110/ | Pexels contributor (see source page) | Pexels License |
| woman-a/1.jpg | https://www.pexels.com/photo/3756679/ | Pexels contributor (see source page) | Pexels License |
| woman-a/2.jpg | https://www.pexels.com/photo/3756677/ | Pexels contributor (see source page) | Pexels License |
| woman-a/3.jpg | https://www.pexels.com/photo/3756688/ | Pexels contributor (see source page) | Pexels License |
| child-a/1.jpg | https://www.pexels.com/photo/3760297/ | Pexels contributor (see source page) | Pexels License |
| child-a/2.jpg | https://www.pexels.com/photo/3760299/ | Pexels contributor (see source page) | Pexels License |

All files: downloaded at width 1600 from the Pexels image server on 2026-10-20.

## Shipped in the app (`public/hero/`)

The hero result and its "Try this moment" photo. Credits are in `public/hero/CREDITS.md`.

## Example photos on step 2 (`public/examples/`)

| Path | Source | License | Note |
|---|---|---|---|
| public/examples/good.jpg | https://www.pexels.com/photo/3778603/ | Pexels License | Square crop |
| public/examples/filtered.jpg | https://www.pexels.com/photo/3778603/ | Pexels License | Same photo, edited on purpose with a blur and colour boost to show a beauty filter |
| public/examples/far.jpg | https://www.pexels.com/photo/3769735/ | Pexels License | Square crop of the hay bale photo |
