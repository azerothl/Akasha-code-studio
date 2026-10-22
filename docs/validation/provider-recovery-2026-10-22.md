# Reprise fournisseur et cohérence Kanban — 22 octobre 2026

Les six corrections du rapport Todo sont implémentées dans les deux dépôts. La version UI dépend de la version daemon correspondante : les changements d'affichage seuls ne fournissent pas la reprise côté serveur.

## Comportements vérifiés

- Délai partagé entre les routes configurées, modèle explicite conservé, nombre de tentatives borné et arrêt des générations périmées.
- Réponse partielle d'une tentative abandonnée exclue du parseur d'outils ; préférence pour le fournisseur ayant répondu aux tours suivants.
- Attente observable avec fournisseur, modèle, numéro de tentative et heartbeat, sans faux jalon de progression lors d'un timeout.
- Ticket terminal réconcilié immédiatement et au chargement du board ; reprise du même task_id et du même ticket, y compris après un échec de revue.
- Première demande enregistrée avec coordination, phases, besoins explicites et dépendances ; migration idempotente des anciens tickets uniques. La planification doit encore spécialiser les gabarits avant l'implémentation.
- Rapport sans timeout dans les actions terminées et sans doublons. L'UI différencie responsable, exécution et compteurs d'outils.

## Vérifications

| Vérification | Résultat |
| --- | --- |
| Build TypeScript / Vite | Réussi ; avertissement préexistant du bundle principal > 500 Ko |
| Tests unitaires UI | 35 réussis |
| Parcours Playwright avec API simulée | 47 réussis, bureau et mobile |
| Tests Rust `studio_` du daemon | 188 réussis |
| Tests Rust du rapport | 2 réussis |
| Tests du routeur LLM sans fonctionnalités optionnelles | 101 réussis |
| Recette daemon ciblée, fournisseur HTTP scripté | 2 scénarios réussis, preuves JSON associées |

Le binaire final a été reconstruit avec `--no-default-features --features embedded`, puis relancé sur le port 3876. Son SHA-256 correspond au rapport de recette final. L'interface et son proxy répondent sur le port 5179. Après le dernier ajustement du cache d'état du Kanban, le build et les deux parcours navigateur de reprise ont été rejoués avec succès.

La recette réelle provoque un flux partiel qui ne se termine pas. Elle observe le heartbeat, le basculement vers la seconde route et une lecture de fichier réussie. Le texte partiel demandait une écriture interdite par le scénario : aucun fichier correspondant n'a été créé. Une seconde tâche impose le fournisseur muet, atteint son timeout, reste liée à son ticket bloqué, puis reprend avec succès après rétablissement simulé du fournisseur, sans nouvel identifiant.

## Limites et vérification générale

La recette existante `test:daemon:agentic` s'arrête sur `partial web-only policy inherits Studio file and development access`, avant tout appel au modèle. Elle interroge `/api/tools/effective?project_id=...` sans rôle, puis exige `write_file` exécutable. Le rôle par défaut est le coordinateur, dont le contrat dans le code de base réserve les modifications applicatives aux spécialistes. Cette attente doit être réconciliée avec le parcours de délégation ; la recette générale n'est pas déclarée réussie et ses assertions n'ont pas été affaiblies. [Rapport de cet échec](agentic-role-contract-2026-10-22.json).

Aucune nouvelle création complète de Todo avec un vrai modèle n'est validée par cette tranche. Les tests ciblés prouvent la gestion des erreurs et la reprise, pas la capacité du modèle à livrer une application entière.
