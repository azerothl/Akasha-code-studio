# Admission des modèles et reconnexion du chat — 23 octobre 2026

Cette tranche traite les cinq améliorations du [rapport Todo précédent](todo-real-llm-2026-10-22.md).

## Changements

- Qualification réelle du transport d'outils, sans exécuter le probe sur un projet ; contexte configuré et latence exposés dans le catalogue. Contrôle limité à 20 s, succès conservé une heure et échec cinq minutes. La vraie demande est également soumise au garde de contexte.
- Profil `studio` facultatif pour les rôles Code Studio, avec routes et paramètres dédiés. Repli limité aux alternatives configurées et qualifiées ; modèle explicitement choisi conservé. Les moteurs embarqués sans transport natif d'outils ne sont plus des secours pour ces opérations. Une génération sans premier contenu est bornée à 60 s maximum dans le budget existant.
- Pas de redispatch automatique de la demande inchangée après `studio_routes_exhausted`. Les opérations déjà exécutées restent couvertes par le checkpoint et le registre existants.
- Reconnexion automatique du suivi après erreur de lecture, délai croissant jusqu'à 15 s, requêtes de suivi bornées à 10 s et annulables. Dernier état métier conservé, reprise au rechargement et résultat terminal sans doublon ni nouveau message.
- Vérification du modèle disponible dans le composeur hors exécution active. Le sélecteur transmet uniquement fournisseur et modèle, sans ses métadonnées. Les diagnostics distinguent inférence locale, incompatibilité d'outils et attente expirée ; ils n'inventent pas une cause mémoire.

## Validations avant le nouveau scénario Todo

| Vérification | Résultat |
| --- | --- |
| Tests unitaires UI | 35 réussis |
| Build TypeScript / Vite | Réussi ; avertissement préexistant de taille du bundle |
| Playwright avec API simulée | 51 réussis au passage complet final. Au premier passage, le scénario d'échec d'envoi avait échoué ; il a réussi seul puis dans la suite complète, sans modification de son assertion. |
| Tests routeur LLM | 105 réussis |
| Tests daemon `studio_` | 188 réussis |
| Compilation du daemon | Réussie, avec `--no-default-features --features embedded` |
| Daemon réel + fournisseur HTTP scripté | 2 scénarios de reprise réussis : abandon du flux partiel, repli, timeout épinglé et reprise du même task_id / ticket |
| Recette ciblée d'accès avec politique partielle | Création Git initiale et scénario d'accès réussis. Le coordinateur reste sans écriture applicative ; un objectif explicite sur `studio_fullstack` exerce lecture, commande Git et écriture. Le scénario non-Studio conserve ses refus. La suite générale entière n'a pas été rejouée. |
| Qualification des modèles réels | Qwen 3.5 9B : 5 873 ms, contexte configuré 32 768 ; GPT-OSS 20B : 11 242 ms, contexte configuré 16 384. Les deux renvoient le probe structuré exact. |

La qualification d'un petit appel natif ne prouve ni la qualité de la planification ni la livraison d'une application. Le contexte configuré est une information de routage, pas une mesure de VRAM disponible. Les probes constituent des appels supplémentaires distincts des outils du projet.

Le profil local de recette utilise Qwen 3.5 9B en primaire et GPT-OSS 20B en secours, tous deux déjà installés dans Ollama ; les paramètres sont enregistrés via l'API du daemon. Le reste du routage est conservé et une copie préalable du fichier de configuration reste dans le dossier temporaire local. Le nouveau scénario Todo sera lancé après publication des commits. Aucune intervention ne sera faite après sa demande initiale.

## Preuves et publication

- [Mesures des contrôles et empreinte du binaire](studio-admission-reconnection-2026-10-23.json).
- [Akasha #259](https://github.com/azerothl/Akasha/pull/259), après #258.
- [Code Studio #114](https://github.com/azerothl/Akasha-code-studio/pull/114), après #113 et le daemon #259.

Les PR restent ouvertes pendant la validation du parcours réel.

## Premier essai après publication et ajustement du repli

Le projet `5810e103-30dd-42be-b1ec-7e1d027c6887`, tâche `a7abc086-e13e-44b2-b001-0e4f9ebae258`, a reçu une seule demande. Il a échoué sans exécution d'outil après environ dix secondes : Qwen a demandé `delegate_to_agent` pendant la phase ne proposant que `studio_list_tickets`, `studio_create_ticket` et `studio_update_ticket`. Le ticket est bloqué et aucune application n'a été produite. Aucune intervention n'a eu lieu pendant son exécution.

L'observation a révélé que les routes embarquées ajoutées par défaut à une nouvelle catégorie occupaient les places avant GPT-OSS dans la limite de tentatives. Après la fin du scénario, le filtre a été déplacé avant cette limite et couvert par un test. Une erreur d'outil liée au rôle ne met plus globalement en quarantaine un transport valide, afin que les réparations sémantiques puissent réellement le réinterroger. Le diagnostic garde aussi son action de reprise avant ses détails abrégés, et le chat distingue un appel invalide d'une panne externe supposée. Après ces ajustements : 107 tests LLM et 36 tests UI réussis, build UI réussi. Un autre projet neuf est prévu pour observer le repli corrigé ; le premier projet échoué est conservé.
