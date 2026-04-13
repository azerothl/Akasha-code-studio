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
npm run test:e2e:install
npm run test:e2e
```

Les tests Playwright **mockent** `/api/*` pour ne pas exiger un daemon réel.

## Spécification

`docs/CODE_STUDIO_SPEC.md` — contrats API, exigences `STU-*`, phases.

## Dépôt Rust

Les changements daemon vivent dans le monorepo **Akasha** (`crates/akasha-daemon` : `api_studio.rs`, `studio.rs`, `api.rs`).
