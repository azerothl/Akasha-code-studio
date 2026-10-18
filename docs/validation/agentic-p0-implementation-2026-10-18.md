# Premier lot de correction agentique — 18 octobre 2026

> Validation ultérieure : [tests et parcours réels](agentic-real-2026-10-18.md). Les résultats initiaux ci-dessous sont conservés comme historique.

Tickets : [Akasha #151](https://github.com/azerothl/Akasha/issues/151), [Akasha #152](https://github.com/azerothl/Akasha/issues/152), [Code Studio #27](https://github.com/azerothl/Akasha-code-studio/issues/27).

## Changements

- Le daemon persiste un résultat structuré avec motif de terminaison, résultats partiels et vérifications. Une réponse vide, boucle, limite, erreur provider ou timeout ne vaut plus réussite.
- Le statut final est atomiquement lié au résultat ; les échecs et arrêts utilisateur préexistants sont préservés. Une synthèse n’efface plus une sous-tâche échouée.
- Les rôles planner/reviewer partagent une liste fermée de capacités entre annonce et exécution. Les branches spéciales et alias de skills sont contrôlés avant action.
- Le planner peut uniquement remplacer le plan exact ; les commandes, extensions, délégations et scripts automatiques sont désactivés pour les rôles restreints.
- Code Studio présente résultat et motif dans le suivi, le chat, le détail et la revue. Les vérifications réussies proviennent du résultat structuré ; les progressions textuelles du modèle restent non confirmées.
- Un ancien daemon ou une ancienne tâche sans ce contrat reste consultable, avec une mention de résultat non vérifié. Les fichiers et diffs d’une tâche échouée sont également rafraîchis.

## Contrôles effectués

- `npm run build` : réussi (TypeScript puis Vite). Avertissement de taille de bundle : environ 707 kB avant compression.
- `cargo check -p akasha-daemon --no-default-features --features embedded` : réussi sous Windows, avec les avertissements préexistants du monorepo.
- `git diff --check` : réussi dans les deux dépôts.
- Relecture React : composant sans effet ni requête supplémentaire ; détails progressifs accessibles, motif expurgé, contrat versionné et compatibilité explicite.

## Limites

Aucune suite de tests ni recette modèle supplémentaire exécutée pour ce lot. Les scénarios restant à valider sont documentés dans le daemon, `spec/dev/quality/STUDIO_AGENTIC_P0.md`. Le profil daemon sans aucune feature échoue sur la référence préexistante à `embedded_apply_runtime` ; le profil compilé utilise `embedded`.

Le résultat `succeeded` décrit la fin normale de la boucle, sans garantir seul la satisfaction métier. Les codes de sortie absents du dispatch actuel restent inconnus ; les contrôles manuels ne deviennent pas automatiques. La reprise après crash et la sandbox système restent des sujets distincts. Les tickets restent ouverts pour revue et validation de leurs critères.
