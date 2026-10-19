# Corrections #179 / #159 et validation de la pile — 19 octobre 2026

## Périmètre et décision

**Contrôles locaux et campagnes réelles réussis ; CI CPU finale en attente de runner.** Les états de fusion et de clôture courants sont ceux des PR et tickets GitHub. Ce rapport remplace le [constat de blocage précédent](agentic-ci-integration-2026-10-19.md) pour la version finale ; ses échecs restent conservés.

## Corrections

- **#179** : les fonctions natives conservent la description des préconditions de création ; `expected_version` est explicite dans le transport LiquidAI. Un lot rejeté indique les opérations restées sans effet dans leur ordre et demande de repartir de la première opération non exécutée. Les résumés sont bornés et ne recopient pas les gros contenus dans chaque résultat. Les contenus et versions ne sont jamais corrigés silencieusement par l’exécuteur.
- **#159** : après modification d’un buffer, un serveur ne proposant que des diagnostics push est redémarré avant `didOpen`. Cette nouvelle session constitue la barrière de fraîcheur quand `publishDiagnostics` omet sa version. Les buffers frères non enregistrés sont rouverts ; les requêtes inchangées réutilisent le processus. Les diagnostics pull gardent leur synchronisation par requête. Un mauvais numéro de version reste refusé. Le coût est une nouvelle indexation pour les buffers push modifiés. Les plans de renommage sont limités sur leur JSON sérialisé, avec le même plafond de 8 MiB à l’écriture et à la lecture ; le plafond d’aperçu agent reste 48 KiB.
- **#158** : la résolution d’un effet inconnu et le contrôle du statut arrêté partagent la même écriture SQLite. Une reprise concurrente qui a mis la tâche en file empêche cette résolution. L’overlay de reprise n’est plus répété après le premier tour repris.
- **#160 / revue** : les métadonnées Git appartiennent au projet précis, ou au worktree enregistré et validé de ce projet. Refus des redirections par gitfile/commondir, des symlinks de chemins de contrôle et de répertoires d’objets, et des alternates externes. Les chemins Git et la destination réseau sont épinglés dans les processus et dans l’identité d’approbation. Le verrou `config.lock` est détenu de la validation à la fin de la commande ; un autre écrivain Git ne peut pas modifier sa configuration dans cet intervalle. Le verrou coordonne les écrivains Git ; la sandbox OS contre les mutations arbitraires de processus externes reste hors périmètre. Un verrou existant est refusé et n’est jamais supprimé automatiquement.
- **Dernières revues Git et historique** : les versions opaques de livraison lient aussi le caractère exécutable Unix ; elles sont contrôlées avant et après staging. Le parcours des métadonnées contrôle les répertoires d’objets et les chemins mutables sans parcourir chaque objet loose. Une fonction JSON précédée de raisonnement apparaît une seule fois dans l’historique natif, sans copie dans le texte assistant. Les tests Linux de chmod et de refus de shard symlinké restent en attente de CI.
- **Arguments natifs / revue tardive** : les champs JSON restent des données avant les normalisations de prose, de raisonnement et d’en-têtes `TOOL:`. Aucune commande n’est extraite d’un contenu de fichier. Les blocs de raisonnement extérieurs restent expurgés. Le cas réel valide une seule écriture et aucun fichier injecté.
- **CI affichée** : `STALE`, un résultat manquant et un état inconnu ne valent pas réussite, même mélangés avec `SKIPPED`/`NEUTRAL`. Priorité : échec, attente, inconnu, neutre/ignoré, réussite.

## Contrôles

| Contrôle | Résultat |
| --- | --- |
| Rust ciblé daemon / LLM / store / tools | **449 / 66 / 29 / 34**, soit **578 réussis**, 1 ancien PTY ignoré |
| Code Studio Vitest / Playwright | **21 / 32 réussis**, API simulées dans les 32 parcours |
| Daemon réel, SQLite, Git/GitHub, PTY, MCP, Chromium, LSP | **50/50**, dont REC-01 à REC-09 |
| Processus LSP push sans version et notifications tardives | **4/4** ; buffer frère non enregistré conservé |
| Vrais modèles, sans fallback | **18/18** : Devstral, LFM2, Qwen, six recettes chacun |
| LFM2 supplémentaire, sans fallback | **12/12**, six écritures simples et six séquences à trois opérations |
| Builds daemon / Code Studio | Réussis ; avertissement de taille du bundle non bloquant |
| Interface native | **57 Vitest + 1 Chromium ciblé**, TypeScript et build e2e réussis ; binaire Tauri non compilé |

Source du daemon testé : [65d3cc2](https://github.com/azerothl/Akasha/commit/65d3cc2859636530e71f370c1710e429357d9e70). Les quatre campagnes finales utilisent le même exécutable SHA-256 : `98d1d431d62d9cb733f364751951702b6e34d578c7237ce6462229a397fc5f66`.

La source finale inclut la correction du graphe natif différé et l’isolation des enveloppes `TOOL_JSON` avant les transformations de texte libre. Le point d’entrée Studio et les fonctions JSON directes préservent aussi les balises littérales. Les six nouveaux tests Rust passent ; le 50e parcours réel vérifie le contenu exact et l’absence d’opération injectée. Le premier essai avait encore supprimé les balises `<think>` au point d’entrée Studio : cet échec reste archivé dans l’historique et a été corrigé avant la campagne finale.

[CI CPU de la source finale](https://github.com/azerothl/Akasha/actions/runs/39278448450) : en attente de runner (workspace, daemon/CLI, llama.cpp Linux et UI). Le raccordement d’ascendance de #167, sans modification de son arbre de fichiers, est aussi validé par sa [CI dédiée](https://github.com/azerothl/Akasha/actions/runs/39271373767). Les tests natifs 57 Vitest et 1 Chromium ont été relancés sur la source finale ; le contrôle TypeScript et le build du panneau portent sur les mêmes sources UI.

Le groupement natif GitHub #226 a été dissous pour revenir aux PR dépendantes classiques et conserver l’historique de merges validé. Les piles natives demandent un historique linéaire et une procédure de fusion spécifique ([documentation GitHub](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests)). Après dissociation et relance, GitHub calcule à nouveau la fusion et crée la CI du dernier SHA. Aucun test ni workflow n’a été assoupli.

[Preuve du correctif natif du graphe](agentic-native-panel-2026-10-19.json).

Preuves : [50 parcours techniques](agentic-blockers-technical-2026-10-19.json), [18 recettes modèles](agentic-blockers-models-2026-10-19.json), [12 recettes LFM2 supplémentaires](agentic-blockers-lfm-stress-2026-10-19.json), [4 cas LSP](agentic-blockers-lsp-2026-10-19.json). [Historique des passages de ce traitement](agentic-blockers-development-2026-10-19.json). Captures : [desktop](agentic-blockers-2026-10-19/desktop.png), [mobile](agentic-blockers-2026-10-19/mobile.png), [éditeur LSP](agentic-blockers-2026-10-19/editor-lsp.png), [preuves de tâche](agentic-blockers-2026-10-19/task-evidence.png). Les recettes techniques emploient une fixture de protocole déterministe, distincte des vrais modèles. Les tests UI Playwright simulent les API ; les captures desktop/mobile et les parcours d’éditeur utilisent aussi un daemon réel.

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

L’option de publication crée une PR temporaire en brouillon : elle doit être fermée sans fusion et sa branche supprimée après contrôle. La PR finale de recette [#61](https://github.com/azerothl/Akasha-code-studio/pull/61), comme les PR de recette #53 à #60, a été fermée sans fusion et sa branche supprimée.

Les trois modèles doivent être installés dans Ollama. Le runner utilise une configuration temporaire isolée, sans fournisseur de secours, sans modifier les réglages de l’utilisateur. Chaque campagne copie son exécutable. Température 0.1, max_tokens 4096, contexte 32768, budget 12 tours ; adaptation LiquidAI native pour LFM2. Les écritures, fichiers exacts, diff exact, absence d’écritures réussies répétées et lecture de FIRST.md après sa création et avant SECOND.md sont vérifiés. Les alias Devstral temporaires sont supprimés en fin de campagne.

## Limites et suivi

Le job CUDA n’est pas exécuté faute de runner, conformément à l’exception expressément autorisée ; les modèles locaux via Ollama sur RTX 4080 SUPER ne certifient pas le backend embarqué CUDA. Le binaire Tauri n’a pas été compilé ; son contrôle TypeScript est distinct de la CI et de l’interface web.

La tranche livrée correspond à Akasha #151–#160 et #179, et Code Studio #27–#30. **#143** garde ses besoins d’évaluation transversale, mémoire/fallback/tâches planifiées et baselines/seuils. **#145** garde son audit complet des frontières et mutations de worktrees. Aucun adaptateur Akasha OS n’est livré ici.
