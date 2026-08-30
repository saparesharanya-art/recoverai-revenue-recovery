# RecoverAI – Intelligent Revenue Recovery Agent

RecoverAI helps merchants safely turn failed payments into explainable recovery actions and measurable recovered revenue.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/recoverai/src/App.tsx` — React application routes and feature screens.
- `artifacts/recoverai/src/index.css` — RecoverAI visual tokens and responsive UI styles.
- `artifacts/api-server/src/routes/recoverai.ts` — deterministic recovery agent, safety layer, demo processor, and API routes.
- `lib/api-spec/openapi.yaml` — source of truth for API contracts.
- `lib/db/src/schema/index.ts` — PostgreSQL/Drizzle relational schema.
- `README.md` — product overview, architecture, demo guide, and API map.

## Architecture decisions

- The app is demo-safe by default: no real-money actions or external credentials are required to evaluate the workflow.
- AI recommendations and financial execution are separate; deterministic merchant guardrails always run before an automated action.
- Demo data and payment outcomes are deterministic so scans are repeatable and metrics remain internally consistent across a run.
- OpenAPI is the contract source of truth; generated React Query hooks are used by the frontend and generated Zod schemas validate request boundaries.

## Product

The product includes a merchant dashboard, payment and customer profiles, AI recovery scans, human review, analytics, searchable audit trail, and configurable safety settings.

## User preferences

No additional preferences recorded.

## Gotchas

- Use Razorpay Test Mode only if the optional adapter is added; never send real-money transactions.
- Run `pnpm --filter @workspace/api-spec run codegen` after changing the OpenAPI contract.
- Use the shared proxy path `/api` for API calls; do not hardcode localhost in browser code.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
