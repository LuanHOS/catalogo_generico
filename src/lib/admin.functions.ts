import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FIXED_ADMIN_USERNAME = "admin";
const FIXED_ADMIN_EMAIL = "admin@banquinha.local";
const FIXED_ADMIN_PASSWORD = "adminpamelafortes";

function toAdminEmail(user: string) {
  return user.includes("@") ? user : `${user}@banquinha.local`;
}

function usernameFromEmail(email: string) {
  return email.split("@")[0] ?? email;
}

async function assertCallerIsAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Sem permissão de administrador.");
}

function pwdKey(userId: string) {
  return `admin_pwd:${userId}`;
}

async function storePassword(userId: string, password: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("app_settings")
    .upsert({ key: pwdKey(userId), value: password }, { onConflict: "key" });
}

/* ---------- Seed do admin fixo (idempotente, sem auth) ---------- */
export const ensureSeedAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: sentinel } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "admin_seeded_v3")
    .maybeSingle();

  if (sentinel?.value === "true") return { ok: true, skipped: true };

  // Procura usuário admin existente
  const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.data?.users?.find((u) => u.email === FIXED_ADMIN_EMAIL);

  let userId: string;
  if (existing) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: FIXED_ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    userId = existing.id;
  } else {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: FIXED_ADMIN_EMAIL,
      password: FIXED_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { username: FIXED_ADMIN_USERNAME, fixed: true },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar admin");
    userId = created.user.id;
  }

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

  await supabaseAdmin
    .from("app_settings")
    .upsert({ key: "admin_seeded_v3", value: "true" }, { onConflict: "key" });

  await storePassword(userId, FIXED_ADMIN_PASSWORD);

  return { ok: true };
});

/* ---------- Listar administradores ---------- */
export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCallerIsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (rolesErr) throw new Error(rolesErr.message);

    const ids = new Set((roles ?? []).map((r) => r.user_id));
    const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const admins =
      list.data?.users
        ?.filter((u) => ids.has(u.id))
        .map((u) => ({
          id: u.id,
          email: u.email ?? "",
          username: usernameFromEmail(u.email ?? ""),
          fixed: u.email === FIXED_ADMIN_EMAIL,
        })) ?? [];

    return { admins };
  });

/* ---------- Criar administrador ---------- */
const createSchema = z.object({
  user: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_.-]+$|@/),
  password: z.string().min(6).max(72),
});

export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = toAdminEmail(data.user);
    if (email === FIXED_ADMIN_EMAIL) {
      throw new Error("Usuário 'admin' já existe e é fixo.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.user },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar admin");

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "admin" }, { onConflict: "user_id,role" });
    if (roleErr) throw new Error(roleErr.message);

    await storePassword(created.user.id, data.password);

    return { id: created.user.id, email };
  });

/* ---------- Atualizar usuário/senha ---------- */
const updateSchema = z.object({
  userId: z.string().uuid(),
  user: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_.-]+$|@/).optional(),
  password: z.string().min(6).max(72).optional(),
});

export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (!target.user) throw new Error("Usuário não encontrado.");
    const isFixed = target.user.email === FIXED_ADMIN_EMAIL;

    const patch: { email?: string; password?: string } = {};
    if (data.user) {
      if (isFixed) throw new Error("O usuário 'admin' não pode ser renomeado.");
      patch.email = toAdminEmail(data.user);
      if (patch.email === FIXED_ADMIN_EMAIL) {
        throw new Error("Esse nome de usuário é reservado.");
      }
    }
    if (data.password) patch.password = data.password;
    if (!patch.email && !patch.password) return { ok: true };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, patch);
    if (error) throw new Error(error.message);
    if (patch.password) await storePassword(data.userId, patch.password);
    return { ok: true };
  });

/* ---------- Excluir administrador ---------- */
const deleteSchema = z.object({ userId: z.string().uuid() });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (!target.user) throw new Error("Usuário não encontrado.");
    if (target.user.email === FIXED_ADMIN_EMAIL) {
      throw new Error("O usuário 'admin' não pode ser excluído.");
    }

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      throw new Error("Deve existir pelo menos um administrador.");
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("app_settings").delete().eq("key", pwdKey(data.userId));
    return { ok: true };
  });

/* ---------- Obter senha de um administrador ---------- */
const getPasswordSchema = z.object({ userId: z.string().uuid() });

export const getAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => getPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", pwdKey(data.userId))
      .maybeSingle();
    return { password: row?.value ?? "" };
  });

/* ---------- Configuração do WhatsApp ---------- */
const whatsappSchema = z.object({
  number: z
    .string()
    .trim()
    .min(8)
    .max(20)
    .regex(/^[+\d\s()-]+$/, "Use apenas dígitos e símbolos comuns de telefone."),
});

export const updateWhatsAppNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => whatsappSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const clean = data.number.replace(/\D/g, "");
    if (clean.length < 8) throw new Error("Número inválido.");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "whatsapp_number", value: clean }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { number: clean };
  });