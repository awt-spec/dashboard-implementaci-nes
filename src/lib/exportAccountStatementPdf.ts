import jsPDF from "jspdf";
import type { AccountStatement } from "@/hooks/useAccountStatement";

const fmtNum = (n: number, decimals = 2) => Number(n).toFixed(decimals);
const fmtMoney = (n: number, currency: string) => `${fmtNum(n, 2)} ${currency}`;

export function exportAccountStatementPdf(stmt: AccountStatement) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  const checkPage = (needed = 10) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Estado de Cuenta", margin, y);
  y += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(stmt.client.name, margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Período: ${stmt.period.start} → ${stmt.period.end}  ·  Generado: ${stmt.generated_at.slice(0, 10)}`,
    margin, y,
  );
  doc.setTextColor(0);
  y += 8;

  // Contract block
  if (stmt.contract) {
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Contrato activo", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Tipo: ${stmt.contract.contract_type}`, margin, y);
    doc.text(`Bolsa: ${stmt.contract.included_hours} h/mes`, margin + 60, y);
    doc.text(`Tarifa: ${fmtMoney(stmt.contract.hourly_rate, stmt.currency)}/h`, margin + 120, y);
    y += 5;
    doc.text(`Valor mensual: ${fmtMoney(stmt.contract.monthly_value, stmt.currency)}`, margin, y);
    if (stmt.contract.start_date) {
      doc.text(`Vigente desde: ${stmt.contract.start_date}`, margin + 60, y);
    }
    y += 8;
  }

  // Consumption summary
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Consumo del período", margin, y);
  y += 6;
  doc.setFontSize(20);
  doc.setTextColor(200, 32, 15);
  doc.text(fmtNum(stmt.consumption.total_hours, 1), margin, y);
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.text(" horas trabajadas", margin + 25, y);
  y += 6;

  if (stmt.consumption.included_hours > 0) {
    doc.setFontSize(9);
    doc.setTextColor(80);
    const remaining = stmt.consumption.included_hours - stmt.consumption.total_hours;
    if (remaining >= 0) {
      doc.text(
        `Saldo: ${fmtNum(remaining, 1)} h restantes de ${stmt.consumption.included_hours} h contratadas (${stmt.consumption.utilization_pct ?? 0}% utilización)`,
        margin, y,
      );
    } else {
      doc.setTextColor(200, 32, 15);
      doc.text(
        `Sobreconsumo: ${fmtNum(stmt.consumption.overage_hours, 1)} h sobre la bolsa de ${stmt.consumption.included_hours} h`,
        margin, y,
      );
      doc.setTextColor(80);
    }
    doc.setTextColor(0);
    y += 6;
  }

  // Por colaborador
  if (stmt.consumption.by_user.length > 0) {
    checkPage(20);
    y += 4;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Desglose por colaborador", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    // Tabla simple
    doc.setDrawColor(220);
    doc.line(margin, y + 1, pageW - margin, y + 1);
    doc.text("Colaborador", margin + 1, y);
    doc.text("Entradas", pageW - margin - 40, y);
    doc.text("Horas", pageW - margin - 15, y, { align: "right" });
    y += 5;
    for (const u of stmt.consumption.by_user) {
      checkPage(6);
      doc.text(u.user_name.substring(0, 50), margin + 1, y);
      doc.text(String(u.entries_count), pageW - margin - 40, y);
      doc.text(fmtNum(u.hours, 2), pageW - margin - 1, y, { align: "right" });
      y += 5;
    }
    y += 3;
  }

  // Por ticket/tarea (max 15)
  if (stmt.consumption.by_item.length > 0) {
    checkPage(20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Desglose por ticket/tarea (top 15)", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setDrawColor(220);
    doc.line(margin, y + 1, pageW - margin, y + 1);
    doc.text("Item", margin + 1, y);
    doc.text("Horas", pageW - margin - 1, y, { align: "right" });
    y += 5;
    for (const it of stmt.consumption.by_item.slice(0, 15)) {
      checkPage(6);
      const label = it.ticket_info
        ? `${it.ticket_info.ticket_id} — ${it.ticket_info.asunto}`
        : `${it.source}: ${it.item_id}`;
      doc.text(label.substring(0, 80), margin + 1, y);
      doc.text(fmtNum(it.hours, 2), pageW - margin - 1, y, { align: "right" });
      y += 5;
    }
    y += 3;
  }

  // Cotizaciones aprobadas
  if (stmt.quotes.approved_in_period.length > 0) {
    checkPage(20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Cotizaciones aprobadas en el período", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setDrawColor(220);
    doc.line(margin, y + 1, pageW - margin, y + 1);
    doc.text("Número", margin + 1, y);
    doc.text("Concepto", margin + 35, y);
    doc.text("Monto", pageW - margin - 1, y, { align: "right" });
    y += 5;
    for (const q of stmt.quotes.approved_in_period) {
      checkPage(6);
      doc.text(q.quote_number, margin + 1, y);
      doc.text((q.title || "").substring(0, 60), margin + 35, y);
      doc.text(fmtMoney(q.total_amount, q.currency), pageW - margin - 1, y, { align: "right" });
      y += 5;
    }
    const totalApproved = stmt.quotes.approved_in_period.reduce((s, q) => s + Number(q.total_amount), 0);
    doc.setFont("helvetica", "bold");
    doc.text(`Total aprobado en el período: ${fmtMoney(totalApproved, stmt.currency)}`, pageW - margin - 1, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 8;
  }

  if (stmt.quotes.pending_count > 0) {
    checkPage(10);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    doc.text(
      `Hay ${stmt.quotes.pending_count} cotizaciones pendientes de aprobación por un total de ${fmtMoney(stmt.quotes.pending_total, stmt.currency)}.`,
      margin, y,
    );
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    y += 6;
  }

  // Financials
  if (stmt.financials) {
    checkPage(30);
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Estado financiero", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Valor del contrato: ${fmtMoney(stmt.financials.contract_value, stmt.currency)}`, margin, y);
    y += 5;
    doc.text(`Facturado: ${fmtMoney(stmt.financials.billed, stmt.currency)}`, margin, y);
    y += 5;
    doc.text(`Pagado: ${fmtMoney(stmt.financials.paid, stmt.currency)}`, margin, y);
    y += 5;
    doc.text(`Pendiente: ${fmtMoney(stmt.financials.pending, stmt.currency)}`, margin, y);
    y += 8;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    `Generado por SYSDE ERP el ${new Date().toLocaleString()}`,
    margin, pageH - 8,
  );
  doc.setTextColor(0);

  // Save
  const fname = `estado-cuenta_${stmt.client.name.replace(/\s+/g, "-")}_${stmt.period.start}_${stmt.period.end}.pdf`;
  doc.save(fname);
}
