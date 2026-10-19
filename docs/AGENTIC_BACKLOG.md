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

## Implémentations proposées

Les 12 PR sont empilées et conservées ouvertes. Voir [la validation de reprise et des modèles](validation/agentic-recovery-models-2026-10-19.md) et les preuves archivées. REC-01 à REC-09 sont désormais exécutées ; #158 reste ouvert jusqu’à intégration. [Akasha #179](https://github.com/azerothl/Akasha/issues/179) dispose désormais de 18/18 recettes ciblées réussies ; les échecs exploratoires restent archivés et le ticket reste ouvert jusqu’à intégration. Les compléments sont dans Akasha #170 et Code Studio #35.

| Priorité | Ticket | PR d’implémentation |
| --- | --- | --- |
| P0 | Akasha #151 — terminaison | [#162](https://github.com/azerothl/Akasha/pull/162) |
| P0 | Akasha #152 — rôles | [#162](https://github.com/azerothl/Akasha/pull/162), [#164](https://github.com/azerothl/Akasha/pull/164) |
| P1 | Akasha #153 — capacités | [#164](https://github.com/azerothl/Akasha/pull/164) |
| P1 | Akasha #154 — règles/skills | [#164](https://github.com/azerothl/Akasha/pull/164), [#170](https://github.com/azerothl/Akasha/pull/170) pour les nouvelles mutations |
| P1 | Akasha #155 — sept workflows | [#164](https://github.com/azerothl/Akasha/pull/164) |
| P1 | Akasha #156 — observation | [#166](https://github.com/azerothl/Akasha/pull/166) |
| P1 | Akasha #157 — contrats | [#167](https://github.com/azerothl/Akasha/pull/167), [#170](https://github.com/azerothl/Akasha/pull/170) |
| P1 | Akasha #158 — reprise | [#168](https://github.com/azerothl/Akasha/pull/168), [#170](https://github.com/azerothl/Akasha/pull/170) pour les publications incertaines |
| P1 | Code Studio #27 — résultats/reprise | [#31](https://github.com/azerothl/Akasha-code-studio/pull/31), [#34](https://github.com/azerothl/Akasha-code-studio/pull/34) |
| P1 | Code Studio #28 — capacités | [#32](https://github.com/azerothl/Akasha-code-studio/pull/32) |
| P1 | Code Studio #29 — PTY/preuves | [#33](https://github.com/azerothl/Akasha-code-studio/pull/33) |
| P2 | Akasha #159 — LSP | [#169](https://github.com/azerothl/Akasha/pull/169), [#170](https://github.com/azerothl/Akasha/pull/170) pour les règles imbriquées |
| P2 | Akasha #160 — livraison | [#170](https://github.com/azerothl/Akasha/pull/170) |
| P2 | Code Studio #30 — sémantique/livraison | [#35](https://github.com/azerothl/Akasha-code-studio/pull/35) |

### Ordre de revue et d’intégration

- Daemon : `main` → #162 → #164 → #166 → #167 → #168 → #169 → #170.
- Interface : `main` → #31 → #32 → #33 → #34 → #35.
- Chaque PR doit être revue avec les API de son lot daemon ; compiler l’interface seule ne prouve pas la présence du backend correspondant.

### Contrôles et limites

- Compilation Windows du daemon avec `cargo check -p akasha-daemon --no-default-features --features embedded` : réussie sur les branches proposées. Le mode sans fonctionnalités, sans `embedded`, conserve un défaut préexistant distinct.
- Build TypeScript/Vite : réussi. Avertissement du bundle principal >500 Ko persistant ; xterm est chargé séparément.
- Les workflows CI automatiques sont consultables dans les PR. Ils ne remplacent pas les recettes MCP/PTY/LSP/publication ou crash/reprise ; le job GPU peut rester en attente.
- Dernière validation (19 octobre) : 21 tests unitaires UI, 32 Playwright simulés, 416 daemon + 122 bibliothèques Rust = 538, 45 parcours techniques réels (44 standard + publication temporaire), REC-01 à REC-09. Vrais LLM : Qwen, Devstral et LFM2 6/6 chacun, soit 18/18. Les validations locales passent ; CI et intégration des PR restent à suivre. CUDA non exécuté, avec accord utilisateur.
- Première tranche : MCP stdio (un serveur attaché), transports natifs Chat Completions sur trois providers, contrôle de version sur les outils de fichier documentés, reprise de la boucle Studio, LSP sur trois familles de langages, livraison GitHub.com. Les limites complémentaires sont explicites dans les contrats daemon et empêchent une clôture globale comme « solution agentique complète ».

Documents de validation : [P0](validation/agentic-p0-implementation-2026-10-18.md), [capacités/skills](validation/agentic-capabilities-skills-2026-10-18.md), [observation](validation/agentic-observation-2026-10-18.md), [reprise](validation/agentic-recovery-2026-10-18.md), [LSP/livraison](validation/agentic-semantic-delivery-2026-10-18.md).
