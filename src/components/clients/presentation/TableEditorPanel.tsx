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
