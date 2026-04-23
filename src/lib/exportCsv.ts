/**
 * Utilidad para generar y descargar archivos CSV.
 *
 * - Escapa correctamente valores con comas, comillas y saltos de línea
 * - Respeta codificación UTF-8 con BOM para que Excel abra tildes/ñ sin problemas
 * - Soporta columnas personalizadas con header custom + getter
 */

export interface CsvColumn<T> {
  key: string;          // identificador interno
  header: string;       // lo que se muestra en el CSV
  get: (row: T) => string | number | null | undefined;
}

/** Escapa un valor para CSV: si contiene , " \n → envuelve en comillas y duplica las comillas internas. */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Convierte un array de objetos a string CSV. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map(c => escapeCell(c.header)).join(",");
  const body = rows
    .map(row => columns.map(c => escapeCell(c.get(row))).join(","))
    .join("\n");
  return header + "\n" + body;
}

/** Dispara descarga del archivo en el navegador. */
export function downloadCsv(filename: string, content: string): void {
  // BOM UTF-8 para que Excel respete tildes
  const bom = "\uFEFF";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convierte un Date o ISO string a formato `YYYY-MM-DD HH:mm` para CSV. */
export function csvDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Slug-safe filename a partir de un string arbitrario. */
export function safeFilename(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
