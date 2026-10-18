# Backlog agentique — audit du 18 octobre 2026

Source : [audit des outils et skills](AGENTIC_CAPABILITY_AUDIT.md). Tickets publiés après recherche des doublons. Les API et moteurs vivent dans **Akasha** ; leur présentation vit dans **Akasha-code-studio**. L’intégration Akasha OS demeure un chantier distinct.

## P0 — fiabilité et restrictions

- [Akasha #151 — terminaison et résultat vérifié](https://github.com/azerothl/Akasha/issues/151)
- [Akasha #152 — restrictions planner/reviewer](https://github.com/azerothl/Akasha/issues/152)

## P1 — capacités et workflows

- [Akasha #153 — manifeste effectif contextuel](https://github.com/azerothl/Akasha/issues/153)
- [Akasha #154 — règles et skills du projet](https://github.com/azerothl/Akasha/issues/154)
- [Akasha #155 — pack de sept workflows de développement](https://github.com/azerothl/Akasha/issues/155)
- [Akasha #156 — navigateur, PTY et découverte MCP](https://github.com/azerothl/Akasha/issues/156)
- [Akasha #157 — contrats d’appels typés et versionnés](https://github.com/azerothl/Akasha/issues/157)
- [Akasha #158 — reprise durable après incident](https://github.com/azerothl/Akasha/issues/158)
- [Code Studio #27 — affichage du résultat structuré](https://github.com/azerothl/Akasha-code-studio/issues/27), dépend de #151 côté Akasha.
- [Code Studio #28 — outils, règles et skills effectifs](https://github.com/azerothl/Akasha-code-studio/issues/28), dépend de #153 et #154 côté Akasha.
- [Code Studio #29 — terminal et preuves navigateur](https://github.com/azerothl/Akasha-code-studio/issues/29), dépend de #156 côté Akasha.

## P2 — sémantique et livraison

- [Akasha #159 — navigation sémantique LSP](https://github.com/azerothl/Akasha/issues/159)
- [Akasha #160 — opérations Git/PR/CI](https://github.com/azerothl/Akasha/issues/160)
- [Code Studio #30 — diagnostics et cycle PR/CI](https://github.com/azerothl/Akasha-code-studio/issues/30), dépend de #159 et #160 côté Akasha.

## Suivis existants réutilisés

- [Akasha #145 — frontières de chemins et mutations des worktrees](https://github.com/azerothl/Akasha/issues/145) : conserve son périmètre, distinct de la restriction des rôles.
- [Akasha #143 — évaluations reproductibles](https://github.com/azerothl/Akasha/issues/143) : héberge les parcours de validation transverses ; aucun doublon créé.

Un ticket ouvert ou une correction locale ne signifie pas livraison validée. Les PR et les contrôles exécutés sont à référencer dans chaque ticket concerné.
