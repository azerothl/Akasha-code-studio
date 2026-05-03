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
| STU-OPS-001 | 3 | Cockpit Hermes structuré (sections opérateur: scheduler, task runs, process watch, terminal, tools, MCP, lifecycle) avec fallback raw JSON | Fait |
| STU-OPS-002 | 3 | Cockpit: refresh manuel + auto-refresh léger ciblé (`task_runs` + `process_watch`) | Fait |
| STU-SWARM-001 | 4 | Mode swarm studio **opt-in**: un coordinateur (`studio_project_manager`) peut déléguer à plusieurs workers bornés selon `AKASHA_STUDIO_MAX_PARALLEL_OPS` | Fait (MVP) |
| STU-SWARM-002 | 4 | États worker normalisés (`spawned`, `ready`, `running`, `blocked`, `completed`, `failed`, `stopped`) exposés via events tâche | Fait (MVP) |
| STU-SWARM-003 | 4 | Cockpit: vue graphe des sous-tâches studio + transitions d’état en quasi temps réel | Fait (MVP) |
| STU-SWARM-004 | 4 | Événement de conflit non bloquant (`studio_conflict_notice`) quand deux workers touchent les mêmes fichiers | Fait (MVP) |
| STU-GIT-001 | 1 | Création projet Studio initialise automatiquement un repo Git local avec branche primaire `main` | Fait |
| STU-GIT-002 | 1 | Reprise projet garantit l’existence d’une branche primaire (`main` ou `master`, création si absente) | Fait |
| STU-011 | 2 | Exécution builds **conteneurisée** par défaut | Fait (MVP, fallback hôte explicite) |
| STU-012 | 3 | Proxy preview dev server | Fait (URL signée courte TTL) |
| STU-013 | 8 | Application de patchs par hunk dans l’UI | Fait (MVP) |
| STU-020 | 1 | `POST /api/message` accepte `studio_acceptance_criteria` (texte ou JSON `criteria` avec `manual` / `file_exists` / `command_ok`) ; préfixe « Definition of Done » + bloc embarqué retiré avant LLM ; vérifications mécaniques après build | Fait |
| STU-021 | 1 | Revue sémantique optionnelle des critères **manual** (1 appel LLM sans outils ; `AKASHA_STUDIO_SEMANTIC_VERIFY=0` pour désactiver) ; événement `studio_acceptance_review` + champ `acceptance_review` sur `GET /api/tasks/:id` si points manquants | Fait |
| STU-022 | 1 | Garde-fou tours d’outils **lecture seule** Code Studio (`AKASHA_STUDIO_READ_ONLY_STREAK_MAX`, défaut 4) + `ProgressUpdate` étape garde-fou | Fait |
| STU-023 | 1 | Audit LLM des garde-fous **prose sans exécution** / **promesse sans `TOOL:`** lorsque les heuristiques déclenchent ; **activé par défaut** — `AKASHA_STUDIO_LLM_RESPONSE_AUDITOR=0` pour n’utiliser que les heuristiques ; `AKASHA_STUDIO_LLM_RESPONSE_AUDITOR_TIMEOUT_SEC` (défaut 22, plage 8–60) borne l’appel classifieur | Fait |
| STU-024 | 1 | Outil **`write_code`** (même protocole que `write_file`) : réservé aux extensions source listées côté daemon ; validation `studio_reject_polluted_code_content` sur **tout** chemin (pas seulement sous `studio-projects/`) ; permissions **`tools_policy`** : équivalence **`write_file`** (profil qui liste `write_file` autorise `write_code` sans dupliquer la ligne) | Fait |

---

## Contrats API (daemon)

Base : même hôte que le daemon, préfixe `/api`. CORS : usage recommandé via proxy Vite (`/api` → `127.0.0.1:3876`). Les requêtes **mutantes** depuis un navigateur sont soumises au contrôle **Origin** (localhost / Tauri) côté daemon.

### `POST /api/message`

Champs JSON utiles Code Studio (en plus de `message`, `session_id`, etc.) :

| Champ | Type | Description |
|-------|------|-------------|
| `studio_project_id` | string (UUID) | Répertoire projet sous `studio-projects/` |
| `studio_assigned_agent` | string | Préférence de **sous-agent** (`studio_scaffold`, `studio_frontend`, …) ; avec `studio_project_id`, le daemon route la tâche racine vers **`studio_project_manager`** (chef de projet) qui peut déléguer selon cette préférence. |
| `studio_evolution_branch` | string | Branche Git (injectée dans le contexte message) |
| `studio_evolution_id` | string | Si présent avec `studio_project_id`, résolution de la branche via `.akasha-studio.json` |
| `studio_design_hint` | string | Résumé design compact (tokens/intention) |
| `studio_design_doc` | string | Contenu DESIGN.md (tronqué/sanitisé côté daemon) |
| `studio_acceptance_criteria` | string \| objet \| tableau | Definition of Done : chaîne (critères manuels) **ou** `{ "criteria": [ { "id"?, "text", "kind": "manual" \| "file_exists" \| "command_ok", "path"?, "argv"? } ] }` **ou** tableau de critères. Les entrées `command_ok` utilisent les mêmes règles de sécurité que `verify_argv`. |

Réponse typique : `{ "ack": true, "task_id": "…", "session_id": "…", "message": "…" }`.

### `/api/studio/projects`

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/studio/projects` | Liste `{ projects: [{ id, name, path }] }` (`name` depuis `.akasha-studio.json` ou repli `Projet xxxxxxxx`) |
| POST | `/api/studio/projects` | Crée un UUID ; corps optionnel `{ "name": "…", "tech_stack": "…" }` → `{ id, path }` ; initialise `CODE_STUDIO_PLAN.md`, le dossier **`specs/`**, repo Git local et branche primaire `main` (fallback `master` selon environnement) |
| PATCH | `/api/studio/projects/:id` | Corps : `name`, `tech_stack`, et/ou options de vérif post-tâche : `verify_skip` (bool), `verify_argv` (tableau de chaînes ou `null`), `verify_timeout_sec` (nombre 1–3600 ou `null`) |
| GET | `/api/studio/projects/:id` | Lit méta + évolutions (`tech_stack`, champs `verify_*`). Garantit une branche primaire (`main`/`master`) au moment de la reprise si le dépôt Git existe. Ajoute `git_branch`, `git_worktree_clean` et **`git_worktree_lines`** (tableau borné, max 200 entrées `{ "status": string, "path": string }` dérivées de `git status --porcelain`, même source que « propre » / indicateur dirty) lorsque le dépôt Git est valide. |
| POST | `/api/studio/projects/:id/preview/start` | Corps JSON optionnel `{ "force_install": bool, "port": number }`. Exige `package.json` : si `node_modules` absent ou `force_install`, exécute `npm install` (timeout 900 s) ; puis lance en arrière-plan `npm run dev -- --host 127.0.0.1 --port <p>` (tue un serveur précédent pour ce projet). Réponse `{ ok, url, port, proxy_signed, installed?, install? }` où `url` pointe vers `/preview/proxy` signé (TTL court). **Windows** : `npm` est invoqué via `cmd.exe /c` (même logique que le build). Les sorties du serveur dev sont capturées pour `GET .../preview/logs`. |
| GET | `/api/studio/projects/:id/preview/proxy?token=...` | Vérifie un jeton signé court TTL et redirige vers `http://127.0.0.1:<port>` du projet. Scope projet strict. |
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
| POST | `/api/studio/projects/:id/build` | `{ "argv": ["npm","run","build"], "timeout_sec"?: number, "containerized"?: boolean, "allow_host_fallback"?: boolean }` | Exécution **conteneurisée par défaut** (`containerized=true`) ; fallback hôte uniquement si `allow_host_fallback=true`. Réponse inclut `execution_mode` (`container`, `host_fallback`, `host`) + sorties tronquées. Sous **Windows**, exécution hôte des commandes `npm`, `npx`, `pnpm`, `yarn`, `corepack` via `cmd.exe /c` pour éviter « program not found » (shims `.cmd`). |

Erreurs fréquentes : `invalid or unsafe argv`, timeout → JSON avec `error: "timeout"`.

**Vérification post-tâche (agents Code Studio)** : après une tâche dont le disque outil est sous `studio-projects/`, le daemon lance une commande de vérif si `verify_skip` est faux dans `.akasha-studio.json` : `verify_argv` si défini, sinon `npm run build` si `package.json` existe, sinon `cargo check` si `Cargo.toml` existe. En cas d’échec, la tâche est marquée **failed** et un `ProgressUpdate` contient la sortie tronquée.

**Orchestration « aller au bout » (variables d’environnement daemon, optionnelles)** : `AKASHA_MAX_TOOL_ROUNDS`, `AKASHA_STUDIO_VERIFY_MAX_PASSES`, `AKASHA_STUDIO_VERIFY_AUTOFIX_LLM_ROUNDS` (déjà documentées côté ops) ; en complément : `AKASHA_STUDIO_SEMANTIC_VERIFY=0` désactive la revue LLM des critères **manual** ; `AKASHA_STUDIO_READ_ONLY_STREAK_MAX` (défaut 4) borne le garde-fou « tours d’affilée en lecture seule » sur les tâches disque `studio-projects/` ; `AKASHA_STUDIO_LLM_RESPONSE_AUDITOR=0` désactive l’audit LLM qui confirme ou infirme les heuristiques « prose d’implémentation » / « promesse sans outil » (voir STU-023).

### Tâches (statut & suggestions Code Studio)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/tasks/:id` | Statut tâche : `task_id`, `status`, `assigned_agent`, `progress[]`, `failure_detail`, **`acceptance_review`** (optionnel, objet `{ "missing": string[] }` après revue non bloquante), et **`suggested_actions`** (optionnel, tableau stable) : `{ "id": string, "label": string, "kind": "message" \| "ui", "message"?: string, "ui_action"?: string }`. Les `ui_action` réservés côté UI incluent au minimum `open_editor`, `open_preview`, `open_design`, `refresh_files` (les ids inconnus sont ignorés pour compatibilité avant). |
| GET | `/api/tasks/:id/events` | `{ "events": [ { "event_type": string, "at": string, "task_id"?: string, "payload"?: any } ] }` — journal d’événements bus (délégations, outils, etc.), charge utile bornée côté daemon. |
| GET | `/api/tasks/:id/report` | Rapport opérateur compact de fin de tâche: `{ "done": string[], "needs_review": string[], "failed": string[], "next_steps": string[] }` et lien éventuel vers transcript. |
| GET | `/api/tasks/:id/studio-diff` | `{ "task_id", "captured_at", "files": [ { "path", "status", "diff", "truncated" } ] }` — diff texte depuis un **snapshot** pris au démarrage des tâches Code Studio **racine** ; `404` `{ "error":"no_snapshot" }` sinon (sous-tâches, tâche hors studio, etc.). |
| GET/POST | `/api/permissions/decisions` | Centre de permissions : lister et créer des décisions persistantes pour les outils sensibles. **GET** → `{ "items": [ { "id": string, "tool_id"?: string, "scope"?: string, "decision": "allow_persistent" \| "deny_persistent", "created_at"?: string, "updated_at"?: string } ], "page"?: number, "page_size"?: number, "total"?: number }` (pagination optionnelle ; sans pagination, tous les éléments sont renvoyés dans `items`). `allow_persistent` autorise durablement un outil/scope sans nouvelle confirmation ; `deny_persistent` refuse durablement cet outil/scope tant que la décision n'est pas supprimée. **POST** body → `{ "tool_id"?: string, "scope"?: string, "decision": "allow_persistent" \| "deny_persistent" }` avec au moins un critère de ciblage métier accepté par l'implémentation (`tool_id` et/ou `scope`). Réponse succès : `201` `{ "id": string }`. Erreurs minimales : `403` si le centre de permissions n'est pas accessible à l'appelant ; `400`/`422` en cas de body invalide (`decision` inconnue, cible absente ou mal formée). |
| DELETE | `/api/permissions/decisions/:id` | Supprimer une décision persistante du centre de permissions par identifiant. Réponse succès : `200` `{ "deleted": true, "id": string }` (ou `204` sans body selon l'implémentation). Erreurs minimales : `403` si suppression non autorisée, `404` si `id` inconnu, `400` si identifiant mal formé. |
| GET | `/api/permissions/queue` | Liste des demandes d’autorisation avec filtres (`status`, `cursor`, `limit`) ; statuts attendus: `pending`, `approved`, `denied`, `expired`. |
| GET | `/api/permissions/queue/:id` | Détail d’une demande (contexte, rationnel, cible outil/scope, horodatage, décision). |
| POST | `/api/permissions/queue/:id/approve` | Valider une demande (option `note`), puis reprise de l’action si encore applicable. |
| POST | `/api/permissions/queue/:id/deny` | Refuser une demande (option `note`) ; l’agent reçoit un retour explicite de refus. |
| GET/POST | `/api/memory/second-brain/settings` | `GET` → `{ "enabled": boolean, "paused": boolean }`. `POST` → corps partiel `{ "enabled"?: boolean, "paused"?: boolean }`, réponse `200` avec l'objet complet mis à jour. Sémantique: `enabled=false` désactive totalement la collecte/usage mémoire ; `enabled=true` l'autorise ; `paused=true` met en pause temporairement une mémoire activée ; `paused=false` reprend après pause. Si `enabled=false`, `paused` peut rester présent en lecture mais n'a pas d'effet tant que la mémoire n'est pas réactivée. |
| GET | `/api/memory/second-brain/overview` | `200` → `{ "sections": [ { "type": "identity" \| "preference" \| "goal" \| "project" \| "workflow" \| "fact" \| "other", "label": string, "count": number, "items": [ { "id": string, "summary": string, "updated_at": string } ] } ], "total_items": number, "updated_at": string \| null }`. `updated_at` est un timestamp ISO-8601 UTC ; `count` = nombre total d'items de la section ; `items` est un aperçu, potentiellement tronqué par le backend. |
| POST | `/api/memory/second-brain/clear` | Réinitialiser la mémoire long-terme. |
| GET/POST | `/api/budget` | `GET` → `{ "daily_token_limit": number \| null, "daily_cost_limit": string \| null, "currency": string, "alert_threshold_pct": number, "auto_concise": boolean, "usage": { "today_input_tokens": number, "today_output_tokens": number, "today_total_tokens": number, "today_total_cost": string, "current_session_id": string \| null, "current_session_input_tokens": number, "current_session_output_tokens": number, "current_session_total_tokens": number, "current_session_total_cost": string } }`. `POST` → corps partiel limité aux champs configurables `{ "daily_token_limit"?: number \| null, "daily_cost_limit"?: string \| null, "alert_threshold_pct"?: number, "auto_concise"?: boolean }`, réponse `200` avec le même schéma complet que `GET`. Contrat: les volumes sont en **tokens** entiers ; les montants monétaires sont des **chaînes décimales** dans la devise `currency` (ex. `"EUR"`, `"1.25"`) ; `usage` est **lecture seule** et calculé par le backend. |
| POST | `/api/budget/reset-session` | Réinitialise les compteurs de budget d'une session ciblée. Corps requis `{ "session_id": string }` ; aucun paramètre d'URL ni header dédié. Réponse `200` → `{ "session_id": string, "reset": true }`. Le reset couvre uniquement les agrégats de la session visée (`current_session_*` et toute accumulation stockée pour cette session) ; il ne modifie ni la configuration globale de `/api/budget`, ni les totaux journaliers (`today_*`), ni l'historique des autres sessions. |

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
| Arbre fichiers | **Uniquement dans l’onglet Éditeur** (colonne fichiers) : `GET /files` ; clic → `GET /raw` |
| Zone centrale | Grille **50/50** (éditeur/onglets \| chat) avec modes **plein éditeur** / **plein chat** ; pas de colonne latérale gauche historique. Onglets: **Éditeur / Aperçu / Plan / Design / Logs serveur / Cockpit**. |
| Menus en-tête | **Projet** (créer/charger, paramètres stack & politique), **Évolutions Git**, **Import & build**, **Agent / actions** (plan, design, matrice) ; sélecteur d’agent compact + badge de statut daemon dans la barre de navigation. |
| Éditeur | **Monaco Editor** (`@monaco-editor/react`) + liste fichiers à gauche ; thème sombre ; sauvegarde via `PUT .../raw`. Workers Monaco depuis jsDelivr (`monaco-editor@0.52.2`). |
| Aperçu | **▶ Lancer la prévisualisation** : `POST .../preview/start` — serveur dev sur `127.0.0.1` ; **Arrêter le serveur** : `POST .../preview/stop`. Sinon, fichier `.html` ouvert : aperçu statique (blob + iframe `sandbox`). Priorité : URL serveur dev si actif, sinon blob. |
| Barre ops | Menus **Import & build** : clone HTTPS, build argv, merge / abandon évolution |
| Chat | `POST /api/message` avec `studio_project_id`, agent, évolution ; bulles assistant avec `task_id` → icône **détail tâche** (modal `GET /api/tasks/:id` + `GET /api/tasks/:id/events`) ; **chips** « Suggestions » alimentées par `suggested_actions` du daemon sur la dernière bulle assistant ; après fin de tâche, bloc pliable **fichiers modifiés** (`GET /api/tasks/:id/studio-diff`) sous la bulle concernée. |
| Design | Édition `DESIGN.md`, planche visuelle (tokens), mode d’affichage **Les deux / Visuel / Source**, diagnostics, bouton **Demander à l’agent de corriger** (errors/warnings), import/export, export artefacts, auto-apply contexte design |
| Cockpit | Vue opérateur structurée (scheduler actions, task runs, process watch, terminal, tools, MCP, lifecycle), raw JSON repliable par section, refresh manuel + auto-refresh ciblé runs/process |
| Cockpit (swarm studio) | Quand le mode swarm est actif: graphe coordinateur/workers/sous-tâches + états (`running`, `blocked`, etc.) + événements de conflit et reprise |
| Trust & Access | Section opérateur pour gouvernance canal et contrôles de confiance : mode permissions (`ask_me`/`allow_all`), décisions persistantes, utilisateurs Telegram approuvés/pending et actions promote/demote/remove/reset. **Contrats daemon attendus pour l'UI** : `GET /api/trust-access` → `{ channel_permissions_mode, trust_decisions, telegram_users: { approved: TelegramUser[], pending: TelegramUser[] } }`; `PATCH /api/trust-access/channel-permissions` avec body `{ mode: "ask_me" \| "allow_all" }`; `GET /api/trust-access/decisions` / `POST /api/trust-access/decisions/reset`; `POST /api/trust-access/telegram-users/:telegram_user_id/promote`; `POST /api/trust-access/telegram-users/:telegram_user_id/demote`; `DELETE /api/trust-access/telegram-users/:telegram_user_id`; `POST /api/trust-access/telegram-users/:telegram_user_id/reset`. Objet minimal `TelegramUser`: `{ telegram_user_id, username?, display_name?, status: "approved" \| "pending", role?, promoted_at?, decided_at? }`. |
| Skills & Plugins Trust | Afficher les métadonnées de confiance (`trust_level`, `compat_status`, `signature_status`) sur les catalogues et détails, avec fallback sûr si absent. |
| Stack projet | Menu **Projet** : `<select>` de préréglages + « Personnalisé » ; cases à cocher ; enregistrement `PATCH` (`tech_stack`) ; zone **Critères d’acceptation** (texte ou JSON) envoyée avec chaque message agent tant qu’elle n’est pas vide |
| Git worktree | Bouton **Git Δ** dans l’en-tête : tableau `git_worktree_lines` (popover). |
| Logs build | Résultat `POST .../build` |
| Indicateur sandbox | L’UI affiche que le périmètre disque est le dossier projet ; l’isolation réseau/conteneur dépend de la policy et de `run_in_container` |

---

## Sandbox & sécurité

- **Disque** : IDs projet = UUID validés ; `raw` refuse `..` et chemins hors racine canonique.
- **Build API** : arguments filtrés (pas de `|`, `;`, `&`, retours ligne, `..`).
- **Hôte** : `npm install` / scripts post-install sur le poste = risque résiduel — **STU-011** reporté vers conteneur.
- **Builds** : mode conteneur actif par défaut ; fallback hôte autorisé explicitement pour compatibilité.
- **Réseau** : non restreint par le daemon pour les commandes build (contrairement à un runner conteneurisé idéal).
- **Prévisualisation** : accès UI via URL proxy signée courte durée ; le daemon lance toujours `npm run dev` sur l’hôte (`127.0.0.1:<port>`). L’UI charge les workers Monaco depuis un CDN (accès Internet requis pour l’éditeur en production build).

---

## Matrice de tests

| Scénario | Type | Statut |
|----------|------|--------|
| Liste / création projet | Playwright (mock) | Fait `e2e/smoke.spec.ts` |
| Ouverture fichier + preview HTML | Playwright (mock) | Fait |
| Envoi message (mock `/api/message`) | Playwright | Fait |
| `studio_acceptance_criteria` dans le corps `POST /api/message` (UI Projet) | Playwright (mock) | Fait `e2e/smoke.spec.ts` |
| Cockpit structuré + action scheduler | Playwright (mock) | Fait |
| Clone réel HTTPS | Manuel | Fait |
| Build `npm` sur template | Manuel / CI optionnel | Fait |
| Évolution + merge sans conflit | Manuel | Fait |
| Recette fork (`SESSION_FORK_SPEC`) | Manuel | Fait |
| Scénarios swarm (succès + conflit) | Manuel | Fait (MVP) |
| `studio_evolution_id` résolu → branche | Intégration | Fait (daemon) |

### Given / When / Then (exemple)

1. **Given** un daemon et un projet studio avec `index.html`, **when** `GET .../raw?path=index.html`, **then** `200` et `mime` text/html.
2. **Given** un dépôt git avec `main`, **when** `POST .../evolutions` avec label `fix`, **then** `201` et branche `studio/fix` ou `studio/<uuid8>`.

---

## Checklist de recette (avant clôture phase)

- [x] Spec mise à jour (tableaux statuts + exigences).
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
