import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Send, Sparkles, Award } from "lucide-react";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { useKudos, useGiveKudo, useBadges, useMemberBadges, useAwardBadge } from "@/hooks/useTeamEngagement";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const CATEGORIES = [
  { value: "teamwork", label: "🤝 Teamwork" },
  { value: "innovation", label: "💡 Innovación" },
  { value: "delivery", label: "🚀 Entrega" },
  { value: "mentor", label: "🧑‍🏫 Mentoría" },
  { value: "quality", label: "✨ Calidad" },
];
const EMOJIS = ["👏", "🚀", "🔥", "💪", "🎉", "⭐", "🏆", "❤️"];

export function RecognitionWall() {
  const { data: members = [] } = useSysdeTeamMembers();
  const { data: kudos = [] } = useKudos();
  const { data: badges = [] } = useBadges();
  const { data: memberBadges = [] } = useMemberBadges();
  const giveKudo = useGiveKudo();
  const awardBadge = useAwardBadge();

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("teamwork");
  const [emoji, setEmoji] = useState("👏");
  const [msg, setMsg] = useState("");

  const [badgeOpen, setBadgeOpen] = useState(false);
  const [bMember, setBMember] = useState("");
  const [bBadge, setBBadge] = useState("");
  const [bReason, setBReason] = useState("");

  // Leaderboard: kudos count per member
  const leaderboard = useMemo(() => {
    const counts: Record<string, number> = {};
    kudos.forEach((k: any) => { counts[k.to_member_id] = (counts[k.to_member_id] || 0) + 1; });
    return members
      .map((m: any) => ({ ...m, kudos: counts[m.id] || 0, badges: memberBadges.filter((b: any) => b.member_id === m.id).length }))
      .sort((a: any, b: any) => (b.kudos + b.badges * 3) - (a.kudos + a.badges * 3))
      .slice(0, 8);
  }, [kudos, members, memberBadges]);

  const memberMap = useMemo(() => Object.fromEntries(members.map((m: any) => [m.id, m])), [members]);

  const handleSend = async () => {
    if (!from || !to || !msg.trim()) return;
    await giveKudo.mutateAsync({ from_member_id: from, to_member_id: to, category, emoji, message: msg.trim() });
    setMsg(""); setOpen(false);
  };

  const handleAward = async () => {
    if (!bMember || !bBadge) return;
    await awardBadge.mutateAsync({ member_id: bMember, badge_id: bBadge, reason: bReason });
    setBReason(""); setBadgeOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-rose-500/20 flex items-center justify-center border border-amber-500/30">
            <Trophy className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Wall of Kudos & Badges</h3>
            <p className="text-[11px] text-muted-foreground">Reconoce a tus compañeros y celebra logros del equipo</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={badgeOpen} onOpenChange={setBadgeOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2"><Award className="h-3.5 w-3.5" />Otorgar insignia</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Otorgar insignia</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={bMember} onValueChange={setBMember}>
                  <SelectTrigger><SelectValue placeholder="Colaborador" /></SelectTrigger>
                  <SelectContent>{members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={bBadge} onValueChange={setBBadge}>
                  <SelectTrigger><SelectValue placeholder="Insignia" /></SelectTrigger>
                  <SelectContent>{badges.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>)}</SelectContent>
                </Select>
                <Textarea placeholder="Motivo (opcional)" value={bReason} onChange={e => setBReason(e.target.value)} />
                <Button onClick={handleAward} disabled={awardBadge.isPending} className="w-full">Otorgar</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white"><Sparkles className="h-3.5 w-3.5" />Dar Kudo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Reconoce a un compañero 🎉</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={from} onValueChange={setFrom}>
                    <SelectTrigger><SelectValue placeholder="De" /></SelectTrigger>
                    <SelectContent>{members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={to} onValueChange={setTo}>
                    <SelectTrigger><SelectValue placeholder="Para" /></SelectTrigger>
                    <SelectContent>{members.filter((m: any) => m.id !== from).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => setEmoji(e)} className={`text-2xl p-1.5 rounded-md transition ${emoji === e ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"}`}>{e}</button>
                  ))}
                </div>
                <Textarea placeholder="¿Por qué le agradeces?" value={msg} onChange={e => setMsg(e.target.value)} rows={3} />
                <Button onClick={handleSend} disabled={giveKudo.isPending} className="w-full gap-2"><Send className="h-3.5 w-3.5" />Enviar Kudo</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-3">
          <div className="text-xs font-semibold mb-2 text-muted-foreground">Últimos reconocimientos</div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {kudos.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Sin kudos aún. ¡Sé el primero!</p>}
            {kudos.map((k: any) => {
              const fromM = memberMap[k.from_member_id];
              const toM = memberMap[k.to_member_id];
              return (
                <div key={k.id} className="p-3 rounded-lg border bg-gradient-to-br from-card to-muted/30 hover:shadow-sm transition">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl shrink-0">{k.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs">
                        <span className="font-semibold">{fromM?.name || "?"}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-semibold text-primary">{toM?.name || "?"}</span>
                      </div>
                      <p className="text-sm mt-1">{k.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="text-[10px]">{CATEGORIES.find(c => c.value === k.category)?.label || k.category}</Badge>
                        <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(k.created_at), { addSuffix: true, locale: es })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-xs font-semibold mb-2 text-muted-foreground">🏆 Leaderboard</div>
          <div className="space-y-2">
            {leaderboard.map((m: any, i: number) => (
              <div key={m.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-zinc-400 text-white" : i === 2 ? "bg-orange-700 text-white" : "bg-muted"}`}>{i + 1}</div>
                <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{m.name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{m.name}</div>
                  <div className="text-[10px] text-muted-foreground">{m.kudos} kudos · {m.badges} badges</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
