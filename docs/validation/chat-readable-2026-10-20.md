# Lisibilité du chat — 20 octobre 2026

## Correction

Les diagnostics et la liste des branches pouvaient occuper toute la hauteur disponible avant les messages. Le pied de conversation pouvait aussi consommer 65 % du panneau et faire défiler la saisie avec ses options.

- Suivi de tâche et branches repliés par défaut; les descriptions complètes et les actions de récupération restent accessibles.
- Un défilement principal pour le suivi et la conversation, avec le suivi automatique des nouveaux messages rattaché à ce conteneur.
- Demandes de décision placées à la suite des messages; une nouvelle question participe au signalement des messages non lus.
- Réglages, contexte, objectif et options avancées regroupés dans une zone de défilement limitée. Le champ de saisie et les commandes restent en dehors de cette zone.
- Le pied est limité à 48 % du panneau. La sélection du modèle demeure directe; son explication détaillée est repliable.

## Contrôles observés

`npm run build` réussit (TypeScript et Vite). Le détecteur statique de mise en page ne remonte aucun problème. Les deux scénarios navigateur existants qui ouvraient directement une branche ou une récupération ont été adaptés aux nouveaux résumés; la suite automatisée n'a pas été exécutée pour cette correction.

Inspection visuelle Chromium, deux passages au maximum, avec cinq branches, une erreur longue, un objectif et les réglages ouverts. Les captures utilisent un historique et des réponses de tâche simulés dans un navigateur isolé. Aucun message n'est envoyé au vrai agent et les données du navigateur utilisateur ne sont pas modifiées.

| Fenêtre | Hauteur de lecture avec détails ouverts | Champ de saisie |
| --- | --- | --- |
| 1440 × 960 | 479 px | Entièrement visible, environ 93 px |
| 1280 × 720 | 345 px | Entièrement visible, environ 93 px |
| 390 × 844 | 377 px | Entièrement visible, environ 93 px |

Aucun débordement horizontal ni erreur JavaScript observé dans ces trois configurations. Les détails ouverts ne sont plus des panneaux fixes qui réduisent la conversation à zéro : ils sont consultables par défilement. Ce contrôle porte sur l'agencement, pas sur la résolution de l'erreur de permissions de l'agent.

[Mesures](chat-readable-2026-10-20.json) · [Ordinateur](../screenshots/chat-readable-desktop.png) · [Mobile](../screenshots/chat-readable-mobile.png).
