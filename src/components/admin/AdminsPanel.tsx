import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { listAdmins, deleteAdminUser, createAdminUser, updateAdminUser } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ShieldAlert, UserPlus, Pencil, Trash2 } from "lucide-react";

import { ConfirmActionModal, ScrollLock } from "@/routes/admin";

type AdminRow = { id: string; email: string; username: string; fixed: boolean; isMaster: boolean };

export function AdminsPanel({ currentUserId }: { currentUserId: string }) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminRow | null>(null);

  // Limite de exibição simultânea na tela (paginação)
  const [visibleCount, setVisibleCount] = useState(20);

  // Estado para Modal de Exclusão
  const [adminToDelete, setAdminToDelete] = useState<AdminRow | null>(null);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false);

  const list = useServerFn(listAdmins);
  const del = useServerFn(deleteAdminUser);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await list();
      setAdmins(res.admins);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => { refresh(); }, [refresh]);

  async function confirmDeleteAdmin() {
    if (!adminToDelete) return;
    setIsDeletingAdmin(true);
    try {
      await del({ data: { userId: adminToDelete.id } });
      toast.success("Administrador removido");
      if (adminToDelete.id === currentUserId) {
        await supabase.auth.signOut();
        window.location.reload();
        return;
      }
      refresh();
      setEditing(null); // Fecha o modal de edição se estivesse aberto
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    } finally {
      setIsDeletingAdmin(false);
      setAdminToDelete(null);
    }
  }

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <p className="text-sm font-medium text-muted-foreground break-words whitespace-normal min-w-0 max-w-full">
          <ShieldAlert className="mr-1 inline h-4 w-4 flex-shrink-0" />
          O usuário <code className="rounded bg-secondary px-1.5 py-0.5">admin</code> é fixo e não pode ser excluído nem renomeado.
        </p>
        <Button onClick={() => setShowCreate(true)} className="rounded-full shadow-sm flex-shrink-0 w-full sm:w-auto">
          <UserPlus className="mr-1 h-4 w-4" /> Novo administrador
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm min-w-0 max-w-full">
        {loading && <li className="p-6 text-center text-muted-foreground font-semibold truncate">Carregando…</li>}
        {!loading && admins.length === 0 && <li className="p-6 text-center text-muted-foreground font-semibold truncate">Nenhum administrador.</li>}
        {admins.slice(0, visibleCount).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 p-4 break-words min-w-0 max-w-full">
            <div className="min-w-0 flex-1">
              <div className="font-semibold flex flex-wrap items-center gap-2 min-w-0 max-w-full">
                <span className="truncate block max-w-full">{a.username}</span>
                {a.isMaster ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary flex-shrink-0">Master</span>
                ) : (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground flex-shrink-0">Operador</span>
                )}
                {a.fixed && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground border border-border shadow-sm flex-shrink-0">Fixo</span>}
              </div>
              <div className="text-xs font-semibold text-muted-foreground truncate w-full">{a.email}</div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setEditing(a)} title="Editar"><Pencil className="h-4 w-4" /></Button>
            </div>
          </li>
        ))}
      </ul>

      {visibleCount < admins.length && (
         <div className="mt-6 flex justify-center w-full min-w-0">
            <Button variant="outline" onClick={() => setVisibleCount(v => v + 20)} className="rounded-full shadow-sm w-full sm:w-auto">
               Mostrar mais administradores
            </Button>
         </div>
      )}

      {showCreate && (
        <AdminFormModal
          title="Novo administrador"
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); refresh(); }}
        />
      )}
      {editing && (
        <AdminFormModal
          title={`Editar "${editing.username}"`}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
          onDelete={() => setAdminToDelete(editing)}
        />
      )}

      {adminToDelete && (
        <ConfirmActionModal
          title="Excluir Administrador"
          description={`Tem certeza que deseja excluir o administrador "${adminToDelete.username}"? O acesso dele ao painel será revogado imediatamente.`}
          onClose={() => setAdminToDelete(null)}
          onConfirm={confirmDeleteAdmin}
          loading={isDeletingAdmin}
          confirmText="Excluir Administrador"
        />
      )}
    </div>
  );
}

function AdminFormModal({
  title,
  editing,
  onClose,
  onSaved,
  onDelete,
}: {
  title: string;
  editing?: AdminRow;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const isEdit = !!editing;
  const [user, setUser] = useState(editing?.username ?? "");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isMasterRole, setIsMasterRole] = useState(editing?.isMaster ?? false);
  const [loading, setLoading] = useState(false);
  
  const create = useServerFn(createAdminUser);
  const update = useServerFn(updateAdminUser);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit && editing) {
        const payload: { userId: string; user?: string; password?: string; isMaster?: boolean } = { userId: editing.id };
        if (!editing.fixed && user.trim() && user.trim() !== editing.username) payload.user = user.trim();
        
        if (pass.trim() !== "") {
          if (pass.length < 6) {
            setLoading(false);
            return toast.error("Senha precisa ter no mínimo 6 caracteres.");
          }
          payload.password = pass;
        }

        if (!editing.fixed && isMasterRole !== editing.isMaster) {
          payload.isMaster = isMasterRole;
        }

        if (!payload.user && !payload.password && payload.isMaster === undefined) {
          setLoading(false);
          return toast.info("Nada para atualizar.");
        }
        await update({ data: payload });
        toast.success("Administrador atualizado");
      } else {
        if (!user.trim() || pass.length < 6) {
          setLoading(false);
          return toast.error("Usuário e senha (mín. 6 caracteres) obrigatórios");
        }
        await create({ data: { user: user.trim(), password: pass, isMaster: isMasterRole } });
        toast.success(`Administrador "${user}" criado`);
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-0 sm:items-center sm:p-6 backdrop-blur-sm">
      <ScrollLock />
      <form autoComplete="off" onSubmit={submit} className="w-full max-w-md space-y-4 rounded-t-2xl bg-background p-6 shadow-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto break-words min-w-0">
        <div className="flex items-center justify-between min-w-0">
          <h3 className="font-display text-xl font-black truncate">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-muted-foreground flex-shrink-0 ml-2">Fechar</button>
        </div>
        <div className="min-w-0">
          <Label htmlFor="au" className="truncate block">Usuário <span className="text-destructive">*</span></Label>
          <Input
            id="au"
            autoComplete="off"
            data-lpignore="true"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="ex: nome"
            disabled={isEdit && editing?.fixed}
            required
            maxLength={30}
            className="w-full min-w-0"
          />
          {isEdit && editing?.fixed && (
            <p className="mt-1 text-xs font-semibold text-muted-foreground truncate">Esse usuário é fixo — não pode renomear.</p>
          )}
        </div>
        <div className="min-w-0">
          <Label htmlFor="ap" className="truncate block">Senha {!isEdit && <span className="text-destructive">*</span>}</Label>
          <div className="relative min-w-0">
            <Input
              id="ap"
              autoComplete="new-password"
              data-lpignore="true"
              type={showPass ? "text" : "password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={isEdit ? "Deixe em branco para não alterar" : "mínimo 6 caracteres"}
              className="pr-16 w-full min-w-0"
              required={!isEdit}
              maxLength={50}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-secondary transition"
            >
              {showPass ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {isEdit && (
            <p className="mt-1 text-xs font-semibold text-muted-foreground truncate">
              Digite uma nova senha apenas se quiser alterar a atual.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm gap-2 break-words min-w-0 max-w-full">
          <div className={(isEdit && editing?.fixed) ? "opacity-50 min-w-0 flex-1" : "min-w-0 flex-1"}>
            <div className="font-semibold truncate w-full">Administrador Master</div>
            <div className="text-xs font-semibold text-muted-foreground break-words whitespace-normal mt-0.5">Desative para limitar acesso.</div>
          </div>
          <Switch checked={isMasterRole || (isEdit && editing?.fixed)} onCheckedChange={setIsMasterRole} disabled={isEdit && editing?.fixed} className="flex-shrink-0" />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4 mt-2 flex-shrink-0">
          {isEdit && !editing?.fixed && onDelete ? (
            <Button type="button" variant="ghost" size="icon" onClick={onDelete} disabled={loading} className="text-destructive hover:bg-destructive/10 hover:text-destructive flex-shrink-0">
               <Trash2 className="h-5 w-5" />
            </Button>
          ) : <div />}
          <div className="flex gap-2 min-w-0">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full shadow-sm flex-shrink-0">Cancelar</Button>
            <Button type="submit" disabled={loading} className="rounded-full shadow-sm flex-shrink-0">
              {loading ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}