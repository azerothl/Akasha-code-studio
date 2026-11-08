---
title: Akasha Code Studio
description: Code Studio est une interface web qui pilote un projet isolé par le daemon Akasha.
---

# Akasha Code Studio

Code Studio est une interface web qui pilote un projet isolé par le daemon Akasha. Elle regroupe la conversation avec l’agent, l’éditeur, le suivi des tâches, les branches et l’aperçu du projet.

## Connexion au daemon

Le serveur Vite écoute sur 127.0.0.1:5178 par défaut. Il transmet les requêtes /api au daemon configuré par VITE_DAEMON_URL, dont la valeur par défaut est http://127.0.0.1:3876.

## Sources

- [Contrats Code Studio](https://github.com/azerothl/Akasha-code-studio/blob/main/docs/CODE_STUDIO_SPEC.md)
- [Vue d’ensemble](https://github.com/azerothl/Akasha-code-studio/blob/main/README.md)
