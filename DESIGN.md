# Code Studio — interface de travail

## Intention

Mode **Operate**. Aider à demander une modification, suivre le travail de l’agent et examiner son résultat. La conversation est l’entrée par défaut ; les fichiers et l’aperçu restent à un clic. Les informations techniques se déplient au moment où elles servent une décision.

Cette direction remplace l’en-tête à plusieurs rangées et les surfaces violettes imbriquées. Elle concerne l’interface de Code Studio, pas les fichiers `DESIGN.md` des projets créés par le daemon.

## Composition

- En-tête de 56 px : choix du projet, branche sur grand écran, indicateur de connexion, disposition, notifications et outils.
- Navigation principale : Discussion, Fichiers, Aperçu et Tâches. Les autres destinations sont dans **Plus d’outils**.
- Mobile jusqu’à 900 px : un seul espace visible, navigation basse **Discussion / Fichiers / Aperçu**, menu latéral fermé au démarrage.
- **Outils du projet** ouvre un panneau dédié : index, état Git, création/chargement, évolutions, import/build et actions agent. Le panneau gère le focus et Échap avec un dialogue natif.
- Compositeur : texte, bouton d’envoi, choix de l’agent et options. **Contexte et permissions** ouvre le détail avant envoi. Le handoff de modèle reste dans les options.
- Le modèle de la prochaine tâche se choisit directement dans le composeur, séparément du rôle; le handoff reste réservé aux reprises. La palette `/` découvre les workflows et `/goal` montre ses critères et limites.
- Le Kanban garde son propre défilement horizontal dans les vues partagées. L’aperçu privilégie le lancement et le résultat; environnement, vérification et journaux se déplient à la demande. Les branches se lisent dans un seul flux, avec comparaison et confirmation avant fusion.
- Sans projet : invitation à créer/ouvrir un projet. Aucun compositeur inutilisable.
- Éditeur mobile : l’arborescence se replie après ouverture d’un fichier. Recherche et diagnostics sont repliables.

## Apparence

Le thème Akasha par défaut utilise un graphite neutre : fond `#18191b`, surface `#202123`, texte `#ededee`, texte secondaire `#b0b2b8`, séparateurs `#34363a`. Le violet `#7867cf` reste réservé aux actions. Les autres thèmes disponibles gardent leur palette.

Police de travail existante Inter/système ; corps 14 px, titres de bienvenue 28–34 px, interligne confortable. Messages assistant sans boîte ; messages utilisateur sur une surface neutre. Compositeur arrondi à 16 px, commandes à 7–10 px. Aucun dégradé ni effet de halo dans le nouvel habillage.

Les ajustements du shell vivent dans `src/workspace.css`. Les tokens synchronisés depuis le monorepo ne sont pas modifiés. Les composants de structure et de bienvenue vivent dans `src/workspaceChrome.tsx`.

## Références

Les principes repris sont la place centrale de la tâche/conversation et la consultation des outils et de la revue à la demande : [Cursor Agent](https://cursor.com/docs/agent/overview), [Codex — interface projets, threads et revue](https://learn.chatgpt.com/docs/changelog). Il s’agit d’une adaptation aux fonctions réelles de Code Studio.

## Évidence

Captures avec API simulée : [ordinateur](docs/screenshots/workspace-desktop.png), [mobile](docs/screenshots/workspace-mobile.png), [éditeur mobile](docs/screenshots/workspace-mobile-files.png), [outils mobiles](docs/screenshots/workspace-mobile-tools.png). Script reproductible : `node scripts/capture-workspace-screenshots.mjs`, avec Vite sur le port 5178.

Deux passages de revue visuelle ont été effectués à 1440 × 960 et 390 × 844. À 390 px, le compositeur reste dans l’écran, la navigation basse finit à 844 px et le document n’a pas de débordement horizontal. TypeScript/Vite compilent. Après adaptation des assertions à la nouvelle navigation : **20 tests unitaires et 29 tests navigateur réussis**. Les contrôles couvrent aussi le focus du panneau Outils, la navigation mobile, la place du code et la conservation du brouillon. Les résultats daemon réels et leurs limites sont dans [le rapport de validation](docs/BACKLOG_VALIDATION.md).
