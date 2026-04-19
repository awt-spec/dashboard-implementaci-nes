import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles } from "lucide-react";
import { MemberAIAgentPanel } from "./MemberAIAgentPanel";

export function FloatingAgentButton({ memberId, memberName }: { memberId?: string; memberName?: string }) {
  const [open, setOpen] = useState(false);

  if (!memberId || !memberName) return null;

  return (
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-primary to-primary/70 hover:scale-105 transition-transform z-40 p-0"
        title="Tu agente IA"
      >
        <div className="relative">
          <Bot className="h-6 w-6" />
          <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-warning animate-pulse" />
        </div>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-4xl p-4 overflow-y-auto">
          <SheetHeader className="mb-3">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> Tu agente IA
            </SheetTitle>
          </SheetHeader>
          <MemberAIAgentPanel memberId={memberId} memberName={memberName} />
        </SheetContent>
      </Sheet>
    </>
  );
}
