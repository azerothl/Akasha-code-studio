# Validation agentique réelle — 18 octobre 2026

> **Historique de la première campagne.** La [validation suivante de #158 et #179](agentic-recovery-models-2026-10-18.md) remplace les compteurs et les lacunes de reprise ci-dessous : REC-01 à REC-09 exécutées, 515 tests Rust, 21 unitaires UI, 32 Playwright et 38 parcours techniques réussis. Dernières recettes LLM : Qwen 6/6, Devstral 3/6, LFM2 1/6 ; #179 reste bloquant. Les anciens échecs sont conservés dans ce document.

Validation Windows CPU des piles Akasha #162, #164, #166–#170 et Code Studio #31–#35. Les résultats ci-dessous concernent les scénarios exécutés ; ils ne constituent pas une certification de tous les outils ni de tous les modèles.

## Contrôles

| Contrôle | Résultat observé |
| --- | --- |
| Vitest interface, `npm run test` | 20 tests réussis |
| TypeScript/Vite, `npm run build` | Réussi ; avertissement du bundle principal >500 Ko conservé |
| Playwright, `npm run test:e2e` | 30 tests réussis, API simulées |
| Rust daemon, profil `--no-default-features --features embedded --lib` | 397 réussis, 1 ancien test PTY ignoré ; PTY couvert par les parcours réels ci-dessous |
| Bibliothèques Rust `akasha-llm`, `akasha-store`, `akasha-tools` | Respectivement 46, 29 et 28 tests réussis |
| Création de projet via daemon réel | Réussie ; fichiers initiaux et Git propre vérifiés |

Le profil Rust sans aucune feature conserve son erreur préexistante sur `embedded_apply_runtime`. Le profil `embedded` utilisé ci-dessus est explicite. Les avertissements Rust préexistants restent visibles.

## Recettes avec un vrai modèle Ollama

**La recette avec un vrai LLM reste instable.** Qwen2.5-coder et Devstral ont chacun réussi une exécution (une écriture, contenu exact, diff contrôlé), puis bouclé lors d'une répétition. LFM2:24b a également échoué. Les essais récents des trois modèles terminent correctement en `failed / tool_loop / partial` après l'écriture du fichier demandé. **Aucun de ces modèles n'est déclaré fiable sur cette recette ; les essais techniques ci-dessous ne remplacent pas cette validation.**

Le suivi [Akasha #179](https://github.com/azerothl/Akasha/issues/179) conserve ce blocage. La configuration utilisateur est inchangée. Les premiers succès restent archivés, avec les échecs ultérieurs, dans [le rapport modèles](agentic-model-recipes-2026-10-18.json). Il n'y a aucune suppression d'un essai échoué ni changement des assertions pour annoncer un succès.

Données et daemon isolés, fallback désactivé, température 0.1, num_ctx 32768 pour le transport Ollama, max_tokens 1024 pour les essais texte et 4096 pour l'essai compatible OpenAI. Les parcours techniques utilisent une fixture déterministe du protocole modèle et vérifient les vrais effets du moteur. **La condition générale « tous les tests passent » n'est pas satisfaite tant que la recette LLM reste en échec.**

## Parcours réels reproductibles

`integration/agentic-real.mjs` lance un daemon isolé et utilise ses vraies API, SQLite, les fichiers, Git, processus PTY/MCP, Chromium et serveurs LSP. Le fournisseur OpenAI compatible local est **une fixture déterministe du protocole modèle**, pas une évaluation de l'intelligence d'un LLM. Aucune route navigateur `/api` n'est simulée dans ce parcours.

| Parcours | Preuve vérifiée |
| --- | --- |
| Build TypeScript invalide, bundle Vite réussi | Tâche en échec `verification_failed`, build configuré non validé, bundle de secours réellement produit |
| Projet | Fichiers initiaux, commit initial, arbre propre |
| Réponse vide, erreur fournisseur | Échec structuré persistant ; aucune réussite inventée |
| Appel natif Unicode, puis réponse vide | Fichier et diff conservés, résultat partiel |
| Planner/reviewer | Commandes refusées, rôle persisté, usurpation du rôle par query refusée ; planner limité au plan exact |
| Terminal utilisateur | Saisie, curseur, redimensionnement, fermeture, refus entre projets |
| Terminal agent | Propriété par tâche, refus de saisie utilisateur, transcription attachée |
| Critères mécaniques | Un fichier présent reste `passed` quand un autre critère échoue |
| MCP stdio | Vrai processus JSON-RPC, découverte paginée, schéma invalide refusé sans consommer le budget, profil explicite refusé, révocation à l'arrêt |
| Navigateur | Captures bureau/mobile, console, réseau, redirection interdite refusée |
| TypeScript | Vrai serveur, diagnostics, définition, références, aperçu et application du renommage |
| Python | Vrai serveur, définition et diagnostic |
| Rust | Vrai rust-analyzer, définition ; marqueur `build.rs` non exécuté |
| Règles et skill | AGENTS racine/sous-dossier, mutation différée puis rejouée explicitement, activation `studio-explore` tracée |
| Commit sélectionné | Préserve l’index sans rapport, refus d’une sélection ignorée sans modifier HEAD, chemin avec antislash normalisé, retry idempotent |
| Reprise du plafond de tours | Arrêt pendant la question, nouvelle question après reprise, continuation seulement après nouvelle réponse |
| REC-01 | Arrêt réel avant modèle, tâche interrompue, reprise explicite avec même session |
| REC-02 | Crash après effet avant résultat : état inconnu, mutations bloquées, inspection puis décision explicite, aucun effet doublé |
| REC-03 | Crash après écriture enregistrée, avant modèle suivant : fichier préservé et une seule écriture dans le journal |
| Interface réelle | Activation LSP, diagnostic, renommage depuis le formulaire, capacités, résultat, preuves et reprise ; captures à 1280 et 390 px, aucune erreur de page ni débordement horizontal |

Publication distante également exécutée avec les nouvelles API : commit, push, PR brouillon, lecture du SHA et de l'état CI. Les [PR temporaires #36](https://github.com/azerothl/Akasha-code-studio/pull/36) et [#37](https://github.com/azerothl/Akasha-code-studio/pull/37) ont été fermées sans fusion et leurs branches supprimées. #37 répète la publication après les corrections de contrôle du SHA GitHub. L'absence de CI dans ce dépôt est correctement rendue `not_run`.

### Reproduction

Prérequis installés explicitement : Node/npm, Git/gh authentifié pour la publication optionnelle, Chromium Playwright, dépendances de `Akasha/scripts/playwright-runner`, `typescript-language-server`, `pyright-langserver`, composant Rust `rust-analyzer`. Le test n'installe pas ces outils automatiquement. TypeScript **5.6.3 du frontend** est lié au projet de test ; le paquet TypeScript 7.0.2 installé seul ne fournit pas le tsserver attendu par typescript-language-server 5.3.0.

```powershell
$env:CARGO_INCREMENTAL='0'
$env:CARGO_PROFILE_DEV_DEBUG='0'
$env:CARGO_PROFILE_TEST_DEBUG='0'
$env:CARGO_TARGET_DIR=Join-Path $env:TEMP 'studio-agentic-cargo-target'
# Depuis Akasha
cargo build -p akasha-daemon --no-default-features --features embedded --bin akasha-daemon
cargo test -p akasha-daemon --no-default-features --features embedded --lib -- --test-threads=2
cargo test -p akasha-llm -p akasha-store -p akasha-tools --lib -- --test-threads=2
# Depuis Akasha-code-studio, avec le dépôt Akasha voisin
$env:CODE_STUDIO_DAEMON_BIN=Join-Path $env:CARGO_TARGET_DIR 'debug/akasha-daemon.exe'
# Si nécessaire : $env:AKASHA_REPO_DIR et $env:STUDIO_LSP_BIN
npm run test:daemon:agentic
```

Le script utilise le port Vite 5189 et des ports dynamiques pour le daemon et la fixture. Il conserve le rapport et les captures dans le répertoire temporaire imprimé en sortie. Les processus lancés sont arrêtés en fin de parcours. `CODE_STUDIO_TEST_PUBLISH=1` active une **vraie publication GitHub** ; la PR créée doit être attachée au suivi puis fermée sans fusion et sa branche supprimée après collecte des preuves.

## Régressions corrigées pendant la validation

- Réponse modèle vide avalée par une relance de délégation PM : l'échec est désormais enregistré immédiatement.
- Écriture Studio `workspace:/` annoncée en mémoire sans fichier physique avec une politique de chemins absolus : contrôle du chemin résolu et écriture disque obligatoire.
- Diagnostics/renommage Windows : URI `file:///c%3A/…` et `file:///C:/…` comparées par fichier canonique.
- Capture PNG encodée dans le texte du chat : la preuve reste dans son lecteur dédié, tout en restant disponible au modèle vision.
- Bouton « Préparer le renommage » de type `button` : corrigé en `submit`, couvert par un nouveau test Playwright et le parcours réel.
- Suivi après outil fondé sur les résultats exécutés, sans répéter la proposition d'appel du modèle ; les exigences restantes peuvent encore appeler des outils. Consignes d'écriture clarifiées pour ne pas demander de répéter une écriture déjà confirmée. Cela ne garantit pas qu'un modèle respecte les consignes ; son échec reste un échec.

## Limites conservées

- **CUDA non exécuté** : aucun runner GPU configuré. L'utilisateur a explicitement autorisé la fusion après validation CPU et parcours réels. Un job GPU en attente n'est pas présenté comme réussi.
- REC-04 a été exécutée pour `ask_user` et la limite de tours : question reposée et tour/budget conservés après arrêt réel. Les approbations d’outils interrompues et REC-05 à REC-09 (worktree disparu, courses annulation/pause, changement de politique, délégation interrompue) restent à valider par arrêt réel. Les contrôles unitaires de conservation des arrêts et de verrou d'exécution ne remplacent pas ces recettes. **Akasha #158 reste ouvert**.
- **Akasha #143** reste le suivi des évaluations transverses/modèles et **#145** celui des frontières worktree. L'intégration Akasha OS n'est pas implémentée par ces PR.
- Sessions navigateur/PTY et images en mémoire ne sont pas restaurées. Les racines de pipeline jamais passées dans la boucle Studio n'ont pas de checkpoint fourni par ce module.
- LSP exige les serveurs autorisés/préinstallés. Aucun DAP livré. MCP testé en stdio. Livraison distante testée sur GitHub.com.

Les rapports compacts joints à ce document et les captures sont issus des exécutions, sans secrets ni configuration fournisseur personnelle.

## Preuves archivées

- [Rapport des 27 parcours et de la publication](agentic-real-2026-10-18.json).
- [Recettes des deux modèles](agentic-model-recipes-2026-10-18.json).
- [Bureau](agentic-real-2026-10-18/desktop.png), [mobile](agentic-real-2026-10-18/mobile.png), [éditeur LSP](agentic-real-2026-10-18/editor-lsp.png), [preuves de tâche](agentic-real-2026-10-18/task-evidence.png).

## Retours des revues automatiques

Les retours publiés sur les sept PR daemon ont été examinés, corrigés ou motivés dans leurs fils. Corrections principales : isolation des PTY par gestionnaire ; profil MCP strict ; activation des skills après approbation ; règles/skills du worktree de la tâche ; appels JSON et legacy mixtes après filtrage du raisonnement ; reprise en file sans résultat périmé ; garde d’activité retenue par l’agrégateur ; timeout structuré ; synchronisation LSP négociée, erreurs applicatives sans tuer le serveur, diagnostics en attente dans le contrat normal et préparation du renommage HTTP verrouillée ; récupération navigateur après erreur ; présence des fichiers sélectionnés dans l’index temporaire.

Les profils explicites restent stricts pour Kanban : ajouter les noms des outils de tickets au profil nécessaire, sans exemption implicite. Les nouveaux scénarios restent dans le script reproductible ; les garanties non testées par arrêt réel de #158 restent ouvertes.

### Dernière validation après revue

Le rapport contient **26 parcours techniques standard + 1 publication GitHub optionnelle**, tous réussis sur le dernier binaire testé. Ajouts : fenêtres de lecture native après 500 lignes, profil sans outils omettant le schéma natif, règles d’inspection avant résultats récursifs, worktree réel avec skills différents, reprise pendant `ask_user`, budget étendu persisté, contrôles d’index et de SHA PR. Les tests de bibliothèque couvrent le dernier fragment SSE sans saut de ligne et les noms de fonction natifs répétés.

Les revues supplémentaires ont conduit à conserver les échecs déjà enregistrés, nettoyer les leases des timeouts, protéger les métadonnées de contexte par mutex, revalider les worktrees avec le validateur de disposition persistée, contrôler l’annulation après acquisition du verrou et refuser une prévisualisation agent de renommage trop grande plutôt que la tronquer.
