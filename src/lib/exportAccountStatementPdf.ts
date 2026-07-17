import jsPDF from "jspdf";
import type { AccountStatement } from "@/hooks/useAccountStatement";
import sysdelogo from "@/assets/logo-sysde.png";

/* ── Datos precalculados por AccountStatementDetail ──────────────────────── */
export interface SysdePackageRow {
  policy_number: number;
  package_number: number;
  hours_contracted: number;
  consumed: number;
  balance: number;
  start_date: string;
  end_date: string;
  estado: string;
}
export interface SysdeSolicitudRow {
  ticket_code: string;
  package_number: number | null;
  producto: string;
  consecutivo_cliente: number | null;
  asunto: string;
  fecha_registro: string | null;
  tipo: string;
  hours: number;
}
export interface SysdeExportData {
  packages: SysdePackageRow[];
  solicitudes: SysdeSolicitudRow[];
  totals: {
    contracted: number;
    consumed: number;
    balance: number;
    saldoActivas: number;
    expiradas?: number;
    invertido: number;
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const RED: [number, number, number] = [139, 30, 30]; // #8B1E1E
const n2 = (v: number) =>
  Number(v || 0).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};

/** Carga el logo (asset de Vite) como dataURL para incrustarlo en el PDF. */
async function loadLogo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(sysdelogo);
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = data;
    });
    return { data, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

interface Col {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
  wrap?: boolean;
}

/* ── Generador principal ─────────────────────────────────────────────────── */
export async function exportAccountStatementPdf(stmt: AccountStatement, data: SysdeExportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  let y = margin;

  const footerH = 18;
  const ensure = (needed: number) => {
    if (y + needed > pageH - footerH) {
      doc.addPage();
      y = margin;
    }
  };

  /* Tabla genérica con encabezado rojo, ajuste de línea y salto de página. */
  const drawTable = (
    title: string,
    cols: Col[],
    rows: string[][],
    opts?: { boldRows?: Set<number>; redText?: Set<number> },
  ) => {
    const totalW = cols.reduce((s, c) => s + c.width, 0);
    const scale = contentW / totalW;
    const w = cols.map((c) => c.width * scale);
    const x0 = margin;

    // Título de la sección (banda con borde rojo)
    ensure(16);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0);
    const titleH = 6;
    doc.rect(x0, y, contentW, titleH);
    doc.text(title, x0 + contentW / 2, y + 4.2, { align: "center" });
    y += titleH;

    // Encabezado de columnas (fondo rojo, texto blanco)
    const drawHeader = () => {
      const rowH = 8;
      doc.setFillColor(...RED);
      doc.rect(x0, y, contentW, rowH, "F");
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      let cx = x0;
      cols.forEach((c, i) => {
        const lines = doc.splitTextToSize(c.header, w[i] - 2);
        const ty = y + rowH / 2 - (lines.length - 1) * 1.3 + 1.2;
        doc.text(lines, cx + w[i] / 2, ty, { align: "center" });
        cx += w[i];
      });
      // líneas verticales del header
      doc.setDrawColor(255);
      doc.setLineWidth(0.1);
      let vx = x0;
      for (let i = 0; i < cols.length; i++) {
        doc.line(vx, y, vx, y + rowH);
        vx += w[i];
      }
      doc.line(vx, y, vx, y + rowH);
      y += rowH;
    };
    drawHeader();

    // Filas
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    rows.forEach((cells, ri) => {
      const isBold = opts?.boldRows?.has(ri);
      const isRed = opts?.redText?.has(ri);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      // altura por wrap
      const wrapped = cells.map((cell, i) =>
        cols[i].wrap ? doc.splitTextToSize(cell || "", w[i] - 2) : [cell || ""],
      );
      const maxLines = Math.max(1, ...wrapped.map((l) => l.length));
      const rowH = Math.max(5.5, maxLines * 3 + 1.5);

      if (y + rowH > pageH - footerH) {
        doc.addPage();
        y = margin;
        drawHeader();
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setFontSize(6.8);
      }

      // fondo tenue para totales
      if (isBold) {
        doc.setFillColor(245, 235, 235);
        doc.rect(x0, y, contentW, rowH, "F");
      }

      if (isRed) doc.setTextColor(...RED);
      else doc.setTextColor(0, 0, 0);
      let cx = x0;
      cols.forEach((c, i) => {
        const lines = wrapped[i];
        const tx = c.align === "right" ? cx + w[i] - 1.5 : c.align === "center" ? cx + w[i] / 2 : cx + 1.5;
        const ty = y + 3.3;
        doc.text(lines, tx, ty, { align: c.align ?? "left" });
        cx += w[i];
      });

      // bordes de celda
      doc.setDrawColor(210);
      doc.setLineWidth(0.1);
      let vx = x0;
      for (let i = 0; i < cols.length; i++) {
        doc.line(vx, y, vx, y + rowH);
        vx += w[i];
      }
      doc.line(vx, y, vx, y + rowH);
      doc.line(x0, y + rowH, x0 + contentW, y + rowH);
      y += rowH;
    });
    doc.setTextColor(0);
  };

  /* ── Encabezado con logo ── */
  const logo = await loadLogo();
  if (logo && logo.w > 0) {
    const logoH = 12;
    const logoW = (logo.w / logo.h) * logoH;
    doc.addImage(logo.data, "PNG", margin, y, logoW, logoH);
  }
  // franja roja a la derecha
  doc.setFillColor(...RED);
  doc.rect(pageW - margin - 8, y, 8, 14, "F");
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.text("ESTADO DE CUENTA", margin, y);
  y += 9;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Estimado cliente: ", margin, y);
  const w1 = doc.getTextWidth("Estimado cliente: ");
  doc.setTextColor(...RED);
  doc.text(stmt.client.name, margin + w1, y);
  doc.setTextColor(0);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Estado de cuenta para el periodo definido entre las siguientes fechas:", margin, y);
  doc.setFont("helvetica", "bold");
  doc.text(`${fmtDate(stmt.period.start)}   ${fmtDate(stmt.period.end)}`, pageW - margin, y, { align: "right" });
  y += 8;

  /* ── Tabla: Paquetes de servicio ── */
  const pkgCols: Col[] = [
    { header: "Póliza", width: 14, align: "center" },
    { header: "Paquete Servicio", width: 20, align: "center" },
    { header: "Horas contratadas", width: 18, align: "right" },
    { header: "Horas consumidas", width: 18, align: "right" },
    { header: "Saldo horas póliza", width: 18, align: "right" },
    { header: "Fecha inicial", width: 16, align: "center" },
    { header: "Fecha vencimiento", width: 18, align: "center" },
    { header: "Estado", width: 14, align: "center" },
  ];
  const pkgRows: string[][] = data.packages.map((p) => [
    String(p.policy_number),
    String(p.package_number),
    n2(p.hours_contracted),
    n2(p.consumed),
    n2(p.balance),
    fmtDate(p.start_date),
    fmtDate(p.end_date),
    p.estado,
  ]);
  if (pkgRows.length === 0) {
    pkgRows.push(["—", "—", "0.00", "0.00", "0.00", "—", "—", "—"]);
  }
  const totalRowIdx = pkgRows.length;
  pkgRows.push([
    "TOTALES",
    "",
    n2(data.totals.contracted),
    n2(data.totals.consumed),
    n2(data.totals.balance),
    "",
    "",
    "",
  ]);
  drawTable("Paquetes de servicio", pkgCols, pkgRows, {
    boldRows: new Set([totalRowIdx]),
    redText: new Set([totalRowIdx]),
  });

  // Banda TOTAL SALDO HORAS ACTIVAS
  ensure(9);
  const bandH = 7;
  doc.setFillColor(...RED);
  doc.rect(margin, y, contentW - 34, bandH, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TOTAL SALDO HORAS ACTIVAS:", margin + 2, y + 4.7);
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.3);
  doc.rect(margin + contentW - 34, y, 34, bandH);
  doc.setTextColor(0);
  doc.text(n2(data.totals.saldoActivas), margin + contentW - 2, y + 4.7, { align: "right" });
  y += bandH + 4;

  /* ── Horas vencidas sin utilizar (explica el saldo total vs. activo) ── */
  const expiradas = Number(data.totals.expiradas || 0);
  if (expiradas > 0.001) {
    ensure(7);
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW - 34, 6);
    doc.setTextColor(120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("Horas vencidas sin utilizar (no aplicables):", margin + 2, y + 4);
    doc.rect(margin + contentW - 34, y, 34, 6);
    doc.text(n2(expiradas), margin + contentW - 2, y + 4, { align: "right" });
    y += 6 + 4;
  } else {
    y += 2;
  }

  /* ── Exceso de horas (facturable) — captura de ingreso ── */
  const excess = data.packages.reduce((s, p) => s + Math.max(0, -Number(p.balance || 0)), 0);
  if (excess > 0.001) {
    ensure(16);
    doc.setFillColor(255, 243, 243);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, contentW, 13, "FD");
    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`Horas consumidas por encima de lo contratado: ${n2(excess)} h`, margin + 3, y + 5);
    doc.setTextColor(70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.text(
      "Este excedente está sujeto a facturación adicional o a la ampliación de su bolsa de horas. Le invitamos a regularizarlo con su ejecutivo SYSDE.",
      margin + 3, y + 9.5, { maxWidth: contentW - 6 },
    );
    y += 13 + 5;
  }

  /* ── Renovación de póliza — call to action de continuidad ── */
  const activos = data.packages.filter((p) => p.estado === "Activo" && p.end_date);
  const nextExpiry = activos.length ? activos.map((p) => p.end_date).sort()[0] : null;
  if (nextExpiry) {
    const rem = Math.max(0, Number(data.totals.saldoActivas || 0));
    ensure(16);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentW, 13);
    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Renovación de póliza", margin + 3, y + 5);
    doc.setTextColor(70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    const renewMsg = rem <= 0.001
      ? `Su póliza vigente (vence el ${fmtDate(nextExpiry)}) ya no tiene horas disponibles. Le recomendamos renovar o ampliar su bolsa de horas para asegurar la continuidad del servicio.`
      : `Su póliza vigente vence el ${fmtDate(nextExpiry)} con un saldo activo de ${n2(rem)} h. Le recomendamos renovar antes del vencimiento para asegurar la continuidad del servicio.`;
    doc.text(renewMsg, margin + 3, y + 9.5, { maxWidth: contentW - 6 });
    y += 13 + 6;
  }

  /* ── Tabla: Solicitudes de servicio ── */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(0);
  ensure(8);
  doc.text("Estado cuenta definido con el siguiente detalle de consumo:", margin, y);
  y += 5;

  const solCols: Col[] = [
    { header: "Id", width: 14, align: "center" },
    { header: "Paquete Servicio", width: 14, align: "center" },
    { header: "Producto", width: 20, align: "left", wrap: true },
    { header: "Cons. cliente", width: 12, align: "center" },
    { header: "Asunto", width: 40, align: "left", wrap: true },
    { header: "Fecha registro", width: 15, align: "center" },
    { header: "Tipo", width: 14, align: "left", wrap: true },
    { header: "Medio descuento", width: 14, align: "center" },
    { header: "Tiempo invertido", width: 14, align: "right" },
  ];
  const solRows: string[][] = data.solicitudes.map((r) => [
    r.ticket_code,
    r.package_number != null ? String(r.package_number) : "—",
    r.producto || "—",
    r.consecutivo_cliente != null ? String(r.consecutivo_cliente) : "—",
    r.asunto || "—",
    fmtDate(r.fecha_registro),
    r.tipo || "—",
    "Póliza",
    n2(r.hours),
  ]);
  if (solRows.length === 0) {
    solRows.push(["—", "—", "—", "—", "Sin consumo registrado en el período", "—", "—", "—", "0.00"]);
    drawTable("Solicitudes de servicio", solCols, solRows);
  } else {
    const totalIdx = solRows.length;
    solRows.push(["", "", "", "", "", "", "", "TOTAL TIEMPO INVERTIDO", n2(data.totals.invertido)]);
    drawTable("Solicitudes de servicio", solCols, solRows, {
      boldRows: new Set([totalIdx]),
      redText: new Set([totalIdx]),
    });
  }

  /* ── Pie SYSDE en todas las páginas ── */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - footerH + 2, pageW - margin, pageH - footerH + 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...RED);
    doc.text("SYSDE", margin, pageH - footerH + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(90);
    doc.text("MetroPark Free Zone, P.O. box: 12133-1000", margin, pageH - footerH + 11);
    doc.text("Costa Rica. Tel.: (506) 2293-2864. Fax: (506) 2293-2812", margin, pageH - footerH + 14);
    doc.text(
      new Date(stmt.generated_at).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      pageW - margin,
      pageH - footerH + 11,
      { align: "right" },
    );
    doc.text(`Página ${p} de ${pages}`, pageW - margin, pageH - footerH + 14, { align: "right" });
  }
  doc.setTextColor(0);

  const fname = `estado-cuenta_${stmt.client.name.replace(/\s+/g, "-")}_${stmt.period.start}_${stmt.period.end}.pdf`;
  doc.save(fname);
}
