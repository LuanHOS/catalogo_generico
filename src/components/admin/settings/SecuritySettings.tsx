import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Plus, Crown, Trash2, X } from "lucide-react";
import { updatePrivateMode, updateVipMode } from "@/lib/admin.functions";
import { ConfirmActionModal, ScrollLock } from "@/routes/admin";

export function SecuritySettings() {
  const [privateMode, setPrivateMode] = useState(false);
  const [vipMode, setVipMode] = useState(true);
  
  const [showStoreCodeModal, setShowStoreCodeModal] = useState(false);
  const [showVipCodeModal, setShowVipCodeModal] = useState(false);
  
  const [accessCodes, setAccessCodes] = useState<{id: string, code: string, code_type: string, unlocks_vip: boolean}[]>([]);
  
  const [newStoreCode, setNewStoreCode] = useState("");
  const [newStoreUnlocksVip, setNewStoreUnlocksVip] = useState(false);
  const [newVipCode, setNewVipCode] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [savingPrivate, setSavingPrivate] = useState(false);
  const [savingVip, setSavingVip] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(false);
  
  const [codeToDelete, setCodeToDelete] = useState<string | null>(null);
  const [isDeletingCode, setIsDeletingCode] = useState(false);
  
  const savePrivateModeFn = useServerFn(updatePrivateMode);
  const saveVipModeFn = useServerFn(updateVipMode);

  useEffect(() => {
    Promise.all([
      supabase.from("app_settings").select("value").eq("key", "private_mode").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "vip_mode").maybeSingle()
    ]).then(([privRes, vipRes]) => {
      setPrivateMode(privRes.data?.value === "true");
      setVipMode(vipRes.data?.value !== "false");
      setLoading(false);
    });
  }, []);

  const fetchCodes = useCallback(async () => {
    setLoadingCodes(true);
    try {
      const { data, error } = await supabase.from("access_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setAccessCodes(data as any);
    } catch(e) {
      toast.error("Erro ao carregar senhas VIP.");
    }
    setLoadingCodes(false);
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  async function togglePrivateMode(checked: boolean) {
    setSavingPrivate(true);
    try {
       await savePrivateModeFn({ data: { enabled: checked } });
       setPrivateMode(checked);
       toast.success(checked ? "Loja Privada ativada." : "Loja Privada desativada.");
    } catch(err) {
       toast.error("Erro ao alterar modo.");
    }
    setSavingPrivate(false);
  }

  async function toggleVipMode(checked: boolean) {
    setSavingVip(true);
    try {
       await saveVipModeFn({ data: { enabled: checked } });
       setVipMode(checked);
       toast.success(checked ? "Área Exclusiva ativada." : "Área Exclusiva desativada.");
    } catch(err) {
       toast.error("Erro ao alterar modo VIP.");
    }
    setSavingVip(false);
  }

  async function handleCreateStoreCode(e: React.FormEvent) {
    e.preventDefault();
    if (!newStoreCode.trim()) return;
    try {
      const { error } = await supabase.from("access_codes").insert({
        code: newStoreCode.trim(),
        code_type: 'store',
        unlocks_vip: newStoreUnlocksVip
      });
      if (error) throw error;
      setNewStoreCode("");
      setNewStoreUnlocksVip(false);
      setShowStoreCodeModal(false);
      toast.success("Senha da loja criada com sucesso.");
      fetchCodes();
    } catch(err: any) {
      if (err?.code === '23505' || err?.message?.includes('duplicate key') || err?.message?.includes('unique constraint')) {
        toast.error("Esta senha já está cadastrada. Escolha uma senha diferente.");
      } else {
        toast.error(err?.message || "Erro ao criar senha da loja.");
      }
    }
  }

  async function handleCreateVipCode(e: React.FormEvent) {
    e.preventDefault();
    if (!newVipCode.trim()) return;
    try {
      const { error } = await supabase.from("access_codes").insert({
        code: newVipCode.trim(),
        code_type: 'vip',
        unlocks_vip: true
      });
      if (error) throw error;
      setNewVipCode("");
      setShowVipCodeModal(false);
      toast.success("Senha da Área Exclusiva criada com sucesso.");
      fetchCodes();
    } catch(err: any) {
      if (err?.code === '23505' || err?.message?.includes('duplicate key') || err?.message?.includes('unique constraint')) {
        toast.error("Esta senha já está cadastrada. Escolha uma senha diferente.");
      } else {
        toast.error(err?.message || "Erro ao criar senha VIP.");
      }
    }
  }

  function handleDeleteCode(id: string) {
    setCodeToDelete(id);
  }

  async function confirmDeleteCode() {
    if (!codeToDelete) return;
    setIsDeletingCode(true);
    try {
      const { error } = await supabase.from("access_codes").delete().eq("id", codeToDelete);
      if (error) throw error;
      toast.success("Senha revogada.");
      fetchCodes();
    } catch(err) {
      toast.error("Erro ao remover senha.");
    } finally {
      setIsDeletingCode(false);
      setCodeToDelete(null);
    }
  }

  const storeCodes = accessCodes.filter(c => c.code_type === 'store');
  const vipCodes = accessCodes.filter(c => c.code_type === 'vip');

  if (loading) return <p className="text-muted-foreground font-semibold">Carregando…</p>;

  return (
    <>
      <style>{`
        @keyframes shimmer-btn {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .shimmer-btn {
          background-image: linear-gradient(110deg, var(--primary) 20%, color-mix(in srgb, var(--primary) 50%, white) 50%, var(--primary) 80%);
          background-size: 200% auto;
          animation: shimmer-btn 3.5s linear infinite;
          color: var(--primary-foreground) !important;
          border-color: transparent !important;
        }
        .shimmer-btn:hover { filter: brightness(1.1); }
      `}</style>

      {/* 1. Bloco de Loja Privada */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words min-w-0 max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-5 mb-5 min-w-0">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-black flex items-center gap-2 truncate">
              <Lock className="h-5 w-5 text-primary flex-shrink-0" /> <span className="truncate">Loja Privada (Bloqueio Total)</span>
            </h3>
            <p className="mt-1 text-sm font-medium text-muted-foreground break-words whitespace-normal">
              Exija uma senha para os clientes visualizarem qualquer produto do site.
            </p>
          </div>
          <Switch checked={privateMode} onCheckedChange={togglePrivateMode} disabled={savingPrivate} className="flex-shrink-0" />
        </div>

        <div className="min-w-0 max-w-full">
           <div className="flex items-center justify-between mb-4 gap-2">
              <div>
                <h4 className="font-bold text-foreground truncate">Senhas de Acesso à Loja</h4>
                <p className="text-xs text-muted-foreground break-words whitespace-normal">Crie as senhas que os clientes usarão para entrar no site.</p>
              </div>
              <Button onClick={() => setShowStoreCodeModal(true)} className="flex-shrink-0 shadow-sm rounded-full"><Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Nova Senha</span></Button>
           </div>

           {loadingCodes ? (
             <p className="text-sm text-muted-foreground truncate">Carregando...</p>
           ) : storeCodes.length === 0 ? (
             <p className="text-sm text-muted-foreground italic truncate">Nenhuma senha da loja cadastrada.</p>
           ) : (
             <ul className="space-y-2 max-w-lg min-w-0 w-full">
               {storeCodes.map(c => (
                 <li key={c.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-2 bg-secondary/30 gap-2 min-w-0 w-full">
                   <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold truncate block w-full" title={c.code}>{c.code}</span>
                      {c.unlocks_vip && <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide flex items-center gap-1 mt-0.5 truncate"><Crown className="h-3 w-3 flex-shrink-0"/> Libera Área Exclusiva</span>}
                   </div>
                   <button onClick={() => handleDeleteCode(c.id)} className="text-muted-foreground hover:text-destructive p-2 rounded-full hover:bg-destructive/10 transition flex-shrink-0" title="Revogar">
                     <Trash2 className="h-4 w-4" />
                   </button>
                 </li>
               ))}
             </ul>
           )}
        </div>
      </div>

      {/* 2. Bloco de Área Exclusiva (VIP) */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words min-w-0 max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-5 mb-5 min-w-0">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-black flex items-center gap-2 truncate">
              <Crown className="h-5 w-5 text-yellow-600 flex-shrink-0" /> <span className="truncate">Área Exclusiva (VIP)</span>
            </h3>
            <p className="mt-1 text-sm font-medium text-muted-foreground break-words whitespace-normal">
              Proteja categorias específicas. Se desativado, o acesso VIP é suspenso para todos os clientes.
            </p>
          </div>
          <Switch checked={vipMode} onCheckedChange={toggleVipMode} disabled={savingVip} className="flex-shrink-0" />
        </div>

        <div className="min-w-0 max-w-full">
           <div className="flex items-center justify-between mb-4 gap-2">
              <div>
                <h4 className="font-bold text-foreground truncate">Senhas da Área Exclusiva</h4>
                <p className="text-xs text-muted-foreground break-words whitespace-normal">Senhas criadas aqui liberam apenas as categorias marcadas como VIP.</p>
              </div>
              <Button onClick={() => setShowVipCodeModal(true)} className="flex-shrink-0 shadow-sm rounded-full font-bold shimmer-btn"><Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Nova Senha VIP</span></Button>
           </div>

           {loadingCodes ? (
             <p className="text-sm text-muted-foreground truncate">Carregando...</p>
           ) : vipCodes.length === 0 ? (
             <p className="text-sm text-muted-foreground italic truncate">Nenhuma senha exclusiva cadastrada.</p>
           ) : (
             <ul className="space-y-2 max-w-lg min-w-0 w-full">
               {vipCodes.map(c => (
                 <li key={c.id} className="flex items-center justify-between border border-yellow-500/30 rounded-lg px-4 py-2 bg-yellow-500/5 gap-2 min-w-0 w-full">
                   <span className="font-mono font-bold text-yellow-700 truncate w-full flex-1" title={c.code}>{c.code}</span>
                   <button onClick={() => handleDeleteCode(c.id)} className="text-yellow-700 hover:text-destructive p-2 rounded-full hover:bg-destructive/10 transition flex-shrink-0" title="Revogar">
                     <Trash2 className="h-4 w-4" />
                   </button>
                 </li>
               ))}
             </ul>
           )}
        </div>
      </div>

      {codeToDelete && (
        <ConfirmActionModal
          title="Revogar Senha"
          description="Tem certeza que deseja remover esta senha? Quem estiver usando perderá o acesso na mesma hora."
          onClose={() => setCodeToDelete(null)}
          onConfirm={confirmDeleteCode}
          loading={isDeletingCode}
          confirmText="Revogar Acesso"
        />
      )}

      {showStoreCodeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <ScrollLock />
          <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display truncate text-foreground flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary"/> Nova Senha da Loja
              </h3>
              <button onClick={() => setShowStoreCodeModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button>
            </div>
            <form onSubmit={handleCreateStoreCode} className="flex flex-col gap-4">
              <div>
                <Label>Senha <span className="text-destructive">*</span></Label>
                <Input value={newStoreCode} onChange={e => setNewStoreCode(e.target.value)} required maxLength={20} placeholder="Ex: cliente123" className="mt-1" />
              </div>
              <div className="flex items-center justify-between bg-secondary/30 p-3 rounded-lg border border-border min-w-0 gap-3">
                 <div className="min-w-0">
                    <Label className="font-bold flex items-center gap-1.5 truncate"><Crown className="h-4 w-4 text-yellow-600 flex-shrink-0"/> <span className="truncate">Liberar Área Exclusiva</span></Label>
                    <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 truncate">Também dará acesso aos itens VIP.</p>
                 </div>
                 <Switch checked={newStoreUnlocksVip} onCheckedChange={setNewStoreUnlocksVip} className="flex-shrink-0" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
                 <Button type="button" variant="outline" onClick={() => setShowStoreCodeModal(false)} className="rounded-full shadow-sm">Cancelar</Button>
                 <Button type="submit" disabled={!newStoreCode.trim()} className="rounded-full shadow-sm">Adicionar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVipCodeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <ScrollLock />
          <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display truncate text-foreground flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-600"/> Nova Senha VIP
              </h3>
              <button onClick={() => setShowVipCodeModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button>
            </div>
            <form onSubmit={handleCreateVipCode} className="flex flex-col gap-4">
              <div>
                <Label>Senha <span className="text-destructive">*</span></Label>
                <Input value={newVipCode} onChange={e => setNewVipCode(e.target.value)} required maxLength={20} placeholder="Ex: vip_premium" className="mt-1" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
                 <Button type="button" variant="outline" onClick={() => setShowVipCodeModal(false)} className="rounded-full shadow-sm">Cancelar</Button>
                 <Button type="submit" disabled={!newVipCode.trim()} className="rounded-full shadow-sm">Adicionar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}