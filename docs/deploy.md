# Deploy

Vercel Hobby (free plan), Neon Postgres, private Vercel Blob, Vercel Workflow.

## One-time setup

1. Push the repository to GitHub. Import it in Vercel (Hobby).
2. In the Vercel project, add **Neon** from the Marketplace. In Neon, cap compute at **0.25 CU** (autoscaling can reach 2 CU and use the 100 free compute hours fast). Vercel sets `DATABASE_URL`.
3. Add a **Blob** store with **private** access. Vercel sets `BLOB_READ_WRITE_TOKEN`.
4. Set the other env vars from `.env.example`:
   - `ACCESS_CODE`: the code you send the evaluators.
   - `SESSION_SECRET`: 32+ random characters.
   - `SPEND_CAP_USD=10`; `FACE_T` from `fixtures/calibration.json` (B1 calibration).
   - `MACHGEN_API_KEY`, `XKIRO_API_KEY` (optional `VISION_MODEL`), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`.
5. Run the migration once against Neon: `DATABASE_URL=… npx drizzle-kit migrate`.
6. Vercel Firewall: add 1 rate-limit rule (free on Hobby): `POST /api/access`, **10 requests per minute per IP**, action deny.
7. Deploy.

## Check it

- `pnpm smoke --url https://<deployment> --code <code> --pair c1`: expect `done`, 2 versions, under 10 minutes, and no function over 300 s in the Vercel logs.
- `pnpm smoke --url … --code wrong`: expect `access: 401` and the copy "That code is not right. Check the email you got."
- `curl -i https://<deployment>/api/jobs/x`: expect `401`.
- `pnpm smoke --url … --code … --pair c3-ac`: child route, paid calls on Seedream 5.0 Lite and FLUX.2 dev (about $0.045). Expect `done`, or `failed` with `REFUSED_ALL` if both refuse; never a GPT Image model in the versions.
- Inspect runs: Vercel dashboard → Workflows, or `npx workflow web` locally.

## After the evaluation (7 days)

Retention rule from the spec: delete every photo and result.

1. Vercel → Storage → Blob: delete the store (or every path under `uploads/` and `jobs/`).
2. Neon: drop the database, or `delete from candidates; delete from photos; delete from step_costs; delete from jobs;`.
