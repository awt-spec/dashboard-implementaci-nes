import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, GripVertical, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CronogramaRow, type CompromisoRow } from "./aurumCronogramaData";

// ── Generic Table Editor Panel (Canva-style) ────────────

interface TableEditorPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function TableEditorPanel({ open, onClose, title, children }: TableEditorPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed right-0 top-0 bottom-0 w-[480px] bg-[#1a1a2e] border-l border-white/10 z-[60] flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#c0392b] flex items-center justify-center">
                <Table2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-white font-semibold text-sm">{title}</span>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Cronograma Editor ───────────────────────────────────

interface CronogramaEditorProps {
  rows: CronogramaRow[];
  onChange: (rows: CronogramaRow[]) => void;
}

export function CronogramaEditor({ rows, onChange }: CronogramaEditorProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const updateRow = (idx: number, field: keyof CronogramaRow, val: string | boolean | number) => {
    const next = [...rows];
    (next[idx] as any)[field] = val;
    onChange(next);
  };

  const addRow = (afterIdx: number) => {
    const next = [...rows];
    next.splice(afterIdx + 1, 0, {
      name: "Nueva tarea",
      duration: "0 días",
      percent: "0%",
      start: "",
      end: "",
      indent: rows[afterIdx]?.indent ?? 3,
    });
    onChange(next);
  };

  const removeRow = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div className="space-y-1">
      {rows.map((row, i) => (
        <div
          key={i}
          onClick={() => setSelectedRow(i === selectedRow ? null : i)}
          className={cn(
            "rounded-lg border transition-all cursor-pointer",
            selectedRow === i
              ? "border-[#c0392b] bg-[#c0392b]/10"
              : "border-white/5 hover:border-white/20 bg-white/5"
          )}
        >
          {/* Row summary */}
          <div className="flex items-center gap-2 px-3 py-2">
            <GripVertical className="h-3.5 w-3.5 text-white/20 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-[13px] text-white/90 truncate",
                row.isBold && "font-bold",
                row.isRed && "text-[#ff6b6b]"
              )} style={{ paddingLeft: `${row.indent * 12}px` }}>
                {row.name}
              </p>
            </div>
            <span className={cn(
              "text-[12px] font-mono shrink-0 px-2 py-0.5 rounded",
              parseInt(row.percent) === 100 ? "bg-emerald-500/20 text-emerald-400" :
              parseInt(row.percent) > 0 ? "bg-[#c0392b]/20 text-[#ff6b6b]" :
              "bg-white/5 text-white/40"
            )}>
              {row.percent}
            </span>
          </div>

          {/* Expanded edit fields */}
          <AnimatePresence>
            {selectedRow === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Nombre</label>
                    <input value={row.name} onChange={e => updateRow(i, "name", e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b] transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Duración</label>
                      <input value={row.duration} onChange={e => updateRow(i, "duration", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Porcentaje</label>
                      <input value={row.percent} onChange={e => updateRow(i, "percent", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Comienzo</label>
                      <input value={row.start} onChange={e => updateRow(i, "start", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Fin</label>
                      <input value={row.end} onChange={e => updateRow(i, "end", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Nivel</label>
                      <select value={row.indent} onChange={e => updateRow(i, "indent", parseInt(e.target.value))}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]">
                        <option value={0} className="bg-[#1a1a2e]">Proyecto</option>
                        <option value={1} className="bg-[#1a1a2e]">Fase</option>
                        <option value={2} className="bg-[#1a1a2e]">Subfase</option>
                        <option value={3} className="bg-[#1a1a2e]">Tarea</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-white/50">
                        <input type="checkbox" checked={row.isBold || false} onChange={e => updateRow(i, "isBold", e.target.checked)}
                          className="accent-[#c0392b]" />Bold
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-white/50">
                        <input type="checkbox" checked={row.isRed || false} onChange={e => updateRow(i, "isRed", e.target.checked)}
                          className="accent-[#c0392b]" />Rojo
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => addRow(i)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[#c0392b]/20 text-[#ff6b6b] text-[11px] font-medium hover:bg-[#c0392b]/30 transition-colors">
                      <Plus className="h-3 w-3" /> Agregar fila debajo
                    </button>
                    <button onClick={() => removeRow(i)}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      <button onClick={() => addRow(rows.length - 1)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-white/20 text-white/40 text-[12px] hover:border-[#c0392b] hover:text-[#ff6b6b] transition-colors mt-3">
        <Plus className="h-3.5 w-3.5" /> Nueva fila
      </button>
    </div>
  );
}

// ── Compromisos Editor ──────────────────────────────────

interface CompromisosEditorProps {
  rows: CompromisoRow[];
  onChange: (rows: CompromisoRow[]) => void;
}

export function CompromisosEditor({ rows, onChange }: CompromisosEditorProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const updateRow = (idx: number, field: keyof CompromisoRow, val: string | number) => {
    const next = [...rows];
    (next[idx] as any)[field] = val;
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, {
      num: rows.length + 1,
      description: "Nuevo compromiso",
      responsible: "",
      date: "TBD",
      status: "Pendiente",
      comments: "",
    }]);
  };

  const removeRow = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, num: i + 1 }));
    onChange(next);
  };

  const statusColors: Record<string, string> = {
    "Hecho": "bg-emerald-500/20 text-emerald-400",
    "En progreso": "bg-amber-500/20 text-amber-400",
    "Pendiente": "bg-red-500/20 text-red-400",
  };

  return (
    <div className="space-y-1">
      {rows.map((row, i) => (
        <div
          key={i}
          onClick={() => setSelectedRow(i === selectedRow ? null : i)}
          className={cn(
            "rounded-lg border transition-all cursor-pointer",
            selectedRow === i
              ? "border-[#c0392b] bg-[#c0392b]/10"
              : "border-white/5 hover:border-white/20 bg-white/5"
          )}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-[12px] text-white/30 font-mono w-5">{row.num}</span>
            <p className="flex-1 text-[13px] text-white/90 truncate">{row.description}</p>
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", statusColors[row.status] || statusColors["Pendiente"])}>
              {row.status}
            </span>
          </div>

          <AnimatePresence>
            {selectedRow === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Descripción</label>
                    <textarea value={row.description} onChange={e => updateRow(i, "description", e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b] resize-none" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Responsable</label>
                      <input value={row.responsible} onChange={e => updateRow(i, "responsible", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Fecha</label>
                      <input value={row.date} onChange={e => updateRow(i, "date", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Estado</label>
                      <select value={row.status} onChange={e => updateRow(i, "status", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]">
                        <option className="bg-[#1a1a2e]">Hecho</option>
                        <option className="bg-[#1a1a2e]">En progreso</option>
                        <option className="bg-[#1a1a2e]">Pendiente</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Comentarios</label>
                    <input value={row.comments} onChange={e => updateRow(i, "comments", e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeRow(i); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors">
                    <Trash2 className="h-3 w-3" /> Eliminar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      <button onClick={addRow}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-white/20 text-white/40 text-[12px] hover:border-[#c0392b] hover:text-[#ff6b6b] transition-colors mt-3">
        <Plus className="h-3.5 w-3.5" /> Nuevo compromiso
      </button>
    </div>
  );
}

// ── Coordination Editor (for action items / próximos pasos) ──

export interface CoordinationRow {
  num: number;
  subject: string;
  owner: string;
  date: string;
  status: string;
  fup: string;
}

interface CoordinationEditorProps {
  rows: CoordinationRow[];
  onChange: (rows: CoordinationRow[]) => void;
}

export function CoordinationEditor({ rows, onChange }: CoordinationEditorProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const updateRow = (idx: number, field: keyof CoordinationRow, val: string | number) => {
    const next = [...rows];
    (next[idx] as any)[field] = val;
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, { num: rows.length + 1, subject: "Nuevo item", owner: "", date: "", status: "Pendiente", fup: "" }]);
  };

  const removeRow = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, num: i + 1 }));
    onChange(next);
  };

  return (
    <div className="space-y-1">
      {rows.map((row, i) => (
        <div key={i} onClick={() => setSelectedRow(i === selectedRow ? null : i)}
          className={cn("rounded-lg border transition-all cursor-pointer",
            selectedRow === i ? "border-[#c0392b] bg-[#c0392b]/10" : "border-white/5 hover:border-white/20 bg-white/5")}>
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-[12px] text-white/30 font-mono w-5">{row.num}</span>
            <p className="flex-1 text-[13px] text-white/90 truncate">{row.subject}</p>
            <span className="text-[11px] text-white/40">{row.owner}</span>
          </div>
          <AnimatePresence>
            {selectedRow === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Asunto</label>
                    <textarea value={row.subject} onChange={e => updateRow(i, "subject", e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b] resize-none" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Owner</label>
                      <input value={row.owner} onChange={e => updateRow(i, "owner", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Fecha</label>
                      <input value={row.date} onChange={e => updateRow(i, "date", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Estado</label>
                      <select value={row.status} onChange={e => updateRow(i, "status", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]">
                        <option className="bg-[#1a1a2e]">Hecho</option>
                        <option className="bg-[#1a1a2e]">Pendiente</option>
                        <option className="bg-[#1a1a2e]">Vencido</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">FUP</label>
                      <input value={row.fup} onChange={e => updateRow(i, "fup", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeRow(i); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 text-[11px] hover:bg-red-500/20 transition-colors">
                    <Trash2 className="h-3 w-3" /> Eliminar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      <button onClick={addRow}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-white/20 text-white/40 text-[12px] hover:border-[#c0392b] hover:text-[#ff6b6b] transition-colors mt-3">
        <Plus className="h-3.5 w-3.5" /> Nuevo item
      </button>
    </div>
  );
}

// ── Timeline / Gantt Editor ─────────────────────────────

export interface TimelineRow {
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  progress: number;
}

interface TimelineEditorProps {
  rows: TimelineRow[];
  onChange: (rows: TimelineRow[]) => void;
}

export function TimelineEditor({ rows, onChange }: TimelineEditorProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const updateRow = (idx: number, field: keyof TimelineRow, val: string | number) => {
    const next = [...rows];
    (next[idx] as any)[field] = val;
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, { name: "Nueva fase", startDate: "", endDate: "", status: "en-progreso", progress: 0 }]);
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const statusColors: Record<string, string> = {
    "completado": "bg-emerald-500/20 text-emerald-400",
    "en-progreso": "bg-amber-500/20 text-amber-400",
    "pendiente": "bg-white/10 text-white/40",
  };

  return (
    <div className="space-y-1">
      {rows.map((row, i) => (
        <div key={i} onClick={() => setSelectedRow(i === selectedRow ? null : i)}
          className={cn("rounded-lg border transition-all cursor-pointer",
            selectedRow === i ? "border-[#c0392b] bg-[#c0392b]/10" : "border-white/5 hover:border-white/20 bg-white/5")}>
          <div className="flex items-center gap-2 px-3 py-2">
            <GripVertical className="h-3.5 w-3.5 text-white/20 shrink-0" />
            <p className="flex-1 text-[13px] text-white/90 truncate">{row.name}</p>
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", statusColors[row.status] || statusColors["pendiente"])}>
              {row.progress}%
            </span>
          </div>
          <AnimatePresence>
            {selectedRow === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Nombre</label>
                    <input value={row.name} onChange={e => updateRow(i, "name", e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Inicio</label>
                      <input type="date" value={row.startDate} onChange={e => updateRow(i, "startDate", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Fin</label>
                      <input type="date" value={row.endDate} onChange={e => updateRow(i, "endDate", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Estado</label>
                      <select value={row.status} onChange={e => updateRow(i, "status", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]">
                        <option value="completado" className="bg-[#1a1a2e]">Completado</option>
                        <option value="en-progreso" className="bg-[#1a1a2e]">En progreso</option>
                        <option value="pendiente" className="bg-[#1a1a2e]">Pendiente</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Progreso %</label>
                      <input type="number" min={0} max={100} value={row.progress} onChange={e => updateRow(i, "progress", parseInt(e.target.value) || 0)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={(e) => { e.stopPropagation(); addRow(); }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[#c0392b]/20 text-[#ff6b6b] text-[11px] font-medium hover:bg-[#c0392b]/30 transition-colors">
                      <Plus className="h-3 w-3" /> Agregar fase
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeRow(i); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 text-[11px] hover:bg-red-500/20 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      <button onClick={addRow}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-white/20 text-white/40 text-[12px] hover:border-[#c0392b] hover:text-[#ff6b6b] transition-colors mt-3">
        <Plus className="h-3.5 w-3.5" /> Nueva fase
      </button>
    </div>
  );
}

// ── Activity / Avance Editor ────────────────────────────

export interface ActivityEditorItem {
  label: string;
  progress: number;
  status: "completed" | "in-progress" | "pending";
  group: string;
}

interface ActivityEditorProps {
  items: ActivityEditorItem[];
  onChange: (items: ActivityEditorItem[]) => void;
}

export function ActivityEditor({ items, onChange }: ActivityEditorProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const updateItem = (idx: number, field: keyof ActivityEditorItem, val: string | number) => {
    const next = [...items];
    (next[idx] as any)[field] = val;
    onChange(next);
  };

  const addItem = () => {
    const lastGroup = items.length > 0 ? items[items.length - 1].group : "EJECUCIÓN";
    onChange([...items, { label: "Nueva actividad", progress: 0, status: "pending", group: lastGroup }]);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const statusColors: Record<string, string> = {
    "completed": "bg-emerald-500/20 text-emerald-400",
    "in-progress": "bg-amber-500/20 text-amber-400",
    "pending": "bg-white/10 text-white/40",
  };

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} onClick={() => setSelectedRow(i === selectedRow ? null : i)}
          className={cn("rounded-lg border transition-all cursor-pointer",
            selectedRow === i ? "border-[#c0392b] bg-[#c0392b]/10" : "border-white/5 hover:border-white/20 bg-white/5")}>
          <div className="flex items-center gap-2 px-3 py-2">
            <GripVertical className="h-3.5 w-3.5 text-white/20 shrink-0" />
            <p className="flex-1 text-[13px] text-white/90 truncate">{item.label}</p>
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", statusColors[item.status])}>
              {item.progress}%
            </span>
          </div>
          <AnimatePresence>
            {selectedRow === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Actividad</label>
                    <input value={item.label} onChange={e => updateItem(i, "label", e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Grupo</label>
                    <input value={item.group} onChange={e => updateItem(i, "group", e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Progreso %</label>
                      <input type="number" min={0} max={100} value={item.progress} onChange={e => updateItem(i, "progress", parseInt(e.target.value) || 0)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Estado</label>
                      <select value={item.status} onChange={e => updateItem(i, "status", e.target.value as any)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]">
                        <option value="completed" className="bg-[#1a1a2e]">Completado</option>
                        <option value="in-progress" className="bg-[#1a1a2e]">En progreso</option>
                        <option value="pending" className="bg-[#1a1a2e]">Pendiente</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={(e) => { e.stopPropagation(); addItem(); }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[#c0392b]/20 text-[#ff6b6b] text-[11px] font-medium hover:bg-[#c0392b]/30 transition-colors">
                      <Plus className="h-3 w-3" /> Agregar
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeItem(i); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 text-[11px] hover:bg-red-500/20 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      <button onClick={addItem}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-white/20 text-white/40 text-[12px] hover:border-[#c0392b] hover:text-[#ff6b6b] transition-colors mt-3">
        <Plus className="h-3.5 w-3.5" /> Nueva actividad
      </button>
    </div>
  );
}

// ── Entregables Editor ──────────────────────────────────

export interface EntregableRow {
  id: string;
  name: string;
  date: string;
  status: string;
}

interface EntregablesEditorProps {
  rows: EntregableRow[];
  onChange: (rows: EntregableRow[]) => void;
}

export function EntregablesEditor({ rows, onChange }: EntregablesEditorProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const updateRow = (idx: number, field: keyof EntregableRow, val: string) => {
    const next = [...rows];
    (next[idx] as any)[field] = val;
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, { id: `E-${rows.length + 1}`, name: "Nuevo entregable", date: "", status: "pendiente" }]);
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const statusColors: Record<string, string> = {
    "aprobado": "bg-emerald-500/20 text-emerald-400",
    "entregado": "bg-blue-500/20 text-blue-400",
    "en-revision": "bg-amber-500/20 text-amber-400",
    "pendiente": "bg-white/10 text-white/40",
  };

  return (
    <div className="space-y-1">
      {rows.map((row, i) => (
        <div key={i} onClick={() => setSelectedRow(i === selectedRow ? null : i)}
          className={cn("rounded-lg border transition-all cursor-pointer",
            selectedRow === i ? "border-[#c0392b] bg-[#c0392b]/10" : "border-white/5 hover:border-white/20 bg-white/5")}>
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-[11px] text-white/30 font-mono w-12">{row.id}</span>
            <p className="flex-1 text-[13px] text-white/90 truncate">{row.name}</p>
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize", statusColors[row.status] || statusColors["pendiente"])}>
              {row.status}
            </span>
          </div>
          <AnimatePresence>
            {selectedRow === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">ID</label>
                      <input value={row.id} onChange={e => updateRow(i, "id", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Nombre</label>
                      <input value={row.name} onChange={e => updateRow(i, "name", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Fecha</label>
                      <input value={row.date} onChange={e => updateRow(i, "date", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Estado</label>
                      <select value={row.status} onChange={e => updateRow(i, "status", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]">
                        <option value="aprobado" className="bg-[#1a1a2e]">Aprobado</option>
                        <option value="entregado" className="bg-[#1a1a2e]">Entregado</option>
                        <option value="en-revision" className="bg-[#1a1a2e]">En Revisión</option>
                        <option value="pendiente" className="bg-[#1a1a2e]">Pendiente</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeRow(i); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 text-[11px] hover:bg-red-500/20 transition-colors">
                    <Trash2 className="h-3 w-3" /> Eliminar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      <button onClick={addRow}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-white/20 text-white/40 text-[12px] hover:border-[#c0392b] hover:text-[#ff6b6b] transition-colors mt-3">
        <Plus className="h-3.5 w-3.5" /> Nuevo entregable
      </button>
    </div>
  );
}

// ── Riesgos Editor ──────────────────────────────────────

export interface RiesgoRow {
  id: string;
  description: string;
  impact: string;
  status: string;
  mitigation: string;
}

interface RiesgosEditorProps {
  rows: RiesgoRow[];
  onChange: (rows: RiesgoRow[]) => void;
}

export function RiesgosEditor({ rows, onChange }: RiesgosEditorProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const updateRow = (idx: number, field: keyof RiesgoRow, val: string) => {
    const next = [...rows];
    (next[idx] as any)[field] = val;
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, { id: `R-${rows.length + 1}`, description: "Nuevo riesgo", impact: "medio", status: "abierto", mitigation: "" }]);
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const impactColors: Record<string, string> = {
    "alto": "bg-red-500/20 text-red-400",
    "medio": "bg-amber-500/20 text-amber-400",
    "bajo": "bg-emerald-500/20 text-emerald-400",
  };

  return (
    <div className="space-y-1">
      {rows.map((row, i) => (
        <div key={i} onClick={() => setSelectedRow(i === selectedRow ? null : i)}
          className={cn("rounded-lg border transition-all cursor-pointer",
            selectedRow === i ? "border-[#c0392b] bg-[#c0392b]/10" : "border-white/5 hover:border-white/20 bg-white/5")}>
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-[11px] text-white/30 font-mono w-10">{row.id}</span>
            <p className="flex-1 text-[13px] text-white/90 truncate">{row.description}</p>
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize", impactColors[row.impact] || impactColors["medio"])}>
              {row.impact}
            </span>
          </div>
          <AnimatePresence>
            {selectedRow === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Descripción</label>
                    <textarea value={row.description} onChange={e => updateRow(i, "description", e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b] resize-none" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Impacto</label>
                      <select value={row.impact} onChange={e => updateRow(i, "impact", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]">
                        <option value="alto" className="bg-[#1a1a2e]">Alto</option>
                        <option value="medio" className="bg-[#1a1a2e]">Medio</option>
                        <option value="bajo" className="bg-[#1a1a2e]">Bajo</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Estado</label>
                      <select value={row.status} onChange={e => updateRow(i, "status", e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b]">
                        <option value="abierto" className="bg-[#1a1a2e]">Abierto</option>
                        <option value="mitigado" className="bg-[#1a1a2e]">Mitigado</option>
                        <option value="cerrado" className="bg-[#1a1a2e]">Cerrado</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">Mitigación</label>
                    <textarea value={row.mitigation} onChange={e => updateRow(i, "mitigation", e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-[#c0392b] resize-none" rows={2} />
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeRow(i); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 text-[11px] hover:bg-red-500/20 transition-colors">
                    <Trash2 className="h-3 w-3" /> Eliminar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      <button onClick={addRow}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-white/20 text-white/40 text-[12px] hover:border-[#c0392b] hover:text-[#ff6b6b] transition-colors mt-3">
        <Plus className="h-3.5 w-3.5" /> Nuevo riesgo
      </button>
    </div>
  );
}
