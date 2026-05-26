import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/adminEmails";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  AdminAppointment,
  AdminClient,
  AdminRemoval,
  AppointmentStatus,
  AppointmentType,
  ImpactType,
  RemovalStatus,
} from "@/app/admin/admin-data";

export const dynamic = "force-dynamic";

type OperationEntity = "client" | "removal" | "appointment";

type OperationPayload = {
  entity?: OperationEntity | "state";
  row?: unknown;
  id?: unknown;
};

type AdminClientRow = {
  id: string;
  name: string | null;
  document: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type AdminRemovalRow = {
  id: string;
  client_id: string;
  seller_id: string | null;
  ml_order_id: string | null;
  pack_id: string | null;
  claim_id: string | null;
  shipment_id: string | null;
  impact_type: ImpactType;
  status: RemovalStatus;
  title: string | null;
  description: string | null;
  charged_amount: number | string | null;
  success: boolean | null;
  service_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  report_notes: string | null;
  internal_notes: string | null;
  evidence_links: string[] | null;
  priority: "alta" | "media" | "baixa" | null;
};

type AdminAppointmentRow = {
  id: string;
  client_id: string;
  title: string | null;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  potential_amount: number | string | null;
  priority: "alta" | "media" | "baixa" | null;
  notes: string | null;
};

function getBearer(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  return auth.replace(/^Bearer\s+/i, "").trim();
}

function supabaseWithBearer(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
}

async function requireAdmin(req: NextRequest) {
  const token = getBearer(req);

  if (!token) {
    return { ok: false as const, status: 401, error: "Nao autenticado" };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const user = data?.user;

  if (error || !user) {
    return { ok: false as const, status: 401, error: "Sessao invalida" };
  }

  if (isAdminEmail(user.email)) {
    return { ok: true as const, userId: user.id };
  }

  const supabaseUser = supabaseWithBearer(token);
  const { data: isAdmin, error: adminErr } = await supabaseUser.rpc("is_admin");

  if (adminErr) {
    return { ok: false as const, status: 500, error: `Falha ao verificar admin: ${adminErr.message}` };
  }

  if (!isAdmin) {
    return { ok: false as const, status: 403, error: "Acesso negado" };
  }

  return { ok: true as const, userId: user.id };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function optionalText(value: unknown) {
  const next = text(value).trim();
  return next || null;
}

function numberValue(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function booleanOrNull(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function dbClientToApp(row: AdminClientRow): AdminClient {
  return {
    id: row.id,
    name: row.name ?? "",
    document: row.document ?? "",
    contactName: row.contact_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    notes: row.notes ?? "",
  };
}

function dbRemovalToApp(row: AdminRemovalRow): AdminRemoval {
  return {
    id: row.id,
    clientId: row.client_id,
    sellerId: row.seller_id ?? undefined,
    mlOrderId: row.ml_order_id ?? undefined,
    packId: row.pack_id ?? undefined,
    claimId: row.claim_id ?? undefined,
    shipmentId: row.shipment_id ?? undefined,
    impactType: row.impact_type,
    status: row.status,
    title: row.title ?? "",
    description: row.description ?? "",
    chargedAmount: numberValue(row.charged_amount),
    success: row.success,
    serviceDate: row.service_date ?? "",
    dueDate: row.due_date ?? "",
    completedAt: row.completed_at ?? undefined,
    reportNotes: row.report_notes ?? "",
    internalNotes: row.internal_notes ?? "",
    evidenceLinks: row.evidence_links ?? [],
    priority: row.priority ?? "media",
  };
}

function dbAppointmentToApp(row: AdminAppointmentRow): AdminAppointment {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title ?? "",
    type: row.type,
    status: row.status,
    scheduledDate: row.scheduled_date ?? "",
    scheduledTime: row.scheduled_time ?? "09:00",
    durationMinutes: row.duration_minutes ?? 30,
    potentialAmount: numberValue(row.potential_amount),
    priority: row.priority ?? "media",
    notes: row.notes ?? "",
  };
}

function appClientToDb(value: unknown) {
  const row = isRecord(value) ? value : {};

  return {
    id: text(row.id),
    name: text(row.name).trim(),
    document: text(row.document).trim(),
    contact_name: text(row.contactName).trim(),
    phone: text(row.phone).trim(),
    email: text(row.email).trim(),
    notes: text(row.notes).trim(),
  };
}

function appRemovalToDb(value: unknown) {
  const row = isRecord(value) ? value : {};

  return {
    id: text(row.id),
    client_id: text(row.clientId),
    seller_id: optionalText(row.sellerId),
    ml_order_id: optionalText(row.mlOrderId),
    pack_id: optionalText(row.packId),
    claim_id: optionalText(row.claimId),
    shipment_id: optionalText(row.shipmentId),
    impact_type: text(row.impactType, "reclamacao"),
    status: text(row.status, "pendente"),
    title: text(row.title).trim(),
    description: text(row.description).trim(),
    charged_amount: numberValue(row.chargedAmount),
    success: booleanOrNull(row.success),
    service_date: text(row.serviceDate),
    due_date: text(row.dueDate),
    completed_at: optionalText(row.completedAt),
    report_notes: text(row.reportNotes).trim(),
    internal_notes: text(row.internalNotes).trim(),
    evidence_links: stringArray(row.evidenceLinks),
    priority: text(row.priority, "media"),
  };
}

function appAppointmentToDb(value: unknown) {
  const row = isRecord(value) ? value : {};

  return {
    id: text(row.id),
    client_id: text(row.clientId),
    title: text(row.title).trim(),
    type: text(row.type, "tarefa"),
    status: text(row.status, "agendado"),
    scheduled_date: text(row.scheduledDate),
    scheduled_time: text(row.scheduledTime, "09:00"),
    duration_minutes: numberValue(row.durationMinutes, 30),
    potential_amount: numberValue(row.potentialAmount),
    priority: text(row.priority, "media"),
    notes: text(row.notes).trim(),
  };
}

function tableMissing(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42P01" || /does not exist/i.test(error.message ?? "");
}

async function listState() {
  const [clientsRes, removalsRes, appointmentsRes] = await Promise.all([
    supabaseAdmin
      .from("admin_clients")
      .select("id, name, document, contact_name, phone, email, notes")
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("admin_removals")
      .select(
        "id, client_id, seller_id, ml_order_id, pack_id, claim_id, shipment_id, impact_type, status, title, description, charged_amount, success, service_date, due_date, completed_at, report_notes, internal_notes, evidence_links, priority"
      )
      .order("service_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("admin_appointments")
      .select("id, client_id, title, type, status, scheduled_date, scheduled_time, duration_minutes, potential_amount, priority, notes")
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true }),
  ]);

  const firstError = clientsRes.error ?? removalsRes.error ?? appointmentsRes.error;
  if (firstError) {
    return {
      ok: false as const,
      status: tableMissing(firstError) ? 503 : 500,
      body: {
        ok: false,
        setupRequired: tableMissing(firstError),
        error: firstError.message,
      },
    };
  }

  const clients = (clientsRes.data ?? []).map((row) => dbClientToApp(row as AdminClientRow));
  const removals = (removalsRes.data ?? []).map((row) => dbRemovalToApp(row as AdminRemovalRow));
  const appointments = (appointmentsRes.data ?? []).map((row) => dbAppointmentToApp(row as AdminAppointmentRow));

  return {
    ok: true as const,
    body: {
      ok: true,
      clients,
      removals,
      appointments,
    },
  };
}

async function upsertEntity(entity: OperationEntity, row: unknown) {
  if (entity === "client") {
    const payload = appClientToDb(row);
    const { data, error } = await supabaseAdmin
      .from("admin_clients")
      .upsert(payload, { onConflict: "id" })
      .select("id, name, document, contact_name, phone, email, notes")
      .single();

    if (error) return { ok: false as const, error };
    return { ok: true as const, row: dbClientToApp(data as AdminClientRow) };
  }

  if (entity === "removal") {
    const payload = appRemovalToDb(row);
    const { data, error } = await supabaseAdmin
      .from("admin_removals")
      .upsert(payload, { onConflict: "id" })
      .select(
        "id, client_id, seller_id, ml_order_id, pack_id, claim_id, shipment_id, impact_type, status, title, description, charged_amount, success, service_date, due_date, completed_at, report_notes, internal_notes, evidence_links, priority"
      )
      .single();

    if (error) return { ok: false as const, error };
    return { ok: true as const, row: dbRemovalToApp(data as AdminRemovalRow) };
  }

  const payload = appAppointmentToDb(row);
  const { data, error } = await supabaseAdmin
    .from("admin_appointments")
    .upsert(payload, { onConflict: "id" })
    .select("id, client_id, title, type, status, scheduled_date, scheduled_time, duration_minutes, potential_amount, priority, notes")
    .single();

  if (error) return { ok: false as const, error };
  return { ok: true as const, row: dbAppointmentToApp(data as AdminAppointmentRow) };
}

async function upsertState(row: unknown) {
  const state = isRecord(row) ? row : {};
  const clients = arrayValue(state.clients).map(appClientToDb).filter((client) => client.id);
  const removals = arrayValue(state.removals).map(appRemovalToDb).filter((removal) => removal.id);
  const appointments = arrayValue(state.appointments)
    .map(appAppointmentToDb)
    .filter((appointment) => appointment.id);

  if (clients.length > 0) {
    const { error } = await supabaseAdmin.from("admin_clients").upsert(clients, { onConflict: "id" });
    if (error) return { ok: false as const, error };
  }

  if (removals.length > 0) {
    const { error } = await supabaseAdmin.from("admin_removals").upsert(removals, { onConflict: "id" });
    if (error) return { ok: false as const, error };
  }

  if (appointments.length > 0) {
    const { error } = await supabaseAdmin
      .from("admin_appointments")
      .upsert(appointments, { onConflict: "id" });
    if (error) return { ok: false as const, error };
  }

  return { ok: true as const };
}

async function deleteEntity(entity: OperationEntity, id: string) {
  const table =
    entity === "client"
      ? "admin_clients"
      : entity === "removal"
        ? "admin_removals"
        : "admin_appointments";

  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  return error ? { ok: false as const, error } : { ok: true as const };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return Response.json({ ok: false, error: admin.error }, { status: admin.status });

  const result = await listState();
  if (!result.ok) return Response.json(result.body, { status: result.status });

  return Response.json(result.body);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return Response.json({ ok: false, error: admin.error }, { status: admin.status });

  try {
    const payload = (await req.json()) as OperationPayload;
    const entity = payload.entity;

    if (entity === "state") {
      const result = await upsertState(payload.row);
      if (!result.ok) {
        return Response.json(
          { ok: false, setupRequired: tableMissing(result.error), error: result.error.message },
          { status: tableMissing(result.error) ? 503 : 500 }
        );
      }

      const state = await listState();
      if (!state.ok) return Response.json(state.body, { status: state.status });

      return Response.json(state.body);
    }

    if (entity !== "client" && entity !== "removal" && entity !== "appointment") {
      return Response.json({ ok: false, error: "Entidade invalida" }, { status: 400 });
    }

    const result = await upsertEntity(entity, payload.row);
    if (!result.ok) {
      return Response.json(
        { ok: false, setupRequired: tableMissing(result.error), error: result.error.message },
        { status: tableMissing(result.error) ? 503 : 500 }
      );
    }

    return Response.json({ ok: true, row: result.row });
  } catch (error: unknown) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao salvar" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return Response.json({ ok: false, error: admin.error }, { status: admin.status });

  try {
    const payload = (await req.json()) as OperationPayload;
    const entity = payload.entity;
    const id = text(payload.id);

    if (entity !== "client" && entity !== "removal" && entity !== "appointment") {
      return Response.json({ ok: false, error: "Entidade invalida" }, { status: 400 });
    }

    if (!id) {
      return Response.json({ ok: false, error: "ID obrigatorio" }, { status: 400 });
    }

    const result = await deleteEntity(entity, id);
    if (!result.ok) {
      return Response.json(
        { ok: false, setupRequired: tableMissing(result.error), error: result.error.message },
        { status: tableMissing(result.error) ? 503 : 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (error: unknown) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao excluir" },
      { status: 500 }
    );
  }
}
