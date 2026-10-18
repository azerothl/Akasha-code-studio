# Reprise et compatibilité modèles — 18 octobre 2026

Complément du [rapport initial](agentic-real-2026-10-18.md), pour [Akasha #158](https://github.com/azerothl/Akasha/issues/158) et [#179](https://github.com/azerothl/Akasha/issues/179). Corrections proposées dans [Akasha #170](https://github.com/azerothl/Akasha/pull/170) et [Code Studio #35](https://github.com/azerothl/Akasha-code-studio/pull/35), au sommet des piles existantes. **Les 12 PR d’implémentation restent ouvertes ; aucun ticket d’implémentation n’est clos.**

## Validation finale Windows CPU

| Contrôle | Résultat |
| --- | --- |
| Daemon, build `--no-default-features --features embedded` | Réussi |
| Tests daemon `--lib -- --test-threads=2` | 406 réussis, 1 ancien test PTY ignoré |
| Bibliothèques LLM / store / tools | 52 / 29 / 28 réussis ; total Rust : **515** |
| Code Studio Vitest / Playwright | **21 / 32 réussis** ; API simulées dans Playwright |
| Code Studio TypeScript/Vite | Réussi ; avertissement de taille du bundle conservé |
| Interface native Akasha `npx tsc --noEmit` | Réussi ; binaire Tauri non compilé dans cette campagne |
| Parcours techniques avec daemon réel | **38 réussis** : 37 standard et 1 publication GitHub |

Binaire testé : SHA-256 `5efe8298bed2ef8e7315dbbac0c9756a8e2c91f07f453c098b5657c2166edf5c`. Les rapports décrivent le worktree avec ces corrections, avant son commit. Tests exécutés sans modification de la configuration utilisateur, dans des données et projets temporaires isolés.

Le script technique utilise une **fixture déterministe du protocole modèle**, avec vrais API, SQLite, fichiers, Git, processus PTY/MCP, Chromium et serveurs LSP. Il ne mesure pas la fiabilité d’un LLM. Les recettes de modèles ci-dessous utilisent réellement Ollama, sans fixture ni fallback.

## #158 : scénarios de reprise exécutés

| Scénario | Résultat observé |
| --- | --- |
| REC-01 : arrêt avant modèle/outil | Tâche interrompue, reprise explicite, session conservée |
| REC-02 : effet avant résultat enregistré | Opération inconnue ; mutations bloquées jusqu’à inspection et décision explicite |
| REC-03 : résultat enregistré avant tour suivant | Écriture conservée, absence de répétition de l’effet |
| REC-04 : question et approbation interrompues | Nouvelle question après redémarrage ; ancien ID d’approbation refusé en 409 ; nouvel accord nécessaire |
| REC-05 : worktree déplacé | Reprise refusée sans repli sur le projet principal ; HEAD principal inchangé ; restauration puis reprise du même enfant |
| REC-06 : reprise et annulation concurrentes | Cinq courses exécutées ; annulation conservée, aucun fichier créé après annulation |
| REC-07 : pause pendant commande longue | Reprise refusée tant que l’ancienne exécution est active ; commande exécutée une seule fois |
| REC-08 : politique révoquée pendant arrêt | Permission courante appliquée après reprise ; écriture refusée sans effet |
| REC-09 : délégation interrompue | Enfant conservé ; délégation incertaine à inspecter ; pas de second enfant créé |

REC-05 est vérifiée dans le scénario de délégation REC-09. Les arrêts/redémarrages sont physiques pour les cas de crash ; les courses annulation/pause utilisent les vraies API et processus. Scénarios complémentaires réussis : attente `ask_user`, budget de tours durable, pause et annulation libérant le canal et le worker, objectif complet retrouvé dans le checkpoint malgré le titre de tâche tronqué à 500 caractères.

Corrections associées : transitions conditionnelles pour l’annulation/la pause ; suppression du canal d’attente lors de ces actions ; ID d’approbation lié à l’attente actuelle ; conservation des tours de conversation dans le checkpoint. Dans Code Studio, une réponse 409 recharge la question et efface le brouillon, sans renvoyer automatiquement l’ancienne réponse. Deux tests Playwright couvrent l’envoi de l’ID et cette remise à jour.

**Les validations de reprise manquantes de #158 sont exécutées.** Le ticket reste ouvert jusqu’à intégration de ses PR. Les sessions PTY/navigateur et images en mémoire ne sont pas restaurées ; les racines de pipeline sans checkpoint Studio restent hors de ce contrat.

## #179 : causes observées et corrections

- Les résultats d’outils étaient renvoyés dans une nouvelle demande utilisateur de continuation, sans historique assistant/outil natif. Le transport conserve maintenant les rôles, appels et résultats correspondants ; un tour natif se termine par le résultat d’outil, sans nouvelle demande générique « continue ».
- Ollama recevait le transport texte alors que Qwen possède un template de conversation avec outils. Le transport utilise `/api/chat` lorsque le template installé gère `.Messages`, et conserve les appels natifs complets. Un appel tronqué ou malformé n’est pas exécuté. Le décodage NDJSON conserve l’UTF-8 même entre deux fragments HTTP.
- Le modèle LFM2 installé annonce uniquement `{{ .Prompt }}` : les messages de chat peuvent alors être perdus. Pour cette architecture et ce template exact, l’adaptateur emploie le cadrage ChatML publié par LiquidAI, sans modifier le modèle installé. Cela ne suffit pas à garantir qu’il respecte le protocole d’outils.
- Les propositions legacy ambiguës, notamment les appels entre crochets ou `--content` non cité, sont refusées plutôt que d’écrire la syntaxe d’appel dans le fichier. L’identifiant d’opération omis est attribué par le runtime ; un identifiant explicite invalide reste refusé.
- Une déclaration de création sans aucune opération exécutée ne devient plus une réussite. Pour des créations littérales simples, un contrôle physique borné détecte les fichiers explicitement demandés encore absents, et laisse au modèle au plus trois corrections avant échec. Il ne certifie **ni le contenu, ni les lectures demandées, ni l’acceptation complète** ; `acceptance_verified` reste faux sans critères validés. Ce contrôle est désactivé après intervention susceptible de changer le périmètre et respecte les permissions de lecture.
- L’historique et l’objectif complet sont persistés pour la reprise. Le titre tronqué de la tâche n’est pas utilisé comme contrat de livrables.

Les arrêts `tool_loop`, `model_empty`, erreurs d’outils et résultats partiels restent des échecs ; aucun succès n’est déduit de la seule présence d’un fichier.

### Recettes LLM répétées

| Modèle / transport | Écriture simple | Écriture → lecture → seconde écriture | Total |
| --- | --- | --- | --- |
| Qwen2.5-coder:14b / Ollama natif | 3/3 | 3/3 | **6/6** |
| Devstral:latest / OpenAI compatible, alias contexte 32768 | 3/3 | 0/3 | **3/6** |
| LFM2:24b / adaptateur texte ChatML | 1/3 | 0/3 | **1/6** |

**La campagne finale est en échec : #179 reste bloquant.** Deux essais LFM2 atteignent l’attente au plafond de tours sans produire le fichier demandé ; ses trois essais multi-outils retournent `completed / succeeded` avec des fichiers au contenu incorrect (titres, explications ou modèle de projet au lieu de `alpha` / `beta`). Devstral produit les bons fichiers mais omet la lecture dans ses trois essais multi-outils. La validation externe rejette ces huit essais. Le contrôle de présence n’est pas une vérification sémantique du contenu ou de la séquence demandée ; il ne résout pas ces défauts.

Qwen réussit **ces deux recettes répétées**, avec cette configuration. Cela ne constitue pas une certification générale de toutes les tâches de code. Une campagne complète précédente avait obtenu Qwen 6/6, Devstral 6/6 et LFM2 0/6 ; elle reste archivée séparément. La répétition ne confirme donc pas la fiabilité de Devstral ou LFM2. #179 conserve le travail sur les sorties invalides et les opérations omises. Les 12 PR restent ouvertes et aucun ticket d’implémentation n’est fermé.

Critères externes inchangés : tâche `completed / succeeded / success`, contenu exact (fin de ligne facultative), diff limité aux fichiers demandés, une seule écriture réussie par fichier ; pour la recette multi-outils, lecture réussie de `FIRST.md` contenant `alpha` avant la seconde écriture. La présence du second fichier seule ne suffit pas à réussir cette recette.

Configuration : température 0.1, `max_tokens=4096`, `num_ctx=32768`, budget de 12 tours d’outils. Qwen et LFM2 utilisent le provider Ollama ; Devstral utilise son API compatible OpenAI. Pour Devstral, un alias temporaire du modèle avec contexte 32768 est créé puis supprimé : le transport OpenAI ne permet pas de transmettre `num_ctx`. Ce résultat ne valide pas le contexte par défaut du modèle utilisateur.

Les échecs exploratoires précédents restent conservés : l’adaptateur de grammaire JSON forcée a été abandonné ; des fins prématurées et écritures répétées ont été observées. Un essai long antérieur a également révélé le canal d’attente non libéré après annulation, corrigé et couvert par le parcours réel. Ces essais ne sont pas présentés comme des succès et ne remplacent pas la dernière campagne complète.

## Reproduction et preuves

Commandes de build/tests identiques au [rapport initial](agentic-real-2026-10-18.md#reproduction). Puis, depuis Code Studio :

```powershell
$env:CODE_STUDIO_DAEMON_BIN=Join-Path $env:TEMP 'studio-agentic-cargo-target\debug\akasha-daemon.exe'
node integration/agentic-real.mjs
# Python + PyYAML, Ollama démarré et modèles déjà installés
python -u integration/real-model-recipes.py --models qwen2.5-coder:14b devstral:latest lfm2:24b --repeat 3 --openai-context 32768
```

`CODE_STUDIO_TEST_PUBLISH=1` active la publication réelle optionnelle. Les brouillons de cette campagne [#38](https://github.com/azerothl/Akasha-code-studio/pull/38), [#39](https://github.com/azerothl/Akasha-code-studio/pull/39), [#40](https://github.com/azerothl/Akasha-code-studio/pull/40) et [#41](https://github.com/azerothl/Akasha-code-studio/pull/41) ont été vérifiés puis fermés sans fusion ; leurs branches ont été supprimées. #41 correspond aux 38 parcours finaux sur le dernier binaire.

- [Rapport technique et preuves de reprise](agentic-recovery-models-2026-10-18.json).
- [Campagne LLM finale et traces d’appels](agentic-model-recipes-final-2026-10-18.json) ; l’ordre écriture/lecture/seconde écriture est également revérifié sur les horodatages du journal persistant.
- [Résultats exploratoires conservés](agentic-model-explorations-2026-10-18.json), séparés de la campagne finale.
- [Bureau](agentic-recovery-models-2026-10-18/desktop.png), [mobile](agentic-recovery-models-2026-10-18/mobile.png), [éditeur LSP](agentic-recovery-models-2026-10-18/editor-lsp.png), [preuves](agentic-recovery-models-2026-10-18/task-evidence.png).

CUDA non exécuté : aucun runner GPU configuré, dispense explicite donnée par l’utilisateur. Les vérifications CI des SHA publiés sont distinctes des tests locaux. Aucun ajout de sandbox OS ni intégration Akasha OS dans ce lot ; #143 et #145 conservent leurs périmètres.

Sources des transports : [API chat Ollama](https://docs.ollama.com/api/chat), [compatibilité OpenAI et contexte](https://docs.ollama.com/api/openai-compatibility), [template LFM2 officiel](https://huggingface.co/LiquidAI/LFM2-24B-A2B/blob/main/chat_template.jinja).
