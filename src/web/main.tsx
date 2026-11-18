import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { LoginComplete } from "./LoginComplete.js";
import "./styles.css";
import "./styles-mission09.css";
import "./styles-neumorphic.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname === "/auth/complete" ? (
      <LoginComplete />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
