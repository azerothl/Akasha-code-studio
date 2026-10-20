# Validation finale Code Studio — 20 octobre 2026

Source finale daemon : [aadc55e](https://github.com/azerothl/Akasha/commit/aadc55ed2c3d88887266bf7cd5b2c516682b0004). Main intégré : `e18ca745cb72e2e0b1d7ef53d108003cd5185c53`. [CI CPU finale](https://github.com/azerothl/Akasha/actions/runs/39386826762) : les cinq jobs obligatoires réussissent, y compris les évaluations mock et le premier démarrage Linux. Binaire commun aux quatre campagnes : `d00ca6a66498a97b3126eab2a5e8503b779a0577306cbbc55fd195838d895d24`. Le reste du document conserve l'historique de validation des sources antérieures ; les fichiers JSON courants portent cette nouvelle source.

| Validation actuelle | Résultat |
| --- | --- |
| Rust ciblé | 744 réussis : daemon 564, LLM 70, store 30, tools 35, core 22, vault 9, CLI 14 |
| Tests ignorés existants | 1 ancien PTY couvert par recette réelle ; 1 corruption du coffre suivie dans #214 |
| Évaluations déterministes mock | 8/8 ; aucune inférence modèle dans ces évaluations |
| Code Studio | 21 Vitest, 32 Playwright avec API simulée ; compilation réussie |
| Interface Akasha | 59 Vitest, deux Chromium ciblés ; compilation réussie. Binaire Tauri non compilé |
| Parcours techniques sur vrai daemon | 59/59, comprenant les scénarios REC de reprise et publication GitHub réelle |
| LSP push | 4/4 |
| Modèles Ollama réels | 18/18 : Qwen, Devstral, LFM2, puis 12/12 LFM2 ; sans fallback |

## Corrections et limites de cette intégration

- Les tests du coffre sérialisent l'accès à la clé d'environnement et restaurent sa valeur. Le défaut distinct de fichier corrompu reste suivi dans #214.
- L'évaluation importée utilise les champs `conversation` et `require_tool` du contrat actuel.
- Les cibles « file named », « folder called », leurs pluriels et les variantes françaises sont résolues après le connecteur. Tests unitaires des types/espaces/listes, refus réels des effets absents/partiels au pluriel et création réelle d'un fichier et dossier sans chemins parasites `named`/`called`.
- `search_replace` annonce les champs distincts `search`/`replacement`, conserve exactement espaces, retours et `|`, accepte le remplacement vide et maintient les anciens appels typés version 1. Régressions unitaires et mutations sur daemon réel.
- Les demandes avec fichier explicite avant l’action (« In config.toml, update the port », « Pour le fichier `src/my parser.rs`, implémente le parseur ») exigent aussi un effet vérifié. Régressions unitaires et parcours réels de refus prose seule puis écriture effective.
- Les adjectifs avant les noms typés et le fichier « vide nommé » restent soumis aux preuves ; les listes ne sont pas absorbées comme des adjectifs. La grammaire reste bornée et ne certifie pas la conformité sémantique universelle de toute demande.
- `spec/api_integration.md` documente le contrat de réponse humaine version 2, sa migration et le rejet 409 des identifiants absents ou périmés. Aucun rejeu automatique d'une ancienne réponse.
- La CI conserve l'état de la tâche et les journaux du smoke de release. La validation confirme la complétion d'une inférence CPU de la release v0.11.0 ; elle ne garantit pas que ce petit modèle respecte une consigne de réponse exacte « OK ».
- Le parcours orchestré CPU par défaut a dépassé 240 secondes sur une exécution malgré le modèle chargé ; cet échec et la matrice des autres artefacts restent dans #141. Le smoke corrigé garde le délai de 240 secondes et n’ignore aucune inférence. Il ne certifie pas la latence du parcours orchestré ni les autres plateformes. [Preuve du smoke Linux](agentic-release-firstboot-2026-10-20.json).
- La saturation du disque E a fait échouer l'écriture du cache/build UI. Le cache incrémental régénérable a été déplacé sur C ; les deux suites et builds ont ensuite été relancés avec succès.
- La génération indépendante Ollama sur 11435 n'a pas été interrompue. Préchargement des modèles de recette consigné séparément ; délais des tâches inchangés.
- CUDA non exécuté : aucun runner GPU configuré, conformément à l'accord utilisateur. Les cinq jobs CPU sont exigés.
- La PR temporaire #102 a été fermée sans fusion et sa branche supprimée. La fusion externe de documentation #193 ne modifie aucun code compilé : le SHA-256 du binaire avant/après est strictement identique et les tests daemon ont été répétés. Les campagnes courantes sont relancées après les derniers correctifs de grammaire et de contrat. Les anciennes campagnes sont conservées dans l'historique.
- #143 conserve son périmètre plus large ; #145 a été fermé par la fusion externe #146. Les suivis Deep Research #232/#235 ne sont pas certifiés par cette recette Code Studio.

Les validations requises autorisent la fusion dans l’ordre Akasha #170, puis Code Studio #31 → #32 → #33 → #34 → #35. Les tickets validés ne sont clôturés qu’après les fusions et vérification que les arbres de main correspondent aux sources validées. Les états de livraison courants sont publiés dans les PR et les tickets.

---

## Historique antérieur

# Corrections #179 / #159 et validation finale — 19-20 octobre 2026

## Décision et provenance

**Tests locaux, campagnes réelles et CI CPU réussis.** Les PR et tickets GitHub portent l’état vivant de fusion et de clôture. La fusion doit conserver l’ordre des dépendances ; les arbres intégrés doivent correspondre aux sources validées avant les clôtures.

Source finale daemon : [2eada3a](https://github.com/azerothl/Akasha/commit/2eada3ae28ad49d9ece053b552cf40e6913c2c84). Les mises à jour de main [#225](https://github.com/azerothl/Akasha/pull/225) et [#233](https://github.com/azerothl/Akasha/pull/233) sont intégrées, avec leurs changements Deep Research et UI. Toutes les campagnes ont été relancées après cette intégration. Le même binaire est utilisé dans les quatre campagnes, SHA-256 : `0e7b718c619160a016120ff0cd8f3ff44ca924d054aa657326517e3dd785b930`.

[CI CPU finale](https://github.com/azerothl/Akasha/actions/runs/39342590108) : workspace, daemon/CLI, cookbook, llama.cpp Linux et UI réussis. Les contrôles Unix de permissions exécutables et de répertoires Git redirigés sont inclus dans les tests Linux.

## Corrections validées

- **Confinement des commandes Windows** : comparaison exacte du nom ou du chemin autorisé après normalisation `.exe` ; `evilnode.exe` ne correspond plus à `node`. Régressions allow/deny et exécution hostile sur daemon réel couvertes.

- **Formats Git** : les dépôts non standards, dont SHA-256, restent non pris en charge par la livraison Studio et reçoivent un refus explicite de format. Un vrai dépôt initialisé en SHA-256 vérifie ce diagnostic.

- **Index Git et branches numériques** : le calcul SHA-256 de l’index utilise un flux sans la limite des fichiers sélectionnés. Le statut de PR cherche explicitement la branche source via l’API, y compris pour les noms numériques. Tests unitaires et recette GitHub réelle couverts.

- **Configuration GitHub CLI** : chaque commande de livraison reçoit une configuration `gh` vide et isolée. Les identifiants sont importés séparément en mémoire ; la route `http_unix_socket` héritée ne peut pas détourner les appels. La publication réelle utilise volontairement cette configuration hostile.

- **PR existantes** : titre, description et statut brouillon doivent correspondre à la demande approuvée ; toute divergence produit un échec explicite sans modifier la PR. Régression unitaire et publication GitHub réelle couvertes.

- **Identité Git actualisée** : chaque commande de livraison relit les deux champs globaux inertes user.name/user.email ; une configuration faite après le premier appel est prise en compte sans redémarrer le daemon. Test sur un fichier global temporaire vide puis configuré et modifié, sans changer les réglages utilisateur.

- **Objets ressemblant à des chemins** : « Add dist/ to .gitignore » lie la preuve à .gitignore ; modifier seulement dist/ ne suffit pas. Les listes de dossiers sans extension héritent du type demandé, y compris lorsqu’un déterminant est répété ; une liste partielle échoue.

- **Annulation Deep Research héritée** : la fin du travail revérifie le drapeau d’annulation avant de publier un succès. Un test déterministe couvre l’annulation acceptée entre deux scrutations, sans inférence. Cela ne certifie pas la qualité factuelle des rapports de recherche.

- **Fichiers et dossiers explicites** : les déterminants file/fichier/folder/directory/dossier/répertoire désignent une cible, y compris sans extension et en majuscules. Le type final demandé est vérifié : un fichier ne satisfait pas une demande de dossier, et inversement. Les variantes sans effet et une création réelle de dossier sont couvertes.

- **Cibles de renommage** : « rename … as … » et « move … into … » sont reconnues. Un verbe rename/move sans cible résolue reste une demande de mutation et provoque un refus explicite, au lieu de désactiver le contrôle. Les variantes sans effet et les cibles incomplètes sont couvertes.

- **Listes de fichiers** : les chemins coordonnés par virgule, « and » ou « et » héritent du verbe de mutation ; écrire seulement a.txt pour « Create a.txt and b.txt » ne suffit plus. Une recette partielle échoue et la recette complète réussit.

- **Fonctions JSON dans le texte** : les enveloppes directes, enveloppées et les lots sont validés contre les noms annoncés pour ce tour, avant tout effet. Les appels de lecture légitimes et leur historique restent pris en charge. Le transport texte TOOL/TOOL_JSON vérifie aussi le catalogue effectif du tour avant tout effet. Les outils de workflow annoncés pour les tours ordinaires restent disponibles par texte, sans élargir les tours limités aux fichiers littéraux.

- **Catalogue natif OpenAI, OpenRouter, Azure et Ollama** : chaque fonction, y compris `studio_call`, doit figurer dans le catalogue transmis au modèle. Ollama conserve son enveloppe, avec validation explicite du nom de l’outil interne contre le catalogue du tour. Les lots invalides sont rejetés avant effet ; tests SSE, réponses complètes et parcours hostile sur daemon réel couverts.

- **Demandes avec objet avant le chemin** : « Add logging to config.txt » et « Update dependencies in Cargo.toml », « Replace foo with bar in config.toml » et « Change the port in config.toml » lient maintenant la vérification au fichier cible. Le parseur reste borné à la phrase et ignore les exemples entre guillemets. Les tests unitaires et deux variantes sur daemon réel refusent une simple affirmation sans modification.

- **Preuves par chemin** : seuls les reçus du registre autoritaire attestent les effets. Ils mesurent les versions avant/après sous le verrou de travail, avec les chemins demandés et leur état final. Les écritures identiques, dans un autre fichier et les changements annulés ne satisfont pas la demande. Les renommages conservent le contenu source, vérifié à nouveau à la conclusion ; une réécriture ou recréation ultérieure avec un contenu différent invalide la preuve. Les preuves survivent aux checkpoints ; une nouvelle cible humaine réinitialise la portée et exclut les anciens reçus par une borne monotone du registre. Les réponses de tools ne peuvent pas fabriquer cette preuve. Limites de capture : 32 chemins, 4096 entrées et 64 MiB ; les symlinks exigent une inspection explicite. Il ne s’agit pas d’une preuve universelle de conformité sémantique de tout code généré.

- **Annulation des arbres** : chaque membre est basculé par transition conditionnelle, y compris les tâches en pause, interrompues ou attendant une réponse. Le nettoyage retire uniquement les questions des identifiants effectivement annulés dont le statut reste annulé ; les autres attentes sont préservées. Test unitaire de l’arbre et recette réelle d’annulation pendant ask_user couverts.

- **Entrées humaines** : chaque question et attente au plafond de tours reçoit un identifiant neuf. Une réponse ancienne ou sans identifiant ne peut pas satisfaire la question suivante. Le parcours réel vérifie les deux refus 409 puis la bonne reprise avec la réponse courante. Les clients Studio, natif, TUI et Telegram transmettent cet identifiant.

- **Effets différés du PTY** : les reçus autoritaires conservent l’état avant start/write par session. Une lecture ou fermeture ultérieure constate le changement à partir de cet état, même si la commande a exécuté après le retour de write. L’état survit aux checkpoints et le rejeu des reçus suit leur ordre monotone. Le parcours réel utilise une écriture Node retardée, avant la lecture, puis vérifie la réussite et les octets.

- **Terminal** : le code de sortie naturel est capturé avant fermeture puis transmis à l’archive ; une sortie réelle de code 7 reste 7 dans les métadonnées. Un processus interrompu n’est pas présenté comme une fin normale.

- **Modifications sans effet** : le garde existant du moteur couvre les demandes explicites de modification en français et en anglais. Un parcours réel exige un outil puis simule une affirmation seule de modification d’un fichier existant : la tâche doit échouer sans effet. Le rejet des seules commandes non natives a été retiré : il bloquait les appels texte valides de Qwen. Cette campagne en échec reste dans l’historique.

- **#179** : préconditions de création et `expected_version` conservés dans les fonctions natives ; validation des lots avant effets ; opérations différées rejouées dans l’ordre. Les lectures FIRST précèdent les écritures SECOND, les contenus exacts sont conservés et aucune réussite n’est forcée.

- **Fichiers temporaires** : une suppression, un renommage ou un déplacement demandé ne déclenche plus de recréation par le contrôle complémentaire de présence finale. Deux parcours réels vérifient création/lecture/suppression et création/renommage ; les critères explicites restent contrôlés.

- **Arguments natifs** : les enveloppes JSON sont isolées avant les transformations du texte libre. Les marqueurs `TOOL:` et `<think>` dans un argument restent des données. Trois transports sont vérifiés : appel natif, fonction JSON et fonction JSON précédée de raisonnement. Une seule invocation apparaît dans l’historique, sans copie dans le texte assistant.

- **#159** : une nouvelle session push-only après changement du buffer fournit la barrière de fraîcheur des diagnostics sans version. Les buffers frères non enregistrés sont rouverts, les buffers inchangés réutilisent le serveur, et les versions explicitement incorrectes sont refusées. Coût : réindexation sur changement push-only. Les plans de renommage sérialisés sont limités à 8 MiB, comme leur lecture ; aperçu agent limité à 48 KiB.

- **Réponses humaines Telegram** : attente conservée pendant le POST, rafraîchissement de la demande après refus et absence de rejeu automatique ; une nouvelle attente concurrente n’est pas écrasée. Deux tests locaux couvrent ces états, sans appel Telegram réel.

- **#158** : résolution d’un effet inconnu et contrôle du statut arrêté dans la même écriture SQLite ; refus si une reprise concurrente a remis la tâche en file. L’overlay de reprise n’est pas répété après le premier tour.

- **Livraison Git** : métadonnées liées au projet ou worktree enregistré ; destination et chemins Git épinglés ; verrou de configuration détenu de l’inspection à la fin de la commande. Les versions opaques lient contenu et caractère exécutable Unix. Contrôle des chemins mutables et répertoires d’objets, sans parcourir chaque objet loose ; symlinks de contrôle et alternates externes refusés. Les symlinks sélectionnés sont refusés.

- **CI et UI** : états inconnus/STALE non assimilés à une réussite ; refs transmises par les panneaux différés et graphe initialisé après disponibilité de la ref.

## Résultats

| Contrôle | Résultat |

| --- | --- |

| Rust daemon / LLM / store / tools | **507 / 69 / 29 / 35**, soit **640 réussis**, 1 ancien PTY ignoré et couvert par les parcours réels |

| Code Studio | **21 Vitest, 32 Playwright réussis** ; build réussi |

| Interface native | **59 Vitest, 1 Chromium ciblé réussis** ; TypeScript/build réussis |

| Daemon réel, SQLite, Git/GitHub, PTY, MCP, navigateur, LSP | **59/59**, REC-01 à REC-09 inclus |

| Diagnostics LSP push sans version et notifications tardives | **4/4**, buffer frère conservé |

| Vrais modèles, sans fallback | **18/18**, Devstral 6/6, LFM2 6/6, Qwen 6/6 |

| LFM2 supplémentaire | **12/12**, six écritures simples et six séquences multi-outils |

| CI CPU de la source finale | **Réussie** |

Les tests UI natifs ont été rejoués sur `f923cf3` (arbre UI identique au backend final) et les 21/32 tests Code Studio sur `f3ccf67` (seule la recette d’intégration a changé ensuite).

Les parcours techniques utilisent une fixture déterministe du protocole modèle, distincte des vraies recettes LLM. Les tests de refus couvrent les fonctions natives, les enveloppes JSON dans le texte et les appels TOOL/TOOL_JSON ; les lots sont refusés avant tout effet si un outil est hors catalogue. Les contrôles de rôle et de politique restent actifs dans le moteur. Les 32 Playwright Code Studio simulent les API ; les parcours techniques et captures utilisent un daemon réel. Le test Chromium natif retarde le chunk du graphe et simule ses données IPC, avec les vrais composants React/relation-graph.

Preuves : [techniques](agentic-blockers-technical-2026-10-19.json), [modèles](agentic-blockers-models-2026-10-19.json), [LFM2 supplémentaire](agentic-blockers-lfm-stress-2026-10-19.json), [LSP](agentic-blockers-lsp-2026-10-19.json), [graphe natif](agentic-native-panel-2026-10-19.json). [Historique des essais et échecs corrigés](agentic-blockers-development-2026-10-19.json). Captures : [desktop](agentic-blockers-2026-10-19/desktop.png), [mobile](agentic-blockers-2026-10-19/mobile.png), [LSP](agentic-blockers-2026-10-19/editor-lsp.png), [preuves](agentic-blockers-2026-10-19/task-evidence.png).

La PR de recette [#88](https://github.com/azerothl/Akasha-code-studio/pull/88) est fermée sans fusion et sa branche supprimée. Les publications de recette antérieures #53 à #76 et #78 à #87 sont aussi fermées sans fusion.

## Reproduction

Dans Code Studio, avec les modèles Ollama installés, Python/PyYAML et les serveurs LSP des scripts :

```powershell

$env:CODE_STUDIO_DAEMON_BIN = '<daemon construit depuis la source finale>'

python integration/studio-lsp-push.py

$env:CODE_STUDIO_TEST_PUBLISH = '1'

node integration/agentic-real.mjs

python integration/real-model-recipes.py --models qwen2.5-coder:14b devstral:latest lfm2:24b --repeat 3 --openai-context 32768 --require-file-catalogue --preload-models

python integration/real-model-recipes.py --models lfm2:24b --repeat 6 --require-file-catalogue --preload-models

```

Une campagne précédente sur le binaire remplacé a enregistré un timeout Qwen après 90 secondes, puis a été arrêtée avant la campagne finale seule sur le binaire corrigé ; cet échec est conservé dans l’historique. La campagne finale précharge chaque modèle avec `--preload-models` via la requête Ollama vide documentée, puis vérifie sa résidence et son contexte. La durée de chargement est consignée séparément dans `readiness` ; les délais des tâches restent de 90 secondes, avec une échéance totale de 180 secondes. Elle ne certifie pas un chargement à froid dans le délai de tâche. [Documentation Ollama](https://github.com/ollama/ollama/blob/main/docs/api.md?plain=1).

Température 0.1, max_tokens 4096, contexte 32768, budget 12 tours ; adaptation LiquidAI pour LFM2. Configurations temporaires isolées et exécutables copiés ; aucun fallback ni changement des réglages utilisateur. Les contenus, fichiers, diffs, écritures uniques et ordre lecture FIRST avant écriture SECOND sont contrôlés. Fermer toute PR de recette sans fusion et supprimer sa branche après validation.

## Historique CI et limites

Les anciennes lectures d’attente étaient incomplètes : la lecture rafraîchie a confirmé les succès backend et Playwright, avec un statut UI annulé après demande d’arrêt. Le job UI a été relancé, puis la nouvelle intégration de main a obtenu sa propre CI complète. L’[instantané précédent](https://github.com/azerothl/Akasha-code-studio/blob/82ad6c1b3cf9cb3c0dbc03e34615d09db6f29d38/docs/validation/agentic-blockers-2026-10-19.md) conserve ce contexte sans certifier la source finale.

CUDA embarqué non exécuté faute de runner, conformément à l’accord utilisateur. Les recettes Ollama sur RTX 4080 SUPER ne certifient pas ce backend CUDA. Binaire Tauri non compilé. Les verrous Git coordonnent les écrivains Git et ne constituent pas une sandbox OS contre les mutations arbitraires de processus externes.

Ordre : Akasha #162 → #164 → #166 → #167 → #168 → #169 → #170, puis Code Studio #31 → #32 → #33 → #34 → #35. Périmètre validé : Akasha #151–#160 et #179 ; Code Studio #27–#30. Akasha **#143** (évaluations transversales) et **#145** (audit complet worktrees/sandbox) restent ouverts ; **#232** suit un défaut Deep Research hérité de main #225, hors de cette livraison ; **#235** suit la validation des citations du retry Deep Research, héritée inchangée de main #233 et non validée ici ; aucun adaptateur Akasha OS livré ici.

## Raccordement après fusion des dépendances

Après fusion de #167, #168 et #169, GitHub signalait un conflit lié aux deux ancêtres communs. La fusion locale standard `ort` a produit exactement l’arbre déjà validé. Le commit de raccordement [8e7bc61](https://github.com/azerothl/Akasha/commit/8e7bc6145bcdbff5a62adb48b58c16291ce84952) relie `2eada3a` et le main des dépendances `5f6a339`.

Arbre complet identique : `27504d6db25b81f38f000a69a0cdc41d3cd464af`. Les campagnes locales et leur binaire conservent leur provenance `2eada3a` ; cette égalité couvre tous les fichiers du dépôt. La [CI du raccordement](https://github.com/azerothl/Akasha/actions/runs/39345222095) a également réussi ses trois jobs CPU sur `8e7bc61`. Les détails et parents sont enregistrés dans le champ integration du JSON technique.
