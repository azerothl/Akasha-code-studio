# Actions, modèles et objectifs par tâche

Le daemon doit annoncer `schema_version: 1` via `GET /api/router/studio-options`. Une interface connectée à un ancien daemon désactive le sélecteur et les objectifs et affiche une explication. Les commandes spécialisées sont refusées si le contrat manque.

`POST /api/message` accepte, pour une nouvelle tâche Studio :

```json
{
  "studio_project_id": "project-uuid",
  "message": "Corriger le jeu",
  "studio_model": { "provider": "ollama", "model": "configured-model" },
  "studio_action": "goal",
  "studio_goal": {
    "objective": "Les tests du jeu passent",
    "criteria": {
      "criteria": [
        { "id": "tests", "kind": "command_ok", "text": "Tests réussis", "argv": ["npm", "run", "test"] }
      ]
    },
    "max_cycles": 4,
    "max_seconds": 600,
    "max_tokens": 50000
  }
}
```

Les champs sont optionnels pour un message ordinaire. Le choix « Automatique » omet `studio_model`. Les valeurs explicites doivent désigner un modèle configuré et un fournisseur enregistré; leur indisponibilité produit une erreur, sans fallback silencieux. La sélection ne modifie pas la configuration globale et ne s’applique pas rétroactivement à une tâche active. Le modèle déclaré par le fournisseur reste affiché comme modèle observé.

Les options sont persistées dans la table SQLite `studio_execution_contracts` avant l’envoi au worker. Un événement `studio_execution` reste disponible pour le diagnostic, mais sa rétention bornée ne conditionne pas la reprise ni le suivi d’un objectif. Les reprises les relisent et revalident le modèle contre la configuration actuelle. `/audit` utilise `studio_auditor` : les mutations, le shell et les délégations sont refusés par la politique technique. `/debug` et `/test` sont des workflows qui réutilisent les outils et autorisations du projet.

Un objectif accepte 1 à 20 critères mécaniques `file_exists` ou `command_ok`. Les critères manuels ne peuvent pas décider d’une continuation. Limites : 1–20 cycles de vérification, 30–3600 secondes et 1000–1000000 tokens de boucle principale. La vérification ne démarre pas après un arrêt enregistré ou après épuisement du budget. La vérification intervient après chaque lot d’outils et avant une réponse finale. Dès que les critères sont prouvés, le daemon termine sans exiger une confirmation supplémentaire du modèle; la limite de tours existante reste applicable.

Une présence de fichier certifie seulement une présence. Un code de sortie nul certifie seulement la réussite de la commande configurée. Les commandes passent par les mêmes validations d’arguments et le même exécuteur que les critères d’acceptation de projet. Les effets d’un script doivent être compris avant de le choisir comme vérification.

`GET /api/tasks/:id/goal` expose objectif, état, cycles, temps écoulé, tokens et motif. Les états sont dérivés de l’état réel de tâche et de l’état durable dans `studio_execution_contracts`; les anciens événements restent lisibles pour compatibilité. Les opérations pause/reprise/annulation utilisent les contrôles de tâche existants. La reprise conserve le journal d’effets et n’accorde pas une ancienne approbation.

La consommation de tokens repose sur l’usage fourni par le modèle, sinon sur une estimation conservée avec l’état. Ce compteur porte sur la boucle principale et n’est pas une facture fournisseur. Après une interruption non clôturée, le temps non enregistré est ajouté de manière conservatrice. Une opération externe en cours conserve son propre timeout; le daemon réévalue les limites à la prochaine frontière d’exécution.
