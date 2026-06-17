import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Lock, Plus, Crown, Trash2, Palette, ShoppingBag, Phone, X, Upload, Image as ImageIcon, PanelBottom } from "lucide-react";
import { brl, DEFAULT_WHATSAPP_NUMBER, whatsappLink } from "@/lib/whatsapp";
import {
  updateWhatsAppNumber,
  updateCatalogName,
  updateCatalogLogo,
  updateSystemTheme,
  updatePrivateMode,
  updateVipMode,
} from "@/lib/admin.functions";

import { SYSTEM_THEMES, applyTheme, ConfirmActionModal, ScrollLock } from "@/routes/admin";

export function SettingsPanel() {
  const [number, setNumber] = useState("");
  const [catalogName, setCatalogName] = useState("");
  const [catalogLogo, setCatalogLogo] = useState("");
  const [theme, setTheme] = useState("");
  
  // UI states for logo preview/remove
  const [previewLogo, setPreviewLogo] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const [showRemoveLogoConfirm, setShowRemoveLogoConfirm] = useState(false);
  
  // Novos estados do Modo Privado e Área Exclusiva
  const [privateMode, setPrivateMode] = useState(false);
  const [vipMode, setVipMode] = useState(true);
  
  const [showStoreCodeModal, setShowStoreCodeModal] = useState(false);
  const [showVipCodeModal, setShowVipCodeModal] = useState(false);

  // Novos estados do Rodapé
  const [catalogDesc, setCatalogDesc] = useState("");
  const [catalogAddress, setCatalogAddress] = useState("");
  const [showDescModal, setShowDescModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [tempDesc, setTempDesc] = useState("");
  const [tempAddress, setTempAddress] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  
  // Array com todas as senhas (buscadas direto do banco para ter acesso aos novos campos)
  const [accessCodes, setAccessCodes] = useState<{id: string, code: string, code_type: string, unlocks_vip: boolean}[]>([]);
  
  // Formulário: Senha da Loja
  const [newStoreCode, setNewStoreCode] = useState("");
  const [newStoreUnlocksVip, setNewStoreUnlocksVip] = useState(false);

  // Formulário: Senha da Área Exclusiva
  const [newVipCode, setNewVipCode] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [savingNumber, setSavingNumber] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingPrivate, setSavingPrivate] = useState(false);
  const [savingVip, setSavingVip] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(false);
  
  // Estado para Modal de Exclusão de Senha VIP e Validação do WPP
  const [codeToDelete, setCodeToDelete] = useState<string | null>(null);
  const [isDeletingCode, setIsDeletingCode] = useState(false);
  const [showInvalidWhatsApp, setShowInvalidWhatsApp] = useState(false);
  
  const saveNumberFn = useServerFn(updateWhatsAppNumber);
  const saveNameFn = useServerFn(updateCatalogName);
  const saveLogoFn = useServerFn(updateCatalogLogo);
  const saveThemeFn = useServerFn(updateSystemTheme);
  const savePrivateModeFn = useServerFn(updatePrivateMode);
  const saveVipModeFn = useServerFn(updateVipMode);

  useEffect(() => {
    Promise.all([
      supabase.from("app_settings").select("value").eq("key", "whatsapp_number").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "catalog_name").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "system_theme").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "private_mode").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "catalog_logo").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "vip_mode").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "catalog_description").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "catalog_address").maybeSingle()
    ]).then(([waRes, catRes, themeRes, privRes, logoRes, vipRes, descRes, addRes]) => {
      setNumber(waRes.data?.value ?? DEFAULT_WHATSAPP_NUMBER);
      setCatalogName(catRes.data?.value ?? "Catálogo de Produtos");
      setTheme(themeRes.data?.value ?? "strong-gray");
      setPrivateMode(privRes.data?.value === "true");
      setVipMode(vipRes.data?.value !== "false"); // Default true
      setCatalogDesc(descRes.data?.value ?? "");
      setCatalogAddress(addRes.data?.value ?? "");
      
      const logoVal = logoRes.data?.value ?? "";
      setCatalogLogo(logoVal);
      setPreviewLogo(logoVal);
      
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

  async function submitNumber(e: React.FormEvent) {
    e.preventDefault();
    
    const cleanNumber = number.replace(/\D/g, '');
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      setShowInvalidWhatsApp(true);
      return;
    }

    setSavingNumber(true);
    try {
      const res = await saveNumberFn({ data: { number: cleanNumber } });
      setNumber(res.number);
      toast.success("Número do WhatsApp atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSavingNumber(false);
    }
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    if (!catalogName.trim()) return toast.error("O nome não pode ser vazio.");
    setSavingName(true);
    try {
      const res = await saveNameFn({ data: { name: catalogName } });
      setCatalogName(res.name);
      toast.success("Nome do catálogo atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSavingName(false);
    }
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedLogoFile(file);
    setPreviewLogo(URL.createObjectURL(file));
    setIsRemovingLogo(false);
  }

  function handleLogoRemoveClick() {
    setShowRemoveLogoConfirm(true);
  }

  function confirmRemoveLogo() {
    setPreviewLogo("");
    setSelectedLogoFile(null);
    setIsRemovingLogo(true);
    setShowRemoveLogoConfirm(false);
  }

  function undoLogoChanges() {
    setPreviewLogo(catalogLogo);
    setSelectedLogoFile(null);
    setIsRemovingLogo(false);
  }

  async function submitLogo(e: React.FormEvent) {
    e.preventDefault();
    setSavingLogo(true);
    try {
      let finalUrl = catalogLogo;

      if (isRemovingLogo) {
        finalUrl = "";
      } else if (selectedLogoFile) {
        const options = { maxSizeMB: 0.2, maxWidthOrHeight: 600, useWebWorker: true };
        const compressedFile = await imageCompression(selectedLogoFile, options);
        const ext = compressedFile.name.split(".").pop() || "png";
        const path = `logos/${crypto.randomUUID()}.${ext}`;
        
        const { error } = await supabase.storage.from("product-images").upload(path, compressedFile, { upsert: false });
        if (error) { 
          toast.error("Falha no envio da imagem"); 
          setSavingLogo(false); 
          return; 
        }
        
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        if (!data?.publicUrl) { 
          toast.error("Falha ao gerar URL"); 
          setSavingLogo(false); 
          return; 
        }
        
        finalUrl = data.publicUrl;
      }

      if (finalUrl !== catalogLogo || isRemovingLogo) {
        // EXCLUSÃO DA IMAGEM ANTIGA DA LOGO NO STORAGE
        if (catalogLogo) {
          const oldPath = catalogLogo.split('/public/product-images/')[1];
          if (oldPath) {
            await supabase.storage.from("product-images").remove([oldPath]);
          }
        }

        await saveLogoFn({ data: { logoUrl: finalUrl } });
        setCatalogLogo(finalUrl);
        setPreviewLogo(finalUrl);
        setSelectedLogoFile(null);
        setIsRemovingLogo(false);
        toast.success("Logo salva com sucesso!");
      } else {
        toast.info("Nenhuma alteração para salvar.");
      }
    } catch (error) {
      toast.error("Erro ao salvar a logo.");
    } finally {
      setSavingLogo(false);
    }
  }

  async function submitTheme(e: React.FormEvent) {
    e.preventDefault();
    setSavingTheme(true);
    try {
      const res = await saveThemeFn({ data: { theme } });
      setTheme(res.theme);
      applyTheme(res.theme);
      toast.success("Cores do sistema atualizadas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSavingTheme(false);
    }
  }

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
      toast.error(err.message || "Erro ao criar senha");
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
      toast.error(err.message || "Erro ao criar senha");
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

  const hasLogoChanges = selectedLogoFile !== null || isRemovingLogo;

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      
      {/* Bloco de Loja Privada */}
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

      {/* Bloco de Área Exclusiva (VIP) */}
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
              <Button onClick={() => setShowVipCodeModal(true)} variant="secondary" className="flex-shrink-0 shadow-sm rounded-full bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 border border-yellow-500/30 font-bold"><Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Nova Senha VIP</span></Button>
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

      {/* Bloco de Rodapé */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words min-w-0 max-w-full">
        <h3 className="font-display text-lg font-black flex items-center gap-2 truncate">
          <PanelBottom className="h-5 w-5 text-primary flex-shrink-0" /> <span className="truncate">Rodapé da Loja</span>
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words whitespace-normal">
          Personalize as informações que aparecem no final da página da sua loja.
        </p>

        <div className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-lg bg-secondary/20 gap-4">
            <div>
              <h4 className="font-bold text-foreground">Descrição do Catálogo</h4>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {catalogDesc || "Padrão: Este site funciona apenas como um catálogo para vendas online..."}
              </p>
            </div>
            <Button variant="outline" onClick={() => { setTempDesc(catalogDesc); setShowDescModal(true); }} className="rounded-full shadow-sm flex-shrink-0">
              Editar
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-lg bg-secondary/20 gap-4">
            <div>
              <h4 className="font-bold text-foreground">Endereço Físico</h4>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {catalogAddress || "Padrão: Para saber o endereço, pergunte diretamente através do WhatsApp."}
              </p>
            </div>
            <Button variant="outline" onClick={() => { setTempAddress(catalogAddress); setShowAddressModal(true); }} className="rounded-full shadow-sm flex-shrink-0">
              Editar
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words min-w-0 max-w-full">
        <h3 className="font-display text-lg font-black flex items-center gap-2 truncate">
          <Palette className="h-5 w-5 text-primary flex-shrink-0" /> <span className="truncate">Cores do Sistema</span>
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words whitespace-normal">
          Personalize a aparência do seu catálogo. As alterações são aplicadas instantaneamente após salvar.
        </p>

        <form onSubmit={submitTheme} className="mt-4 space-y-6 min-w-0 max-w-full">
          <div className="min-w-0 max-w-full">
            <div className="flex flex-wrap gap-3 min-w-0">
              {SYSTEM_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTheme(t.id); applyTheme(t.id); }}
                  className={`h-10 w-10 rounded-full border-4 transition-all hover:scale-110 flex-shrink-0 ${theme === t.id ? "border-foreground scale-110 shadow-md" : "border-transparent shadow-sm"}`}
                  style={{ backgroundColor: t.primary }}
                  title={t.name}
                />
              ))}
            </div>
          </div>
          <Button type="submit" disabled={savingTheme} className="rounded-full shadow-sm w-full sm:w-auto">
            {savingTheme ? "Salvando…" : "Salvar Cores"}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words min-w-0 max-w-full">
        <h3 className="font-display text-lg font-black flex items-center gap-2 truncate">
          <ShoppingBag className="h-5 w-5 text-primary flex-shrink-0" /> <span className="truncate">Nome do Catálogo</span>
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words whitespace-normal">
          Este é o nome que aparecerá no cabeçalho e na página inicial da loja.
        </p>
        <form onSubmit={submitName} className="mt-4 flex flex-col gap-3 sm:flex-row min-w-0">
          <Input
            value={catalogName}
            onChange={(e) => setCatalogName(e.target.value)}
            placeholder="ex: Catálogo de Produtos"
            className="flex-1 min-w-0"
            required
            maxLength={50}
          />
          <Button type="submit" disabled={savingName} className="rounded-full shadow-sm flex-shrink-0">
            {savingName ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words min-w-0 max-w-full">
        <h3 className="font-display text-lg font-black flex items-center gap-2 truncate">
          <ImageIcon className="h-5 w-5 text-primary flex-shrink-0" /> <span className="truncate">Logo da Loja</span>
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words whitespace-normal">
          Adicione a logomarca da sua empresa. Ela aparecerá no cabeçalho do catálogo.
        </p>
        <form onSubmit={submitLogo} className="mt-4 flex flex-col gap-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
            <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-secondary shadow-sm flex items-center justify-center flex-shrink-0">
              {previewLogo ? (
                <img src={previewLogo} className="h-full w-full object-cover" alt="Logo preview" />
              ) : (
                <span className="text-xl font-black text-muted-foreground uppercase">{catalogName.charAt(0)}</span>
              )}
            </div>
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary shadow-sm transition break-words min-w-0 max-w-full">
                  <Upload className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Escolher imagem</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} disabled={savingLogo} />
                </label>
                {previewLogo && !isRemovingLogo && (
                   <Button type="button" variant="outline" size="icon" onClick={handleLogoRemoveClick} disabled={savingLogo} className="rounded-full shadow-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                   </Button>
                )}
              </div>
              {hasLogoChanges && (
                 <Button type="button" variant="ghost" onClick={undoLogoChanges} disabled={savingLogo} className="text-xs h-7 px-2 justify-start w-full sm:w-max text-muted-foreground break-words whitespace-normal text-left min-w-0">
                    Desfazer mudança de logo
                 </Button>
              )}
            </div>
          </div>
          <div className="flex justify-start pt-2 flex-shrink-0">
            <Button type="submit" disabled={savingLogo || !hasLogoChanges} className="rounded-full shadow-sm w-full sm:w-auto">
              {savingLogo ? "Salvando…" : "Salvar Logo"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words min-w-0 max-w-full">
        <h3 className="font-display text-lg font-black flex items-center gap-2 truncate">
          <Phone className="h-5 w-5 text-primary flex-shrink-0" /> <span className="truncate">Número do WhatsApp</span>
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words whitespace-normal">
          Este é o número que receberá os pedidos do site e o botão flutuante.
        </p>
        <form onSubmit={submitNumber} className="mt-4 flex flex-col gap-3 sm:flex-row min-w-0">
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="ex: 5545912345678"
            className="flex-1 min-w-0"
            required
            maxLength={20}
          />
          <div className="flex gap-2 flex-shrink-0">
            <Button type="button" variant="secondary" onClick={() => {
                const cleanNumber = number.replace(/\D/g, '');
                if (cleanNumber.length < 10 || cleanNumber.length > 15) {
                  setShowInvalidWhatsApp(true);
                  return;
                }
                window.open(whatsappLink("Teste de número válido - Catálogo", cleanNumber), "_blank");
              }} className="rounded-full shadow-sm flex-1 sm:flex-auto">
              Testar número
            </Button>
            <Button type="submit" disabled={savingNumber} className="rounded-full shadow-sm flex-1 sm:flex-auto">
              {savingNumber ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
        <p className="mt-2 text-xs font-semibold text-muted-foreground break-words whitespace-normal">
          Use o formato internacional sem espaços (DDI + DDD + número). Ex: <code>5545912345678</code>
        </p>
      </div>

      {showInvalidWhatsApp && (
        <ConfirmActionModal
          title="Número de WhatsApp Inválido"
          description="O número inserido está muito curto ou incompleto. Por favor, certifique-se de digitar o Código do País + DDD + Número. Exemplo: 5545984311918."
          onClose={() => setShowInvalidWhatsApp(false)}
          onConfirm={() => setShowInvalidWhatsApp(false)}
          destructive={true}
          confirmText="Entendi"
          alertOnly={true}
        />
      )}

      {showRemoveLogoConfirm && (
        <ConfirmActionModal
          title="Remover Logo"
          description="Tem certeza que deseja remover a logo do catálogo? A alteração só será definitiva ao clicar em 'Salvar Logo'."
          onClose={() => setShowRemoveLogoConfirm(false)}
          onConfirm={confirmRemoveLogo}
          confirmText="Remover"
        />
      )}

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

      {/* MODAIS DO RODAPÉ */}
      {showDescModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <ScrollLock />
          <div className="bg-background w-full max-w-md rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display truncate text-foreground flex items-center gap-2">
                <PanelBottom className="h-5 w-5 text-primary"/> Descrição do Rodapé
              </h3>
              <button onClick={() => setShowDescModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button>
            </div>
            <p className="text-sm text-muted-foreground">
              Este texto aparecerá na primeira coluna do rodapé da loja, logo abaixo do nome do catálogo. Serve para explicar o funcionamento da sua loja. Se deixar em branco, um texto padrão será exibido.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSavingDesc(true);
              try {
                const { error } = await supabase.from("app_settings").upsert({ key: "catalog_description", value: tempDesc.trim(), updated_at: new Date().toISOString() });
                if (error) throw error;
                setCatalogDesc(tempDesc.trim());
                toast.success("Descrição atualizada!");
                setShowDescModal(false);
              } catch (err) {
                toast.error("Erro ao salvar descrição.");
              }
              setSavingDesc(false);
            }} className="flex flex-col gap-4">
              <Textarea 
                value={tempDesc} 
                onChange={e => setTempDesc(e.target.value)} 
                maxLength={255} 
                placeholder="Ex: Somos uma loja online especializada em..." 
                className="resize-y min-h-[100px]" 
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
                 <Button type="button" variant="outline" onClick={() => setShowDescModal(false)} className="rounded-full shadow-sm">Cancelar</Button>
                 <Button type="submit" disabled={savingDesc} className="rounded-full shadow-sm">{savingDesc ? "Salvando..." : "Salvar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddressModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <ScrollLock />
          <div className="bg-background w-full max-w-md rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display truncate text-foreground flex items-center gap-2">
                <PanelBottom className="h-5 w-5 text-primary"/> Endereço da Loja
              </h3>
              <button onClick={() => setShowAddressModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button>
            </div>
            <p className="text-sm text-muted-foreground">
              Este texto aparecerá na coluna central do rodapé da loja. Ideal para informar sua localização física ou de retirada. Se deixar em branco, indicará para perguntar no WhatsApp.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSavingAddress(true);
              try {
                const { error } = await supabase.from("app_settings").upsert({ key: "catalog_address", value: tempAddress.trim(), updated_at: new Date().toISOString() });
                if (error) throw error;
                setCatalogAddress(tempAddress.trim());
                toast.success("Endereço atualizado!");
                setShowAddressModal(false);
              } catch (err) {
                toast.error("Erro ao salvar endereço.");
              }
              setSavingAddress(false);
            }} className="flex flex-col gap-4">
              <Textarea 
                value={tempAddress} 
                onChange={e => setTempAddress(e.target.value)} 
                maxLength={255} 
                placeholder="Ex: Rua das Flores, 123 - Centro..." 
                className="resize-y min-h-[80px]" 
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
                 <Button type="button" variant="outline" onClick={() => setShowAddressModal(false)} className="rounded-full shadow-sm">Cancelar</Button>
                 <Button type="submit" disabled={savingAddress} className="rounded-full shadow-sm">{savingAddress ? "Salvando..." : "Salvar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAIS DE SENHAS */}
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
                <Label>Senha</Label>
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
                <Label>Senha</Label>
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
    </div>
  );
}