import jsPDF from "jspdf";
import { type Client } from "@/data/projectData";

const STATUS_LABELS: Record<string, string> = {
  activo: "Activo",
  "en-riesgo": "En Riesgo",
  completado: "Completado",
  pausado: "Pausado",
};

const PHASE_STATUS: Record<string, string> = {
  completado: "Completado",
  "en-progreso": "En Progreso",
  "por-iniciar": "Por Iniciar",
  pendiente: "Pendiente",
};

const TASK_STATUS: Record<string, string> = {
  completada: "Completada",
  "en-progreso": "En Progreso",
  bloqueada: "Bloqueada",
  pendiente: "Pendiente",
};

const DELIVERABLE_STATUS: Record<string, string> = {
  aprobado: "Aprobado",
  entregado: "Entregado",
  "en-revision": "En Revisión",
  pendiente: "Pendiente",
};

export function exportClientPdf(client: Client) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const addPage = () => {
    doc.addPage();
    y = margin;
  };

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      addPage();
    }
  };

  // ── Header ──
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageW, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("SYSDE — Gestión de Implementaciones", margin, 15);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Reporte de Cliente: ${client.name}`, margin, 23);
  doc.setFontSize(8);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-CR")}`, margin, 30);
  y = 45;

  // ── Info del cliente ──
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Información General", margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const info = [
    ["País", client.country],
    ["Industria", client.industry],
    ["Contacto", `${client.contactName} (${client.contactEmail})`],
    ["Estado", STATUS_LABELS[client.status] || client.status],
    ["Contrato", `${client.contractStart} → ${client.contractEnd}`],
    ["Progreso", `${client.progress}%`],
  ];
  info.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, margin + 30, y);
    y += 5;
  });
  y += 5;

  // ── Fases ──
  checkPage(30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Fases del Proyecto", margin, y);
  y += 8;

  client.phases.forEach((phase) => {
    checkPage(12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(phase.name, margin, y);
    doc.setFont("helvetica", "normal");
    const statusLabel = PHASE_STATUS[phase.status] || phase.status;
    doc.text(`${statusLabel} — ${phase.progress}%`, margin + 70, y);
    doc.text(`${phase.startDate} → ${phase.endDate}`, margin + 115, y);

    y += 3;
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, y, contentW * 0.5, 2, "F");
    doc.setFillColor(220, 38, 38);
    doc.rect(margin, y, contentW * 0.5 * (phase.progress / 100), 2, "F");
    y += 7;
  });
  y += 3;

  // ── Entregables ──
  checkPage(30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Entregables", margin, y);
  y += 8;

  doc.setFontSize(8);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 4, contentW, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.text("Entregable", margin + 2, y);
  doc.text("Estado", margin + 80, y);
  doc.text("Fecha Límite", margin + 110, y);
  doc.text("Versión", margin + 145, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  client.deliverables.forEach((d) => {
    checkPage(6);
    doc.text(d.name.substring(0, 45), margin + 2, y);
    doc.text(DELIVERABLE_STATUS[d.status] || d.status, margin + 80, y);
    doc.text(d.dueDate, margin + 110, y);
    doc.text(`v${d.version}`, margin + 145, y);
    y += 5;
  });
  y += 5;

  // ── Tareas ──
  checkPage(30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Tareas", margin, y);
  y += 8;

  if (client.tasks.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("No hay tareas registradas.", margin, y);
    y += 8;
  } else {
    doc.setFontSize(8);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, contentW, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Tarea", margin + 2, y);
    doc.text("Estado", margin + 80, y);
    doc.text("Responsable", margin + 110, y);
    doc.text("Fecha", margin + 145, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    client.tasks.forEach((t) => {
      checkPage(6);
      doc.text(t.title.substring(0, 45), margin + 2, y);
      doc.text(TASK_STATUS[t.status] || t.status, margin + 80, y);
      doc.text(t.owner, margin + 110, y);
      doc.text(t.dueDate, margin + 145, y);
      y += 5;
    });
    y += 5;
  }

  // ── Riesgos ──
  checkPage(30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Riesgos", margin, y);
  y += 8;

  if (client.risks.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("Sin riesgos identificados.", margin, y);
  } else {
    client.risks.forEach((r) => {
      checkPage(15);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const impactColor = r.impact === "alto" ? [220, 38, 38] : r.impact === "medio" ? [234, 179, 8] : [107, 114, 128];
      doc.setTextColor(impactColor[0], impactColor[1], impactColor[2]);
      doc.text(`[${r.impact.toUpperCase()}]`, margin, y);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "normal");
      doc.text(r.description.substring(0, 80), margin + 18, y);
      y += 5;
      if (r.mitigation) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Mitigación: ${r.mitigation}`, margin + 18, y);
        doc.setTextColor(30, 30, 30);
        y += 5;
      }
      y += 2;
    });
  }

  // ── Footer on all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`SYSDE Gestión de Implementaciones — Reporte Confidencial`, margin, ph - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin - 25, ph - 8);
  }

  doc.save(`Reporte_${client.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}
