// Detailed WBS data for AURUM cronograma slide (from PPTX)

export interface CronogramaRow {
  name: string;
  duration: string;
  percent: string;
  start: string;
  end: string;
  indent: number; // 0=project, 1=phase, 2=sub, 3=task
  isBold?: boolean;
  isItalic?: boolean;
  isRed?: boolean;
}

export const aurumCronogramaRows: CronogramaRow[] = [
  { name: "PROYECTO GRUPO AURUM — ETAPA 1: PRÉSTAMOS, ETAPA 2: ARRENDAMIENTO", duration: "472 días", percent: "51%", start: "28/8/24", end: "12/6/26", indent: 0, isBold: true, isRed: true },
  { name: "00 - Inicio", duration: "0.33 días", percent: "100%", start: "1/11/25", end: "3/11/25", indent: 1, isBold: true, isRed: true },
  { name: "01 - Planificación", duration: "64 días", percent: "100%", start: "20/11/25", end: "17/2/26", indent: 1, isBold: true, isRed: true },
  { name: "03 - Ejecución", duration: "419 días", percent: "51%", start: "28/8/24", end: "2/4/26", indent: 1, isBold: true, isRed: true },
  { name: "Infraestructura", duration: "60 días", percent: "99%", start: "2/12/25", end: "23/2/26", indent: 2, isBold: true },
  { name: "Instalación ambientes, registro licencias, instalación aplicativos", duration: "60 días", percent: "99%", start: "2/12/25", end: "23/2/26", indent: 3 },
  { name: "Servidores de aplicaciones, base de datos y API", duration: "10 días", percent: "100%", start: "2/12/25", end: "15/12/25", indent: 3 },
  { name: "Carga de licencias, certificado de seguridad, configuración accesos", duration: "2 días", percent: "100%", start: "16/12/25", end: "17/12/25", indent: 3 },
  { name: "Instalación base de datos SAF", duration: "8 días", percent: "100%", start: "11/12/25", end: "22/12/25", indent: 3 },
  { name: "Carga de catálogos base", duration: "26 días", percent: "100%", start: "23/12/25", end: "30/1/26", indent: 3 },
  { name: "Instalación servicios Windows y versión SAF 7.0", duration: "0 días", percent: "100%", start: "5/1/26", end: "5/1/26", indent: 3 },
  { name: "Configuración API 2.0 - Despliegue servicios Windows", duration: "4 días", percent: "100%", start: "12/1/26", end: "16/1/26", indent: 3 },
  { name: "Configuración de roles base y accesos generales", duration: "13.35 días", percent: "100%", start: "13/1/26", end: "30/1/26", indent: 3 },
  { name: "Configuración usuarios de VPN, acceso por RD", duration: "5 días", percent: "85%", start: "17/2/26", end: "23/2/26", indent: 3 },
  { name: "Parametrización base", duration: "34 días", percent: "15%", start: "16/2/26", end: "31/3/26", indent: 2, isBold: true },
  { name: "Configuración de reglas de negocio, parámetros generales", duration: "15 días", percent: "30%", start: "16/2/26", end: "6/3/26", indent: 3 },
  { name: "Configuración clientes", duration: "2 días", percent: "35%", start: "9/3/26", end: "10/3/26", indent: 3 },
  { name: "Configuración seguridad", duration: "2 días", percent: "40%", start: "11/3/26", end: "12/3/26", indent: 3 },
  { name: "Configuración productos arrendamiento", duration: "10 días", percent: "5%", start: "13/3/26", end: "26/3/26", indent: 3 },
  { name: "Configuración productos préstamos", duration: "5 días", percent: "5%", start: "27/3/26", end: "31/3/26", indent: 3 },
  { name: "Configuración del gestor de cobro", duration: "5 días", percent: "0%", start: "13/3/26", end: "19/3/26", indent: 3 },
  { name: "Configuración del gestor de notificaciones para cobro", duration: "5 días", percent: "0%", start: "13/3/26", end: "19/3/26", indent: 3 },
  { name: "Hito * Parametrización Base", duration: "0 días", percent: "0%", start: "19/3/26", end: "19/3/26", indent: 3, isItalic: true, isRed: true },
  { name: "Capacitación a capacitadores & talleres", duration: "21 días", percent: "0%", start: "6/4/26", end: "4/5/26", indent: 2, isBold: true },
  { name: "Identificación de capacitadores, super usuario", duration: "1 día", percent: "0%", start: "6/4/26", end: "6/4/26", indent: 3 },
  { name: "Capacitación para equipo TI - creación de roles", duration: "5 días", percent: "0%", start: "7/4/26", end: "13/4/26", indent: 3 },
  { name: "Preparación de flujos base por roles - Guías", duration: "5 días", percent: "0%", start: "14/4/26", end: "20/4/26", indent: 3 },
  { name: "Capacitación y talleres Préstamos y Arrendamiento", duration: "10 días", percent: "0%", start: "21/4/26", end: "4/5/26", indent: 3 },
  { name: "Hito * Capacitación base", duration: "0 días", percent: "0%", start: "4/5/26", end: "4/5/26", indent: 3, isItalic: true, isRed: true },
  { name: "Pruebas integrales flujos consensuados", duration: "10 días", percent: "0%", start: "5/5/26", end: "18/5/26", indent: 2, isBold: true },
  { name: "Matriz de procesos operativos - AURUM & SYSDE", duration: "5 días", percent: "0%", start: "5/5/26", end: "11/5/26", indent: 3 },
  { name: "Apoyo técnicos sobre proceso de certificación", duration: "5 días", percent: "0%", start: "12/5/26", end: "18/5/26", indent: 3 },
  { name: "04 - Go Live", duration: "19 días", percent: "0%", start: "19/5/26", end: "12/6/26", indent: 1, isBold: true, isRed: true },
  { name: "Capitalización de parametrización base producción", duration: "1 día", percent: "0%", start: "19/5/26", end: "19/5/26", indent: 2 },
  { name: "Aseguramiento ambiente, base de datos, versión producto", duration: "1 día", percent: "0%", start: "20/5/26", end: "20/5/26", indent: 2 },
  { name: "Puesta en producción", duration: "1 día", percent: "0%", start: "21/5/26", end: "21/5/26", indent: 2 },
  { name: "Acompañamiento puesta producción", duration: "16 días", percent: "0%", start: "22/5/26", end: "12/6/26", indent: 2, isBold: true },
];

// Compromisos y entregables data for AURUM

export interface CompromisoRow {
  num: number;
  description: string;
  responsible: string;
  date: string;
  status: "Hecho" | "En progreso" | "Pendiente";
  comments: string;
}

export const aurumCompromisosRows: CompromisoRow[] = [
  { num: 1, description: "Lista de usuarios para instalación de VPN", responsible: "Grupo AURUM", date: "20 feb.", status: "Hecho", comments: "15/01: Tomás envía hasta el 20 feb." },
  { num: 2, description: "Coordinación fechas de sesiones de entendimiento de negocio (28 ene. al 3 feb.)", responsible: "AURUM / SYSDE", date: "3 feb.", status: "Hecho", comments: "15/01: Oscar envía temario hasta 20 feb." },
  { num: 3, description: "Disponibilidad de folder de insumos para envío de documentación Grupo AURUM", responsible: "SYSDE", date: "3 feb.", status: "Hecho", comments: "—" },
  { num: 4, description: "Revisión de solicitud de Grupo AURUM para uso anticipado de SYSDE SAF", responsible: "SYSDE", date: "20 feb.", status: "Hecho", comments: "Puesta en producción 21 mayo, ambos productos" },
  { num: 5, description: "Configuración de acceso VPN y RDP", responsible: "AURUM / SYSDE", date: "6 mar.", status: "En progreso", comments: "SYSDE enviará las sesiones Teams, 4 mar., 10:00am" },
  { num: 6, description: "Entrega de información contable y de clientes, catálogo por empresa | Aclaración de dudas", responsible: "Grupo AURUM", date: "26, 27 feb. 2 mar.", status: "Hecho", comments: "Info recibida 26 feb. Sesión aclaración con César Almendras y Guadalupe Ucles" },
  { num: 7, description: "Envío de plan de proyecto y cronograma final a Grupo AURUM", responsible: "SYSDE", date: "20 feb.", status: "Hecho", comments: "Enviado por Fernando" },
  { num: 8, description: "Elaboración de matriz de casos especiales de negocio", responsible: "Grupo AURUM", date: "TBD", status: "Pendiente", comments: "Matriz a ser enviada por el equipo de Grupo Aurum" },
  { num: 9, description: "Grupo Aurum solicita una reunión para revisar el cronograma del proyecto", responsible: "Grupo AURUM", date: "TBD", status: "Pendiente", comments: "Juan Carlos Marín y/o Oscar Castro enviarán fechas propuestas" },
];
