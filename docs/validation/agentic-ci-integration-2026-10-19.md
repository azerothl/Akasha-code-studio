# Validation avant intégration — 19 octobre 2026

Suite du [rapport de reprise et des modèles](agentic-recovery-models-2026-10-19.md), après traitement des commentaires de revue et deux régressions Windows observées pendant la recette. Les états de fusion et de clôture sont consultables dans les PR et tickets liés au [backlog](../AGENTIC_BACKLOG.md).

## Décision : intégration bloquée

**Aucune fusion ni clôture de ticket.** La campagne complète sur le code actuel comporte un échec fonctionnel LFM2 (17/18). Les succès de campagnes antérieures ne lèvent pas ce blocage. Les validations de reprise #158 passent ; #179 reste ouvert.

## Résultats locaux sur le dernier code

| Contrôle | Résultat |
| --- | --- |
| Rust daemon / LLM / store / tools | **432 / 65 / 29 / 30**, soit **556 réussis** ; 1 ancien test PTY ignoré |
| Code Studio Vitest / Playwright | **21 / 32 réussis** ; API simulées dans Playwright |
| Daemon réel, SQLite, Git, PTY, MCP, Chromium, LSP | **48/48** ; protocole modèle déterministe |
| Vrais modèles, sans fallback | **17/18 fonctionnelles** ; Devstral 6/6, LFM2 5/6, Qwen 6/6 ; contrôle du catalogue partiellement perdu dans le journal borné |
| Builds daemon / Code Studio | Réussis ; avertissement de taille du bundle conservé |
| Interface native / TUI | TypeScript / cargo check réussis ; binaire Tauri non compilé |
| Expurgation des journaux navigateur | 4 cas Authorization, Cookie, Bearer et token réussis |

Code daemon : [2eb0c9d](https://github.com/azerothl/Akasha/commit/2eb0c9df73eed95616f8ab6d32beaf8c57f0eb90). SHA-256 du binaire commun aux 48 parcours et 18 recettes : `3592dacea6a593b58ca4a5eeac8f1af91447202fe710576719453911da675b38`.

La [CI CPU du commit](https://github.com/azerothl/Akasha/actions/runs/39245399976) comprend les tests du workspace, les recettes cookbook, les smoke daemon/CLI, les parcours UI et la compilation llama.cpp Linux. **Les trois jobs CPU sont terminés avec succès** : test (workspace, cookbook, daemon/CLI), embedded-llama-cpp-linux et ui-e2e. Les revues automatiques sont terminées ; le commentaire LSP sur les diagnostics sans version reste ouvert. Cette CI verte ne lève pas le blocage fonctionnel #179. Le job GPU sans runner n'est pas exécuté, conformément à l'exception autorisée. La recette locale utilise Ollama sur une **RTX 4080 SUPER, 16 376 MiB**, pilote 610.88 ; elle ne remplace pas une validation du backend embarqué CUDA.

## Corrections de revue

- Résultats terminaux persistants même hors de la finalisation principale ; conservation du motif détaillé d'un échec concordant et des preuves de commandes exécutées par un skill CLI.
- Contexte de worktree restauré depuis le registre persistant ; règles imbriquées chargées dans l'autofix ; règles découvertes par recherche immédiatement actives ; une activation documentaire n'est plus enregistrée deux fois ; les skills YAML ne peuvent pas masquer un outil interne.
- Quota MCP limité à la présentation, profil appliqué avant le quota, notifications d'initialisation et lignes blanches prises en charge. Fermeture PTY avant archivage, attente bornée du lecteur, alias Windows cohérents avec les autorisations et interdictions.
- Lots : validation structurelle et des littéraux avant tout effet ; une erreur bloque les opérations suivantes, y compris après une lecture invalide. Le schéma de lecture exprime l’exclusion entre `full: true` et la fenêtre de lignes. Les créations à littéraux explicites exposent des valeurs autorisées de chemin/contenu sans réécrire la sortie du modèle.
- Schémas natifs dérivés du même contrat typé pour tous les outils. Les descriptions précises de chemin, version attendue et contenu exact sont conservées. Résultat de commande directement lisible, troncature explicite, hashes hexadécimaux insensibles à la casse, politique réévaluée avant de restituer un résultat en cache.
- Approbations liées au workspace et à la destination GitHub réelle, avec fichiers/message de commit visibles ; contenu PTY inspectable et borné ; identifiants transmis par TUI et Telegram ; objectifs et littéraux conservés après approbation et reprise.
- Git : configuration locale limitée aux métadonnées autorisées, refus des configurations malformées, refus des symlinks sélectionnés, inspection locale possible sans gh, URL de publication approuvée épinglée dans la commande push, destination `expected_repository` obligatoire pour l’opérateur ; refus des helpers/includes configurés par le dépôt, comparaison de HEAD pendant la réconciliation d'index, précondition distante appliquée côté serveur avec vérification locale d'ascendance, livraison opérateur depuis les états arrêtés.
- Routes GET de livraison, tâches, approbations et événements SSE protégées contre les origines navigateur externes/opaques ; expurgation complète des en-têtes sensibles et jetons des journaux navigateur.
- LSP : extensions `.mts`/`.cts`, lancement depuis un chemin absolu autorisé, préservation du nom des shims rustup. Après modification d'un buffer, un diagnostic push dépourvu de version n'est pas présenté comme frais : état pending explicite ; diagnostics pull et notifications versionnées restent utilisables.

## Recettes, preuves et limites

[48 parcours techniques](agentic-ci-technical-2026-10-19.json), [18 recettes modèles](agentic-ci-models-2026-10-19.json), [passages précédents conservés](agentic-ci-development-2026-10-19.json).

La campagne complète réalise trois écritures simples et trois séquences écriture de FIRST.md, lecture réussie de FIRST.md contenant alpha, puis écriture de SECOND.md par modèle. Les fichiers et diffs exacts sont vérifiés ; une lecture quelconque ou omise ne suffit pas. Température 0.1, 4 096 tokens, contexte 32 768, budget 12 tours ; LFM2 top_k 50 et repeat_penalty 1.05 par défaut de l’adaptateur. Les données et alias sont isolés puis nettoyés.

**Blocage actuel : LFM2, multi-tool, itération 3.** Le modèle omet `expected_version` et répète lecture/écriture invalide jusqu’à atteindre 12 tours et demander une décision utilisateur. Aucun des fichiers demandés n’est écrit. Le moteur conserve l’échec et ne force pas la réussite. Cette campagne ne justifie aucune fusion.

Le contrôle supplémentaire du catalogue avait lu les événements après terminaison. Le journal `task_events` étant borné, des événements de tokens pouvaient avoir évincé le catalogue initial. Le runner les collecte désormais pendant l’exécution. Les verdicts d’origine sont conservés dans la preuve ; les contenus, diffs, nombres d’écritures et lectures ordonnées ont été revérifiés séparément : **17/18**. Ce défaut de collecte n’explique pas l’échec fonctionnel LFM2. Un [contrôle de six recettes après correction de la collecte](agentic-ci-catalogue-2026-10-19.json) passe 6/6, avec catalogue présent et contenu/ordre vérifiés. Ce passage court ne remplace pas la campagne complète en échec et ne clôt pas #179.

Les passages intermédiaires restent archivés : régressions Windows corrigées ; campagne 15/18 après perte des indications de schéma ; campagnes 18/18 antérieures ; 17/18 puis 11/12 avec mauvaise casse LFM2 ; 10/12 après schémas de littéraux, contenus corrects mais lecture FIRST exécutée après SECOND parce qu’un lot partiellement invalide continuait. La correction actuelle rejette les lots structurellement invalides avant tout effet et suspend les appels suivants après un échec d’exécution. Le parcours déterministe couvre ces deux cas et leur réparation dans l’ordre.

Les PR temporaires de publication [#48](https://github.com/azerothl/Akasha-code-studio/pull/48) et [#49](https://github.com/azerothl/Akasha-code-studio/pull/49), [#50](https://github.com/azerothl/Akasha-code-studio/pull/50), [#51](https://github.com/azerothl/Akasha-code-studio/pull/51), [#52](https://github.com/azerothl/Akasha-code-studio/pull/52) ont été fermées sans fusion et leurs branches supprimées. Les captures [desktop](agentic-ci-2026-10-19/desktop.png), [mobile](agentic-ci-2026-10-19/mobile.png), [éditeur LSP](agentic-ci-2026-10-19/editor-lsp.png) et [preuves](agentic-ci-2026-10-19/task-evidence.png) proviennent du dernier parcours technique.

Les contrôles techniques couvrent la tranche des tickets #151–#160, #179 et Code Studio #27–#30. Elles ne couvrent pas tout #143 (mémoire, fallback, tâches planifiées, baseline CPU et seuils CI) ni l'audit complet des worktrees #145. Le contrôle de capacités et de chemins ne constitue pas une sandbox OS.
