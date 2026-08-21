import { createRoot } from "react-dom/client";
import { applyStoredTheme } from "@/lib/theme";
import App from "./App.tsx";
import "./index.css";

// Antes de montar React: si se aplicara en un efecto, el usuario en modo
// oscuro vería un destello claro en cada recarga.
applyStoredTheme();

createRoot(document.getElementById("root")!).render(<App />);
