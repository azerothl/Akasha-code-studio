# Validation avant intégration — 19 octobre 2026

Suite du [rapport de reprise et des modèles](agentic-recovery-models-2026-10-19.md), après traitement des commentaires de revue et deux régressions Windows observées pendant la recette. Les états de fusion et de clôture sont consultables dans les PR et tickets liés au [backlog](../AGENTIC_BACKLOG.md).

## Résultats locaux sur le dernier code

| Contrôle | Résultat |
| --- | --- |
| Rust daemon / LLM / store / tools | **425 / 65 / 29 / 30**, soit **549 réussis** ; 1 ancien test PTY ignoré |
| Code Studio Vitest / Playwright | **21 / 32 réussis** ; API simulées dans Playwright |
| Daemon réel, SQLite, Git, PTY, MCP, Chromium, LSP | **48/48** ; protocole modèle déterministe |
| Vrais modèles, sans fallback | **18/18** ; Devstral, LFM2 et Qwen, 6 recettes chacun |
| Builds daemon / Code Studio | Réussis ; avertissement de taille du bundle conservé |
| Interface native / TUI | TypeScript / cargo check réussis ; binaire Tauri non compilé |
| Expurgation des journaux navigateur | 4 cas Authorization, Cookie, Bearer et token réussis |

Code daemon : [aa075a9](https://github.com/azerothl/Akasha/commit/aa075a9c39fe6c13ce7ae879f22efad3a923f571). SHA-256 du binaire commun aux 48 parcours et 18 recettes : `8bbd9836f54d3d396ca828327eb2325e2025f75c8b65afbc99f248bee3b30e1b`.

La [CI CPU du commit](https://github.com/azerothl/Akasha/actions/runs/39235813853) comprend les tests du workspace, les recettes cookbook, les smoke daemon/CLI, les parcours UI et la compilation llama.cpp Linux. Son état vivant doit être vert avant fusion. Le job GPU sans runner n'est pas exécuté, conformément à l'exception autorisée. La recette locale utilise Ollama sur une **RTX 4080 SUPER, 16 376 MiB**, pilote 610.88 ; elle ne remplace pas une validation du backend embarqué CUDA.

## Corrections de revue

- Résultats terminaux persistants même hors de la finalisation principale ; conservation du motif détaillé d'un échec concordant et des preuves de commandes exécutées par un skill CLI.
- Contexte de worktree restauré depuis le registre persistant ; règles imbriquées chargées dans l'autofix ; règles découvertes par recherche immédiatement actives ; une activation documentaire n'est plus enregistrée deux fois ; les skills YAML ne peuvent pas masquer un outil interne.
- Quota MCP limité à la présentation, profil appliqué avant le quota, notifications d'initialisation et lignes blanches prises en charge. Fermeture PTY avant archivage, attente bornée du lecteur, alias Windows cohérents avec les autorisations et interdictions.
- Schémas natifs dérivés du même contrat typé pour tous les outils. Les descriptions précises de chemin, version attendue et contenu exact sont conservées. Résultat de commande directement lisible, troncature explicite, hashes hexadécimaux insensibles à la casse, politique réévaluée avant de restituer un résultat en cache.
- Approbations liées au workspace et à la destination GitHub réelle, avec fichiers/message de commit visibles ; contenu PTY inspectable et borné ; identifiants transmis par TUI et Telegram ; objectifs et littéraux conservés après approbation et reprise.
- Git : refus des helpers/includes configurés par le dépôt, comparaison de HEAD pendant la réconciliation d'index, précondition distante appliquée côté serveur avec vérification locale d'ascendance, livraison opérateur depuis les états arrêtés.
- Routes GET de livraison protégées contre les origines navigateur externes/opaques ; expurgation complète des en-têtes sensibles et jetons des journaux navigateur.
- LSP : extensions `.mts`/`.cts`, lancement depuis un chemin absolu autorisé, préservation du nom des shims rustup. Après modification d'un buffer, un diagnostic push dépourvu de version n'est pas présenté comme frais : état pending explicite ; diagnostics pull et notifications versionnées restent utilisables.

## Recettes, preuves et limites

[48 parcours techniques](agentic-ci-technical-2026-10-19.json), [18 recettes modèles](agentic-ci-models-2026-10-19.json), [passages précédents conservés](agentic-ci-development-2026-10-19.json).

Le dernier passage réalise trois écritures simples et trois séquences écriture de FIRST.md, lecture réussie de FIRST.md contenant alpha, puis écriture de SECOND.md par modèle. Les fichiers et diffs exacts sont vérifiés ; une lecture quelconque ou omise ne suffit pas. Température 0.1, 4 096 tokens, contexte 32 768, budget 12 tours ; LFM2 top_k 50 et repeat_penalty 1.05 par défaut de l'adaptateur. Les données et alias sont isolés puis nettoyés.

Les échecs intermédiaires restent visibles : refus de cmd.exe avec une ancienne politique cmd, perte du nom rust-analyzer via canonicalisation, chemins Windows verbatim refusés, assertion de fixture devenue obsolète après activation immédiate des règles, puis campagne 15/18 (un timeout Devstral à 90 secondes et deux budgets LFM2 épuisés après perte des indications de schéma). Le dernier passage 18/18 est exécuté après restauration de ces indications, sans compilation ou LSP concurrents. Cette différence de conditions est documentée ; elle ne prouve pas que le timeout initial était causé par la compilation.

Les PR temporaires de publication [#48](https://github.com/azerothl/Akasha-code-studio/pull/48) et [#49](https://github.com/azerothl/Akasha-code-studio/pull/49) ont été fermées sans fusion et leurs branches supprimées. Les captures [desktop](agentic-ci-2026-10-19/desktop.png), [mobile](agentic-ci-2026-10-19/mobile.png), [éditeur LSP](agentic-ci-2026-10-19/editor-lsp.png) et [preuves](agentic-ci-2026-10-19/task-evidence.png) proviennent du dernier parcours technique.

Ces validations couvrent la tranche des tickets #151–#160, #179 et Code Studio #27–#30. Elles ne couvrent pas tout #143 (mémoire, fallback, tâches planifiées, baseline CPU et seuils CI) ni l'audit complet des worktrees #145. Le contrôle de capacités et de chemins ne constitue pas une sandbox OS.
