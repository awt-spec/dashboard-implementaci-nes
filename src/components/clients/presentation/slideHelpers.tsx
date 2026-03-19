import { useState, useEffect, useRef, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

// Context to disable editing (e.g., in fullscreen mode)
export const EditDisabledContext = createContext(false);

// ── Slide Layout ────────────────────────────────────────

export function SlideLayout({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-[1920px] h-[1080px] relative overflow-hidden", className)}>{children}</div>;
}

export function ScaledSlide({ children, containerRef }: { children: React.ReactNode; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      setScale(Math.min(width / 1920, height / 1080));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [containerRef]);
  return (
    <div className="absolute w-[1920px] h-[1080px]" style={{
      left: "50%", top: "50%", marginLeft: "-960px", marginTop: "-540px",
      transform: `scale(${scale})`, transformOrigin: "center center",
    }}>{children}</div>
  );
}

// ── Sysde Logo ──────────────────────────────────────────

export function SysdeLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path d="M50 10C30 10 15 25 15 45C15 55 20 63 28 68L35 55C30 52 27 47 27 42C27 32 37 24 50 24C63 24 73 32 73 42C73 52 63 60 50 60L45 75C48 76 50 76 50 76C70 76 85 63 85 45C85 25 70 10 50 10Z" fill="currentColor" opacity="0.7"/>
    </svg>
  );
}

// ── Editable Text Component ─────────────────────────────

export function EditableText({
  value, onChange, className, multiline = false, tag: Tag = "span", disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  multiline?: boolean;
  tag?: "span" | "p" | "h1" | "h2" | "h3" | "li" | "div";
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    if (draft.trim() !== value) onChange(draft.trim());
  };

  if (editing) {
    const shared = "bg-white/90 border-2 border-[#c0392b] rounded px-[8px] py-[2px] outline-none w-full";
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          className={cn(shared, "resize-none py-[4px]", className)}
          rows={3}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className={cn(shared, className)}
      />
    );
  }

  if (disabled) {
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <Tag
      className={cn(className, "cursor-pointer hover:outline hover:outline-2 hover:outline-[#c0392b]/30 hover:outline-offset-2 rounded transition-all group/et relative")}
      onClick={() => setEditing(true)}
      title="Clic para editar"
    >
      {value}
      <Pencil className="inline-block ml-[8px] opacity-0 group-hover/et:opacity-50 transition-opacity" style={{ width: '0.5em', height: '0.5em' }} />
    </Tag>
  );
}

// ── Editable Cell (for tables) ──────────────────────────

export function EditableCell({
  value, onChange, className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    if (draft.trim() !== value) onChange(draft.trim());
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className={cn("bg-white border-2 border-[#c0392b] rounded px-[4px] py-[2px] outline-none w-full", className)}
      />
    );
  }

  return (
    <span
      className={cn("cursor-pointer hover:bg-[#c0392b]/5 rounded px-[2px] transition-colors", className)}
      onClick={() => setEditing(true)}
      title="Clic para editar"
    >
      {value}
    </span>
  );
}

// ── Slide Text Storage (localStorage) ───────────────────

export type SlideTexts = Record<string, string>;

function getStorageKey(clientId: string) {
  return `ppt-texts-${clientId}`;
}

export function loadSlideTexts(clientId: string): SlideTexts {
  try {
    const raw = localStorage.getItem(getStorageKey(clientId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveSlideTexts(clientId: string, texts: SlideTexts) {
  localStorage.setItem(getStorageKey(clientId), JSON.stringify(texts));
}

// ── Progress Helpers ────────────────────────────────────

export function extractProgress(desc?: string): number | null {
  if (!desc) return null;
  const m = desc.match(/(?:avance|progreso)\s*[:=]?\s*(\d+)\s*%/i);
  return m ? parseInt(m[1], 10) : null;
}

// ── Gantt Helpers ───────────────────────────────────────

import { type Phase } from "@/data/projectData";

export function getMonthRange(phases: Phase[], contractStart: string, contractEnd: string): { label: string; date: Date }[] {
  const allDates: Date[] = [];
  const parseD = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? null : d; };
  phases.forEach(p => {
    const s = parseD(p.startDate); if (s) allDates.push(s);
    const e = parseD(p.endDate); if (e) allDates.push(e);
  });
  if (allDates.length === 0) {
    const s = parseD(contractStart); if (s) allDates.push(s);
    const e = parseD(contractEnd); if (e) allDates.push(e);
  }
  if (allDates.length === 0) return [];
  const min = new Date(Math.min(...allDates.map(d => d.getTime())));
  const max = new Date(Math.max(...allDates.map(d => d.getTime())));
  const months: { label: string; date: Date }[] = [];
  const cur = new Date(min.getFullYear(), min.getMonth(), 1);
  while (cur <= max || months.length < 3) {
    const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    months.push({ label: `${names[cur.getMonth()]} ${cur.getFullYear()}`, date: new Date(cur) });
    cur.setMonth(cur.getMonth() + 1);
    if (months.length > 12) break;
  }
  return months;
}

export function getPhaseBarStyle(phase: Phase, months: { label: string; date: Date }[]): { left: string; width: string; color: string } {
  if (months.length === 0) return { left: "0%", width: "0%", color: "#ccc" };
  const parseD = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? null : d; };
  const totalStart = months[0].date.getTime();
  const lastMonth = new Date(months[months.length - 1].date);
  lastMonth.setMonth(lastMonth.getMonth() + 1);
  const totalEnd = lastMonth.getTime();
  const totalSpan = totalEnd - totalStart;
  const ps = parseD(phase.startDate);
  const pe = parseD(phase.endDate);
  if (!ps || !pe) return { left: "0%", width: "0%", color: "#ccc" };
  const left = Math.max(0, ((ps.getTime() - totalStart) / totalSpan) * 100);
  const width = Math.max(2, ((pe.getTime() - ps.getTime()) / totalSpan) * 100);
  let color = "#bbb";
  if (phase.status === "completado") color = "#c0392b";
  else if (phase.status === "en-progreso") color = "#c0392b";
  else if (phase.name.toLowerCase().includes("capacitación") || phase.name.toLowerCase().includes("talleres")) color = "#e67e22";
  else if (phase.name.toLowerCase().includes("pruebas")) color = "#e67e22";
  else if (phase.name.toLowerCase().includes("go") || phase.name.toLowerCase().includes("producción")) color = "#27ae60";
  else color = "#e67e22";
  return { left: `${left}%`, width: `${width}%`, color };
}

export function getCurrentDatePosition(months: { label: string; date: Date }[]): string | null {
  if (months.length === 0) return null;
  const now = new Date();
  const totalStart = months[0].date.getTime();
  const lastMonth = new Date(months[months.length - 1].date);
  lastMonth.setMonth(lastMonth.getMonth() + 1);
  const totalEnd = lastMonth.getTime();
  const pos = ((now.getTime() - totalStart) / (totalEnd - totalStart)) * 100;
  if (pos < 0 || pos > 100) return null;
  return `${pos}%`;
}
