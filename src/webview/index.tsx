import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const el = document.getElementById("root");
if (!el) throw new Error("Root element #root not found");

const root = createRoot(el);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
