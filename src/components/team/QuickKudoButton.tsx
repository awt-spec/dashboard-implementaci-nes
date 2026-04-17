import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Send } from "lucide-react";
import { useGiveKudo } from "@/hooks/useTeamEngagement";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";

const EMOJIS = ["👏", "🚀", "🔥", "💪", "🎉", "⭐", "🏆", "❤️"];
const CATEGORIES = [
  { value: "teamwork", label: "🤝 Teamwork" },
  { value: "innovation", label: "💡 Innovación" },
  { value: "delivery", label: "🚀 Entrega" },
  { value: "mentor", label: "🧑‍🏫 Mentoría" },
  { value: "quality", label: "✨ Calidad" },
];

export function QuickKudoButton({ toMemberId, size = "sm" }: { toMemberId: string; size?: "sm" | "icon" }) {
  const { data: members = [] } = useSysdeTeamMembers();
  const give = useGiveKudo();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [emoji, setEmoji] = useState("👏");
  const [category, setCategory] = useState("teamwork");
  const [msg, setMsg] = useState("");

  const send = async () => {
    if (!from || !msg.trim()) return;
    await give.mutateAsync({ from_member_id: from, to_member_id: toMemberId, emoji, category, message: msg.trim() });
    setMsg(""); setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
        {size === "icon" ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Dar kudo">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]">
            <Sparkles className="h-3 w-3 text-amber-500" /> Kudo
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2" onClick={e => e.stopPropagation()}>
        <div className="text-xs font-semibold">Enviar reconocimiento</div>
        <Select value={from} onValueChange={setFrom}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="De quién" /></SelectTrigger>
          <SelectContent>
            {members.filter((m: any) => m.id !== toMemberId).map((m: any) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex flex-wrap gap-0.5">
          {EMOJIS.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={`text-lg p-1 rounded ${emoji === e ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-muted"}`}
            >{e}</button>
          ))}
        </div>
        <Textarea rows={2} placeholder="¿Por qué?" value={msg} onChange={e => setMsg(e.target.value)} className="text-xs" />
        <Button size="sm" className="w-full gap-1.5" onClick={send} disabled={give.isPending || !from || !msg.trim()}>
          <Send className="h-3 w-3" /> Enviar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
