import React from "react";
import ReactDOM from "react-dom/client";
import { loader } from "@monaco-editor/react";
import App from "./App";
import "./index.css";

/** Workers chargés depuis le CDN (évite les soucis de bundle Rollup avec monaco-editor ESM). */
loader.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs",
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
