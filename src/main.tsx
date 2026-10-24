import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installPrismaApi } from "@/api/prismaApi";
import { actions } from "@/state/store";
import "./index.css";

installPrismaApi();
void actions.completeSharePointOAuth().then(() => actions.completeAccOAuth());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
