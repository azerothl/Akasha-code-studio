# Code Studio ↔ Hermes-style cockpit

Goal: surface **long-running jobs**, **logs**, **RAG status**, **worktrees**, and **terminal/backends** from the Akasha daemon in this UI.

## Daemon endpoints to wire (incremental)

| Area | HTTP (examples) | UI idea |
|------|-----------------|--------|
| Jobs / scheduler | `GET /api/schedules`, `GET /api/task_runs`, `POST .../run-now` | Panel liste + actions pause/resume |
| Process watch | `GET /api/process/watch/recent?limit=50` | Toast / liste fins de commandes background |
| Terminal | `GET /api/terminal/capabilities` | Afficher mode actuel vs PTY planifié |
| Tools | `GET /api/tools/effective` | Badge politique par session |
| Webhooks (doc) | `docs/automation-webhooks.md` (core) | Lien doc opérateur |
| Memory | `GET /api/memory/recall-metrics` | Sparkline recall |

## Implémenté (cockpit brut)

Dans l’UI Code Studio : menu **Agent / actions** → **Afficher le cockpit daemon** — appelle en lecture les cinq endpoints ci-dessus (schedules, task_runs, process watch, terminal capabilities, tools effective) et affiche le JSON (voir `src/hermesOpsPanel.tsx`).

## Existing Code Studio docs

- **`CODE_STUDIO_SPEC.md`** — contrat API et phases produit.

## Dev proxy

`vite.config.ts` proxifie `/api/*` vers le daemon — les nouvelles routes sont utilisables dès branchement des composants React.
