"use client";
import { App } from "./App.js";
import { LoginComplete } from "./LoginComplete.js";
export default function Workspace() {
  return window.location.pathname === "/auth/complete" ? (
    <LoginComplete />
  ) : (
    <App />
  );
}
