# Diagnostics et livraison — #30

> Validation ultérieure : [tests et parcours réels](agentic-real-2026-10-18.md). Les résultats initiaux ci-dessous sont conservés comme historique.

## Éditeur

Section LSP fermée par défaut : activation explicite par projet, diagnostics serveur séparés de Monaco local, F12 et références, puis préparation d’un renommage avec aperçu avant/après. L’application exige des buffers enregistrés et un plan non périmé ; les buffers affectés sont relus sans écraser un brouillon devenu modifié. Les URI Monaco incluent le projet pour séparer les modèles de deux dépôts. Serveurs préinstallés/autorisation et états d’indexation restent visibles.

## Revue de tâche

Section Livraison Git / PR / CI, fermée par défaut :

1. Choisir les fichiers et créer le commit local.
2. Publier explicitement le SHA affiché sur le remote sélectionné.
3. Créer une PR brouillon après lecture du commit distant.
4. Consulter la PR et les contrôles liés au SHA ; une CI absente ou ancienne n’est pas affichée comme validée.

Aucune sélection de fichiers, publication ou fusion automatique. Les requêtes incertaines conservent leur identifiant ; la reprise et une nouvelle action restent des décisions explicites. Un résultat Git connu et une erreur d’archivage sont présentés séparément. Les champs et étapes sont affichés progressivement ; aucune nouvelle rangée d’actions permanente sur mobile.

`npm run build` passe (TypeScript/Vite). Avertissement du bundle principal >500 Ko toujours présent (~737 Ko brut), terminal chargé dans son chunk séparé. Aucun test local, serveur LSP réel ou parcours Git/publication réel via ces API. Clavier/mobile, navigation Monaco, conflits de renommage, index Git concurrent et contrôles PR/CI restent à valider avant clôture. Les limites serveur sont documentées dans les contrats daemon #159 et #160.
