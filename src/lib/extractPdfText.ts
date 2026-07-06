/**
 * Extrae texto de un PDF (vía pdfjs-dist) o de un archivo de texto plano.
 * Se usa tanto en el análisis IA de contratos como en la ingesta a la KB.
 * La extracción ocurre en el cliente; al backend solo viaja el texto.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs" as any);
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(" ") + "\n";
    }
    return text;
  }
  return await file.text();
}
