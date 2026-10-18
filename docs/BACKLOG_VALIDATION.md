# Traitement du backlog Code Studio — 18 octobre 2026

La base inclut les PR fusionnées [Code Studio #23](https://github.com/azerothl/Akasha-code-studio/pull/23), [#24](https://github.com/azerothl/Akasha-code-studio/pull/24) et [Akasha #138](https://github.com/azerothl/Akasha/pull/138). Ce passage termine les écarts suivants ; les tickets restent liés à la livraison des corrections.

| Ticket | Livraison et preuve |
|--------|---------------------|
| [#14](https://github.com/azerothl/Akasha-code-studio/issues/14) | Spécification et guide réconciliés : build conteneurisé, prévisualisation Node/Python, validation manuelle distincte des mocks et de la recette réelle. Guide embarqué synchronisé. |
| [#15](https://github.com/azerothl/Akasha-code-studio/issues/15) | Réponses HTTP lues une fois, fichier Markdown exact, diff exigé avec le fichier attendu, diagnostics conservés et nettoyage contrôlé. Une tâche réelle a réussi, voir ci-dessous. |
| [#16](https://github.com/azerothl/Akasha-code-studio/issues/16) | Cycle demander → fusionner, validation fondée sur le succès du build, vue adaptative et menu mobile fermé au démarrage/rétrécissement. Tests navigateur du parcours sans projet et des destinations existantes. |
| [#17](https://github.com/azerothl/Akasha-code-studio/issues/17) | Critères et branche enregistrés par demande, état Git et conflits, résultats de commandes sans assimiler une intention à une exécution. Dry-run obligatoire, hunks appliqués verrouillés, hunks tronqués en lecture seule. |
| [#18](https://github.com/azerothl/Akasha-code-studio/issues/18) | Contrat d’isolation livré dans Akasha #138 ; cockpit avec base/branche/conflits. Intégration seulement pour les workers en revue, après confirmation d’une revue manuelle du dossier isolé. Test UI : worker actif non intégrable, worker en revue désactivé jusqu’à confirmation. |
| [#19](https://github.com/azerothl/Akasha-code-studio/issues/19) | Onglets et brouillons indépendants, sauvegarde sans perdre une saisie plus récente, réponses de fichiers périmées ignorées. Recherche sur les candidats texte listés, sans plafond silencieux de 25 fichiers, avec 4 lectures simultanées et 40 résultats affichés. |
| [#20](https://github.com/azerothl/Akasha-code-studio/issues/20) | Résumé d’envoi consultable avec références, critères, design, agent demandé et permissions. Le modèle affiché vient du dernier tour réel, les champs de handoff ne deviennent pas une fausse preuve d’exécution. Secrets masqués, y compris en-têtes et valeurs entre guillemets. |
| [#21](https://github.com/azerothl/Akasha-code-studio/issues/21) | Hiérarchie parent/enfant, statuts disponibles et branche active, transcript local complet sans limite de 240 caractères, retour au parent. Repli sur les événements et l’historique conservé, sans endpoint graphe requis. |
| [#22](https://github.com/azerothl/Akasha-code-studio/issues/22) | Hooks de domaines projets, éditeur, Git, aperçu/build et suivi des tâches. Types de navigation et modèles purs séparés. Annulation, identification des requêtes et synchronisation des brouillons préservées ; voir [frontières UI](UI_BOUNDARIES.md). |
| [#25](https://github.com/azerothl/Akasha-code-studio/issues/25) | Composant commun pour attente, vide, partiel, hors ligne, erreur et succès ; actions de reprise, détails repliables, annonces accessibles et brouillon de chat conservé après échec. |

## Validation finale après simplification UI

Passage du 18 octobre 2026 sous Windows, sur l’interface simplifiée de [DESIGN.md](../DESIGN.md) :

- `npm run test:unit` : **20/20**.
- `npm run test:e2e` : **29/29**, Chromium et API simulée. Deux tests supplémentaires couvrent le focus et la fermeture du panneau Outils ainsi que le parcours mobile discussion → fichier → aperçu → discussion avec conservation du brouillon.
- `npm run build` : **réussi**, TypeScript/Vite ; avertissement de bundle principal d’environ 704 ko minifié.
- `npm run test:daemon` : **1/1 réel**, création et initialisation Git du projet ; le test de tâche agent reste opt-in.
- `npm run test:daemon:task` : **1/1 réel**, environ 59 secondes avec Ollama `qwen3.5:9b`, même binaire daemon identifié ci-dessous. Le [rapport final](validation/daemon-task-2026-10-18-final.json) confirme le contenu exact de `RECIPE_OK.md`, le diff HTTP 200 et le nettoyage du projet `9224a360-8491-4555-88a2-fcbe5bc6dd55`. Le dossier des projets était vide après nettoyage et le daemon de recette a été arrêté.

La tâche finale `78e6a50e-7661-4ac1-917d-71a844220eb1` est déclarée `completed` par le daemon. Sa dernière progression indique toutefois une absence de réponse du modèle après les opérations d’écriture. Les assertions fichier/diff/nettoyage passent ; ce message est conservé dans le rapport et ne permet pas d’affirmer que toute l’orchestration daemon est sans avertissement.

Les assertions qui dépendaient de l’ancien bandeau sandbox ont été remplacées par la sélection visible du projet. Le test de restauration place le projet mémorisé en deuxième position de la liste. Le test de reprise cible la progression visible de la conversation et vérifie l’identifiant de tâche persistant, la reprise des requêtes après rechargement puis le nettoyage à la fin. Son mock de statut ne répond qu’à l’URL exacte de la tâche.

## Validation initiale du backlog

Les résultats et captures ci-dessous correspondent au commit `785a4e7`, avant la simplification visuelle. Les résultats de l’interface simplifiée figurent dans la section précédente.

Exécutions du 18 octobre 2026 sous Windows :

- `npm run test:unit` : **20 tests réussis** dans 4 fichiers.
- `npm run test:e2e` : **27 tests réussis** dans Chromium, avec API simulée.
- `npm run build` : **réussi**, TypeScript et Vite ; avertissement de taille du bundle principal (environ 695 ko minifié).
- `npm run test:daemon` : **1 test réussi**, création et initialisation Git réelles ; la recette agent reste ignorée dans cette suite par défaut.
- `npm run test:daemon:task` : **1 test réussi**, en environ 69 secondes. Le [rapport conservé](validation/daemon-task-2026-10-18.json) inclut le contenu, le diff et les identifiants des projets nettoyés.
- `git diff --check` : aucune erreur d’espacement. Les deux copies du guide utilisateur ont le même SHA-256.

Captures relues avec données simulées : [reprise sur ordinateur](screenshots/feedback-desktop.png), [projet vide sur fenêtre étroite](screenshots/feedback-mobile-empty.png), [chat sur fenêtre étroite](screenshots/feedback-mobile-chat.png). Les tests vérifient aussi que l’action principale, le compositeur et les options restent accessibles à 390 px de largeur.

La recette réelle a utilisé un daemon isolé sur le port 3891 et Ollama `qwen3.5:9b`. La tâche finale `45b4a3b8-2844-46de-ba7f-397da76486cd` a été déclarée `completed` ; le contenu de `RECIPE_OK.md` et sa présence dans le diff ont été vérifiés. Le projet temporaire a été supprimé, le répertoire des projets était vide après nettoyage, puis le daemon de recette a été arrêté. Sa progression signale une répétition d’appel outil arrêtée par le détecteur de boucle : le succès de la recette porte sur les assertions fichier/diff/nettoyage, sans affirmer une exécution agent dépourvue d’avertissement. La première tentative `.txt` avait créé le fichier, mais échouait à juste titre sur le diff : cette extension est exclue du snapshot.

Le daemon exécuté est le binaire local dont le SHA-256 est `22ce5a5babf8d5c32cd7acb0b4728f40ef57158ad4f3b9114cccebd58751e6bd`. Cette recette valide la compatibilité avec ce binaire ; elle ne constitue pas une compilation ni une validation de tout le monorepo Akasha courant.

Les tests Playwright utilisent des réponses API simulées. La revue des workers est manuelle et leur concurrence réelle n’a pas été mesurée dans ce passage. Le panneau des forks affiche les messages conservés dans ce navigateur (au plus 200), pas une archive serveur complète. LSP/DAP et l’intégration Akasha OS restent hors du périmètre livré.
