import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireAuth, requireRole } from "../_shared/auth.ts";

function getDevOpsPat(): string {
  const pat = Deno.env.get("AZURE_DEVOPS_PAT");
  if (!pat) throw new Error("AZURE_DEVOPS_PAT not configured");
  return pat;
}

function devopsHeaders(pat: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${btoa(`:${pat}`)}`,
  };
}

const API_VERSION = "7.1";

interface Connection {
  id: string;
  client_id: string;
  organization: string;
  project: string;
  team: string | null;
  default_work_item_type: string;
  state_mapping: Record<string, string>;
  priority_mapping: Record<string, string>;
}

// ---------- Azure DevOps API helpers ----------

async function devopsGet(pat: string, url: string) {
  const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}api-version=${API_VERSION}`, {
    headers: devopsHeaders(pat),
  });
  if (!res.ok) throw new Error(`DevOps GET ${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function devopsPost(pat: string, url: string, body: unknown) {
  const res = await fetch(`${url}?api-version=${API_VERSION}`, {
    method: "POST",
    headers: devopsHeaders(pat),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DevOps POST ${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function devopsPatch(pat: string, url: string, body: unknown) {
  const res = await fetch(`${url}?api-version=${API_VERSION}`, {
    method: "PATCH",
    headers: { ...devopsHeaders(pat), "Content-Type": "application/json-patch+json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DevOps PATCH ${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---------- Mapping helpers ----------

function invertMap(m: Record<string, string>): Record<string, string> {
  const inv: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) inv[v] = k;
  return inv;
}

// ---------- PULL: DevOps → Sysde ----------

async function pullWorkItems(sb: any, conn: Connection, pat: string) {
  const base = `https://dev.azure.com/${conn.organization}/${conn.project}`;

  // WIQL query for all work items in the project
  const wiql = await devopsPost(pat, `${base}/_apis/wit/wiql`, {
    query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${conn.project}' ORDER BY [System.ChangedDate] DESC`,
  });
  const ids = (wiql.workItems || []).map((w: any) => w.id);
  if (ids.length === 0) return { pulled: 0 };

  // Batch get (max 200 at a time)
  let pulled = 0;
  const stateMapInv = invertMap(conn.state_mapping);
  const prioMapInv = invertMap(conn.priority_mapping);

  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const items = await devopsGet(pat, `${base}/_apis/wit/workitems?ids=${batch.join(",")}&$expand=relations`);

    for (const wi of items.value || []) {
      const devopsId = String(wi.id);
      const fields = wi.fields || {};

      // Check existing mapping
      const { data: existing } = await sb
        .from("devops_sync_mappings")
        .select("*")
        .eq("client_id", conn.client_id)
        .eq("entity_type", "ticket")
        .eq("devops_id", devopsId)
        .maybeSingle();

      const ticketData: Record<string, unknown> = {
        asunto: fields["System.Title"] || "",
        tipo: fields["System.WorkItemType"] || conn.default_work_item_type,
        estado: stateMapInv[fields["System.State"]] || fields["System.State"] || "EN ATENCIÓN",
        prioridad: prioMapInv[String(fields["Microsoft.VSTS.Common.Priority"] || "")] || "Media",
        notas: fields["System.Description"] || null,
        responsable: fields["System.AssignedTo"]?.displayName || null,
      };

      if (existing) {
        // Update existing ticket
        await sb.from("support_tickets").update(ticketData).eq("id", existing.local_id);
        await sb.from("devops_sync_mappings").update({
          devops_rev: wi.rev,
          last_synced_at: new Date().toISOString(),
          last_direction: "pull",
        }).eq("id", existing.id);
      } else {
        // Create new ticket
        const newTicketId = `DEVOPS-${devopsId}`;
        const { data: newTicket } = await sb.from("support_tickets").insert({
          client_id: conn.client_id,
          ticket_id: newTicketId,
          ...ticketData,
        }).select("id").single();

        if (newTicket) {
          await sb.from("devops_sync_mappings").insert({
            client_id: conn.client_id,
            entity_type: "ticket",
            local_id: newTicket.id,
            devops_id: devopsId,
            devops_url: wi._links?.html?.href || null,
            devops_rev: wi.rev,
            last_direction: "pull",
          });
        }
      }
      pulled++;
    }
  }
  return { pulled };
}

// ---------- PUSH: Sysde → DevOps ----------

async function pushWorkItems(sb: any, conn: Connection, pat: string) {
  const base = `https://dev.azure.com/${conn.organization}/${conn.project}`;

  // Get all tickets for this client that are NOT yet mapped
  const { data: tickets } = await sb
    .from("support_tickets")
    .select("*")
    .eq("client_id", conn.client_id);

  const { data: mappings } = await sb
    .from("devops_sync_mappings")
    .select("local_id")
    .eq("client_id", conn.client_id)
    .eq("entity_type", "ticket");

  const mappedIds = new Set((mappings || []).map((m: any) => m.local_id));
  const unmapped = (tickets || []).filter((t: any) => !mappedIds.has(t.id));

  let pushed = 0;

  for (const ticket of unmapped) {
    const state = conn.state_mapping[ticket.estado] || "New";
    const priority = conn.priority_mapping[ticket.prioridad] || "2";

    try {
      const wi = await devopsPatch(pat, `${base}/_apis/wit/workitems/$${conn.default_work_item_type}`, [
        { op: "add", path: "/fields/System.Title", value: ticket.asunto || ticket.ticket_id },
        { op: "add", path: "/fields/System.State", value: state },
        { op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value: Number(priority) },
        { op: "add", path: "/fields/System.Description", value: ticket.notas || "" },
      ]);

      await sb.from("devops_sync_mappings").insert({
        client_id: conn.client_id,
        entity_type: "ticket",
        local_id: ticket.id,
        devops_id: String(wi.id),
        devops_url: wi._links?.html?.href || null,
        devops_rev: wi.rev,
        last_direction: "push",
      });
      pushed++;
    } catch (e) {
      console.error(`Failed to push ticket ${ticket.ticket_id}:`, e);
    }
  }

  // Update already-mapped tickets
  const alreadyMapped = (tickets || []).filter((t: any) => mappedIds.has(t.id));
  for (const ticket of alreadyMapped) {
    const { data: mapping } = await sb
      .from("devops_sync_mappings")
      .select("*")
      .eq("client_id", conn.client_id)
      .eq("entity_type", "ticket")
      .eq("local_id", ticket.id)
      .maybeSingle();

    if (!mapping) continue;

    const state = conn.state_mapping[ticket.estado] || "New";
    const priority = conn.priority_mapping[ticket.prioridad] || "2";

    try {
      await devopsPatch(pat, `${base}/_apis/wit/workitems/${mapping.devops_id}`, [
        { op: "replace", path: "/fields/System.Title", value: ticket.asunto || ticket.ticket_id },
        { op: "replace", path: "/fields/System.State", value: state },
        { op: "replace", path: "/fields/Microsoft.VSTS.Common.Priority", value: Number(priority) },
      ]);

      await sb.from("devops_sync_mappings").update({
        last_synced_at: new Date().toISOString(),
        last_direction: "push",
      }).eq("id", mapping.id);
      pushed++;
    } catch (e) {
      console.error(`Failed to update WI ${mapping.devops_id}:`, e);
    }
  }

  return { pushed };
}

// ---------- PULL iterations → sprints ----------

async function pullIterations(sb: any, conn: Connection, pat: string) {
  const teamPath = conn.team ? `/${conn.team}` : "";
  const base = `https://dev.azure.com/${conn.organization}/${conn.project}${teamPath}`;

  const data = await devopsGet(pat, `${base}/_apis/work/teamsettings/iterations`);
  let pulled = 0;

  for (const iter of data.value || []) {
    const devopsId = iter.id;
    const { data: existing } = await sb
      .from("devops_sync_mappings")
      .select("*")
      .eq("client_id", conn.client_id)
      .eq("entity_type", "sprint")
      .eq("devops_id", devopsId)
      .maybeSingle();

    const sprintData = {
      name: iter.name,
      start_date: iter.attributes?.startDate?.split("T")[0] || null,
      end_date: iter.attributes?.finishDate?.split("T")[0] || null,
      status: iter.attributes?.timeFrame === "current" ? "activo" : iter.attributes?.timeFrame === "past" ? "completado" : "planificado",
    };

    if (existing) {
      await sb.from("support_sprints").update(sprintData).eq("id", existing.local_id);
      await sb.from("devops_sync_mappings").update({
        last_synced_at: new Date().toISOString(),
        last_direction: "pull",
      }).eq("id", existing.id);
    } else {
      const { data: newSprint } = await sb.from("support_sprints").insert({
        client_id: conn.client_id,
        ...sprintData,
      }).select("id").single();

      if (newSprint) {
        await sb.from("devops_sync_mappings").insert({
          client_id: conn.client_id,
          entity_type: "sprint",
          local_id: newSprint.id,
          devops_id: devopsId,
          devops_url: iter.url || null,
          last_direction: "pull",
        });
      }
    }
    pulled++;
  }
  return { pulled };
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = corsHeaders(req);

  const startTime = Date.now();

  try {
    const ctx = await requireAuth(req);
    await requireRole(ctx, ["admin", "pm"]);
    const sb = ctx.adminClient;

    const { action, client_id, direction } = await req.json();

    // Test connection
    if (action === "test") {
      const pat = getDevOpsPat();
      const { data: conn } = await sb
        .from("devops_connections")
        .select("*")
        .eq("client_id", client_id)
        .maybeSingle();
      if (!conn) throw new Error("No connection found for this client");

      const base = `https://dev.azure.com/${conn.organization}/${conn.project}`;
      const result = await devopsGet(pat, `${base}/_apis/projects/${conn.project}`);

      return new Response(JSON.stringify({ success: true, project: result.name }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Sync
    if (action === "sync") {
      let pat: string;
      try {
        pat = getDevOpsPat();
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: "AZURE_DEVOPS_PAT no está configurado. Agrega la llave en la configuración de secretos.",
        }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: conn } = await sb
        .from("devops_connections")
        .select("*")
        .eq("client_id", client_id)
        .maybeSingle();
      if (!conn) throw new Error("No connection configured for this client");

      const syncDirection = direction || "bidirectional";
      let itemsPulled = 0, itemsPushed = 0, itemsFailed = 0;
      const errors: string[] = [];

      // Pull
      if (["pull", "bidirectional"].includes(syncDirection)) {
        try {
          const wiResult = await pullWorkItems(sb, conn as Connection, pat);
          const iterResult = await pullIterations(sb, conn as Connection, pat);
          itemsPulled = wiResult.pulled + iterResult.pulled;
        } catch (e: any) {
          errors.push(`Pull error: ${e.message}`);
          itemsFailed++;
        }
      }

      // Push
      if (["push", "bidirectional"].includes(syncDirection)) {
        try {
          const result = await pushWorkItems(sb, conn as Connection, pat);
          itemsPushed = result.pushed;
        } catch (e: any) {
          errors.push(`Push error: ${e.message}`);
          itemsFailed++;
        }
      }

      const durationMs = Date.now() - startTime;
      const status = errors.length > 0 ? (itemsPulled + itemsPushed > 0 ? "partial" : "error") : "success";

      // Log sync
      await sb.from("devops_sync_logs").insert({
        client_id,
        direction: syncDirection,
        status,
        items_pulled: itemsPulled,
        items_pushed: itemsPushed,
        items_failed: itemsFailed,
        duration_ms: durationMs,
        error_message: errors.length > 0 ? errors.join("; ") : null,
        triggered_by: "manual",
      });

      // Update last_sync_at
      await sb.from("devops_connections").update({ last_sync_at: new Date().toISOString() }).eq("client_id", client_id);

      return new Response(JSON.stringify({
        success: status !== "error",
        status,
        items_pulled: itemsPulled,
        items_pushed: itemsPushed,
        items_failed: itemsFailed,
        duration_ms: durationMs,
        errors,
      }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
