# Frontières Code Studio

`App.tsx` compose l’écran et garde la coordination : projet sélectionné, onglet, chat, polling des tâches. Les règles de chaque domaine vivent à côté.

| Domaine | Module | Rôle |
|---------|--------|------|
| Livraison | `src/deliveryCycle.ts`, `src/deliveryCyclePanel.tsx` | Étape courante du parcours demander → fusionner |
| Éditeur | `src/editorSession.ts` | Onglets, brouillons, recherche |
| Envoi | `src/sendContext.ts` | Résumé du contexte et masquage des secrets |
| Revue | `src/taskReviewModel.ts`, `src/taskReview.tsx` | Critères, vérifications, diff |
| Forks | `src/forkTree.ts` | Arbre parent / enfant sans remplacer le journal |
| Swarm | `src/swarmIsolationPanel.tsx` | Worktrees et intégration explicite |
| API | `src/api.ts` | Client HTTP, sans état d’écran |

Les appels concurrents restent dans `App.tsx` : un `AbortController` par polling de tâche, et les chargements d’onglet s’annulent quand l’onglet ou le projet change.
