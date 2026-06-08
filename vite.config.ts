import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const daemon = process.env.VITE_DAEMON_URL ?? "http://127.0.0.1:3876";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5178,
    strictPort: true,
    proxy: {
      "/api": {
        target: daemon,
        changeOrigin: true,
      },
    },
  },
});
