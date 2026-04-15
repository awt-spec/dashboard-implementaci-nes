

## Plan: Corregir Minutas de Soporte y Filtro de Sidebar

### Problemas identificados

1. **Minutas no funcionan**: El componente `SupportMinutas` envía `systemPrompt` al edge function `summarize-transcript`, pero la función espera `clientName`. El campo `clientName` nunca se envía, causando que la IA no reciba el contexto correcto del cliente.

2. **Sidebar muestra clientes incorrectos en Implementación**: Aunque el filtro `client_type === "implementacion"` existe, necesito verificar si hay un problema de datos o de renderizado. La DB tiene exactamente 3 clientes de implementación (ARKFIN, GRUPO APEX, GRUPO AURUM) y 20 de soporte.

### Cambios

**1. Corregir `src/components/support/SupportMinutas.tsx`** (líneas 79-95)
- Cambiar el body del `supabase.functions.invoke("summarize-transcript")` para enviar `clientName` en vez de `systemPrompt`
- El transcript ya contiene la info de los casos, y la función edge tiene su propio system prompt — no necesita uno custom

**2. Verificar y reforzar filtro en `src/components/dashboard/AppSidebar.tsx`**
- Agregar un `console.log` temporal o revisar si `client_type` se pierde en el mapeo
- Si el problema es que `useClients()` retorna clientes sin `client_type` definido, agregar fallback para excluirlos
- Asegurar que solo ARKFIN, GRUPO APEX y GRUPO AURUM aparezcan en la sección "Implementación"

### Detalles técnicos

```typescript
// Fix 1: SupportMinutas.tsx - Corregir llamada al edge function
const { data, error } = await supabase.functions.invoke("summarize-transcript", {
  body: {
    transcript: `MINUTA DE SOPORTE...`,
    clientName: clientName,  // ← was sending systemPrompt instead
  },
});

// Fix 2: AppSidebar.tsx - Reforzar filtro
const implClients = allClients.filter(
  (c: any) => c.client_type === "implementacion"
);
```

