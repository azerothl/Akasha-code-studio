# Code Studio — cockpit opérateur (daemon)

goal: surface **long-running jobs**, **logs**, **RAG status**, **worktrees**, and **terminal/backends** from the Akasha daemon in this UI.

## Daemon endpoints to wire (incremental)

| Area | HTTP (examples) | UI idea |
|------|-----------------|--------|
| Jobs / scheduler | `GET /api/schedules`, `GET /api/task_runs`, `POST /api/schedules/{id}/run_now` | Panel liste + actions pause/resume |
| Process watch | `GET /api/process/watch/recent?limit=50` | Toast / liste fins de commandes background |
| Terminal | `GET /api/terminal/capabilities` | Afficher mode actuel vs PTY planifié |
| Tools | `GET /api/tools/effective` | Badge politique par session |
| Webhooks (doc) | `docs/automation-webhooks.md` (core) | Lien doc opérateur |
| Memory | `GET /api/memory/recall-metrics` | Sparkline recall |
| MCP (statut disque) | `GET /api/mcp/status` | Résumé `mcp.json` + validité schéma |
| Lifecycle hooks | `GET /api/lifecycle/hooks` | Résumé `lifecycle_hooks.json` |

## Implémenté (cockpit structuré)

Dans l’UI Code Studio, le **cockpit opérateur** est affiché dans l’onglet central **Cockpit**.  
La vue est maintenant structurée en sections opérateur actionnables:

- **Task runs** (`GET /api/task_runs`) — liste condensée des exécutions récentes.
- **Process watch** (`GET /api/process/watch/recent`) — flux récent avec état succès/erreur.
- **Terminal** (`GET /api/terminal/capabilities`) — résumé mode courant / PTY / shells.
- **Tools effective** (`GET /api/tools/effective`) — profil actif + compteurs allow/approval/deny.
- **MCP** (`GET /api/mcp/status` + `GET /api/mcp/runtime`) — statut config/runtime + OAuth mode.
- **Lifecycle hooks** (`GET /api/lifecycle/hooks`) — sandbox, timeout, phases exécutées.
- **Scheduler actions** (`GET /api/schedules` + `POST /api/schedules/{id}/{pause|resume|run_now}`).

Chaque section conserve un **fallback Raw JSON** repliable pour diagnostic.

Le cockpit inclut aussi:

- un bouton **Rafraîchir** (rechargement complet),
- un mode **auto-refresh léger** (runs + process watch uniquement).

## UX complémentaires

- **Reprise du dernier projet**: l’ID du dernier projet sélectionné est persisté localement et réappliqué au démarrage si le projet existe encore.
- **Conversation**: le panneau chat s’ouvre en bas (dernier message visible), avec garde-fou si l’utilisateur scrolle manuellement (bouton "Nouveaux messages — aller en bas").
- **Détail tâche**: les événements sont regroupés explicitement en sections **Sous-agents**, **Outils** et **Autres événements**.
- **Anti-dup streaming**: les répétitions d’événements et de progressions dues au streaming sont dédupliquées sur clé sémantique pour éviter des bulles redondantes.

## Recette manuelle minimale

1. Ouvrir un projet puis l’onglet **Cockpit**.
2. Vérifier que les cartes **Task runs** et **Process watch** affichent des lignes structurées (pas seulement du JSON).
3. Déclencher une action scheduler (`Pause`, `Reprendre` ou `Exécuter maintenant`) et vérifier le feedback.
4. Ouvrir les sections `Raw JSON` pour confirmer la donnée brute de chaque endpoint.

## Existing Code Studio docs

- **`CODE_STUDIO_SPEC.md`** — contrat API et phases produit.

## Dev proxy

`vite.config.ts` proxifie `/api/*` vers le daemon — les nouvelles routes sont utilisables dès branchement des composants React.
