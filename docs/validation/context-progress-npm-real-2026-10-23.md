# Recette Todo — contexte, boucles et npm — 23 octobre 2026

## Conclusion

**Scénario non validé : aucun aperçu jouable/utilisable produit.** Les nouveaux garde-fous fonctionnent sur les cas observés, mais ils arrêtent le travail sans parvenir à faire terminer l’application. Les PR restent ouvertes ; aucun ticket n’est fermé.

Observation : du 23 octobre à **09:09:35 UTC** à **09:37:53 UTC** (11:09–11:37 à Paris), arrêtée après le blocage du socle et du second spécialiste. À la coupe, les cinq exécutions liées capturées sont terminales. Le daemon et son scheduler restent actifs : les autres tickets peuvent faire l’objet de tentatives automatiques ultérieures. Ce rapport ne préjuge pas de leurs résultats.

## Livraison et environnement

- Daemon : commit `beb7b7509ba37ccd9f3fc97a234057bde38f1a0c`, branche `codex/studio-timeout-recovery`, [Akasha #259](https://github.com/azerothl/Akasha/pull/259).
- Interface et fixtures : commits `87aa7ba` et `e7cd3c2`, même nom de branche, [Code Studio #114](https://github.com/azerothl/Akasha-code-studio/pull/114).
- Daemon reconstruit avec `--no-default-features --features embedded`, redémarré avant la recette. SHA-256 du binaire réellement lancé : `B97CFF7DE828987CCF74F6C980DF6E6556DEFE53CCC2D18A1EB76E2979C34A2C`.
- Interface : `http://127.0.0.1:5179/`, daemon : `http://127.0.0.1:3876`.
- Projet neuf : `1ec1d754-090c-43c3-a70b-6f0b4c620efd`, « Todo observé — contexte boucles npm 23-10-2026 ».
- Vrai LLM : profil automatique Studio ; appels observés à **Ollama / GPT-OSS 20B** et **Qwen3.5 9B**, contexte configuré 32 768 tokens. Les fournisseurs scriptés des tests techniques sont distingués ci-dessous.

Ordre des dépendances conservé : **Akasha #258 → #259 ; Code Studio #113 → #114**, avec le daemon #259 disponible avant l’interface #114.

## Corrections mises en place avant la recette

1. `list_tools []` renvoie un index de noms, sans tous les schémas. Une découverte ciblée n’annonce qu’un outil supplémentaire ; elle ne charge plus tout le catalogue au tour suivant. Schéma individuel limité à 16 Kio. Les permissions restent contrôlées.
2. Les commandes npm Studio contrôlent le cwd, `package.json` et le script demandé avant de démarrer un processus. Les erreurs de prérequis conservent un code, une instruction de réparation et `process_started: false`. Aucun manifeste applicatif n’est créé par le moteur.
3. Les modifications attestées rendent les anciennes réussites de build/tests périmées. Le dernier résultat de chaque commande reconnue conserve son nombre de tentatives ; le journal garde les échecs. Les réponses finales avec des vérifications échouées/périmées reçoivent deux demandes de réparation bornées, puis échouent.
4. Après une modification, rappel de vérification au bout de 12 tours et arrêt après 24 tours sans vérification réussie. Une prolongation exige un jalon récent sur une nouvelle révision ; un build répété sans changement ne suffit pas. Les nouveaux blocages ne sont pas redispatchés à l’identique.
5. Le chat explique ces arrêts et ne prétend plus qu’aucun outil n’a été exécuté lorsqu’un rejet de contexte survient après des tours antérieurs.

Ces contrôles bornent les échecs ; ils ne garantissent pas que le modèle sache réparer le projet.

## Protocole d’observation

Création depuis l’interface, stack Vite / React / TypeScript. Une seule demande initiale : Todo List française, titre obligatoire, ajout, terminer/rouvrir, suppression, filtres, compteur, état vide, persistance localStorage, clavier et responsive ; build/tests pertinents puis aperçu.

**Aucune modification manuelle du projet généré, aucune consigne supplémentaire, aucun changement de modèle, aucune reprise ou relance manuelle pendant le travail des agents.** Observation par API GET, consultation du Kanban et captures. Deux anciens projets ont repris automatiquement au redémarrage ; ils ont été laissés travailler. La recette n’était donc pas isolée de cette charge.

## Déroulement observé

| Étape | Résultat réel |
|---|---|
| Demande initiale `eddf67fe…` | 5 tickets créés. Attente de capacité pendant 120 s, puis événement `root_llm_sem_timeout`. Aucun appel LLM ni outil sur cette exécution. Le détail principal perd la cause et affiche une fin générique. |
| Reprise automatique `5e771e7e…` | Même ticket conservé. Vrai GPT-OSS ; plan vérifié, 7 opérations réussies et 3 échouées, dernier checkpoint 10. Le moteur a demandé une correction des critères manquants, résolue sans intervention. `planning_verified=true`, `acceptance_verified=false`. |
| Routage incorrect `26e7a2f4…` | Le ticket de validation contient le critère réservé `initial-kanban-backlog`, recopié depuis le parent. Il est interprété comme un nouveau résumé initial, confié au coordinateur et lancé avant son prérequis d’intégration. Nouveau sous-backlog : 5 → 9 tickets. 10 opérations réussies, 11 échouées, dernier checkpoint 21 ; nouvelle planification déclarée vérifiée. |
| Socle `eb87944f…` | `studio_scaffold` lit et écrit réellement dans le projet, sans erreur d’accès observée. Trois fichiers applicatifs/de configuration sont créés. Premier build : `vite` absent ; installation npm réussie ; second build : `Could not resolve ./src/main.tsx from index.html`. Le modèle ne crée pas ce point d’entrée. 30 opérations réussies, 3 échouées ; dernier checkpoint 32. Arrêt `studio_no_verified_progress` après 24 tours sans vérification réussie, sans prolongation ni faux succès. |
| Sous-ticket supplémentaire `f6da04b6…` | Un `studio_fullstack` démarre sur « Développer la Todo List », sans dépendance au socle bloqué. 7 opérations réussies, 3 échouées ; dernier checkpoint 9. Arrêt sur trois `search_replace` inchangés ou périmés. Aucun fichier supplémentaire. |

À la coupe : **9 tickets — 5 à faire, 2 parents en cours, 2 bloqués, 0 en revue et 0 terminé**. Les deux parents affichés « en cours » n’impliquent aucune exécution active parmi les tâches capturées.

Fichiers visibles : `.akasha-studio-tickets.json`, `CODE_STUDIO_PLAN.md`, `DESIGN.md`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`. Aucun `src/main.tsx`, aucun test applicatif, aucun aperçu (`running=false`, `preview_inactive=true`). La fonctionnalité Todo et le respect du design ne peuvent pas être validés.

## Ce que la recette confirme et ne confirme pas

- Accès au workspace : lectures/écritures réussies ; aucune erreur d’accès terminale observée.
- Contexte : aucune terminaison par dépassement de contexte dans cette recette. Le spécialiste n’a pas utilisé `list_tools` : la correction de découverte est couverte par les tests ciblés, pas directement par ce parcours LLM.
- npm : installation réelle réussie après création du manifeste. Pas d’ENOENT sur `package.json` ; des builds ont néanmoins été lancés avant que les dépendances, puis les sources, soient prêtes. La réparation automatique de ces diagnostics reste insuffisante.
- Boucles : arrêt borné réel, diagnostic explicite et absence de livraison déclarée après build échoué. **L’arrêt d’une boucle n’est pas une reprise réussie.** La planification et les nouveaux tickets échappent encore à un budget commun de projet.
- Kanban : création, raffinement, reprise après saturation et dispatch fonctionnent ; l’identité du type de ticket et les dépendances peuvent encore être faussées par les critères générés.

## Améliorations restantes, par priorité

### P0 — Protéger les métadonnées de gouvernance

Le type « résumé initial » doit être une propriété système immuable liée au ticket racine, indépendante des critères libres générés par le modèle. Refuser un marqueur réservé sur une phase, et le détecter avant de valider le plan. Ne jamais lancer une phase de validation avant ses prérequis. Test de régression : le LLM copie `initial-kanban-backlog` dans une phase ; le premier ticket d’implémentation reste le socle et aucun second backlog n’apparaît.

Sources : `studio_kanban_dispatch::is_initial_backlog_summary`, `ticket_agent_for_dispatch`, contrôles des outils Kanban et `studio_planning` dans le daemon.

### P0 — Faire réparer la première dépendance en échec

Appliquer aux tâches de développement ordinaires un état de réparation persistant après un échec de build : dépendances manquantes → installation ; point d’entrée absent → création du fichier demandé ; erreur de version → relecture et nouvel edit. Limiter les recherches répétées tant que ce diagnostic reste inchangé, tout en gardant les lectures nécessaires. Exiger la nouvelle vérification après réparation. Ne pas coder l’application à la place de l’agent ni transformer une installation réussie en validation du produit.

Test de régression : build sans dépendances, puis sans `src/main.tsx`, puis réparation par le modèle ; seuls un vrai build et les tests applicatifs peuvent valider la phase.

### P0 — Admission durable et diagnostic de saturation

L’attente d’un créneau ne doit pas devenir un échec opaque au bout de 120 s. Conserver une file durable, afficher l’attente, séparer son temps des délais du modèle et garantir l’équité entre travail interactif et anciens tickets de fond. Persister `root_llm_sem_timeout` dans l’outcome et le diagnostic principal si cette limite subsiste. L’événement seul est insuffisant.

Source : `daemon.rs`, acquisition du sémaphore racine et `fail_task_on_worker_slot_timeout`.

### P1 — Budget et blocages à l’échelle de la demande

Compter aussi les replanifications, créations de tickets et nouveaux workers dans un budget de la demande initiale. Un sous-ticket libre ne doit pas contourner un prérequis de socle. Afficher le blocage agrégé des parents et suivre le worker courant dans le chat. La présence d’un parent « en cours » ne doit pas masquer un projet arrêté.

### P1 — Aligner la recette technique étendue sur les rôles actuels

La fixture qui exige `tool_choice=required` pour une modification depuis le coordinateur ne teste pas un spécialiste ayant les outils de mutation. Exercer le vrai chemin de délégation et garder les assertions sur l’absence de faux succès, les effets réels et les contrôles de versions. Ne pas supprimer ces assertions pour faire passer la suite.

## Validations de cette livraison

| Validation | Résultat |
|---|---|
| Daemon, tests unitaires CPU | **688 réussis, 1 ignoré** |
| Moteur LLM, tests unitaires | **107 réussis** |
| Interface, tests unitaires | **41 réussis** |
| Interface, Playwright avec API mockée | **52 réussis** |
| Build interface | Réussi ; avertissement de taille de bundle déjà présent |
| API réelle de création de projet | **1 réussi, 1 ignoré** (scénario de tâche LLM opt-in distinct) |
| Reprise, daemon isolé + fournisseur HTTP scripté | Réussie |
| Recette technique étendue | **13 cas réussis puis 1 échec de fixture** : `prose cannot attest a modification to an existing file without any executed tool`. Attendu `tool_choice=required`, champ absent sur le coordinateur. Le reste de cette suite n’a pas été exécuté ; elle n’est pas validée. |
| Cas build TypeScript de cette recette | Vérifié sur le spécialiste délégué : reste en échec même si le fallback Vite produit un bundle |
| Nouveau Todo avec vrais LLM | **Non validé**, blocages décrits ci-dessus |

CI vérifiée sur les commits de code : Code Studio Linux/Windows réussit ; Akasha Rust, exécution mockée et UI réussissent. Le contrôle GPU reste en attente. Aucune fusion n’est effectuée, indépendamment de la CI, car la recette fonctionnelle et la suite étendue ne passent pas entièrement.

## Preuves

- [Snapshot et chronologie JSON](context-progress-npm-real-2026-10-23.json) : board, outcomes, checkpoints, événements sélectionnés et opérations récentes.
- [Capture du blocage du socle](context-progress-npm-real-2026-10-23.png).

Les vues d’événements et le registre récent sont bornés par l’API : ce ne sont pas des journaux exhaustifs. Aucun secret de configuration ni contenu complet des fichiers générés n’est publié.
