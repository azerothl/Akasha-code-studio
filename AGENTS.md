# AGENTS.md — Akasha Code Studio

Interface **Vite + React + TypeScript** pour le mode **Code Studio** du daemon Akasha.

## Développement

```bash
npm install
npm run dev
```

- URL : `http://127.0.0.1:5178` (serveur écoute sur `127.0.0.1`).
- Proxy : les requêtes `/api` sont relayées vers `VITE_DAEMON_URL` (défaut `http://127.0.0.1:3876`).

## Tests

```bash
npm run test
npm run test:e2e:install
npm run test:e2e
```

`npm run test` exécute les tests unitaires (Vitest), alias de `test:unit`. Les tests Playwright **mockent** `/api/*` pour ne pas exiger un daemon réel.

### Intégration daemon (réel)

Le daemon Akasha doit être **démarré** (par défaut `http://127.0.0.1:3876`). Variable optionnelle : `CODE_STUDIO_DAEMON_URL` ou `VITE_DAEMON_URL`.

```bash
npm run test:daemon
```

Vérifie `POST /api/studio/projects` (fichiers initiaux, Git sur `main`/`master`, arbre propre après commit initial). Crée puis supprime un projet sous le répertoire données du daemon.

## Spécification

`docs/CODE_STUDIO_SPEC.md` — contrats API, exigences `STU-*`, phases.

## Dépôt Rust

Les changements daemon vivent dans le monorepo **Akasha** (`crates/akasha-daemon` : dossier `api_studio/`, `studio.rs`, `api.rs`).
