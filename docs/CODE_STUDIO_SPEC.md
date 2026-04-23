# Code Studio — spécification de livraison

Document de référence pour l’UI [Akasha-code-studio](https://github.com/azerothl/Akasha-code-studio) et les extensions **daemon** (`akasha-daemon`). À mettre à jour à chaque phase clôturée.

---

## Table des phases (plan produit)

| Phase | Objectif | In / out | Dépendances | Risques |
|-------|----------|----------|-------------|---------|
| 1 MVP | Racine projet sandboxée, listing, raw, agent scaffold | In: `studio-projects/<UUID>`, APIs fichiers, `POST /api/message` studio_* | Daemon + UI minimale | Chemins `..`, symlinks |
| 2 Build réel | Commande contrôlée + logs + timeout | In: `POST .../build` | Git/npm sur hôte | Supply chain, pas de conteneur par défaut |
| 3 Dev live | `npm run dev` + proxy preview signé | Out (partiel): non implémenté dans le daemon | Réseau, auth | Exposition LAN |
| 4 GitHub | Clone HTTPS, push via agent + vault | In: `POST .../git/clone` | git, credentials | Secrets hors vault |
| 5 Branches évolution | `studio/*`, merge / abandon | In: évolutions API + meta JSON | git | Conflits merge |
| 6 Parallélisme | Plusieurs évolutions, limite jobs | In: `AKASHA_STUDIO_MAX_PARALLEL_OPS` | Tokio semaphore | Saturation disque / CPU |
| 7 Qualité UI | Templates React/Tailwind, tokens | UI repo | Design system | Dette UI |
| 8 Contrôle fin | Diff par hunk, @fichier | Out: roadmap | UI + API | Complexité |
| 9 Avancé | WebContainers, canvas | Out: roadmap | Client lourd | — |

---

## Exigences traçables

| ID | Phase | Exigence | Statut |
|----|-------|----------|--------|
| STU-001 | 1 | Chaque projet studio = UUID sous `<data_dir>/studio-projects/<UUID>/` | Fait (daemon `studio.rs`) |
| STU-002 | 1 | `POST /api/message` accepte `studio_project_id`, `studio_assigned_agent`, `studio_evolution_branch`, `studio_evolution_id` | Fait |
| STU-003 | 1 | Outils fichier / `run_command` utilisent la racine disque studio pour la lignée de tâche | Fait (`StudioDiskRootRegistry`) |
| STU-004 | 1 | `GET /api/studio/projects`, `POST .../projects` | Fait |
| STU-005 | 1 | `GET .../files`, `GET .../raw?path=` avec rejet `..` et hors racine | Fait |
| STU-006 | 4 | `POST .../git/clone` (HTTPS, répertoire quasi vide) | Fait |
| STU-007 | 2 | `POST .../build` avec `argv[]`, `timeout_sec`, capture stdout/stderr bornée ; sous Windows shims npm/pnpm/yarn via shell | Fait |
| STU-008 | 5 | `GET/POST .../evolutions`, merge, abandon ; méta dans `.akasha-studio.json` | Fait |
| STU-009 | 6 | Limite parallélisme studio (`AKASHA_STUDIO_MAX_PARALLEL_OPS`) | Fait |
| STU-010 | 1 | Rappel prompt « périmètre studio » si racine sous `studio-projects` | Fait (`STUDIO_DISK_REMINDER`) |
| STU-010b | 1 | Désactiver le garde-fou **small-talk** (suppression des réponses « outil ») pour les tâches dont le disque outil est sous `studio-projects/` | Fait (`run_message_via_llm`) |
| STU-014 | 1 | Liste projets avec **nom lisible** + `PATCH .../projects/:id` pour renommer l’affichage | Fait |
| STU-015 | 1 | Champ **stack technique** en méta (POST/PATCH, GET méta) ; préfixe injecté dans `POST /api/message` pour les agents `studio_*` | Fait |
| STU-016 | 3 | UI : onglets **Éditeur** / **Aperçu** / **Logs** ; éditeur **Monaco** (workers via CDN) ; **Play** lance `npm install` si besoin puis `npm run dev` côté daemon ; logs dev via `GET .../preview/logs` | Fait |
| STU-017 | 3 | `GET .../preview/logs`, `POST .../preview/install`, `git_branch` sur GET méta projet | Fait |
| STU-018 | 1 | Fichier `CODE_STUDIO_PLAN.md` à la création ; garde-fou `write_file` anti-markdown sur fichiers code studio ; vérif post-tâche optionnelle (méta `verify_*`) | Fait |
| STU-019 | 1 | Tâches studio : prompt système **dédié** (`CODE_STUDIO_APP_CONTEXT` + instructions outils compactes, sans bloc général Akasha TUI/skills) ; `strip_markdown_fences` sur `write_file` ; persistance UI du `task_id` (rechargement) ; `DELETE .../raw` + outil `delete_file` côté agent | Fait |
| STU-DESIGN-001 | 1 | Section UI **Design** : voir, éditer, sauvegarder et exporter `DESIGN.md` | Fait |
| STU-DESIGN-002 | 2 | `POST /api/studio/projects/:id/design/validate` retourne findings + summary lint DESIGN.md | Fait |
| STU-DESIGN-003 | 2 | `POST /api/message` accepte `studio_design_hint` et `studio_design_doc` (préfixes design) | Fait |
| STU-DESIGN-004 | 3 | Merge évolution : option `design_check` bloque si lint DESIGN.md régresse | Fait |
| STU-011 | 2 | Exécution builds **conteneurisée** par défaut | Reporté (utiliser `run_in_container` côté agent + policy) |
| STU-012 | 3 | Proxy preview dev server | Reporté |
| STU-013 | 8 | Application de patchs par hunk dans l’UI | Reporté |

---

## Contrats API (daemon)

Base : même hôte que le daemon, préfixe `/api`. CORS : usage recommandé via proxy Vite (`/api` → `127.0.0.1:3876`). Les requêtes **mutantes** depuis un navigateur sont soumises au contrôle **Origin** (localhost / Tauri) côté daemon.

### `POST /api/message`

Champs JSON utiles Code Studio (en plus de `message`, `session_id`, etc.) :

| Champ | Type | Description |
|-------|------|-------------|
| `studio_project_id` | string (UUID) | Répertoire projet sous `studio-projects/` |
| `studio_assigned_agent` | string | `studio_scaffold` \| `studio_frontend` \| `studio_backend` \| `studio_fullstack` |
| `studio_evolution_branch` | string | Branche Git (injectée dans le contexte message) |
| `studio_evolution_id` | string | Si présent avec `studio_project_id`, résolution de la branche via `.akasha-studio.json` |
| `studio_design_hint` | string | Résumé design compact (tokens/intention) |
| `studio_design_doc` | string | Contenu DESIGN.md (tronqué/sanitisé côté daemon) |

Réponse typique : `{ "ack": true, "task_id": "…", "session_id": "…", "message": "…" }`.

### `/api/studio/projects`

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/studio/projects` | Liste `{ projects: [{ id, name, path }] }` (`name` depuis `.akasha-studio.json` ou repli `Projet xxxxxxxx`) |
| POST | `/api/studio/projects` | Crée un UUID ; corps optionnel `{ "name": "…", "tech_stack": "…" }` → `{ id, path }` |
| PATCH | `/api/studio/projects/:id` | Corps : `name`, `tech_stack`, et/ou options de vérif post-tâche : `verify_skip` (bool), `verify_argv` (tableau de chaînes ou `null`), `verify_timeout_sec` (nombre 1–3600 ou `null`) |
| GET | `/api/studio/projects/:id` | Lit méta + évolutions (`tech_stack`, champs `verify_*`). Ajoute `git_branch` et `git_worktree_clean` lorsque le dépôt Git est valide. |
| POST | `/api/studio/projects/:id/preview/start` | Corps JSON optionnel `{ "force_install": bool, "port": number }`. Exige `package.json` : si `node_modules` absent ou `force_install`, exécute `npm install` (timeout 900 s) ; puis lance en arrière-plan `npm run dev -- --host 127.0.0.1 --port <p>` (tue un serveur précédent pour ce projet). Réponse `{ ok, url, port, installed?, install? }`. **Windows** : `npm` est invoqué via `cmd.exe /c` (même logique que le build). Les sorties du serveur dev sont capturées pour `GET .../preview/logs`. |
| POST | `/api/studio/projects/:id/preview/stop` | Arrête le processus dev enregistré pour ce projet (`{ ok, stopped }`). |
| GET | `/api/studio/projects/:id/preview/logs` | `{ running, log, preview_inactive? }` — tampon borné des stdout/stderr du `npm run dev`. |
| POST | `/api/studio/projects/:id/preview/install` | Corps `{ "force": bool }`. Exécute `npm install` sans lancer le serveur ; si `force` est faux et `node_modules` existe, `{ ok, skipped, reason }`. |

### Fichiers & raw

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/studio/projects/:id/files` | `{ files: string[] }` (limite profondeur / nombre) |
| GET | `/api/studio/projects/:id/raw?path=` | JSON `{ path, mime, content }` ou `content_base64` |
| DELETE | `/api/studio/projects/:id/raw?path=` | Supprime le fichier indiqué (fichier uniquement, pas un répertoire) ; mêmes règles de chemin que GET/PUT |

### Git

| Méthode | Chemin | Corps | Description |
|---------|--------|-------|-------------|
| POST | `/api/studio/projects/:id/git/clone` | `{ "repo_url": "https://…", "branch"?: string }` | Clone dans la racine projet |

### Build

| Méthode | Chemin | Corps | Description |
|---------|--------|-------|-------------|
| POST | `/api/studio/projects/:id/build` | `{ "argv": ["npm","run","build"], "timeout_sec"?: number }` | Exécute sur l’**hôte** avec `cwd` = projet ; sortie tronquée. Sous **Windows**, les commandes `npm`, `npx`, `pnpm`, `yarn`, `corepack` passent par `cmd.exe /c` pour éviter « program not found » (shims `.cmd`). |

Erreurs fréquentes : `invalid or unsafe argv`, timeout → JSON avec `error: "timeout"`.

**Vérification post-tâche (agents Code Studio)** : après une tâche dont le disque outil est sous `studio-projects/`, le daemon lance une commande de vérif si `verify_skip` est faux dans `.akasha-studio.json` : `verify_argv` si défini, sinon `npm run build` si `package.json` existe, sinon `cargo check` si `Cargo.toml` existe. En cas d’échec, la tâche est marquée **failed** et un `ProgressUpdate` contient la sortie tronquée.

### Évolutions (workflow branche)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/studio/projects/:id/evolutions` | `{ evolutions: [...] }` |
| POST | `/api/studio/projects/:id/evolutions` | Corps optionnel `{ "label": "slug" }` → `201` `{ evolution_id, branch }` (nécessite dépôt git) |
| POST | `/api/studio/projects/:id/evolutions/:eid/merge` | Merge `--no-ff` dans `main` (ou `master`) ; corps optionnel `{ "design_check": bool }` |
| POST | `/api/studio/projects/:id/evolutions/:eid/abandon` | `git branch -D` + statut `abandoned` |
| POST | `/api/studio/projects/:id/design/validate` | Corps optionnel `{ "content": "..." }` ; sinon lit `DESIGN.md` disque |

---

## UI — écrans et comportements

| Zone | Comportement attendu |
|------|----------------------|
| Liste projets | Création `POST /projects`, sélection charge fichiers + évolutions |
| Arbre fichiers | `GET /files` ; clic → `GET /raw` |
| Zone centrale | Onglets **Éditeur** \| **Aperçu** \| **Plan** \| **Design** \| **Logs serveur** |
| Éditeur | **Monaco Editor** (`@monaco-editor/react`), thème sombre, coloration selon l’extension ; édition locale uniquement (pas de sauvegarde API). Workers Monaco chargés depuis jsDelivr (`monaco-editor@0.52.2`) pour compatibilité bundle Vite. |
| Aperçu | **▶ Lancer la prévisualisation** : `POST .../preview/start` — serveur dev sur `127.0.0.1` ; **Arrêter le serveur** : `POST .../preview/stop`. Sinon, fichier `.html` ouvert : aperçu statique (blob + iframe `sandbox`). Priorité : URL serveur dev si actif, sinon blob. |
| Barre ops | Clone HTTPS, build argv, merge / abandon évolution |
| Chat | `POST /api/message` avec `studio_project_id`, agent forcé, évolution |
| Design | Édition de `DESIGN.md`, diagnostics, import/export, export artefacts (`DESIGN.tokens.json`, `DESIGN.css`), toggle auto-apply contexte design |
| Stack projet | `<select>` de préréglages (Vite/React/TS, Python/uv/Streamlit, Go, Rust, etc.) + option « Personnalisé » ; section repliable avec cases à cocher (frontend, backend, design, données, qualité) qui complètent le texte ; enregistrement = chaîne unique via `PATCH` (`tech_stack`) |
| Logs build | Résultat `POST .../build` |
| Indicateur sandbox | L’UI affiche que le périmètre disque est le dossier projet ; l’isolation réseau/conteneur dépend de la policy et de `run_in_container` |

---

## Sandbox & sécurité

- **Disque** : IDs projet = UUID validés ; `raw` refuse `..` et chemins hors racine canonique.
- **Build API** : arguments filtrés (pas de `|`, `;`, `&`, retours ligne, `..`).
- **Hôte** : `npm install` / scripts post-install sur le poste = risque résiduel — **STU-011** reporté vers conteneur.
- **Réseau** : non restreint par le daemon pour les commandes build (contrairement à un runner conteneurisé idéal).
- **Prévisualisation** : le daemon lance `npm run dev` sur l’hôte (`127.0.0.1:<port>`) ; l’UI charge les workers Monaco depuis un CDN (accès Internet requis pour l’éditeur en production build).

---

## Matrice de tests

| Scénario | Type | Statut |
|----------|------|--------|
| Liste / création projet | Playwright (mock) | Fait `e2e/smoke.spec.ts` |
| Ouverture fichier + preview HTML | Playwright (mock) | Fait |
| Envoi message (mock `/api/message`) | Playwright | Fait |
| Clone réel HTTPS | Manuel | À faire |
| Build `npm` sur template | Manuel / CI optionnel | À faire |
| Évolution + merge sans conflit | Manuel | À faire |
| `studio_evolution_id` résolu → branche | Intégration | Fait (daemon) |

### Given / When / Then (exemple)

1. **Given** un daemon et un projet studio avec `index.html`, **when** `GET .../raw?path=index.html`, **then** `200` et `mime` text/html.
2. **Given** un dépôt git avec `main`, **when** `POST .../evolutions` avec label `fix`, **then** `201` et branche `studio/fix` ou `studio/<uuid8>`.

---

## Checklist de recette (avant clôture phase)

- [ ] Spec mise à jour (tableaux statuts + exigences).
- [ ] `cargo check -p akasha-daemon` (ou features Windows `embeddings-tract` si besoin).
- [ ] `npm run build` + `npm run test:e2e` dans ce dépôt.
- [ ] Manuel : créer projet, message agent `studio_scaffold`, vérifier tâche dans UI Akasha principale si besoin.

---

## Gouvernance

Une PR qui livre une phase **doit** mettre à jour ce fichier (cases cochées, nouvelles exigences, statuts `STU-*`).

---

## Références

- Daemon : `crates/akasha-daemon/src/api_studio.rs`, `studio.rs`, `api.rs` (`POST /api/message`, `run_message_via_llm`).
- Guide utilisateur : section *Code Studio* dans `spec/user_guide.md` (dépôt Akasha).
