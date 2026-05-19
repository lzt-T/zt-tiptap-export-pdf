import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

/** 手工验证页的挂载节点。 */
const rootElement = document.getElementById("root") as HTMLElement;

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
