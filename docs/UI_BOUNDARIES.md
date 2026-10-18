# Frontières Code Studio

`App.tsx` compose les écrans et coordonne les actions qui traversent plusieurs domaines (envoi d’une demande, réglages du projet, régénération du plan/design). Les états et opérations des domaines principaux vivent dans des hooks dédiés.

| Domaine | Module | Rôle |
|---------|--------|------|
| Livraison | `src/deliveryCycle.ts`, `src/deliveryCyclePanel.tsx` | Étape courante du parcours demander → fusionner |
| Projets | `src/hooks/useStudioProjects.ts` | Liste, sélection persistée, chargement, suppression et précontrôle |
| Éditeur | `src/hooks/useStudioEditor.ts`, `src/editorSession.ts` | Fichiers, onglets, brouillons, sauvegarde et recherche |
| Git | `src/hooks/useStudioGit.ts` | Branches, évolutions, comparaison et conflits ; App coordonne les mutations avec le rafraîchissement des fichiers |
| Aperçu/build | `src/hooks/useStudioPreview.ts` | Installation, serveur, logs, vérification et état du build |
| Chat/tâches | `src/hooks/useStudioTasks.ts` | Historique local, reprise et annulation du suivi, progression et réponses attendues |
| Envoi | `src/sendContext.ts` | Résumé du contexte et masquage des secrets |
| Revue | `src/taskReviewModel.ts`, `src/taskReview.tsx` | Critères, vérifications, diff |
| Forks | `src/forkTree.ts` | Arbre parent / enfant sans remplacer le journal |
| Swarm | `src/swarmIsolationPanel.tsx` | Worktrees et intégration explicite |
| API | `src/api.ts` | Client HTTP, sans état d’écran |
| Retour utilisateur | `src/asyncState.tsx` | États chargement, vide, partiel, hors ligne, erreur et succès, avec action de reprise |
| Navigation/types | `src/studioNavigation.ts`, `src/studioUiModel.ts` | Types partagés et transformations sans accès réseau |

Le suivi de tâche possède un `AbortController` par exécution ; chaque résultat est ignoré après annulation. Les chargements de projets, fichiers, branches et aperçus utilisent un identifiant de requête et/ou l’identité du projet courant pour ignorer les réponses périmées. Les effets d’onglet conservent leur nettoyage à la fermeture.

Les règles de workflow et les mutations HTTP restent distinctes : aucun composant de présentation n’accorde de capacité ou ne change les garde-fous du daemon. Les builds ne réussissent qu’avec un code de sortie nul. Le résumé d’envoi distingue la préférence d’agent et le modèle observé au dernier tour, sans présenter un champ de handoff non confirmé comme un modèle effectif.
