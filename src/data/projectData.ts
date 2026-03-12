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
  financials: ClientFinancials;
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

export interface ClientFinancials {
  contractValue: number;
  billed: number;
  paid: number;
  pending: number;
  hoursEstimated: number;
hoursUsed: number;
  monthlyBreakdown: { month: string; estimated: number; actual: number }[];
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
  name: "Gestión de Soporte",
  company: "SYSDE",
  status: "Criticidad Media",
  lastUpdate: "09 Marzo 2026",
  targetDate: "Consolidado 2025-2026",
};

export const clients: Client[] = [
  {
    id: "coopecar",
    name: "COOPECAR R.L.",
    country: "Costa Rica",
    industry: "Cooperativa Financiera",
    contactName: "Carmen Milena Arce",
    contactEmail: "gerencia@coopecar.fi.cr",
    contractStart: "01 Ene 2024",
    contractEnd: "31 Dic 2026",
    status: "activo",
    progress: 43,
    phases: [
      { name: "Fase 1: Cerrar backlog alta prioridad (12039, 12038)", status: "en-progreso", progress: 30, startDate: "01 Mar 2026", endDate: "31 Mar 2026" },
      { name: "Fase 2: Definir destino casos cotizados (12074, 12257)", status: "pendiente", progress: 0, startDate: "01 Abr 2026", endDate: "30 Abr 2026" },
      { name: "Fase 3: Evaluación deuda técnica Soporte Plus", status: "pendiente", progress: 0, startDate: "01 May 2026", endDate: "31 May 2026" },
    ],
    deliverables: [
      { id: "D-11818", name: "XML Encaje Mínimo Legal SICVECA", type: "documento", status: "aprobado", dueDate: "09 Mar 2026", deliveredDate: "09 Mar 2026", approvedBy: "COOPECAR", version: "1.0" },
      { id: "D-11963", name: "Automatización Capital Diferido SUGEF", type: "documento", status: "aprobado", dueDate: "09 Mar 2026", deliveredDate: "09 Mar 2026", approvedBy: "COOPECAR", version: "1.0" },
      { id: "D-12262", name: "Propuesta ajuste pantalla pagos extraordinarios", type: "documento", status: "entregado", dueDate: "27 Feb 2026", deliveredDate: "27 Feb 2026", version: "1.0" },
      { id: "D-12038", name: "Corrección XML financiero contable", type: "documento", status: "pendiente", dueDate: "15 Mar 2026", version: "1.0" },
      { id: "D-12039", name: "Corrección asiento contable", type: "documento", status: "pendiente", dueDate: "15 Mar 2026", version: "1.0" },
    ],
    financials: {
      contractValue: 0, billed: 0, paid: 0, pending: 0, hoursEstimated: 500, hoursUsed: 368,
      monthlyBreakdown: [
        { month: "Ene 2026", estimated: 80, actual: 55 },
        { month: "Feb 2026", estimated: 80, actual: 78 },
        { month: "Mar 2026", estimated: 80, actual: 35 },
      ],
    },
    tasks: [
      { id: 12262, title: "Pagos extraordinarios de crédito no cargan el monto de los cargos", status: "completada", owner: "Equipo Técnico SYSDE", dueDate: "27 Feb 2026", priority: "alta", assignees: [{ name: "María Fernanda Angulo", role: "Representante", avatar: "MFA" }], description: "Propuesta enviada 27/2/2026. Deben abrir nueva boleta." },
      { id: 12257, title: "Tesorería / Envío automático estados de cuenta generales", status: "pendiente", owner: "Equipo Técnico SYSDE", dueDate: "30 Abr 2026", priority: "media", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Incluye todas las cuentas, inversiones y créditos. Ref. 12014-522" },
      { id: 12074, title: "Corregir transferencias en módulo de cuentas de efectivo", status: "pendiente", owner: "Equipo Técnico SYSDE", dueDate: "31 Mar 2026", priority: "baja", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Cotizado hace 10 meses sin decisión formal." },
      { id: 12039, title: "Error en asiento contable", status: "en-progreso", owner: "Oscar Rodríguez", dueDate: "15 Mar 2026", priority: "alta", assignees: [{ name: "Oscar Rodríguez", role: "Soporte", avatar: "OR" }], description: "En espera de acceso por parte de COOPECAR. Antigüedad: 12 meses." },
      { id: 12038, title: "Errores o Inconsistencias en varios XML de financiero contable", status: "en-progreso", owner: "Equipo Técnico SYSDE", dueDate: "15 Mar 2026", priority: "alta", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "En proceso de análisis en tercer ambiente. Antigüedad: 12 meses." },
      { id: 11963, title: "Automatización procesos SUGEF capital diferido", status: "completada", owner: "Equipo Técnico SYSDE", dueDate: "09 Mar 2026", priority: "alta", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Caso regulatorio SUGEF entregado. 135 horas invertidas." },
      { id: 11818, title: "XML ENCAJE MINIMO LEGAL NUEVA CLASE DE DATOS SICVECA", status: "completada", owner: "Equipo Técnico SYSDE", dueDate: "09 Mar 2026", priority: "media", assignees: [{ name: "Equipo Técnico SYSDE", role: "Desarrollo", avatar: "ETS" }], description: "Caso regulatorio SUGEF entregado. 78 horas invertidas." },
    ],
    comments: [
      { id: "c1", user: "Eduardo Wheelock", avatar: "EW", message: "Nivel de criticidad: MEDIO (antes ALTO). Tendencia del servicio: MEJORANDO (+207% en completitud).", date: "09 Mar 2026", type: "comentario" },
      { id: "c2", user: "Análisis Gerencial", avatar: "AG", message: "Casos regulatorios SUGEF 100% entregados (11818, 11963). Riesgo de incumplimiento eliminado.", date: "09 Mar 2026", type: "aprobacion" },
      { id: "c3", user: "ITIL Review", avatar: "IR", message: "Casos 12039 y 12038 con 12 meses de antigüedad. SLA implícito INCUMPLIDO. Requieren atención focalizada.", date: "09 Mar 2026", type: "alerta" },
    ],
    risks: [
      { id: "R1", description: "Cierre contable 2025 pendiente - Caso 12039 con 12 meses de antigüedad", impact: "alto", status: "abierto", mitigation: "Coordinar acceso remoto con TI COOPECAR de forma inmediata" },
      { id: "R2", description: "XML financiero contable pendiente de validación final - Caso 12038", impact: "alto", status: "abierto", mitigation: "Completar análisis en tercer ambiente antes del 15-Mar-2026" },
      { id: "R3", description: "Deuda técnica Soporte Plus: 16 casos ON HOLD acumulados", impact: "medio", status: "abierto", mitigation: "Evaluar reactivación de casos críticos de cifrado y cumplimiento" },
      { id: "R4", description: "Caso 12074 cotizado 10 meses sin decisión del cliente", impact: "bajo", status: "abierto", mitigation: "Obtener decisión formal antes del 20-Mar-2026" },
      { id: "R5", description: "Cifrado de transacciones no implementado - 4 casos Soporte Plus", impact: "alto", status: "abierto", mitigation: "Priorizar en roadmap Q3 2026" },
      { id: "R6", description: "Riesgo SUGEF mitigado con entregas 11818/11963", impact: "alto", status: "mitigado", mitigation: "Casos regulatorios entregados exitosamente" },
    ],
    teamAssigned: ["María Fernanda Angulo", "Oscar Rodríguez", "Eduardo Wheelock", "Equipo Técnico SYSDE"],
    actionItems: [
      { id: "AI1", title: "Resolver bloqueo de acceso para caso 12039 - Coordinar con TI COOPECAR", assignee: "Oscar Rodríguez / SYSDE", dueDate: "12 Mar 2026", status: "pendiente", source: "Informe Gerencial 09-Mar-2026", priority: "alta" },
      { id: "AI2", title: "Completar análisis tercer ambiente caso 12038 y definir plan de corrección", assignee: "Equipo Técnico SYSDE", dueDate: "15 Mar 2026", status: "pendiente", source: "Informe Gerencial 09-Mar-2026", priority: "alta" },
      { id: "AI3", title: "Solicitar a COOPECAR apertura de boleta para caso 12262", assignee: "María Fernanda Angulo", dueDate: "12 Mar 2026", status: "pendiente", source: "Informe Gerencial 09-Mar-2026", priority: "media" },
      { id: "AI4", title: "Obtener decisión formal sobre caso 12074 (10 meses cotizado)", assignee: "María Fernanda Angulo", dueDate: "20 Mar 2026", status: "pendiente", source: "Informe Gerencial 09-Mar-2026", priority: "media" },
      { id: "AI5", title: "Validar con cliente entrega de casos 11818 y 11963 para cierre formal", assignee: "Equipo Soporte", dueDate: "15 Mar 2026", status: "pendiente", source: "Informe Gerencial 09-Mar-2026", priority: "alta" },
      { id: "AI6", title: "Formalizar SLAs por tipo de caso", assignee: "Gerencia SYSDE", dueDate: "30 Abr 2026", status: "pendiente", source: "Recomendaciones Estructurales", priority: "media" },
      { id: "AI7", title: "Implementar proceso formal de RCA para casos de alta inversión", assignee: "Equipo Técnico SYSDE", dueDate: "30 Abr 2026", status: "pendiente", source: "Recomendaciones Estructurales", priority: "media" },
    ],
    meetingMinutes: [],
    emailNotifications: [],
  },
];
