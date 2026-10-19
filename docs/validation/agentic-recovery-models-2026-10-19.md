# Reprise et compatibilité des modèles — 19 octobre 2026

Suite du [rapport du 18 octobre](agentic-recovery-models-2026-10-18.md), pour [Akasha #179](https://github.com/azerothl/Akasha/issues/179) et [#158](https://github.com/azerothl/Akasha/issues/158). Correctifs dans [Akasha #170](https://github.com/azerothl/Akasha/pull/170), recettes et preuves dans [Code Studio #35](https://github.com/azerothl/Akasha-code-studio/pull/35).

**Les 18 recettes ciblées passent. Les PR restent ouvertes pendant la validation CI et jusqu’à intégration dans l’ordre des dépendances.** Aucune fusion ni clôture de ticket d’implémentation dans ce suivi.

## Résultats Windows

| Contrôle | Résultat |
| --- | --- |
| Tests daemon | **416 réussis**, 1 ancien test PTY ignoré |
| Tests LLM / store / tools | **65 / 29 / 28 réussis**, total Rust **538** |
| Code Studio Vitest / Playwright | **21 / 32 réussis**, API simulées dans Playwright |
| Build daemon et Code Studio | Réussis, avertissement de taille du bundle conservé |
| Interface native Akasha | TypeScript réussi ; binaire Tauri non compilé |
| Parcours techniques avec daemon réel | **45 réussis**, dont publication GitHub temporaire |
| Recettes avec vrais modèles | **18/18**, sans fallback |

Binaire : SHA-256 `cb04709051092b63768b4abf067a5a934685493d2d2cb3c37733449add1b4288`. Commit de code : `601acde2cdfe133efa8f092c599f847e0ea3dc1b`. Les deux campagnes utilisent le même exécutable ; le script LLM conserve une copie immuable. Données, projets et alias de modèles sont temporaires. La configuration utilisateur et les poids installés sont conservés.

Les parcours techniques emploient une **fixture déterministe du protocole modèle** avec API, SQLite, fichiers, Git, PTY, MCP stdio, Chromium et vrais serveurs LSP. Les 18 recettes ci-dessous utilisent les modèles Ollama réels.

## #179 : corrections et observation

1. **Lectures JSON de Devstral.** Une requête complète renvoyée comme texte JSON pouvait être ignorée. Le décodage accepte les objets/listes de fonctions autonomes, sous forme `studio_call` ou avec le nom d’une fonction interne connue, et des arguments objet ou chaîne JSON. Les exemples mêlés à de la prose et les fonctions inconnues sont refusés. Chaque requête conserve le contrat typé, les permissions et les versions de fichiers.
2. **Catalogue OpenAI compatible.** Les fonctions sont exposées individuellement (`write_file`, `read_file`, etc.). Les appels et l’historique sont convertis vers le contrat Studio interne, avec les identifiants appel/résultat conservés. Le diagnostic brut trouvait des réponses HTTP 200 vides avec le catalogue à enveloppe unique, en streaming comme hors streaming ; les appels directs renvoyaient les bons arguments avec les fonctions distinctes. Les sondes de diagnostic ne sont pas des exécutions d’outils.
3. **Transport LFM2 natif.** Le template brut du modèle installé reçoit le cadrage ChatML publié par LiquidAI, son catalogue et ses appels littéraux entre crochets. Le parseur borné accepte uniquement des données : chaînes, nombres, booléens, listes et objets. Les expressions, appels imbriqués, fonctions non déclarées et réponses tronquées sont refusés. Aucun code Python n’est évalué. Les marqueurs de contrôle présents dans les données sont échappés. La conclusion retrouve le format texte normal.
4. **Paramètres LFM2.** Lorsque la route ne les configure pas, l’adaptateur emploie température 0.1, `top_k=50`, `repeat_penalty=1.05`, selon la fiche du modèle. Les valeurs explicitement configurées restent prioritaires. La campagne impose déjà température 0.1 et laisse les deux autres paramètres à l’adaptateur.
5. **Contexte cohérent.** Les tâches Studio ne reçoivent plus les rappels conversationnels de trajet, caméra ou génération d’images déclenchés par des mots de leur plan. Les créations directes reconnues conservent les contraintes du projet, son préambule, AGENTS.md et le design, sans injecter automatiquement les exemples de maintenance du plan. Les plans personnalisés non reconnus gardent leur contexte complet. Le RAG ne réintroduit pas le plan déjà filtré. Le mode choisi est conservé après reprise.
6. **Contenus littéraux explicites.** Un contrôle limité aux créations sur une ligne dont le contenu est explicitement reconnaissable rejette les propositions différentes avant écriture. Un lot contenant une telle erreur est différé avant ses effets dépendants ; le modèle doit reformuler les opérations. Casse et contenu sont conservés, avec une fin de ligne facultative. Aucun contenu n’est écrit automatiquement à la place du modèle. Les formulations ambiguës restent hors de ce contrôle.
7. **Historique et réponses vides.** Chaque appel reçoit son propre résultat ; les résultats d’un lot ne sont plus répétés sous chaque identifiant. Une réponse vide avant tout effet peut être relancée une seule fois pour une création explicite ; cette consommation est persistée avant la nouvelle génération. Deux réponses vides, ou une réponse vide après un effet, restent des échecs. La recette vérifie cette limite après un vrai redémarrage.

8. **Fenêtres de lecture.** Les paramètres facultatifs `offset_line` et `limit_lines` sont indépendants : première ligne par défaut, 500 lignes par défaut. Le daemon refusait auparavant une limite fournie seule malgré son schéma ; une demande de lecture de LFM2 échouait ainsi avant la seconde écriture. Les valeurs 0 ou hors bornes et le mélange avec `full` restent refusés. Les deux valeurs omises séparément sont couvertes avec de vrais fichiers.

Le contrôle de présence reste un contrôle de présence. Les critères externes ci-dessous vérifient séparément le contenu, le diff et l’ordre des opérations. `acceptance_verified` dépend toujours de critères d’acceptation validés.


## Recettes répétées avec les modèles réels

| Modèle / transport | Écriture simple | Écriture → lecture → seconde écriture | Total |
| --- | --- | --- | --- |
| devstral:latest / openai | 3/3 | 3/3 | **6/6** |
| lfm2:24b / ollama | 3/3 | 3/3 | **6/6** |
| qwen2.5-coder:14b / ollama | 3/3 | 3/3 | **6/6** |

Chaque essai exige `completed / succeeded / success`, les contenus exacts (fin de ligne facultative), un diff limité aux fichiers demandés et une seule écriture réussie par fichier. Le parcours multi-outils exige une lecture réussie de FIRST.md contenant alpha **après sa création et avant l’écriture de SECOND.md**. Une lecture avant création ou après la seconde écriture ne satisfait pas cette condition.

Configuration : température 0.1, 4096 tokens, contexte 32768, 12 tours d’outils. Devstral utilise un alias temporaire de son modèle Ollama via l’API compatible OpenAI ; cet alias est supprimé après la campagne. Qwen utilise le chat natif Ollama, LFM2 son adaptateur natif. Ce résultat porte sur ces deux recettes répétées et ces configurations.

Les échecs de développement restent archivés séparément : grammaires JSON forcées, lectures renvoyées sous plusieurs formats, contenus capitalisés ou copiés d’un modèle de plan, réponses vides et limites de tours. Ces essais ne sont pas substitués aux résultats de la campagne ci-dessus. Les assertions sur les fichiers et l’ordre n’ont pas été assouplies.

## #158 : reprise rejouée

**REC-01 à REC-09 passent** : interruption avant effet, effet incertain à inspecter, résultat enregistré sans répétition, approbation à renouveler, worktree absent sans repli sur le projet principal, cinq courses annulation/reprise, commande longue en pause, politique révoquée et enfant délégué conservé.

Compléments de cette campagne : contexte direct et contraintes de design conservés après un vrai redémarrage ; repli sur le plan complet conservé ; objectif original récupéré au-delà des 500 caractères du titre de tâche ; relance de réponse vide non réattribuée après crash. Les anciennes autorisations, résultats incertains et mutations ne sont pas rejoués aveuglément. #158 reste ouvert jusqu’à intégration.

## Reproduction et preuves

Le serveur UI de recette utilise un port éphémère strict et vérifie l’identifiant du projet isolé par son proxy avant d’ouvrir les pages. Les processus sont arrêtés et leur sortie attendue en fin de campagne. Cela corrige le cas où le port fixe était déjà occupé.


```powershell
$env:CARGO_INCREMENTAL='0'
$env:CARGO_PROFILE_DEV_DEBUG='0'
$env:CARGO_PROFILE_TEST_DEBUG='0'
$env:CARGO_TARGET_DIR=Join-Path $env:TEMP 'studio-agentic-cargo-target'
# Depuis Akasha
cargo test -p akasha-daemon --no-default-features --features embedded --lib -- --test-threads=2
cargo test -p akasha-llm -p akasha-store -p akasha-tools --lib -- --test-threads=2
cargo build -p akasha-daemon --no-default-features --features embedded --bin akasha-daemon
# Depuis Code Studio, Python + PyYAML et Ollama disponibles
$env:CODE_STUDIO_DAEMON_BIN=Join-Path $env:TEMP 'studio-agentic-cargo-target/debug/akasha-daemon.exe'
$env:CODE_STUDIO_TEST_PUBLISH='1'
node integration/agentic-real.mjs
python -u integration/real-model-recipes.py --models devstral:latest lfm2:24b qwen2.5-coder:14b --repeat 3 --openai-context 32768
```

- [Parcours techniques et preuves de reprise](agentic-recovery-models-2026-10-19.json).
- [Campagne LLM finale et traces d’appels](agentic-model-recipes-final-2026-10-19.json).
- [Explorations LLM conservées](agentic-model-explorations-2026-10-19.json), [diagnostic brut et lecture rejetée avant correction](agentic-model-wire-2026-10-19.json), [échecs techniques de développement](agentic-technical-explorations-2026-10-19.json).
- [Bureau](agentic-recovery-models-2026-10-19/desktop.png), [mobile](agentic-recovery-models-2026-10-19/mobile.png), [LSP](agentic-recovery-models-2026-10-19/editor-lsp.png), [preuves](agentic-recovery-models-2026-10-19/task-evidence.png).

Le brouillon de publication de la campagne, [#47](https://github.com/azerothl/Akasha-code-studio/pull/47), a été fermé sans fusion et sa branche supprimée. Les brouillons exploratoires #42 à #46 sont également fermés sans fusion. Les 12 PR d’implémentation restent ouvertes. CUDA non exécuté : aucun runner configuré, dispense utilisateur déjà accordée. Les contrôles CI des SHA publiés sont distincts des tests locaux.

Sources : [template LFM2](https://huggingface.co/LiquidAI/LFM2-24B-A2B/blob/main/chat_template.jinja), [paramètres et outils LiquidAI](https://huggingface.co/LiquidAI/LFM2-24B-A2B), [compatibilité OpenAI d’Ollama](https://docs.ollama.com/api/openai-compatibility).
