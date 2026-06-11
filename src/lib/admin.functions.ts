import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FIXED_ADMIN_USERNAME = "admin";
const FIXED_ADMIN_EMAIL = "admin@catalogo.local";
const FIXED_ADMIN_PASSWORD = "admincatalogo";

function toAdminEmail(user: string) {
  return user.includes("@") ? user : `${user}@catalogo.local`;
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

// Nova trava de segurança para o dono da loja
async function assertCallerIsMaster(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("is_master")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data?.is_master) throw new Error("Apenas o Administrador Master pode fazer isso.");
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
    .eq("key", "admin_seeded_v4")
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

  // O admin fixo principal é sempre master
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin", is_master: true }, { onConflict: "user_id,role" });

  await supabaseAdmin
    .from("app_settings")
    .upsert({ key: "admin_seeded_v4", value: "true" }, { onConflict: "key" });

  await storePassword(userId, FIXED_ADMIN_PASSWORD);

  return { ok: true };
});

/* ---------- Listar administradores ---------- */
export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, is_master")
      .eq("role", "admin");
    if (rolesErr) throw new Error(rolesErr.message);

    const rolesMap = new Map((roles ?? []).map((r) => [r.user_id, r.is_master]));
    const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const admins =
      list.data?.users
        ?.filter((u) => rolesMap.has(u.id))
        .map((u) => ({
          id: u.id,
          email: u.email ?? "",
          username: usernameFromEmail(u.email ?? ""),
          fixed: u.email === FIXED_ADMIN_EMAIL,
          isMaster: !!rolesMap.get(u.id)
        })) ?? [];

    return { admins };
  });

/* ---------- Criar administrador ---------- */
const createSchema = z.object({
  user: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_.-]+$|@/),
  password: z.string().min(6).max(72),
  isMaster: z.boolean().optional()
});

export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = toAdminEmail(data.user);
    if (email === FIXED_ADMIN_EMAIL) {
      throw new Error("O nome de usuário 'admin' é reservado.");
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
      .insert({ user_id: created.user.id, role: "admin", is_master: data.isMaster ?? false });
    if (roleErr) throw new Error(roleErr.message);

    await storePassword(created.user.id, data.password);

    return { id: created.user.id, email };
  });

/* ---------- Atualizar usuário/senha ---------- */
const updateSchema = z.object({
  userId: z.string().uuid(),
  user: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_.-]+$|@/).optional(),
  password: z.string().min(6).max(72).optional(),
  isMaster: z.boolean().optional()
});

export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (!target.user) throw new Error("Usuário não encontrado.");
    const isFixed = target.user.email === FIXED_ADMIN_EMAIL;

    const patch: { email?: string; password?: string } = {};
    if (data.user) {
      if (isFixed) throw new Error("O usuário 'admin' não pode ser renomeado.");
      patch.email = toAdminEmail(data.user);
      if (patch.email === FIXED_ADMIN_EMAIL) {
        throw new Error("O nome de usuário 'admin' é reservado.");
      }
    }
    if (data.password) patch.password = data.password;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, patch);
      if (error) throw new Error(error.message);
      if (patch.password) await storePassword(data.userId, patch.password);
    }

    if (data.isMaster !== undefined && !isFixed) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .update({ is_master: data.isMaster })
        .eq("user_id", data.userId);
      if (roleErr) throw new Error(roleErr.message);
    }

    return { ok: true };
  });

/* ---------- Excluir administrador ---------- */
const deleteSchema = z.object({ userId: z.string().uuid() });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (!target.user) throw new Error("Usuário não encontrado.");
    if (target.user.email === FIXED_ADMIN_EMAIL) {
      throw new Error("O usuário 'admin' não pode ser excluído.");
    }

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_master", true);
    
    if ((count ?? 0) <= 1) {
      const { data: isTargetMaster } = await supabaseAdmin.from("user_roles").select("is_master").eq("user_id", data.userId).single();
      if (isTargetMaster?.is_master) {
        throw new Error("Deve haver pelo menos um Administrador Master.");
      }
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.auth.admin.deleteUser(data.userId);
    await supabaseAdmin.from("app_settings").delete().eq("key", pwdKey(data.userId));
    return { ok: true };
  });

/* ---------- Obter senha de um administrador ---------- */
const getPasswordSchema = z.object({ userId: z.string().uuid() });

export const getAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => getPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", pwdKey(data.userId))
      .maybeSingle();
    if (!row) throw new Error("Senha não encontrada.");
    return { password: row.value };
  });

/* ---------- Configurações Globais ---------- */
const whatsappSchema = z.object({
  number: z.string().trim().min(8).max(20).regex(/^[+\d\s()-]+$/, "Telefone inválido"),
});

export const updateWhatsAppNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => whatsappSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const clean = data.number.replace(/\D/g, "");
    if (clean.length < 8) throw new Error("Telefone inválido");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "whatsapp_number", value: clean }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { number: clean };
  });

const catalogNameSchema = z.object({ name: z.string().trim().min(1).max(100) });

export const updateCatalogName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => catalogNameSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "catalog_name", value: data.name }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { name: data.name };
  });

const themeSchema = z.object({ theme: z.string().trim().min(1).max(50) });

export const updateSystemTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => themeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "system_theme", value: data.theme }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { theme: data.theme };
  });

const privateModeSchema = z.object({ enabled: z.boolean() });

export const updatePrivateMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => privateModeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "private_mode", value: data.enabled ? "true" : "false" }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { enabled: data.enabled };
  });

/* ---------- Gerenciar Senhas VIP ---------- */
export const listAccessCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("access_codes").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { codes: data ?? [] };
  });

const createCodeSchema = z.object({ code: z.string().trim().min(1).max(50) });

export const createAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => createCodeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: existing } = await supabaseAdmin.from("access_codes").select("id").eq("code", data.code).maybeSingle();
    if (existing) throw new Error("Senha já existe");

    const { error } = await supabaseAdmin.from("access_codes").insert({ code: data.code });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteCodeSchema = z.object({ id: z.string().uuid() });

export const deleteAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => deleteCodeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("access_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });