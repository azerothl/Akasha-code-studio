# Fork de session (chat Code Studio) — spécification courte

Objectif : permettre un comportement **proche** de Pi (`/fork`, sessions arborescentes) sans imposer le format JSONL interne de pi-mono : l’utilisateur **repart d’un message** choisi dans l’historique tout en gardant une trace claire côté serveur.

## Personas

- **Développeur** : explore plusieurs directions à partir du même point de la conversation avec l’agent studio.
- **Revue** : comparer deux branches de discussion liées au même `studio_project_id`.

## UX (v1)

1. Dans le **journal de chat**, chaque message utilisateur (optionnellement aussi assistant) affiche une action **« Fork à partir d’ici »** (menu contextuel ou icône discret).
2. Au clic : dialogue de confirmation + champ optionnel **« instruction initiale »** (pré-rempli avec le texte du message choisi, modifiable).
3. Après validation : **nouvelle tâche** (nouveau `task_id`) avec indicateur visuel « fork de Tâche X / message #n ».
4. L’historique affiché dans l’UI peut soit **recharger** le transcript depuis le point de fork, soit afficher un **onglet** « Branche A / Branche B » (hors périmètre v1 minimal — v1 = une seule ligne de temps remplacée par la nouvelle branche, avec lien « Voir la conversation d’origine »).

### Maquette textuelle (layout)

```text
┌ Chat ────────────────────────────────────────────────────┐
│ [user] Message 1                              [⋮ Fork]   │
│ [assistant] Réponse...                                    │
│ [user] Message 2  ◄── utilisateur ouvre ⋮ → Fork         │
│ ...                                                       │
├──────────────────────────────────────────────────────────┤
│ [Composer]                                                │
└──────────────────────────────────────────────────────────┘

Dialogue « Fork » :
  Titre : Nouvelle branche depuis le message du …
  Corps : reprendre le contexte jusqu’à ce message inclus ;
          la suite actuelle ne sera pas copiée dans la nouvelle tâche.
  [ Annuler ] [ Créer la branche ]
```

## Données et API (cible)

Les champs existants `POST /api/message` incluent déjà `session_id`, `studio_project_id`, etc. (voir [CODE_STUDIO_SPEC.md](./CODE_STUDIO_SPEC.md)). Pour le fork :

| Champ (proposition) | Obligatoire | Description |
|----------------------|-------------|-------------|
| `fork_from_task_id` | recommandé | Tâche racine dont on copie le préfixe d’historique. |
| `fork_after_message_index` ou `fork_after_event_id` | oui | Point de coupure stable dans la timeline (index simple v1 ; UUID d’événement v2). |
| `session_id` | selon politique | Nouvelle session **ou** réutilisation avec marqueur de branche (décision daemon). |

**Comportement serveur attendu (v1)** :

1. Charger le transcript court terme (ou équivalent) de `fork_from_task_id` jusqu’au message N inclus.
2. Créer une **nouvelle** session ou une session « fille » documentée (à trancher dans l’implémentation — préférer **nouvelle** `session_id` pour éviter les collisions de compaction).
3. Lancer le traitement du message initial (texte du fork) comme une tâche normale studio.

**Non-objectifs v1** : graphe `/tree` interactif ; fusion de branches ; export gist.

## Traçabilité (exigence)

- Stocker en méta de tâche (ou premier événement) : `{ "fork_parent_task_id": "...", "fork_cut_index": n }` pour affichage et analytics.

## Recette manuelle (une fois implémenté)

1. Ouvrir un projet studio, envoyer deux tours de conversation.
2. Fork depuis le **premier** message utilisateur ; vérifier que la nouvelle tâche ne contient pas la réponse postérieure au point de coupure.
3. Vérifier que l’ancienne tâche reste consultable via son `task_id`.

## Références

- Priorités roadmap (dépôt **Akasha**) : `spec/dev/roadmap/pi_mono_alignment_priorities.md`
- Contrat événements client (dépôt **Akasha**) : `spec/dev/runtime/agent_client_event_contract.md`
