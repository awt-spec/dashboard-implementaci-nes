export interface Client {
  id: string;
  name: string;
  country: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  contractStart: string;
  contractEnd: string;
  status: "activo" | "en-riesgo" | "pausado" | "completado";
  progress: number;
  phases: Phase[];
  deliverables: Deliverable[];
  tasks: ClientTask[];
  comments: Comment[];
  risks: Risk[];
  teamAssigned: string[];
  actionItems: ActionItem[];
  meetingMinutes: MeetingMinute[];
  emailNotifications: EmailNotification[];
}

export interface Phase {
  name: string;
  status: "completado" | "en-progreso" | "por-iniciar" | "pendiente";
  progress: number;
  startDate: string;
  endDate: string;
}

export interface DeliverableDetail {
  description: string;
  attachments: string[];
  hoursInvested: number;
  reviewNotes?: string;
  history: { date: string; action: string; by: string }[];
}

export interface Deliverable {
  id: string;
  name: string;
  type: "documento" | "modulo" | "configuracion" | "capacitacion" | "reporte";
  status: "entregado" | "en-revision" | "pendiente" | "aprobado";
  dueDate: string;
  deliveredDate?: string;
  approvedBy?: string;
  version: string;
  detail?: DeliverableDetail;
  responsibleParty?: string;
  responsibleTeam?: string;
  linkedTaskId?: number;
}

export interface TaskAssignee {
  name: string;
  role: string;
  avatar: string;
}

export interface ClientTask {
  id: number;
  title: string;
  status: "completada" | "en-progreso" | "bloqueada" | "pendiente";
  owner: string;
  dueDate: string;
  priority: "alta" | "media" | "baja";
  assignees: TaskAssignee[];
  description?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  assignee: string;
  dueDate: string;
  status: "pendiente" | "completado" | "vencido";
  source: string;
  priority: "alta" | "media" | "baja";
  responsibleParty?: string;
  responsibleTeam?: string;
  linkedTaskId?: number;
}

export interface MeetingMinute {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  summary: string;
  agreements: string[];
  actionItems: string[];
  nextMeeting?: string;
  presentationSnapshot?: Client;
}

export interface EmailNotification {
  id: string;
  subject: string;
  to: string[];
  from: string;
  date: string;
  status: "enviado" | "pendiente" | "fallido";
  type: "reporte" | "alerta" | "seguimiento" | "minuta";
  preview: string;
}

export interface Comment {
  id: string;
  user: string;
  avatar: string;
  message: string;
  date: string;
  type: "comentario" | "aprobacion" | "solicitud" | "alerta";
}

export interface Risk {
  id: string;
  description: string;
  impact: "alto" | "medio" | "bajo";
  status: "abierto" | "mitigado" | "cerrado";
  mitigation?: string;
}

export const projectInfo = {
  name: "Gestión de Implementaciones",
  company: "SYSDE",
  status: "En Ejecución",
  lastUpdate: "12 Marzo 2026",
  targetDate: "Consolidado 2025-2026",
};

export const clients: Client[] = [
  {
    id: "aurum",
    name: "GRUPO AURUM",
    country: "Honduras",
    industry: "Arrendamiento y Préstamos",
    contactName: "Oscar Castro",
    contactEmail: "ocastro@grupoaurum.com",
    contractStart: "01 Nov 2025",
    contractEnd: "12 Jun 2026",
    status: "activo",
    progress: 51,
    phases: [
      { name: "Planificación", status: "completado", progress: 100, startDate: "20 Nov 2025", endDate: "17 Feb 2026" },
      { name: "Infraestructura y despliegue", status: "completado", progress: 99, startDate: "02 Dic 2025", endDate: "23 Feb 2026" },
      { name: "Parametrización base", status: "en-progreso", progress: 15, startDate: "16 Feb 2026", endDate: "31 Mar 2026" },
      { name: "Capacitación a capacitadores y talleres", status: "pendiente", progress: 0, startDate: "06 Abr 2026", endDate: "04 May 2026" },
      { name: "Pruebas integrales", status: "pendiente", progress: 0, startDate: "05 May 2026", endDate: "18 May 2026" },
      { name: "Go Live y acompañamiento", status: "pendiente", progress: 0, startDate: "19 May 2026", endDate: "12 Jun 2026" },
    ],
    deliverables: [
      { id: "D-AUR-01", name: "Plan de proyecto y cronograma", type: "documento", status: "aprobado", dueDate: "20 Feb 2026", deliveredDate: "20 Feb 2026", approvedBy: "AURUM", version: "1.0" },
      { id: "D-AUR-02", name: "Instalación ambientes Azure", type: "configuracion", status: "aprobado", dueDate: "15 Dic 2025", deliveredDate: "15 Dic 2025", approvedBy: "SYSDE PMO", version: "1.0" },
      { id: "D-AUR-03", name: "Configuración base de datos SAF", type: "configuracion", status: "aprobado", dueDate: "22 Dic 2025", deliveredDate: "22 Dic 2025", version: "1.0" },
      { id: "D-AUR-04", name: "Configuración reglas de negocio y parámetros", type: "configuracion", status: "en-revision", dueDate: "06 Mar 2026", version: "1.0" },
      { id: "D-AUR-05", name: "Configuración productos arrendamiento", type: "configuracion", status: "pendiente", dueDate: "26 Mar 2026", version: "1.0" },
      { id: "D-AUR-06", name: "Configuración productos préstamos", type: "configuracion", status: "pendiente", dueDate: "31 Mar 2026", version: "1.0" },
      { id: "D-AUR-07", name: "Acta de parametrización base", type: "documento", status: "pendiente", dueDate: "19 Mar 2026", version: "1.0" },
    ],
    tasks: [
      { id: 1001, title: "Configuración de reglas de negocio y parámetros generales", status: "en-progreso", owner: "Equipo Técnico SYSDE", dueDate: "06 Mar 2026", priority: "alta", assignees: [{ name: "Fernando Pinto", role: "PM", avatar: "FP" }], description: "Avance 30%. Sesiones de parametrización en curso." },
      { id: 1002, title: "Configuración de clientes en SAF", status: "en-progreso", owner: "Equipo Técnico SYSDE", dueDate: "10 Mar 2026", priority: "alta", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Avance 35%." },
      { id: 1003, title: "Configuración de seguridad", status: "en-progreso", owner: "Equipo Técnico SYSDE", dueDate: "12 Mar 2026", priority: "media", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Avance 40%." },
      { id: 1004, title: "Configuración productos arrendamiento", status: "pendiente", owner: "Equipo Técnico SYSDE", dueDate: "26 Mar 2026", priority: "alta", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Avance 5%. Inicia tras parametrización base." },
      { id: 1005, title: "Configuración productos préstamos", status: "pendiente", owner: "Equipo Técnico SYSDE", dueDate: "31 Mar 2026", priority: "alta", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Avance 5%." },
      { id: 1006, title: "Configuración VPN y acceso RDP", status: "en-progreso", owner: "AURUM / SYSDE", dueDate: "06 Mar 2026", priority: "media", assignees: [{ name: "Equipo Técnico SYSDE", role: "Infraestructura", avatar: "ETS" }], description: "Avance 85%. Sesiones Teams programadas." },
      { id: 1007, title: "Elaboración matriz de casos especiales de negocio", status: "pendiente", owner: "Grupo AURUM", dueDate: "TBD", priority: "media", assignees: [{ name: "Grupo AURUM", role: "Cliente", avatar: "GA" }], description: "Matriz a ser enviada por equipo de Grupo Aurum." },
      { id: 1008, title: "Configuración gestor de cobro y notificaciones", status: "pendiente", owner: "Equipo Técnico SYSDE", dueDate: "19 Mar 2026", priority: "media", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Avance 5%." },
    ],
    comments: [
      { id: "c1", user: "Fernando Pinto", avatar: "FP", message: "SPI 1.0 — Proyecto en tiempo. Avance planificado y real al 51%.", date: "05 Mar 2026", type: "comentario" },
      { id: "c2", user: "Coordinación", avatar: "CO", message: "Información contable y de clientes recibida el 26 feb. Sesión de aclaración con César Almendras y Guadalupe Ucles completada.", date: "05 Mar 2026", type: "aprobacion" },
      { id: "c3", user: "Seguimiento", avatar: "SG", message: "Grupo Aurum solicita reunión para revisar cronograma. Juan Carlos Marín y/o Oscar Castro enviarán fechas.", date: "05 Mar 2026", type: "solicitud" },
    ],
    risks: [
      { id: "R1", description: "Matriz de casos especiales de negocio pendiente de entrega por parte de Grupo AURUM", impact: "medio", status: "abierto", mitigation: "Solicitar fecha compromiso al equipo de Grupo AURUM" },
      { id: "R2", description: "Configuración VPN aún no completada al 100% — puede retrasar pruebas remotas", impact: "medio", status: "abierto", mitigation: "Programar sesiones Teams adicionales para completar configuración" },
      { id: "R3", description: "Revisión de cronograma solicitada por cliente puede generar replanificación", impact: "bajo", status: "abierto", mitigation: "Coordinar reunión de revisión con PM y cliente" },
    ],
    teamAssigned: ["Fernando Pinto", "Oscar Castro", "César Almendras", "Guadalupe Ucles", "Equipo Técnico SYSDE"],
    actionItems: [
      { id: "AI1", title: "Completar configuración VPN y acceso RDP para usuarios AURUM", assignee: "AURUM / SYSDE", dueDate: "06 Mar 2026", status: "pendiente", source: "FUP Semanal 05-Mar-2026", priority: "alta" },
      { id: "AI2", title: "Entrega de matriz de casos especiales de negocio", assignee: "Grupo AURUM", dueDate: "TBD", status: "pendiente", source: "FUP Semanal 05-Mar-2026", priority: "media" },
      { id: "AI3", title: "Coordinar reunión revisión de cronograma con Juan Carlos Marín / Oscar Castro", assignee: "Grupo AURUM", dueDate: "TBD", status: "pendiente", source: "FUP Semanal 05-Mar-2026", priority: "media" },
      { id: "AI4", title: "Completar parametrización base y firmar acta (Hito)", assignee: "SYSDE / AURUM", dueDate: "19 Mar 2026", status: "pendiente", source: "Cronograma Proyecto", priority: "alta" },
      { id: "AI5", title: "Iniciar configuración de productos arrendamiento y préstamos", assignee: "Equipo Técnico SYSDE", dueDate: "13 Mar 2026", status: "pendiente", source: "Cronograma Proyecto", priority: "alta" },
    ],
    meetingMinutes: [],
    emailNotifications: [],
  },
  {
    id: "arkfin",
    name: "ARKFIN",
    country: "Panamá",
    industry: "Préstamos",
    contactName: "Alex / Nelly",
    contactEmail: "contacto@arkfin.com",
    contractStart: "01 Sep 2025",
    contractEnd: "28 Feb 2026",
    status: "activo",
    progress: 44,
    phases: [
      { name: "Despliegue de infraestructura", status: "completado", progress: 100, startDate: "01 Sep 2025", endDate: "30 Sep 2025" },
      { name: "Entendimiento del negocio préstamos", status: "completado", progress: 100, startDate: "01 Oct 2025", endDate: "31 Oct 2025" },
      { name: "Configuración reglas de negocio y políticas", status: "en-progreso", progress: 80, startDate: "15 Oct 2025", endDate: "15 Dic 2025" },
      { name: "Capacitación magistral y talleres", status: "en-progreso", progress: 20, startDate: "16 Dic 2025", endDate: "23 Dic 2025" },
      { name: "Certificación de roles y perfiles", status: "pendiente", progress: 0, startDate: "28 Dic 2025", endDate: "03 Ene 2026" },
      { name: "Puesta en producción", status: "pendiente", progress: 0, startDate: "06 Ene 2026", endDate: "15 Ene 2026" },
    ],
    deliverables: [
      { id: "D-ARK-01", name: "Configuración y parametrización base", type: "configuracion", status: "aprobado", dueDate: "30 Oct 2025", deliveredDate: "30 Oct 2025", version: "1.0" },
      { id: "D-ARK-02", name: "Guías de capacitaciones", type: "documento", status: "aprobado", dueDate: "08 Dic 2025", deliveredDate: "08 Dic 2025", version: "1.0" },
      { id: "D-ARK-03", name: "Configuración reglas de negocio y políticas ARKFIN", type: "configuracion", status: "en-revision", dueDate: "15 Dic 2025", version: "1.0" },
      { id: "D-ARK-04", name: "Configuración plantillas de contratos de préstamos", type: "configuracion", status: "en-revision", dueDate: "12 Dic 2025", version: "1.0" },
      { id: "D-ARK-05", name: "Configuración estados de cuenta", type: "configuracion", status: "en-revision", dueDate: "12 Dic 2025", version: "1.0" },
      { id: "D-ARK-06", name: "Acta de parametrización firmada", type: "documento", status: "pendiente", dueDate: "28 Dic 2025", version: "1.0" },
    ],
    tasks: [
      { id: 2001, title: "Pruebas técnicas y funcionales tras configuración de reglas", status: "en-progreso", owner: "SYSDE", dueDate: "15 Dic 2025", priority: "alta", assignees: [{ name: "Equipo Técnico SYSDE", role: "QA", avatar: "ETS" }], description: "Pruebas funcionales en curso tras ajustes de configuración." },
      { id: 2002, title: "Configuración de plantillas de contratos de préstamos", status: "en-progreso", owner: "SYSDE", dueDate: "12 Dic 2025", priority: "alta", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "En configuración." },
      { id: 2003, title: "Configuración de estados de cuenta", status: "en-progreso", owner: "SYSDE", dueDate: "12 Dic 2025", priority: "media", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Inicio 24 Nov, fin estimado 12 Dic." },
      { id: 2004, title: "Preparación capacitaciones magistrales y elaboración agenda", status: "en-progreso", owner: "SYSDE", dueDate: "15 Dic 2025", priority: "media", assignees: [{ name: "Fernando Pinto", role: "PM", avatar: "FP" }], description: "Inicio 8 Dic, fin estimado 15 Dic." },
      { id: 2005, title: "Firma acta de parametrización", status: "pendiente", owner: "ARKFIN", dueDate: "28 Dic 2025", priority: "alta", assignees: [{ name: "ARKFIN", role: "Cliente", avatar: "AK" }], description: "Depende de completar configuración." },
      { id: 2006, title: "Coordinación capacitaciones magistrales (Sem 1: 16-18 dic, Sem 2: 22-23 dic)", status: "pendiente", owner: "ARKFIN / SYSDE", dueDate: "23 Dic 2025", priority: "alta", assignees: [{ name: "Alex", role: "Coordinador", avatar: "AL" }, { name: "MN", role: "Coordinador", avatar: "MN" }], description: "Sesiones programadas por la tarde." },
      { id: 2007, title: "Certificación de roles", status: "pendiente", owner: "ARKFIN / SYSDE", dueDate: "28 Dic 2025", priority: "media", assignees: [{ name: "ARKFIN / SYSDE", role: "Conjunto", avatar: "AS" }], description: "Depende de capacitaciones." },
      { id: 2008, title: "Puesta en producción", status: "pendiente", owner: "ARKFIN / SYSDE", dueDate: "Ene 2026", priority: "alta", assignees: [{ name: "ARKFIN / SYSDE", role: "Conjunto", avatar: "AS" }], description: "Inicios de enero 2026." },
    ],
    comments: [
      { id: "c1", user: "Fernando Pinto", avatar: "FP", message: "Avance planificado y real al 44%. Proyecto en cronograma re-planificado.", date: "11 Dic 2025", type: "comentario" },
      { id: "c2", user: "Coordinación", avatar: "CO", message: "Sesiones de capacitación magistral coordinadas: Sem 1 (16-18 dic) y Sem 2 (22-23 dic).", date: "11 Dic 2025", type: "aprobacion" },
      { id: "c3", user: "Seguimiento", avatar: "SG", message: "Reunión aclaración convenios y empresa representante coordinada con Alex y Nelly.", date: "11 Dic 2025", type: "comentario" },
    ],
    risks: [
      { id: "R1", description: "Firma de acta de parametrización pendiente — puede retrasar capacitaciones", impact: "alto", status: "abierto", mitigation: "Acelerar pruebas funcionales para liberar acta antes del 28 Dic" },
      { id: "R2", description: "Capacitaciones magistrales programadas en fechas cercanas a fin de año", impact: "medio", status: "abierto", mitigation: "Confirmar disponibilidad del equipo ARKFIN para sesiones de diciembre" },
      { id: "R3", description: "Puesta en producción dependiente de certificación de roles completada", impact: "alto", status: "abierto", mitigation: "Asegurar que certificación se complete en la semana del 28 Dic" },
    ],
    teamAssigned: ["Fernando Pinto", "Alex", "Nelly", "MN", "Equipo Técnico SYSDE"],
    actionItems: [
      { id: "AI1", title: "Completar configuración reglas de negocio y políticas ARKFIN", assignee: "SYSDE", dueDate: "15 Dic 2025", status: "pendiente", source: "FUP Semanal 11-Dic-2025", priority: "alta" },
      { id: "AI2", title: "Coordinar sesiones de capacitaciones magistrales", assignee: "MN / Alex", dueDate: "12 Dic 2025", status: "completado", source: "FUP Semanal 11-Dic-2025", priority: "alta" },
      { id: "AI3", title: "Reunión aclaración convenios con Alex y Nelly", assignee: "MN / Alex", dueDate: "15 Dic 2025", status: "completado", source: "FUP Semanal 11-Dic-2025", priority: "media" },
      { id: "AI4", title: "Firma acta de parametrización por ARKFIN", assignee: "ARKFIN", dueDate: "28 Dic 2025", status: "pendiente", source: "Cronograma Proyecto", priority: "alta" },
      { id: "AI5", title: "Ejecutar puesta en producción", assignee: "ARKFIN / SYSDE", dueDate: "Ene 2026", status: "pendiente", source: "Cronograma Proyecto", priority: "alta" },
    ],
    meetingMinutes: [],
    emailNotifications: [],
  },
  {
    id: "apex",
    name: "GRUPO APEX",
    country: "Guatemala",
    industry: "Arrendamiento y Préstamos",
    contactName: "Walter de León / Vilma Duarte",
    contactEmail: "contacto@grupoapex.com",
    contractStart: "01 Ago 2025",
    contractEnd: "30 Sep 2026",
    status: "activo",
    progress: 49,
    phases: [
      { name: "Despliegue de infraestructura cloud", status: "completado", progress: 100, startDate: "01 Ago 2025", endDate: "30 Sep 2025" },
      { name: "Entendimiento del negocio Leasing", status: "completado", progress: 100, startDate: "14 Oct 2025", endDate: "24 Oct 2025" },
      { name: "Configuración reglas de negocio y parámetros (Arrendamiento)", status: "en-progreso", progress: 95, startDate: "01 Nov 2025", endDate: "Mar 2026" },
      { name: "Carga de datos y pruebas técnicas", status: "en-progreso", progress: 30, startDate: "Mar 2026", endDate: "Abr 2026" },
      { name: "Capacitación a capacitadores", status: "pendiente", progress: 0, startDate: "16 Mar 2026", endDate: "Abr 2026" },
      { name: "Certificación de roles y perfiles", status: "pendiente", progress: 0, startDate: "Mar 2026", endDate: "Abr 2026" },
      { name: "Pruebas integrales", status: "pendiente", progress: 0, startDate: "Abr 2026", endDate: "May 2026" },
      { name: "Go-Live Arrendamiento", status: "pendiente", progress: 0, startDate: "May 2026", endDate: "Jun 2026" },
    ],
    deliverables: [
      { id: "D-APX-01", name: "Instalación y configuración ambientes cloud Azure", type: "configuracion", status: "aprobado", dueDate: "30 Sep 2025", deliveredDate: "30 Sep 2025", version: "1.0" },
      { id: "D-APX-02", name: "Instalación SAF 7.0 versión base", type: "configuracion", status: "aprobado", dueDate: "17 Oct 2025", deliveredDate: "17 Oct 2025", approvedBy: "Carlos Quesada", version: "7.0" },
      { id: "D-APX-03", name: "Plan de proyecto aprobado por PMO SYSDE", type: "documento", status: "aprobado", dueDate: "05 Dic 2025", deliveredDate: "05 Dic 2025", approvedBy: "Grupo ION", version: "1.0" },
      { id: "D-APX-04", name: "Cronograma de proyecto aprobado por PMO SYSDE", type: "documento", status: "aprobado", dueDate: "05 Dic 2025", deliveredDate: "05 Dic 2025", approvedBy: "Grupo ION", version: "1.0" },
      { id: "D-APX-05", name: "Catálogo contable validado", type: "documento", status: "entregado", dueDate: "27 Feb 2026", deliveredDate: "27 Feb 2026", version: "1.0" },
      { id: "D-APX-06", name: "Configuración reglas de negocio y productos arrendamiento", type: "configuracion", status: "en-revision", dueDate: "Mar 2026", version: "1.0" },
      { id: "D-APX-07", name: "Acta de parametrización base", type: "documento", status: "pendiente", dueDate: "Mar 2026", version: "1.0" },
      { id: "D-APX-08", name: "Temario de capacitaciones", type: "documento", status: "en-revision", dueDate: "13 Mar 2026", version: "1.0" },
    ],
    tasks: [
      { id: 3001, title: "Entrega acta de parametrización base", status: "pendiente", owner: "Grupo APEX / SYSDE", dueDate: "Mar 2026", priority: "alta", assignees: [{ name: "Grupo APEX", role: "Cliente", avatar: "GA" }, { name: "SYSDE", role: "Implementación", avatar: "SY" }], description: "Pendiente firma conjunta." },
      { id: 3002, title: "Configuración reglas de negocio y productos arrendamiento", status: "en-progreso", owner: "SYSDE", dueDate: "Mar 2026", priority: "alta", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Avance 95%." },
      { id: 3003, title: "Ajustes documento catálogo contable para migración", status: "en-progreso", owner: "SYSDE", dueDate: "Mar 2026", priority: "media", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Avance 90%." },
      { id: 3004, title: "Pruebas técnicas sobre la configuración", status: "en-progreso", owner: "SYSDE", dueDate: "Mar 2026", priority: "alta", assignees: [{ name: "Equipo Técnico SYSDE", role: "QA", avatar: "ETS" }], description: "Avance 95%." },
      { id: 3005, title: "Carga de datos clientes y financieros", status: "pendiente", owner: "Grupo APEX / SYSDE", dueDate: "Mar 2026", priority: "alta", assignees: [{ name: "Vila Duarte", role: "Cliente", avatar: "VD" }], description: "Plantillas entregadas, pendiente carga." },
      { id: 3006, title: "Preparación temario para capacitaciones", status: "en-progreso", owner: "Carlos Quesada", dueDate: "13 Mar 2026", priority: "media", assignees: [{ name: "Carlos Quesada", role: "Implementación", avatar: "CQ" }], description: "En progreso." },
      { id: 3007, title: "Capacitación a capacitadores", status: "pendiente", owner: "Grupo APEX / SYSDE", dueDate: "16 Mar 2026", priority: "alta", assignees: [{ name: "Grupo APEX / SYSDE", role: "Conjunto", avatar: "GS" }], description: "Coordinación de fechas/horarios pendiente." },
      { id: 3008, title: "Envío lista de roles y áreas actuales", status: "pendiente", owner: "Grupo APEX", dueDate: "06 Mar 2026", priority: "media", assignees: [{ name: "Grupo APEX", role: "Cliente", avatar: "GA" }], description: "Pendiente envío por parte del cliente." },
      { id: 3009, title: "Certificación de roles y perfiles", status: "pendiente", owner: "Grupo APEX / SYSDE", dueDate: "Abr 2026", priority: "alta", assignees: [{ name: "Grupo APEX / SYSDE", role: "Conjunto", avatar: "GS" }] },
      { id: 3010, title: "Go-Live Arrendamiento", status: "pendiente", owner: "Grupo APEX / SYSDE", dueDate: "May 2026", priority: "alta", assignees: [{ name: "Grupo APEX / SYSDE", role: "Conjunto", avatar: "GS" }] },
    ],
    comments: [
      { id: "c1", user: "Fernando Pinto", avatar: "FP", message: "Avance planificado 49%, real 49%. Proyecto en cronograma. Configuración arrendamiento al 95%.", date: "Mar 2026", type: "comentario" },
      { id: "c2", user: "Coordinación", avatar: "CO", message: "Catálogo contable entregado y validado (27 feb). Plantillas de carga de datos en revisión.", date: "Mar 2026", type: "aprobacion" },
      { id: "c3", user: "Seguimiento", avatar: "SG", message: "Capacitaciones a iniciar a partir del 16 o 23 de marzo. Pendiente coordinación de fechas.", date: "Mar 2026", type: "solicitud" },
    ],
    risks: [
      { id: "R1", description: "Lista de roles y áreas pendiente de envío por Grupo APEX — puede retrasar certificación", impact: "medio", status: "abierto", mitigation: "Solicitar entrega inmediata antes del 6 de marzo" },
      { id: "R2", description: "Coordinación de fechas para capacitaciones aún no definida", impact: "medio", status: "abierto", mitigation: "Confirmar fechas con Grupo APEX para semana del 16 o 23 de marzo" },
      { id: "R3", description: "Carga de datos dependiente de plantillas completadas por cliente", impact: "alto", status: "abierto", mitigation: "Dar seguimiento a Vilma Duarte para completar plantillas" },
      { id: "R4", description: "Go-Live de Arrendamiento depende de pruebas integrales exitosas", impact: "alto", status: "abierto", mitigation: "Planificar pruebas integrales para abril-mayo con recursos dedicados" },
    ],
    teamAssigned: ["Fernando Pinto", "Carlos Quesada", "Walter de León", "Vilma Duarte", "Equipo Técnico SYSDE"],
    actionItems: [
      { id: "AI1", title: "Firmar acta de parametrización base", assignee: "Grupo APEX / SYSDE", dueDate: "Mar 2026", status: "pendiente", source: "FUP Semanal Mar-2026", priority: "alta" },
      { id: "AI2", title: "Completar carga de datos de clientes y financieros", assignee: "Grupo APEX (Vila Duarte)", dueDate: "Mar 2026", status: "pendiente", source: "FUP Semanal Mar-2026", priority: "alta" },
      { id: "AI3", title: "Enviar lista de roles y áreas actuales", assignee: "Grupo APEX", dueDate: "06 Mar 2026", status: "pendiente", source: "FUP Semanal Mar-2026", priority: "media" },
      { id: "AI4", title: "Coordinar fechas/horarios de capacitación a capacitadores", assignee: "Grupo APEX / SYSDE", dueDate: "16 Mar 2026", status: "pendiente", source: "FUP Semanal Mar-2026", priority: "alta" },
      { id: "AI5", title: "Preparar temario de capacitaciones", assignee: "Carlos Quesada", dueDate: "13 Mar 2026", status: "pendiente", source: "FUP Semanal Mar-2026", priority: "media" },
    ],
    meetingMinutes: [],
    emailNotifications: [],
  },
];
