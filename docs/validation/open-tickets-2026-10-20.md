# Validation des tickets ouverts — 20 octobre 2026

## Périmètre et état de livraison

Tickets Code Studio **#103–#109**, dépendance daemon **Akasha #236**. Les branches locales sont `codex/studio-open-tickets` et `codex/studio-model-goals`, issues respectivement de `43445eb` et `8701464`. Cette recette valide les modifications locales : elle ne constitue ni une publication, ni une CI GitHub réussie, ni une fusion. Les tickets restent ouverts pendant la publication et la revue.

Le daemon utilisé pour les recettes a l’empreinte SHA-256 `8d4cd465c7c0ff66a690048909b52eb9dafea6c536df4ea138c093e17850a6f5`. Les données, projets et processus des recettes sont isolés dans des répertoires temporaires; le daemon de l’utilisateur n’a pas été remplacé.

## Résultats observés

| Vérification | Résultat | Portée |
| --- | --- | --- |
| `npm run build` | Réussi | TypeScript et bundle Vite |
| `npm test` | **24 réussis**, 5 fichiers | Dont parsing des actions et préservation du texte libre |
| `npm run test:e2e` | **41 réussis** | Chromium; API simulée; desktop et mobile |
| `cargo test -j 2 -p akasha-daemon -p akasha-llm --lib --no-default-features` | **637 réussis**, 1 ignoré | 566 daemon + 71 LLM; compilation CPU sans fonctionnalités par défaut |
| `npm run test:daemon:agentic` | **66 parcours réussis**, 460 requêtes natives | Vrai daemon, disque, Git, processus, Chromium, MCP et LSP; modèle protocolaire déterministe |
| `npm run test:daemon:goal`, `qwen2.5-coder:14b` | **Réussi**, environ 11,4 s | Vraie inférence Ollama; modèle demandé = observé; fichier exact, une écriture, objectif vérifié en un cycle |
| Même recette, `qwen3.5:2b` | **Échec conservé** | Appels textuels invalides, puis génération vide; fichier absent, objectif bloqué, aucun faux succès |

Pour les commandes daemon, définir `CODE_STUDIO_DAEMON_BIN` vers le binaire compilé; `AKASHA_REPO_DIR` peut désigner le monorepo. La recette LLM accepte `CODE_STUDIO_REAL_MODEL` et `CODE_STUDIO_OLLAMA_URL`. Le script choisit par défaut le modèle réellement validé `qwen2.5-coder:14b`. Aucun téléchargement de modèle n’est automatique.

Le résumé portable est [open-tickets-2026-10-20.json](open-tickets-2026-10-20.json). Il conserve les noms, statuts et durées de chaque parcours ainsi que les deux résultats LLM, sans les centaines de requêtes brutes.

## Couverture par ticket

| Ticket | Implémentation et preuve |
| --- | --- |
| [#103](https://github.com/azerothl/Akasha-code-studio/issues/103) | Sélecteur dédié, requête structurée, catalogue sans secrets, validation des modèles configurés, route exacte sans repli silencieux, reprise avec choix persistant. Tests UI, test route Rust, parcours réel avec modèle sélectionné et inférence locale. |
| [#104](https://github.com/azerothl/Akasha-code-studio/issues/104) | Panneaux contraints, défilement horizontal limité au Kanban et accessible au clavier. Parcours aux largeurs 1920, 1440, 1280 et 390 px, captures desktop/mobile. |
| [#105](https://github.com/azerothl/Akasha-code-studio/issues/105) | Composant aperçu séparé, lancement principal, environnement et journaux repliables, états de préparation/échec et iframe dominante. Régression aperçu HTML, build en échec, serveur réel et capture d’erreur. |
| [#106](https://github.com/azerothl/Akasha-code-studio/issues/106) | Timeout décrit comme absence de signal, résultat structuré, diagnostic copiable expurgé, inspection des fichiers/reprise persistée. Préparer une nouvelle demande ne lance aucun effet : un test vérifie que le nombre d’envois reste inchangé. |
| [#107](https://github.com/azerothl/Akasha-code-studio/issues/107) | Branches locales/distantes, suivi et divergences, commit et modifications courantes; base inconnue annoncée. Comparaison obligatoire avant fusion, confirmations contextualisées, aide aux conflits. Tests d’acceptation/refus de confirmation et captures mobile/desktop. |
| [#108](https://github.com/azerothl/Akasha-code-studio/issues/108) | Palette clavier/souris, quatre actions, erreurs de commande explicites, champs de vérification et limites. Chaque action est testée à l’envoi; pause/reprise/arrêt testés sur mobile. `/audit` dispose d’un rôle qui interdit techniquement les mutations du projet, le shell et la délégation. |
| [#109](https://github.com/azerothl/Akasha-code-studio/issues/109) | [Audit daté des capacités](../AGENT_CAPABILITY_AUDIT.md), sources officielles, surfaces UI/API, dépendances et limites. Les écarts déjà suivis ne sont pas dupliqués. |
| [Akasha #236](https://github.com/azerothl/Akasha/issues/236) | Contrat durable SQLite, critères mécaniques, cycles/durée/tokens, état exposé, pause/reprise/annulation. Les parcours vérifient continuation après critère en échec, limite, code de sortie de commande, redémarrage sans rejouer l’écriture, modèle restauré et interdiction des effets d’audit. |

## Défauts révélés et corrigés pendant la recette

1. Le journal de tâche est borné et pouvait supprimer les options initiales après une longue génération. Le contrat et l’état d’objectif sont désormais stockés dans une table SQLite dédiée. Un test évince explicitement les événements initiaux et vérifie que le contrat reste disponible.
2. Une génération vide après une écriture correcte pouvait invalider un objectif déjà atteint. La vérification intervient maintenant après chaque lot d’outils; une preuve mécanique suffisante termine l’objectif sans attendre une confirmation textuelle supplémentaire du LLM.
3. Les écritures de vérification sur un fichier existant doivent conserver la lecture préalable et la version attendue. Les recettes ont été adaptées à ce contrat; le garde-fou n’a pas été affaibli.

## Limites restantes

- `qwen3.5:2b` n’a pas réussi cette recette. La fiabilité des modèles reste suivie par [Akasha #143](https://github.com/azerothl/Akasha/issues/143); ces résultats n’autorisent pas une promesse pour tous les modèles.
- Le critère « présence de fichier » prouve uniquement sa présence. Le script réel vérifie séparément les octets attendus. L’acceptation globale d’un projet et les critères de `/goal` restent distincts; aucun build n’a été inventé pour le projet texte.
- La suite protocolaire fait réellement fonctionner les outils, mais son fournisseur déterministe n’évalue pas l’intelligence d’un LLM.
- La publication GitHub optionnelle de la recette n’a pas été activée; aucune CI distante, publication de PR ou fusion n’est comptée comme validée.
- La compilation et les tests Rust ont été exécutés sans fonctionnalités par défaut, sur CPU. Ils ne valident pas une compilation CUDA.

## Captures

- [Kanban desktop](../screenshots/tickets-kanban-desktop.png), [Kanban mobile](../screenshots/tickets-kanban-mobile.png).
- [Branches desktop](../screenshots/tickets-branches-desktop.png), [Branches mobile](../screenshots/tickets-branches-mobile.png).
- [Aperçu en erreur](../screenshots/tickets-preview-error.png).
