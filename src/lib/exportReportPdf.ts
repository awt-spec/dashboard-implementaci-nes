import jsPDF from "jspdf";
import { type Client } from "@/data/projectData";
import type { ReportSection } from "@/components/dashboard/ShareReportDialog";

interface ExportOptions {
  mode: "resumen" | "cliente";
  sections: ReportSection[];
  client?: Client;
  clients?: Client[];
}

export function exportReportPdf({ mode, sections, client, clients = [] }: ExportOptions) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("SYSDE — Reporte Ejecutivo", margin, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const subtitle = mode === "cliente" && client ? `Cliente: ${client.name}` : "Resumen Consolidado";
  doc.text(subtitle, margin, 20);
  doc.setFontSize(7);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-CR")}`, margin, 26);
  y = 38;

  doc.setTextColor(30, 30, 30);

  if (mode === "resumen") {
    exportResumenSections(doc, sections, margin, contentW, y, checkPage);
  } else if (client) {
    exportClientSections(doc, sections, client, margin, contentW, y, checkPage);
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("SYSDE — Reporte Confidencial", margin, ph - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin - 25, ph - 8);
  }

  const filename = mode === "cliente" && client
    ? `Reporte_${client.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`
    : `Reporte_Ejecutivo_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}

function exportResumenSections(doc: jsPDF, sections: ReportSection[], margin: number, contentW: number, startY: number, checkPage: (n: number) => void) {
  let y = startY;

  if (sections.includes("kpis")) {
    checkPage(30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("KPIs Principales", margin, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const avgProgress = Math.round(clients.reduce((s, c) => s + c.progress, 0) / clients.length);
    const totalRisks = clients.reduce((s, c) => s + c.risks.filter(r => r.status === "abierto").length, 0);
    const allTasks = clients.flatMap(c => c.tasks);

    const kpis = [
      `Clientes Activos: ${clients.filter(c => c.status === "activo").length}`,
      `En Riesgo: ${clients.filter(c => c.status === "en-riesgo").length}`,
      `Progreso Promedio: ${avgProgress}%`,
      `Total Tareas: ${allTasks.length}`,
      `Tareas Completadas: ${allTasks.filter(t => t.status === "completada").length}`,
      `Riesgos Abiertos: ${totalRisks}`,
    ];
    kpis.forEach(k => { doc.text(`• ${k}`, margin + 2, y); y += 5; });
    y += 5;
  }

  if (sections.includes("alerts")) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Alertas Críticas", margin, y);
    y += 7;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    const alerts = clients.flatMap(c =>
      c.risks.filter(r => r.status === "abierto" && r.impact === "alto").map(r => ({ client: c.name, desc: r.description }))
    );
    alerts.forEach(a => {
      checkPage(10);
      doc.setFont("helvetica", "bold");
      doc.text(`[${a.client.substring(0, 20)}]`, margin + 2, y);
      doc.setFont("helvetica", "normal");
      doc.text(a.desc.substring(0, 70), margin + 45, y);
      y += 5;
    });
    y += 5;
  }

  if (sections.includes("progress-cards")) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Progreso por Cliente", margin, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    clients.forEach(c => {
      checkPage(8);
      doc.text(`${c.name.substring(0, 35)} — ${c.progress}% — ${c.status}`, margin + 2, y);
      y += 5;
    });
    y += 5;
  }
}

function exportClientSections(doc: jsPDF, sections: ReportSection[], client: Client, margin: number, contentW: number, startY: number, checkPage: (n: number) => void) {
  let y = startY;

  if (sections.includes("client-info")) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Información General", margin, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const info = [
      ["País", client.country], ["Industria", client.industry],
      ["Contacto", `${client.contactName} (${client.contactEmail})`],
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
  }

  if (sections.includes("client-phases")) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Fases", margin, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    client.phases.forEach(p => {
      checkPage(8);
      doc.text(`${p.name} — ${p.progress}% (${p.status})`, margin + 2, y);
      y += 5;
    });
    y += 5;
  }

  if (sections.includes("client-tasks")) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Tareas", margin, y);
    y += 7;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    client.tasks.forEach(t => {
      checkPage(6);
      doc.text(`[${t.priority.toUpperCase()}] ${t.title.substring(0, 65)} — ${t.owner}`, margin + 2, y);
      y += 5;
    });
    y += 5;
  }

  if (sections.includes("client-risks")) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Riesgos", margin, y);
    y += 7;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    client.risks.forEach(r => {
      checkPage(10);
      const color = r.impact === "alto" ? [220, 38, 38] : r.impact === "medio" ? [234, 179, 8] : [107, 114, 128];
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFont("helvetica", "bold");
      doc.text(`[${r.impact.toUpperCase()}]`, margin + 2, y);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "normal");
      doc.text(r.description.substring(0, 70), margin + 20, y);
      y += 5;
      if (r.mitigation) {
        doc.setFontSize(7);
        doc.text(`→ ${r.mitigation}`, margin + 20, y);
        doc.setFontSize(8);
        y += 5;
      }
    });
    y += 5;
  }

  if (sections.includes("client-deliverables")) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Entregables", margin, y);
    y += 7;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    client.deliverables.forEach(d => {
      checkPage(6);
      doc.text(`${d.name.substring(0, 50)} — ${d.status} — v${d.version}`, margin + 2, y);
      y += 5;
    });
  }
}
