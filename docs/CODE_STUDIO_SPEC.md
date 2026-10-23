# Code Studio — spécification de livraison

Document de référence pour l’UI [Akasha-code-studio](https://github.com/azerothl/Akasha-code-studio) et les extensions **daemon** (`akasha-daemon`). À mettre à jour à chaque phase clôturée.

---

## Table des phases (plan produit)

| Phase | Objectif | In / out | Dépendances | Risques |
|-------|----------|----------|-------------|---------|
| 1 MVP | Racine projet sandboxée, listing, raw, agent scaffold | In: `studio-projects/<UUID>`, APIs fichiers, `POST /api/message` studio_* | Daemon + UI minimale | Chemins `..`, symlinks |
| 2 Build réel | Commande contrôlée + logs + timeout | Livré : `POST .../build`, conteneur par défaut (`containerized=true`), repli hôte seulement si demandé (`allow_host_fallback=true`) | Docker et image de toolchain ; outil hôte si repli explicite | Scripts et dépendances du projet |
| 3 Dev live | `npm run dev` + proxy preview signé | Livré (UI + daemon) : STU-016, STU-012, STU-017. Le processus reste sur l’hôte, l’UI passe par une URL signée. | Réseau, auth | Exposition LAN |
| 4 GitHub | Clone HTTPS, push via agent + vault | In: `POST .../git/clone` | git, credentials | Secrets hors vault |
| 5 Branches évolution | `studio/*`, merge / abandon | In: évolutions API + meta JSON | git | Conflits merge |
| 6 Parallélisme | Plusieurs évolutions, limite jobs | In: `AKASHA_STUDIO_MAX_PARALLEL_OPS` | Tokio semaphore | Saturation disque / CPU |
| 7 Qualité UI | Templates React/Tailwind, tokens | UI repo | Design system | Dette UI |
| 8 Contrôle fin | Diff par hunk, @fichier | Livré (MVP UI + daemon) : STU-013 et injection `@fichier`. L’éditeur multi-fichiers est livré dans l’UI. | UI + API | Complexité |
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
| STU-016 | 3 | UI : onglets **Éditeur** / **Aperçu** / **Logs** ; éditeur **Monaco** (workers via CDN) ; **Play** installe si besoin puis lance le serveur du profil détecté (Node ou Python uv) côté daemon ; logs via `GET .../preview/logs` | Fait |
| STU-017 | 3 | `GET .../preview/logs`, `POST .../preview/install`, `git_branch` sur GET méta projet | Fait |
| STU-018 | 1 | Fichier `CODE_STUDIO_PLAN.md` à la création ; garde-fou `write_file` anti-markdown sur fichiers code studio ; vérif post-tâche optionnelle (méta `verify_*`) | Fait |
| STU-019 | 1 | Tâches studio : prompt système **dédié** (`CODE_STUDIO_APP_CONTEXT` + instructions outils compactes, sans bloc général Akasha TUI/skills) ; `strip_markdown_fences` sur `write_file` ; persistance UI du `task_id` (rechargement) ; `DELETE .../raw` + outil `delete_file` côté agent | Fait |
| STU-DESIGN-001 | 1 | Section UI **Design** : voir, éditer, sauvegarder et exporter `DESIGN.md` | Fait |
| STU-DESIGN-002 | 2 | `POST /api/studio/projects/:id/design/validate` retourne findings + summary lint DESIGN.md | Fait |
| STU-DESIGN-003 | 2 | `POST /api/message` accepte `studio_design_hint` et `studio_design_doc` (préfixes design) | Fait |
| STU-DESIGN-004 | 3 | Merge évolution : option `design_check` bloque si lint DESIGN.md régresse | Fait |
| STU-OPS-001 | 3 | Cockpit opérateur structuré (sections opérateur: scheduler, task runs, process watch, terminal, tools, MCP, lifecycle) avec fallback raw JSON | Fait |
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
| STU-KANBAN-001 | 1 | Toute demande racine actionnable avec `studio_project_id` crée et relie un ticket avant le lancement ; les messages de pilotage d’une tâche active ne créent pas de doublon. La première demande de création remplit le tableau avec des tickets vérifiables et dépendances explicites | En cours (daemon Akasha) |
| STU-KANBAN-002 | 1 | Le `studio_project_manager` lit le Kanban à chaque demande, garde chaque ticket utilisateur comme suivi global et crée avant toute édition au moins un ticket de travail lié (un pour une évolution simple, plusieurs pour un changement composé), avec critères, responsable, reviewer et dépendances. Un bug confirmé hors périmètre reçoit son propre ticket | En cours (daemon Akasha) |
| STU-KANBAN-003 | 1 | Le daemon parcourt périodiquement les projets inactifs, vérifie les tâches ouvertes et dépendances, puis dispatch un ticket prêt à la fois ; un run terminé sans critères vérifiés reste chez l’agent d’implémentation avec son diagnostic, et un ticket ne passe à terminé qu’après validation étayée | En cours (daemon Akasha) |

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

### Tickets Kanban et dispatch agentique

Le Kanban est la source de suivi des tâches du projet. Pour une demande actionnable reconnue et envoyée sans `studio_ticket_id`, le daemon crée le ticket avant de démarrer l’agent et renvoie une erreur si cette inscription échoue. Une demande de pilotage (*steering*) reste dans la tâche active ; une demande de suivi (*follow-up*) crée un ticket distinct. La détection s’appuie sur les formulations courantes de création, d’évolution et de bug en français et en anglais ; elle reste heuristique.

Dans le compositeur, **Follow-up** est le mode par défaut lorsqu’une tâche est active : chaque nouvelle évolution crée un ticket distinct, même si le compositeur porte encore le ticket de la tâche active. L’utilisateur peut choisir **Steering** pour donner une consigne d’exécution immédiate sans créer de ticket. Le mode **Immédiat** démarre une nouvelle tâche racine ; sa demande actionnable reçoit aussi un ticket. La réponse API inclut `studio_ticket_id`, que le chat affiche avec un accès direct au Kanban.

Quand le tableau est vide, une première demande de création produit un ticket global et un backlog de travail avec critères d’acceptation. Chaque travail est relié au suivi avec `parent_ticket_id`; cette relation regroupe les tickets sans bloquer leur lancement. Seuls `depends_on_ticket_ids` expriment les vrais prérequis d’exécution entre tâches. Pour chaque évolution, le ticket global est décomposé avant modification en un ou plusieurs tickets de travail; une évolution simple reçoit un ticket, une demande composée plusieurs tickets. Le chef de projet vérifie les critères et assigne les responsables, puis le daemon dispatch un ticket prêt dans l’ordre des prérequis. Les créations agentiques utilisent une `creation_key` stable; une reprise renvoie le ticket existant au lieu d’en créer un doublon. À chaque nouvelle demande, le manager et le balayage régulier relisent le tableau et son état d’exécution. Un bug confirmé découvert hors périmètre devient un ticket séparé avec résultat attendu, résultat observé et scénario reproductible. Le ticket global reste ouvert jusqu’à revue approuvée de tous ses tickets enfants.

Les outils natifs donnent au manager une liste de tickets comprenant leur parent, clé de création, prérequis, critères, preuves et tâches liées. La création exige des critères d’acceptation non vides; `parent_ticket_id` et `creation_key` sont facultatifs pour les autres clients, et la création sous le même parent est idempotente par clé stable ou, sans clé, par titre normalisé. La mise à jour peut enregistrer le parent séparément des prérequis, les chemins modifiés et les résultats observés sans altérer les identifiants de tâches gérés par le daemon. Le reviewer dispose d’une action `studio_review_ticket` dédiée : elle n’est accessible qu’au reviewer assigné et enregistre un verdict approuvé ou des corrections concrètes. Lorsqu’un verdict demande des corrections sur le ticket global, le chef de projet crée des tickets correctifs enfants sans faire dépendre ceux-ci du parent.

Le balayage daemon s’exécute dès son démarrage puis par défaut toutes les 60 secondes (minimum 60, variable `AKASHA_STUDIO_KANBAN_DISPATCH_INTERVAL_SECS`) et ne lance pas de second passage si une tâche du projet est active. Il dispatch un seul ticket prêt par passage, respecte les dépendances, privilégie la revue et le travail neuf avant une reprise en échec et, entre reprises, tente d’abord les tickets ayant le moins d’échecs. Il peut reprendre un ticket dont la tâche associée est terminée après le délai `AKASHA_STUDIO_KANBAN_RETRY_COOLDOWN_SECS` (défaut 300 secondes, plage 60–3600). Les reprises après échecs répétés appliquent un délai progressif plafonné à une heure; le résultat structuré de l’échec est joint à la nouvelle consigne et inscrit dans la timeline pour éviter une répétition aveugle. Le dernier modèle choisi dans le chat est conservé dans la timeline du ticket et réutilisé lors des dispatchs planifiés; en l’absence de choix enregistré, le daemon applique sa route habituelle. Le balayage peut être désactivé avec `AKASHA_STUDIO_KANBAN_DISPATCH_ENABLED=0`.

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/studio/projects/:id/tickets` | Liste les tickets et leur état pour le Kanban du projet |
| POST | `/api/studio/projects/:id/tickets` | Crée un ticket avec critères, parent de suivi facultatif et prérequis; retourne le ticket canonique si la demande est un doublon |
| GET | `/api/studio/projects/:id/tickets/:ticket_id` | Lit un ticket et son historique |
| PATCH | `/api/studio/projects/:id/tickets/:ticket_id` | Met à jour statut, parent de suivi, prérequis, critères, preuves ou revue |
| POST | `/api/studio/projects/:id/tickets/:ticket_id/review` | Enregistre le résultat de revue du ticket |

### `/api/studio/projects`

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | `/api/studio/projects` | Liste `{ projects: [{ id, name, path }] }` (`name` depuis `.akasha-studio.json` ou repli `Projet xxxxxxxx`) |
| POST | `/api/studio/projects` | Crée un UUID ; corps optionnel `{ "name": "…", "tech_stack": "…" }` → `{ id, path }` ; initialise `CODE_STUDIO_PLAN.md`, le dossier **`specs/`**, repo Git local et branche primaire `main` (fallback `master` selon environnement) |
| PATCH | `/api/studio/projects/:id` | Corps : `name`, `tech_stack`, et/ou options de vérif post-tâche : `verify_skip` (bool), `verify_argv` (tableau de chaînes ou `null`), `verify_timeout_sec` (nombre 1–3600 ou `null`) |
| GET | `/api/studio/projects/:id` | Lit méta + évolutions (`tech_stack`, champs `verify_*`). Garantit une branche primaire (`main`/`master`) au moment de la reprise si le dépôt Git existe. Ajoute `git_branch`, `git_worktree_clean` et **`git_worktree_lines`** (tableau borné, max 200 entrées `{ "status": string, "path": string }` dérivées de `git status --porcelain`, même source que « propre » / indicateur dirty) lorsque le dépôt Git est valide. |
| POST | `/api/studio/projects/:id/preview/start` | Corps optionnel `{ "force_install": bool, "port": number }`. Détecte le profil depuis les manifestes : Node (`package.json`, script `dev`) ou Python uv (Streamlit/FastAPI via `pyproject.toml`). Installe les dépendances si nécessaire puis lance le serveur correspondant sur localhost. Réponse `{ ok, url, port, profile?, proxy_signed, installed?, install? }` ; `url` utilise le proxy signé à durée limitée. Les logs sont disponibles via `preview/logs`. |
| GET | `/api/studio/projects/:id/preview/proxy?token=...` | Vérifie un jeton signé court TTL et redirige vers `http://127.0.0.1:<port>` du projet. Scope projet strict. |
| POST | `/api/studio/projects/:id/preview/stop` | Arrête le processus dev enregistré pour ce projet (`{ ok, stopped }`). |
| GET | `/api/studio/projects/:id/preview/logs` | `{ running, log, preview_inactive? }` — tampon borné des stdout/stderr du `npm run dev`. |
| POST | `/api/studio/projects/:id/preview/install` | Corps `{ "force": bool }`. Exécute l’installation du profil détecté (`npm install`, `uv sync`, …) sans démarrer de serveur. Réponse `{ ok, profile?, skipped?, reason?, install? }`. |

#### Aperçu local et outil `browser` (tests agent)

Pour qu’un agent Akasha ouvre l’UI servie par `preview/start` (Vite, etc.) avec l’outil **`browser`** du daemon :

1. Lancer le preview depuis Code Studio ou `POST .../preview/start` ; noter l’URL renvoyée (proxy signé vers `http://127.0.0.1:<port>`).
2. Dans **`tools_policy.yaml`** (répertoire données du daemon) : `browser_enabled: true`, installer Playwright dans `scripts/playwright-runner`, et inclure les hôtes nécessaires dans **`browser_allowed_domains`** — au minimum `127.0.0.1` (et `localhost` si utilisé). Sans cela, `browser navigate http://127.0.0.1:…` est refusé.
3. Utiliser un **modèle vision** dans `llm_router.yaml` si la tâche doit **interpréter** une capture : après `TOOL: browser screenshot`, la capture complète peut être jointe au tour suivant (voir spec Akasha `spec/39_browser_automation.md`, variables `AKASHA_BROWSER_SCREENSHOT_VISION` / `AKASHA_VISION_INJECT_MAX_CHARS`).
4. Enchaînement typique : `browser navigate` → `browser snapshot` ou `browser screenshot` → synthèse ; pour le rendu visuel, privilégier screenshot + modèle multimodal.

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
| Zone centrale | **Discussion** par défaut. Sur grand écran, modes discussion, espace de travail et partage conservés. Jusqu’à 900 px, un seul espace visible ; navigation basse **Discussion / Fichiers / Aperçu**. Barre latérale : accès fréquents puis **Plus d’outils**. Onglets livrés : **Tableau de bord, Kanban, Éditeur, Aperçu, Plan, Design, Branches, Logs serveur, Cockpit, Documentation, Agents, Paramètres**. |
| En-tête et outils | En-tête de 56 px : choix du projet, branche sur grand écran, indicateur de connexion, disposition et notifications. **Outils du projet** regroupe index, Git et les menus **Projet**, **Évolutions Git**, **Import & build**, **Agent / actions**. Le choix de l’agent est près du compositeur ; contexte/permissions et options se déplient. |
| Tableau de bord | Cycle **demander → suivre → examiner → vérifier → fusionner**, tâche active et prochaine action. Sans projet, le cycle reste visible et demande de créer ou charger un projet. | 
| Éditeur | **Monaco** + onglets multi-fichiers (brouillon indépendant, confirmation à la fermeture). Arborescence repliée après ouverture sur mobile. Ouverture rapide ; recherche texte et diagnostics repliables. Diagnostics syntaxiques Monaco ; aucun LSP n’est configuré, le repli est affiché. Sauvegarde `PUT .../raw`. Workers depuis jsDelivr (`monaco-editor@0.52.2`). |
| Aperçu | **▶ Lancer la prévisualisation** : `POST .../preview/start` — serveur dev sur `127.0.0.1` ; **Arrêter le serveur** : `POST .../preview/stop`. Sinon, fichier `.html` ouvert : aperçu statique (blob + iframe `sandbox`). Priorité : URL serveur dev si actif, sinon blob. |
| Barre ops | Menus **Import & build** : clone HTTPS, build argv, merge / abandon évolution |
| Chat | `POST /api/message` avec `studio_project_id`, agent, évolution ; résumé de contexte avant envoi (fichiers `@`, critères, design, index, agent, modèle s’il est connu, profil de permissions) avec retrait des contextes facultatifs. Les secrets repérés dans le résumé sont masqués. Bulles assistant : détail tâche, suggestions, **revue** (diff, critères, vérifications, branche Git). Dry-run n’écrit pas ; une seconde application des mêmes hunks est bloquée. |
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
- **Hôte** : `npm install` / scripts post-install sur le poste restent un risque résiduel. **STU-011** est livré en MVP : build conteneurisé par défaut, repli hôte seulement si `allow_host_fallback=true`.
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
| Clone réel HTTPS | Manuel | Implémenté ; non réexécuté dans l’audit du 18/10/2026 |
| Build `npm` sur template | Manuel / CI optionnel | Implémenté ; le build de cette UI est vérifié séparément du build d’un projet via daemon |
| Évolution + merge sans conflit | Manuel | Implémenté ; non réexécuté dans l’audit du 18/10/2026 |
| Recette fork (`SESSION_FORK_SPEC`) | Navigateur mocké + manuel | Parcours UI automatisé ; contexte serveur réel non réexécuté le 18/10/2026 |
| Scénarios swarm (succès + conflit) | Navigateur mocké + daemon | Implémentés dans Akasha (PR #138) ; concurrence réelle multi-worker non mesurée le 18/10/2026 |
| `studio_evolution_id` résolu → branche | Intégration | Fait (daemon) |
| Création projet, Git, plan, DESIGN | Intégration daemon réelle | Fait `integration/daemon-studio.test.ts` — pas un mock Playwright |
| Tâche agent jusqu’au fichier `RECIPE_OK.md` | Intégration daemon réelle, opt-in | `npm run test:daemon:task` (pose `CODE_STUDIO_E2E_TASK=1`). Vérifie le contenu exact et la présence du fichier dans le diff (les `.txt` sont exclus du contrat de snapshot). Rapport dans `test-results/daemon-task-report.json`. `npm run test:daemon` ignore ce cas. Les tests Playwright restent mockés |
| Playwright (`e2e/`) | Mock `/api` | Ne prouve pas une recette daemon |

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

## Statut des écarts récents

| Sujet | UI | Daemon | Reste |
|-------|----|--------|-------|
| Cycle de livraison sur le tableau de bord | Livré | — | — |
| Revue unifiée (diff, critères, vérif, branche) | Livré | Diff et `acceptance_review` déjà exposés | — |
| Éditeur multi-fichiers, recherche, diagnostics | Livré | Contrôle de chemin inchangé | Pas de LSP |
| Contexte avant envoi | Livré | Champs `POST /api/message` existants | Agent demandé, permissions et dernier modèle observé ; un handoff saisi ne prouve pas le modèle du prochain tour |
| Arbre de forks | Livré, à partir du chat local et de `session_fork_created` | Champs fork v1 | `GET /api/session/forks` non requis pour cette UI |
| Isolation swarm | Panneau cockpit : liste, intégrer, abandonner | Worktree par **sous-tâche** si `AKASHA_STUDIO_WORKTREE_ENABLED=1`. Intégration **explicite** (`POST .../worktrees/:task_id/integrate`). Référence de départ : `base_branch` + `base_sha`. Nettoyage : abandon ou intégration retire le worktree ; le registre mémoire des états terminaux est purgé après 24 h. Concurrence : `AKASHA_STUDIO_MAX_PARALLEL_OPS`. | Désactivé tant que le flag n’est pas posé |
| Découpage de `App.tsx` | Cinq hooks de domaines, voir `docs/UI_BOUNDARIES.md` | — | `App.tsx` garde la composition et la coordination transversale ; le polling vit dans `useStudioTasks` |
| États UI et reprise | Livré | Composant `AsyncState` | Attente, vide, partiel, hors ligne, erreur, succès ; actions contextuelles et détails accessibles |
| Recette bout en bout | — | Opt-in documentée ci-dessus | Nécessite un modèle |

## Reprise des erreurs du fournisseur

Les générations Studio partagent leur délai entre au plus trois routes configurées. Chaque route n'est tentée qu'une fois ; quand il n'y a qu'un modèle, une seule reprise de transport est possible si les retries sont autorisés. Un choix explicite reste sur ce modèle, et `default_max_retries: 0` désactive cette reprise. Le modèle qui a répondu est préféré aux tours suivants et ce choix est conservé dans le checkpoint.

Les réponses incomplètes d'une tentative en échec ne sont jamais transmises au parseur d'outils. Les événements `llm_provider_attempt` conservent fournisseur, modèle, tentative, délai et phase (`started`, `retry`, `fallback`, `first_token`, `succeeded`, `empty`, `failed`). Un événement `llm_wait_heartbeat` est produit toutes les quinze secondes pendant l'attente. Les annonces temporisées de démarrage cessent dès cette attente effective. Un message d'échec ne constitue pas un jalon de progression utile.

Un échec terminal déplace immédiatement le ticket lié vers `blocked`, indépendamment du scheduler. La lecture du board réconcilie aussi les anciens états périmés. `evidence.resume_status` conserve la phase de revue lorsque nécessaire. La reprise conserve le `task_id`, le ticket, le checkpoint et le registre d'opérations ; les opérations dont l'effet reste inconnu demeurent soumises à inspection. Le bouton de reprise n'envoie pas une nouvelle demande de création.

La première demande fournit un ticket de coordination et quatre phases dépendantes, avec les besoins utilisateur repris dans les critères. Les anciens projets à ticket unique peuvent être migrés sans changer son identité. Le chef de projet doit toujours préciser les gabarits avant de déléguer l'implémentation ; les gabarits seuls ne valident pas la planification.

Le rapport de fin déduplique les messages et ne présente pas un timeout ou une exécution sans critères vérifiés dans `done`. Les compteurs d'outils sont distingués des appels au modèle.

### Qualification et reconnexion du suivi

Le daemon vérifie le protocole d'outils avec un probe inerte avant d'utiliser une nouvelle route. Le résultat est disponible dans le catalogue et via `POST /api/router/studio-qualify` (`provider`, `model`) ; le composeur propose « Vérifier les outils du modèle » hors exécution active. Un résultat positif de ce probe ne valide pas la création d'une application. Les métadonnées du catalogue ne sont jamais envoyées dans `studio_model`, qui contient uniquement `provider` et `model`.

Le profil facultatif `studio` permet de définir des modèles et replis adaptés au développement. Le daemon publie les phases `qualifying`, `qualified` et `skipped` en plus des tentatives de génération. Après épuisement des routes, le scheduler ne répète pas la même demande inchangée. Les détails de configuration sont documentés dans `spec/dev/integrations/studio-provider-recovery.md` du dépôt Akasha.

Une erreur de lecture du suivi conserve le dernier statut métier et l'identifiant durable. Le chat indique la reconnexion automatique avec un délai croissant de 1,5 à 15 s. Les requêtes de suivi ont un délai de 10 s et sont annulées au changement de projet. Au rétablissement, le résultat terminal est récupéré et sa réponse est insérée ou actualisée sans doublon, sans renvoyer le message utilisateur. Le même chemin couvre un rechargement pendant une indisponibilité.

Recette ciblée réelle : `CODE_STUDIO_DAEMON_BIN=<binaire reconstruit> npm run test:daemon:recovery`. Elle utilise un daemon isolé et un fournisseur HTTP scripté ; elle valide le protocole de reprise, pas la qualité d'un LLM ni la livraison autonome d'une application. Voir [les preuves du 22 octobre](validation/provider-recovery-2026-10-22.json).

## Gouvernance

### Jalon de planification

Le résultat daemon peut porter `planning_verified: true` : le backlog initial et ses dépendances ont passé les contrôles structurels. Le chat affiche alors « Planification vérifiée » et indique que l'application reste à implémenter et valider. Ce champ ne remplace pas `acceptance_verified` et ne clôt aucun ticket de travail. Le scheduler passe aux spécialistes sur les tickets prêts, sans bloquer le coordinateur faute de fichiers applicatifs.

Les outils Kanban du coordinateur initial reçoivent le parent lié à la tâche et les IDs stables des phases. Une création avec une clé de phase réutilise son ticket ; les créations supplémentaires sont refusées tant que les gabarits restent à préciser. Des critères de socle conservés et un titre de phase inchangé ne disqualifient plus un ticket dont les critères ont été précisés. Le moteur conserve les responsables et reviewers des phases à partir de leurs clés stables, pour éviter que le coordinateur s'affecte une tâche d'implémentation. Les contrôles détaillés sont documentés dans `spec/dev/integrations/studio-provider-recovery.md` du dépôt Akasha.

Une PR qui livre une phase **doit** mettre à jour ce fichier (cases cochées, nouvelles exigences, statuts `STU-*`).

---

## Références

- Daemon : `crates/akasha-daemon/src/api_studio.rs`, `studio.rs`, `api.rs` (`POST /api/message`, `run_message_via_llm`).
- Guide utilisateur : section *Code Studio* dans `spec/user_guide.md` (dépôt Akasha).


### Contexte, progression et vérifications fraîches

- `list_tools` sans argument renvoie un index de noms, sans les schémas. La découverte ciblée d'un nom autorisé n'ajoute que ce seul outil au catalogue natif ; les découvertes ne s'accumulent pas. Un schéma individuel dépassant 16 Kio est refusé avec un diagnostic de budget. Les permissions restent vérifiées à chaque invocation.
- Les commandes npm du projet vérifient le dossier, le manifeste et le script demandé avant de lancer un processus. Un manifeste absent produit `npm_manifest_missing`, `process_started: false` et une instruction de correction pour l'agent. Le moteur ne génère aucun fichier applicatif à sa place.
- Après modification réelle de fichiers, les anciens résultats de build/tests deviennent périmés. Une nouvelle réussite de la même commande les remplace comme état courant, avec le nombre de tentatives ; le journal des opérations conserve les échecs antérieurs. Une réponse finale prématurée reçoit au plus deux demandes automatiques de réparation/vérification, puis échoue explicitement.
- Sans nouvelle vérification réussie après les modifications, le moteur rappelle le jalon après 12 tours et arrête la boucle après 24 tours. Une prolongation du budget exige un jalon vérifié récent sur une nouvelle révision ; répéter un build inchangé ne suffit pas. Le plafond reste de 96 tours. Les blocages `studio_no_verified_progress`, `studio_command_verification_failed` et `studio_round_budget_exhausted` ne déclenchent pas de redépart automatique inchangé du ticket.

Ces contrôles concernent la progression et les vérifications techniques reconnues. Ils ne prouvent pas à eux seuls la conformité visuelle ou fonctionnelle de l'application générée. Une recette avec vrai LLM reste nécessaire.


### Identité du Kanban et réparation des vérifications

- `initial_backlog_root` est une identité attribuée par le moteur à la demande initiale. Les outils ne peuvent pas la définir. Le critère modifiable `initial-kanban-backlog` ne confère aucun rôle de coordination. La migration des anciens tickets concerne uniquement une demande chat sans parent ni clé de phase ; un critère copié sur un ticket de travail ne le promeut pas.
- Les phases initiales conservent leur parent et leurs prérequis canoniques lors des mises à jour agent. Le dispatch de planification contrôle aussi les prérequis. Un ticket de validation reste un travail de spécialiste et attend son intégration.
- Le premier build/test encore en échec conserve sa commande exacte et son diagnostic borné dans le checkpoint. Le moteur les réinjecte à chaque tour, y compris après reprise. Une installation ou une autre commande réussie n'efface pas cet échec.
- Après deux inspections sans réparation, les outils d'exploration générale sont retirés du catalogue annoncé pour ce tour. Les lectures ciblées, modifications et commandes déjà permises restent disponibles. Le moteur ne fabrique ni code applicatif ni résultat de build : l'agent doit réparer puis réexécuter la commande exacte.
- Recette technique ciblée : `CODE_STUDIO_CASE_FILTER="build repair|TypeScript build failure" npm run test:daemon:agentic` avec `CODE_STUDIO_DAEMON_BIN` pointant le binaire courant. Le fournisseur y est scripté ; la recette d'autonomie avec vrai LLM est distincte.
