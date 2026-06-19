import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShoppingBag, Phone, X, Upload, Image as ImageIcon, Trash2 } from "lucide-react";
import { DEFAULT_WHATSAPP_NUMBER, whatsappLink } from "@/lib/whatsapp";
import { updateWhatsAppNumber, updateCatalogName, updateCatalogLogo } from "@/lib/admin.functions";
import { ConfirmActionModal, ScrollLock } from "@/routes/admin";

export function GeneralSettings() {
  const [number, setNumber] = useState("");
  const [catalogName, setCatalogName] = useState("");
  const [catalogLogo, setCatalogLogo] = useState("");
  
  const [previewLogo, setPreviewLogo] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const [showRemoveLogoConfirm, setShowRemoveLogoConfirm] = useState(false);
  
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState("");
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [tempNumber, setTempNumber] = useState("");
  const [showInvalidWhatsApp, setShowInvalidWhatsApp] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [savingNumber, setSavingNumber] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  
  const saveNumberFn = useServerFn(updateWhatsAppNumber);
  const saveNameFn = useServerFn(updateCatalogName);
  const saveLogoFn = useServerFn(updateCatalogLogo);

  useEffect(() => {
    Promise.all([
      supabase.from("app_settings").select("value").eq("key", "whatsapp_number").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "catalog_name").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "catalog_logo").maybeSingle(),
    ]).then(([waRes, catRes, logoRes]) => {
      setNumber(waRes.data?.value ?? DEFAULT_WHATSAPP_NUMBER);
      setCatalogName(catRes.data?.value ?? "Catálogo de Produtos");
      
      const logoVal = logoRes.data?.value ?? "";
      setCatalogLogo(logoVal);
      setPreviewLogo(logoVal);
      
      setLoading(false);
    });
  }, []);

  async function submitNumber(e: React.FormEvent) {
    e.preventDefault();
    
    const cleanNumber = tempNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      setShowInvalidWhatsApp(true);
      return;
    }

    setSavingNumber(true);
    try {
      const res = await saveNumberFn({ data: { number: cleanNumber } });
      setNumber(res.number);
      toast.success("Número do WhatsApp atualizado");
      setShowWhatsAppModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSavingNumber(false);
    }
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    if (!tempName.trim()) return toast.error("O nome não pode ser vazio.");
    setSavingName(true);
    try {
      const res = await saveNameFn({ data: { name: tempName } });
      setCatalogName(res.name);
      toast.success("Nome do catálogo atualizado");
      setShowNameModal(false);
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

  const hasLogoChanges = selectedLogoFile !== null || isRemovingLogo;

  if (loading) return <p className="text-muted-foreground font-semibold">Carregando…</p>;

  return (
    <>
      {/* 3. Nome do Catálogo */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words min-w-0 max-w-full">
        <h3 className="font-display text-lg font-black flex items-center gap-2 truncate">
          <ShoppingBag className="h-5 w-5 text-primary flex-shrink-0" /> <span className="truncate">Nome do Catálogo</span>
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words whitespace-normal">
          Este é o nome que aparecerá no cabeçalho e na página inicial da loja.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-lg bg-secondary/20 gap-4 min-w-0">
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-foreground break-words whitespace-normal">{catalogName || "Não definido"}</h4>
          </div>
          <Button variant="outline" onClick={() => { setTempName(catalogName); setShowNameModal(true); }} className="rounded-full shadow-sm flex-shrink-0">
            Editar
          </Button>
        </div>
      </div>

      {/* 4. Logo da Loja */}
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

      {/* 5. Número do WhatsApp */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words min-w-0 max-w-full">
        <h3 className="font-display text-lg font-black flex items-center gap-2 truncate">
          <Phone className="h-5 w-5 text-primary flex-shrink-0" /> <span className="truncate">Número do WhatsApp</span>
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words whitespace-normal">
          Este é o número que receberá os pedidos do site e o botão flutuante.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-lg bg-secondary/20 gap-4 min-w-0">
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-foreground truncate">{number || "Não definido"}</h4>
          </div>
          <Button variant="outline" onClick={() => { setTempNumber(number); setShowWhatsAppModal(true); }} className="rounded-full shadow-sm flex-shrink-0">
            Editar
          </Button>
        </div>
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

      {showNameModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <ScrollLock />
          <div className="bg-background w-full max-w-md rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display truncate text-foreground flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary"/> Nome do Catálogo
              </h3>
              <button onClick={() => setShowNameModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button>
            </div>
            <form onSubmit={submitName} className="flex flex-col gap-4">
              <div>
                <Label>Nome da sua loja <span className="text-destructive">*</span></Label>
                <Input 
                  value={tempName} 
                  onChange={(e) => setTempName(e.target.value)} 
                  placeholder="ex: Catálogo de Produtos" 
                  required 
                  maxLength={50} 
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
                 <Button type="button" variant="outline" onClick={() => setShowNameModal(false)} className="rounded-full shadow-sm">Cancelar</Button>
                 <Button type="submit" disabled={savingName} className="rounded-full shadow-sm">{savingName ? "Salvando..." : "Salvar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWhatsAppModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <ScrollLock />
          <div className="bg-background w-full max-w-md rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display truncate text-foreground flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary"/> Número do WhatsApp
              </h3>
              <button onClick={() => setShowWhatsAppModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button>
            </div>
            <p className="text-sm text-muted-foreground">
              Use o formato internacional sem espaços (DDI + DDD + número). Ex: <code>5545912345678</code>
            </p>
            <form onSubmit={submitNumber} className="flex flex-col gap-4">
              <div>
                <Label>Número <span className="text-destructive">*</span></Label>
                <Input
                  value={tempNumber}
                  onChange={(e) => setTempNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="ex: 5545912345678"
                  required
                  maxLength={20}
                  className="mt-1"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-border mt-2">
                 <Button type="button" variant="secondary" onClick={() => {
                    const cleanNumber = tempNumber.replace(/\D/g, '');
                    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
                      setShowInvalidWhatsApp(true);
                      return;
                    }
                    window.open(whatsappLink("Teste de número válido - Catálogo", cleanNumber), "_blank");
                  }} className="rounded-full shadow-sm sm:mr-auto">
                  Testar número
                 </Button>
                 <Button type="button" variant="outline" onClick={() => setShowWhatsAppModal(false)} className="rounded-full shadow-sm">Cancelar</Button>
                 <Button type="submit" disabled={savingNumber} className="rounded-full shadow-sm">{savingNumber ? "Salvando..." : "Salvar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}