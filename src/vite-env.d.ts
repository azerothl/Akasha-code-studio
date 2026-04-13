/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DAEMON_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
