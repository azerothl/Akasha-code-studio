# Audit des outils et skills Code Studio

18 octobre 2026. **Verdict : socle utilisable pour coder avec supervision ; couverture encore incomplète pour un agent de développement autonome et fiable.**

## Périmètre et preuves

- Interface Code Studio : `7ead86678331fae46f705d7bb7c301511048f481`.
- Daemon Akasha : checkout `ce5197ebb7c01ac6d9ac5912abe70fdb6838d0c1`, arbre identique à `origin/main` au commit `4f3ee5f1676e79ff9fea845ef07012de3cf11e8f` après actualisation du remote.
- Inspection du catalogue, de la construction des prompts, du dispatcher, des politiques, du registre et des chemins de chargement des skills.
- Lecture réelle de `GET /api/status`, `/api/skills`, `/api/tools/effective` et `/api/terminal/capabilities`, sur un daemon isolé au port 3892, ensuite arrêté. Binaire SHA-256 `22ce5a5babf8d5c32cd7acb0b4728f40ef57158ad4f3b9114cccebd58751e6bd`. Ce binaire n’a pas été recompilé à partir du monorepo pendant cet audit.
- [Inventaire conservé](validation/tools-skills-2026-10-18.json). Aucun outil de modification, installation de skill ou appel à un agent n’a été lancé par l’audit. Les routes ont été consultées ; les 94 outils n’ont pas tous été exécutés. La politique du daemon isolé n’est pas présentée comme celle d’une installation de production.
- La [recette réelle précédente](validation/daemon-task-2026-10-18-final.json) prouve une écriture, le contenu exact, le diff et le nettoyage ; elle conserve aussi une absence de réponse du modèle en fin de tâche déclarée `completed`.

L’audit utilise comme besoins de référence : comprendre un dépôt, modifier plusieurs fichiers, exécuter et vérifier, observer une application, revoir et livrer, reprendre une tâche, étendre les capacités et contrôler les permissions. Il ne suppose pas qu’un agent doit couvrir tous les langages et tous les environnements sans configuration.

## Ce qui est déjà présent

### Outils de développement

Le catalogue daemon observé comporte **94 entrées**. Le constructeur du prompt Studio retient **35 noms de base**, avant politique. Le manager ajoute la délégation et trois outils de tickets ; le reviewer retire les huit outils d’édition et ajoute deux outils de tickets. Ces listes ne prouvent pas que les exécutables, domaines et autres prérequis sont opérationnels.

- Exploration : `read_file`, fenêtres de lignes et `--full`, `search_files`, `grep_content`, `workspace_graph_search`, injection de contexte Code RAG.
- Édition : `write_file`, `write_code`, `edit_file`, `search_replace`, `apply_patch`, suppression/déplacement, diff texte et unifié.
- Exécution : `run_command`, `run_terminal`, `run_command_background`, `process`, `run_in_container`. Build et tests peuvent passer par la chaîne d’outils du projet.
- Git : `git_status`, `git_diff`, `git_log`, `git_rev_parse`. L’interface fournit aussi évolutions, comparaison, conflits, fusion et abandon ; commit/push/PR nécessitent aujourd’hui le shell ou une intégration externe.
- Interaction : `ask_user`, tâches/todos, délégation depuis le manager, revue de tickets, états et événements.
- Extensions : `list_skills`, `read_skill`, skills documentaires ou liés à un outil/CLI ; infrastructure MCP côté daemon.
- Exécution longue : processus en arrière-plan et API PTY. L’interface montre les capacités terminal dans le cockpit, mais ne fournit pas un terminal PTY interactif complet.
- Isolation de workers : branches/worktrees, intégration explicite et abandon, sous `AKASHA_STUDIO_WORKTREE_ENABLED=1`. La concurrence réelle et le crash recovery n’ont pas été rejoués ici.

Source : [liste Studio et filtrage par rôle](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api.rs#L1376), [dispatcher](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api_tool_dispatch/execute.rs), [PTY](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api_routes_terminal.rs).

### Moteur de skills

Le registre charge des sous-dossiers contenant `SKILL.md` et les anciens YAML dans `data_dir/skills`, puis `spec_dir/skills`. Installation, désinstallation et rechargement existent côté API daemon. L’installateur sait récupérer des fichiers de support et conserve une trace avec hash du `SKILL.md`.

Dans le daemon isolé, deux skills sont chargés : **`read_file`**, un exemple qui renvoie à l’outil de lecture déjà existant, et **`morning-brief`**, un briefing général. Cela ne constitue pas un pack de workflows de développement. Les skills personnels installés pour Codex/Cursor dans `.codex/skills` ou `.agents/skills` ne sont pas automatiquement ceux de ce registre.

Source : [registre](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/skills.rs#L140), [skills livrés](https://github.com/azerothl/Akasha/tree/4f3ee5f/spec/skills), [installateur](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api.rs#L2742).

## Écarts prioritaires

### P0 — Résultat de tâche et résultat vérifié doivent être distincts

Une réponse vide est remplacée par « No response from the model… ». Une répétition d’outils sort de la boucle avec un message d’arrêt. La finalisation conserve néanmoins `completed` en l’absence d’un statut d’échec déjà enregistré ou d’une erreur de vérification Studio. Les deux rapports de recette illustrent cette situation : leurs assertions fichier/diff passent, mais l’orchestration signale un problème.

**À faire :** stocker un motif de terminaison structuré (`success`, `model_empty`, `tool_loop`, `budget_exhausted`, `verification_failed`, etc.), les résultats de commandes et les critères vérifiés. Réserver le succès au contrat demandé ; exposer les résultats partiels et la reprise.

**Preuve :** [réponse vide](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api_llm_loop/run_message.rs#L3621), [finalisation](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api_llm_loop/run_message.rs#L4213), [recette finale](validation/daemon-task-2026-10-18-final.json).

### P0 — Rendre les rôles de lecture seule contraignants

Le reviewer a une interdiction technique de huit outils d’édition et de délégation. **`run_command`, `run_terminal`, le lancement en arrière-plan et le conteneur restent dans sa liste.** Le planner reçoit aussi la liste de base ; sa restriction aux sources et à `CODE_STUDIO_PLAN.md` apparaît dans son prompt, sans garde spécifique retrouvée dans le dispatcher. Une politique shell générale autorisant un interpréteur ou un gestionnaire de paquets ne garantit donc pas une revue sans mutation.

**À faire :** appliquer au point d’exécution un profil par rôle : chemins de lecture/écriture, commandes et sous-commandes, outils externes/MCP et effets de bord. Le planner doit avoir une exception d’écriture limitée au plan ; la revue ne doit pas pouvoir écrire par le shell. Compléter avec une isolation de processus : un `cwd` autorisé ne constitue pas une sandbox système.

**Limite :** constat de code ; aucun scénario de contournement ou d’écriture hors projet n’a été exécuté pendant l’audit.

**Preuve :** [filtrage annoncé](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api.rs#L1456), [garde d’exécution reviewer](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api_tool_dispatch/execute.rs#L58), [commande système](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-tools/src/tools.rs#L1064), [règles planner/reviewer](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api.rs#L3301).

### P1 — Un inventaire effectif par projet, tâche et agent

`/api/tools/effective` décrit la politique globale et le catalogue statique. Le prompt applique ensuite un autre filtrage Studio. Le tableau de capacités de l’interface est également statique. Le résumé avant envoi affiche un mode issu de `/api/trust-access`, pas la liste calculée des outils du rôle avec leurs prérequis.

Le planner mentionne `list_dir`, absent du catalogue Studio et du dispatcher inspectés ; aucun alias correspondant n’a été trouvé. Le repli d’une liste filtrée vide réannonce en outre quelques outils, dont des outils d’écriture, même si le profil les a retirés. L’exécution conserve ses propres contrôles : ceci prouve une incohérence d’information, pas une élévation de droits démontrée.

**À faire :** une source unique qui calcule noms, schémas, statut annoncé/autorisé/exécutable, motifs de refus, prérequis et origine des règles pour un contexte précis. Utiliser ce résultat dans le prompt, le dispatcher et l’interface. Supprimer les outils fantômes et détecter les prérequis manquants avant lancement.

**Preuve :** [route effective globale](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api_routes_plugins.rs#L644), [matrice UI](../src/agentCapabilities.tsx), [permissions affichées](../src/sendContextSummary.tsx), [repli Studio](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api.rs#L1426).

### P1 — Skills de projet, règles et activation contrôlée

Le chargement inspecté ne recherche pas les skills dans le projet ou dans ses parents. Aucun chargement automatique systématique de `AGENTS.md`, de règles imbriquées ou de `.agents/skills` n’a été trouvé dans ce chemin. Un agent peut lire ces fichiers sur demande, ce qui est différent d’une résolution automatique fiable.

Le champ `agents` et la méthode `for_agent` existent, mais la construction du prompt et `list_skills` utilisent `reg.list()`, puis `read_skill` lit le corps sans ce filtrage. Aucun appel à `for_agent` n’a été trouvé dans les crates inspectées. Le même nom chargé depuis `spec_dir` remplace celui de `data_dir`, ce qui mérite une priorité explicite. Le corps renvoyé par `get_body` n’est pas accompagné de son dossier d’origine : la résolution des références relatives et des scripts doit également être rendue explicite.

**À faire :** règles hiérarchiques et skills par projet/utilisateur/pack livré, priorité documentée, sélection pertinente par description, activation visible et auditée, restriction par rôle appliquée à l’invocation, version/source/hash des fichiers de support. Ne pas assimiler l’installation des skills de cet assistant à leur installation dans Code Studio.

**Preuve :** [chemins et priorité](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/skills.rs#L140), [filtrage disponible](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/skills.rs#L187), [catalogue dans le prompt](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api_llm_loop/run_message.rs#L525), [activation](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api_llm_loop/run_message.rs#L2883).

### P1 — Compléter l’observation de l’application et l’intégration des extensions

Le daemon implémente un outil `browser` et un terminal PTY. **`browser` et `terminal_session` ne figurent pas dans les 35 outils annoncés en Studio.** Le navigateur peut être remplacé par des scripts Playwright via le shell, si les dépendances et la politique le permettent, mais il manque une boucle native accessible : lancer → observer → agir → lire console/réseau → conserver une preuve.

Le dispatcher possède une voie `mcp_<server>_<tool>` avec politique et budget ; aucun ajout dynamique de ces descriptions n’a été trouvé dans le bloc d’outils Studio inspecté. Le cockpit affiche surtout le statut/configuration MCP. Le support backend ne suffit pas à rendre une extension découvrable et utilisable depuis la tâche.

**À faire :** exposer navigateur, PTY et outils MCP depuis l’inventaire contextuel, avec permissions adaptées et état de disponibilité. Relier captures, journaux et résultats à la tâche. Dans la sonde isolée, le navigateur était déclaré non exécutable ; son automatisation n’a pas été testée.

**Preuve :** [outils Studio](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api.rs#L1376), [exécution MCP](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api_tool_dispatch/execute.rs#L82), [cockpit](../src/daemonOpsPanel.tsx), [PTY](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api_routes_terminal.rs#L13).

### P1 — Contrats d’appels et reprise d’exécution

La boucle Studio utilise des lignes textuelles `TOOL:` et plusieurs normaliseurs de syntaxes. `CompletionRequest` n’expose pas de schémas de fonctions natifs dans le contrat inspecté. Les sorties, gardes de répétition et événements sont utiles, mais la grammaire d’arguments, les écritures rejouées et les limites de contexte restent des points de fragilité.

**À faire :** contrats d’arguments typés avec validation, erreurs et codes de sortie structurés, identifiants d’opérations et écritures protégées contre les versions périmées. Distinguer la reprise du suivi dans le navigateur, déjà testée, de la reprise d’une boucle d’outils après crash du daemon, non validée ici.

**Preuve :** [contrat LLM](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-llm/src/provider.rs#L10), [boucle et parser](https://github.com/azerothl/Akasha/blob/4f3ee5f/crates/akasha-daemon/src/api_llm_loop/run_message.rs#L540), [test de reprise UI](../e2e/task-resume.spec.ts).

### P2 — Sémantique du code et livraison intégrée

Recherche texte, Code RAG et marqueurs Monaco existent. Pas de LSP/DAP trouvé dans les outils inspectés : définition, références, renommage sémantique, diagnostics serveur et sessions de debug restent à intégrer selon les langages ciblés. Ce n’est pas indispensable pour un MVP supervisé, mais cela limite les gros dépôts et refactorisations.

Git et la revue sont présents ; pour aller jusqu’à la livraison, ajouter des opérations explicites de commit/push/PR/lecture de CI, ou des connecteurs fiables, avec une autorisation adaptée. Le shell peut déjà exécuter ces opérations si les outils et accès nécessaires sont disponibles.

## Pack de skills de développement proposé

Ce sont des workflows à créer, pas des skills actuellement livrés :

1. **Explorer un dépôt** : lire les règles, reconnaître stack et conventions, identifier les fichiers et produire un plan borné.
2. **Implémenter une modification** : changement limité, protection des brouillons/versions et lecture du diff final.
3. **Diagnostiquer un échec** : reproduire, collecter les journaux, isoler la cause, corriger puis rejouer le même contrôle.
4. **Vérifier une modification** : choisir les commandes du projet, conserver code de sortie et preuve, distinguer tests non lancés et réussis.
5. **Revoir une modification** : contrat technique de lecture seule, constats localisés, critères vérifiés et verdict.
6. **Vérifier une interface** : navigateur, desktop/mobile, console/réseau, clavier et captures liées à la tâche.
7. **Livrer une modification** : branche, commit, PR, CI et résumé, avec étapes externes explicitement autorisées.

Les prompts actuels couvrent déjà une partie de ces intentions. Les formaliser en skills doit rendre leur sélection, leurs prérequis et leurs preuves réutilisables ; un skill ne doit jamais accorder des permissions supplémentaires à lui seul.

## Repères externes

- [Cursor Browser](https://cursor.com/docs/agent/tools/browser) : boucle de vérification visuelle, console et réseau dans le travail de l’agent.
- [OpenCode Tools](https://opencode.ai/docs/tools/) : outils code/shell et opérations LSP, dont l’outil LSP expérimental selon configuration.
- [OpenCode Agent Skills](https://opencode.ai/docs/skills/) : découverte de skills dans les emplacements de projet et utilisateur, chargement à la demande.
- [Codex Skills](https://learn.chatgpt.com/docs/build-skills) : workflows réutilisables et instructions accompagnées de ressources.

## Ordre conseillé

**D’abord fiabiliser les statuts et les permissions par rôle. Ensuite unifier l’inventaire effectif et la résolution des skills/règles. Puis ajouter le pack de workflows et la boucle navigateur/terminal.** Les capacités LSP/debug et la livraison intégrée peuvent suivre selon les projets visés.

L’audit ci-dessus décrit l’état inspecté, avant corrections. Les tickets publiés et leurs dépendances sont suivis dans [le backlog agentique](AGENTIC_BACKLOG.md). Les corrections ultérieures doivent être évaluées séparément des constats d’origine.
