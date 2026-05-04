import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { MemberAIAgentPanel } from "./MemberAIAgentPanel";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface AgentSidePanelProps {
  memberId?: string;
  memberName?: string;
  contextLabel?: string | null;
  defaultOpen?: boolean;
}

const STORAGE_KEY = "sysde_agent_panel_open";

/**
 * Persistent right-side AI agent panel — Cursor/Copilot style.
 * Collapsible to a thin rail, expandable to fullscreen overlay.
 */
export function AgentSidePanel({ memberId, memberName, contextLabel, defaultOpen }: AgentSidePanelProps) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen ?? false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? (defaultOpen ?? true) : stored === "1";
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  }, [open]);

  if (!memberId || !memberName) return null;

  return (
    <>
      {/* Collapsed rail — always visible, branded */}
      <AnimatePresence initial={false}>
        {!open && (
          <motion.button
            key="rail"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="group fixed right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 bg-gradient-to-b from-primary to-primary/80 text-primary-foreground rounded-l-xl py-4 px-2 shadow-xl hover:px-3 transition-all"
            title="Abrir agente IA"
          >
            <Bot className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">
              Mi Agente IA
            </span>
            <Sparkles className="h-3 w-3 animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded panel */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.aside
            key="panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className={cn(
              "fixed top-0 right-0 z-40 h-screen bg-background border-l border-border shadow-2xl flex flex-col",
              expanded ? "w-full" : "w-full sm:w-[460px] lg:w-[520px]"
            )}
          >
            {/* Header — branded */}
            <div className="shrink-0 bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-full bg-primary-foreground/15 backdrop-blur flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold flex items-center gap-1.5">
                    Mi Agente IA <Sparkles className="h-3 w-3 text-warning animate-pulse" />
                  </p>
                  <p className="text-[10px] opacity-80 truncate">
                    {contextLabel ? `Contexto: ${contextLabel}` : "Listo para ayudarte"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/15 hidden sm:flex"
                  onClick={() => setExpanded((e) => !e)}
                  title={expanded ? "Reducir" : "Pantalla completa"}
                >
                  {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/15"
                  onClick={() => setOpen(false)}
                  title="Cerrar"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Context chip if any */}
            {contextLabel && (
              <div className="shrink-0 bg-primary/5 border-b border-primary/10 px-4 py-1.5">
                <Badge variant="outline" className="border-primary/30 text-primary text-[10px] gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> {contextLabel}
                </Badge>
              </div>
            )}

            {/* Chat — fills remaining space */}
            <div className="flex-1 overflow-hidden p-3">
              <MemberAIAgentPanel
                memberId={memberId}
                memberName={memberName}
                layout="stacked"
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
