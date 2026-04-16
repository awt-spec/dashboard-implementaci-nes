

## Análisis de los 11 tabs actuales del Support Dashboard

Tabs actuales (visible en screenshot): **Vista General | Gráficos | Clasificación IA | Detalle de Casos | Minutas | Acuerdos | Contrato & SLA | Estrategia Scrum | Azure DevOps** + (oculto en vista cliente: Mapa de Calor, Cargar Datos)

### Problemas identificados

1. **Solapamiento operativo**: "Vista General" + "Gráficos" + "Mapa de Calor" muestran métricas/visuales del mismo dataset.
2. **Comercial fragmentado**: "Acuerdos" + "Contrato & SLA" hablan ambos de términos contractuales.
3. **Estrategia dispersa**: "Clasificación IA" + "Estrategia Scrum" + parte analítica de la vista general son todos planeación.
4. **Integraciones aisladas**: "Azure DevOps" + "Cargar Datos" son ambos canales de ingesta.
5. **Demasiados clicks** para encontrar contexto de un cliente (cliente → 3 tabs distintos para ver financiero, SLA y acuerdos).

### Propuesta: 6 tabs con lógica clara

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Operación  │  Analítica  │  IA & Estrategia  │  Comercial  │ Minutas │ Datos │
└──────────────────────────────────────────────────────────────────────┘
```

| Nuevo Tab | Reemplaza | Contenido (sub-secciones internas) |
|---|---|---|
| **1. Operación** | Vista General + Detalle de Casos | KPIs arriba + tabla de casos abajo (vista única scrolleable). Filtros en header. |
| **2. Analítica** | Gráficos + Mapa de Calor | Sub-tabs internos: "Distribuciones" (estado/prioridad/tipo/aging) y "Por Cliente" (heatmap, solo en vista global). |
| **3. IA & Estrategia** | Clasificación IA + Estrategia Scrum | Sub-tabs: "Clasificación" (auto-tag), "Seguimiento IA", "Backlog Scrum". Unifica todo lo que requiere razonamiento IA o priorización. |
| **4. Comercial** | Acuerdos + Contrato & SLA | Sub-tabs: "Contrato" (valor, horas, vigencia), "SLA" (tiempos respuesta), "Acuerdos" (compromisos firmados). Solo visible cuando hay cliente seleccionado. Edición restringida a admin. |
| **5. Minutas** | Minutas | Sin cambios — flujo de actas reuniones es independiente. |
| **6. Datos & Sync** | Azure DevOps + Cargar Datos | Sub-tabs: "Importar CSV/Excel" y "Azure DevOps". Solo en vista global (admin). |

### Beneficios

- **De 11 → 6 tabs** principales (45% menos ruido visual).
- **Agrupación por intención del usuario**: operar / analizar / planear con IA / negociar / documentar / configurar.
- **Comercial unificado**: el PM ve contrato + SLA + acuerdos en un solo lugar (alimenta directamente al PM IA y al WSJF financiero).
- **IA centralizada**: clasificación + scrum + seguimiento bajo una misma sombrilla.

### Cambios técnicos

**Único archivo afectado**: `src/components/support/SupportDashboard.tsx`

1. Reducir el `<TabsList>` principal a 6 triggers.
2. Dentro de cada nuevo `TabsContent`, anidar `<Tabs>` con sub-secciones donde aplique (Analítica, IA & Estrategia, Comercial, Datos).
3. Conservar toda la lógica existente de RBAC, filtros y carga de datos (solo se reorganiza el JSX, no se borra funcionalidad).
4. Mantener las condiciones `isClientView` y `selectedClient !== "all"` para mostrar/ocultar Comercial y Datos & Sync.

### Visual del nuevo layout

```text
[ Operación ] [ Analítica ] [ IA & Estrategia ] [ Comercial ] [ Minutas ] [ Datos & Sync ]
                  └─ Distribuciones | Por Cliente
                                    └─ Clasificación | Seguimiento IA | Backlog Scrum
                                                          └─ Contrato | SLA | Acuerdos
                                                                                          └─ Importar | Azure DevOps
```

No requiere cambios de DB ni de hooks; todos los componentes existentes (`SupportCaseTable`, `SupportClientHeatmap`, `ContractsSLATab`, `SupportAgreementsTab`, `SupportScrumPanel`, `DevOpsPanel`, `SupportDataLoader`, `SupportMinutas`) se reutilizan tal cual, solo cambia su ubicación dentro del árbol de tabs.

