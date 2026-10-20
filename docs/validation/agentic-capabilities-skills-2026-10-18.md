# Manifeste effectif et skills — lot P1

Suivi : [Akasha #153](https://github.com/azerothl/Akasha/issues/153), [#154](https://github.com/azerothl/Akasha/issues/154), [#155](https://github.com/azerothl/Akasha/issues/155), [Code Studio #28](https://github.com/azerothl/Akasha-code-studio/issues/28). Dépend du lot P0, PR Akasha #162 / Code Studio #31.

## Implémentation proposée

- Même manifeste contextuel pour le prompt et l’exécution. Prévisualisation du rôle racine avant envoi ; projet et rôle persistés pour les tâches existantes. Une politique de profil vide ou absente ne réintroduit aucun outil.
- Le mode plan utilise réellement `studio_planner`. Les lectures des rôles restreints sont bornées au workspace ; aucune recherche dans les graphes externes n’y est exposée. La fin d’une tâche de plan/revue ne réécrit plus automatiquement le statut du ticket en review.
- Skills propres au projet, priorité pack < utilisateur Akasha < `.agents/skills` < `.akasha/skills`, restrictions agents appliquées et ressources relatives bornées. Source/version/hash et activation sont conservés.
- Règles AGENTS.md racine puis sous-dossiers chargées dans leur portée ; les nouvelles règles sont fournies au modèle avant une mutation. Les erreurs de contexte arrêtent la tâche explicitement.
- Sept workflows disponibles dans les sources du daemon, avec inclusion du répertoire dans le packaging Windows/Linux/macOS.
- Dans l’interface, détails progressifs des outils annoncés/exclus, prérequis et motifs, skills disponibles, règles et historique d’activation. La matrice statique a été remplacée. Une réponse globale d’un ancien daemon n’est pas utilisée comme preuve contextuelle.

## Contrôles effectués

- Build TypeScript/Vite réussi, avertissement de bundle ~710 kB.
- Compilation daemon Windows avec `--no-default-features --features embedded` réussie.
- Format des sept nouveaux SKILL.md validé avec le validateur Skill Creator.
- Relecture des annulations des requêtes React lors d’un changement de projet, du chargement à l’ouverture du résumé et du repli compatible.
- Aucun lancement local de suite de tests, de scénario modèle ou de release dans ce lot.

## Validation restante

Recettes à effectuer : manifeste par tâche, contexte falsifié, profil vide, deux projets avec skills homonymes, filtrage agents, ressource sortante/modifiée, règle imbriquée avant mutation, mode plan, statut de revue conservé et premier démarrage d’un paquet installé.

Le préflight reste une déclaration de disponibilité ; il ne prouve pas l’exécution. Le shell d’un agent d’implémentation reste soumis à sa politique, sans sandbox OS. Les références AGENTS des sous-arbres affectés par une commande arbitraire doivent être lues par l’agent. Les tickets restent ouverts pendant revue et validation.
