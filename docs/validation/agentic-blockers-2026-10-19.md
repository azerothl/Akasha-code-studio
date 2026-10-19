# Corrections #179 / #159 et validation de la pile — 19 octobre 2026

## Périmètre et décision

**Contrôles locaux, campagnes réelles et CI CPU du commit final réussis.** Les états de fusion et de clôture courants sont ceux des PR et tickets GitHub. Ce rapport remplace le [constat de blocage précédent](agentic-ci-integration-2026-10-19.md) pour la version finale ; ses échecs restent conservés.

## Corrections

- **#179** : les fonctions natives conservent la description des préconditions de création ; `expected_version` est explicite dans le transport LiquidAI. Un lot rejeté indique les opérations restées sans effet dans leur ordre et demande de repartir de la première opération non exécutée. Les résumés sont bornés et ne recopient pas les gros contenus dans chaque résultat. Les contenus et versions ne sont jamais corrigés silencieusement par l’exécuteur.
- **#159** : après modification d’un buffer, un serveur ne proposant que des diagnostics push est redémarré avant `didOpen`. Cette nouvelle session constitue la barrière de fraîcheur quand `publishDiagnostics` omet sa version. Les buffers frères non enregistrés sont rouverts ; les requêtes inchangées réutilisent le processus. Les diagnostics pull gardent leur synchronisation par requête. Un mauvais numéro de version reste refusé. Le coût est une nouvelle indexation pour les buffers push modifiés. Les plans de renommage sont limités sur leur JSON sérialisé, avec le même plafond de 8 MiB à l’écriture et à la lecture ; le plafond d’aperçu agent reste 48 KiB.
- **#158** : la résolution d’un effet inconnu et le contrôle du statut arrêté partagent la même écriture SQLite. Une reprise concurrente qui a mis la tâche en file empêche cette résolution. L’overlay de reprise n’est plus répété après le premier tour repris.
- **#160 / revue** : les métadonnées Git appartiennent au projet précis, ou au worktree enregistré et validé de ce projet. Refus des redirections par gitfile/commondir, des symlinks de métadonnées et des alternates externes. Les chemins Git et la destination réseau sont épinglés dans les processus et dans l’identité d’approbation. Le verrou `config.lock` est détenu de la validation à la fin de la commande ; un autre écrivain Git ne peut pas modifier sa configuration dans cet intervalle. Le verrou coordonne les écrivains Git ; la sandbox OS contre les mutations arbitraires de processus externes reste hors périmètre. Un verrou existant est refusé et n’est jamais supprimé automatiquement.
- **CI affichée** : `STALE`, un résultat manquant et un état inconnu ne valent pas réussite, même mélangés avec `SKIPPED`/`NEUTRAL`. Priorité : échec, attente, inconnu, neutre/ignoré, réussite.

## Contrôles

| Contrôle | Résultat |
| --- | --- |
| Rust ciblé daemon / LLM / store / tools | **443 / 66 / 29 / 34**, soit **572 réussis**, 1 ancien PTY ignoré |
| Code Studio Vitest / Playwright | **21 / 32 réussis**, API simulées dans les 32 parcours |
| Daemon réel, SQLite, Git/GitHub, PTY, MCP, Chromium, LSP | **49/49**, dont REC-01 à REC-09 |
| Processus LSP push sans version et notifications tardives | **4/4** ; buffer frère non enregistré conservé |
| Vrais modèles, sans fallback | **18/18** : Devstral, LFM2, Qwen, six recettes chacun |
| LFM2 supplémentaire, sans fallback | **12/12**, six écritures simples et six séquences à trois opérations |
| Builds daemon / Code Studio | Réussis ; avertissement de taille du bundle non bloquant |
| Interface native | **57 Vitest + 1 Chromium ciblé**, TypeScript et build e2e réussis ; binaire Tauri non compilé |

Source du daemon testé : [6feefe5](https://github.com/azerothl/Akasha/commit/6feefe5016297b7678e49c13148d4e057cce9429). Les quatre campagnes finales utilisent le même exécutable SHA-256 : `1e8d3dbcb7842f1dbc3c552d80c2bf455925b2cf38c9353423833f55c6eb3287`.

Le [commit d’intégration 146e592](https://github.com/azerothl/Akasha/commit/146e592dd3bf42eba062130c4ad87e6b93c8d56a) ajoute ensuite une correction native UI issue d’une revue tardive : transmission de ref par les panneaux différés et initialisation du graphe quand sa ref arrive après les données. Ses quatre fichiers modifiés sont tous sous `apps/akasha-ui` ; **l’arbre Rust entier est identique** à celui du binaire des campagnes. Les 57 tests UI natifs et le parcours Chromium avec import retardé valident cette correction ; Le binaire des campagnes valide la même source Rust.

[CI CPU du commit d’intégration](https://github.com/azerothl/Akasha/actions/runs/39268414796) : réussie (tests workspace, daemon/CLI, llama.cpp Linux et parcours UI). La [CI du daemon testé](https://github.com/azerothl/Akasha/actions/runs/39261235822) est réussie, comme celles des dépendances #167 à #169. Une simulation des sept merges backend produit le même arbre que la source finale.

Le groupement natif GitHub #226 a été dissous pour revenir aux PR dépendantes classiques et conserver l’historique de merges validé. Les piles natives demandent un historique linéaire et une procédure de fusion spécifique ([documentation GitHub](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests)). Après dissociation et relance, GitHub calcule à nouveau la fusion et crée la CI du dernier SHA. Aucun test ni workflow n’a été assoupli.

[Preuve du correctif natif du graphe](agentic-native-panel-2026-10-19.json).

Preuves : [49 parcours techniques](agentic-blockers-technical-2026-10-19.json), [18 recettes modèles](agentic-blockers-models-2026-10-19.json), [12 recettes LFM2 supplémentaires](agentic-blockers-lfm-stress-2026-10-19.json), [4 cas LSP](agentic-blockers-lsp-2026-10-19.json). [Historique des passages de ce traitement](agentic-blockers-development-2026-10-19.json). Captures : [desktop](agentic-blockers-2026-10-19/desktop.png), [mobile](agentic-blockers-2026-10-19/mobile.png), [éditeur LSP](agentic-blockers-2026-10-19/editor-lsp.png), [preuves de tâche](agentic-blockers-2026-10-19/task-evidence.png). Les recettes techniques emploient une fixture de protocole déterministe, distincte des vrais modèles. Les tests UI Playwright simulent les API ; les captures desktop/mobile et les parcours d’éditeur utilisent aussi un daemon réel.

## Reproduction

Depuis Code Studio, avec le daemon construit et les dépendances décrites dans les scripts :

```powershell
$env:CODE_STUDIO_DAEMON_BIN = '<chemin du daemon construit>'
python integration/studio-lsp-push.py
$env:CODE_STUDIO_TEST_PUBLISH = '1'
node integration/agentic-real.mjs
python integration/real-model-recipes.py --models devstral:latest lfm2:24b qwen2.5-coder:14b --repeat 3 --openai-context 32768 --require-file-catalogue
python integration/real-model-recipes.py --models lfm2:24b --repeat 6 --require-file-catalogue
```

L’option de publication crée une PR temporaire en brouillon : elle doit être fermée sans fusion et sa branche supprimée après contrôle. La PR finale de recette [#59](https://github.com/azerothl/Akasha-code-studio/pull/59), comme les PR de recette #53 à #58, a été fermée sans fusion et sa branche supprimée.

Les trois modèles doivent être installés dans Ollama. Le runner utilise une configuration temporaire isolée, sans fournisseur de secours, sans modifier les réglages de l’utilisateur. Chaque campagne copie son exécutable. Température 0.1, max_tokens 4096, contexte 32768, budget 12 tours ; adaptation LiquidAI native pour LFM2. Les écritures, fichiers exacts, diff exact, absence d’écritures réussies répétées et lecture de FIRST.md après sa création et avant SECOND.md sont vérifiés. Les alias Devstral temporaires sont supprimés en fin de campagne.

## Limites et suivi

Le job CUDA n’est pas exécuté faute de runner, conformément à l’exception expressément autorisée ; les modèles locaux via Ollama sur RTX 4080 SUPER ne certifient pas le backend embarqué CUDA. Le binaire Tauri n’a pas été compilé ; son contrôle TypeScript est distinct de la CI et de l’interface web.

La tranche livrée correspond à Akasha #151–#160 et #179, et Code Studio #27–#30. **#143** garde ses besoins d’évaluation transversale, mémoire/fallback/tâches planifiées et baselines/seuils. **#145** garde son audit complet des frontières et mutations de worktrees. Aucun adaptateur Akasha OS n’est livré ici.
