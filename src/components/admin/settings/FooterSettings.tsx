import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PanelBottom, X } from "lucide-react";
import { ScrollLock } from "@/routes/admin";

export function FooterSettings() {
  const [catalogDesc, setCatalogDesc] = useState("");
  const [catalogAddress, setCatalogAddress] = useState("");
  const [showDescModal, setShowDescModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  
  const [tempDesc, setTempDesc] = useState("");
  const [tempAddressObj, setTempAddressObj] = useState({
      cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", mapsLink: ""
  });
  
  const [savingDesc, setSavingDesc] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("app_settings").select("value").eq("key", "catalog_description").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "catalog_address").maybeSingle()
    ]).then(([descRes, addRes]) => {
      setCatalogDesc(descRes.data?.value ?? "");
      setCatalogAddress(addRes.data?.value ?? "");
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-muted-foreground font-semibold">Carregando…</p>;

  return (
    <>
      {/* 6. Bloco de Rodapé */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words min-w-0 max-w-full">
        <h3 className="font-display text-lg font-black flex items-center gap-2 truncate">
          <PanelBottom className="h-5 w-5 text-primary flex-shrink-0" /> <span className="truncate">Rodapé da Loja</span>
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words whitespace-normal">
          Personalize as informações que aparecem no final da página da sua loja.
        </p>

        <div className="mt-4 space-y-4 min-w-0 max-w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-lg bg-secondary/20 gap-4 min-w-0">
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-foreground">Descrição do Catálogo</h4>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words whitespace-pre-wrap">
                {catalogDesc || "Padrão: Este site funciona apenas como um catálogo para vendas online..."}
              </p>
            </div>
            <Button variant="outline" onClick={() => { setTempDesc(catalogDesc); setShowDescModal(true); }} className="rounded-full shadow-sm flex-shrink-0">
              Editar
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-lg bg-secondary/20 gap-4 min-w-0">
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-foreground">Endereço Físico</h4>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words whitespace-pre-wrap">
                {catalogAddress && catalogAddress.startsWith("{") ? "Estruturado no formato completo." : catalogAddress || "Padrão: Para saber o endereço, pergunte diretamente através do WhatsApp."}
              </p>
            </div>
            <Button variant="outline" onClick={() => { 
                let parsed = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", mapsLink: "" };
                if (catalogAddress) {
                   if (catalogAddress.startsWith("{")) {
                      try { parsed = JSON.parse(catalogAddress); } catch (e) {}
                   } else {
                      parsed.logradouro = catalogAddress;
                   }
                }
                setTempAddressObj(parsed);
                setShowAddressModal(true); 
              }} className="rounded-full shadow-sm flex-shrink-0">
              Editar
            </Button>
          </div>
        </div>
      </div>

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
              <div>
                <Label>Descrição</Label>
                <Textarea 
                  value={tempDesc} 
                  onChange={e => setTempDesc(e.target.value)} 
                  maxLength={255} 
                  placeholder="Ex: Somos uma loja online especializada em..." 
                  className="resize-y min-h-[100px] mt-1" 
                />
              </div>
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
          <div className="bg-background w-full max-w-xl rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display truncate text-foreground flex items-center gap-2">
                <PanelBottom className="h-5 w-5 text-primary"/> Endereço da Loja
              </h3>
              <button onClick={() => setShowAddressModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button>
            </div>
            <p className="text-sm text-muted-foreground">
              Preencha as informações estruturadas da sua loja. Isso formará um bloco de endereço perfeito no rodapé. Se deixar todos os campos em branco, um texto padrão será exibido no rodapé no local do endereço.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              
              if (tempAddressObj.mapsLink) {
                try {
                  const url = new URL(tempAddressObj.mapsLink);
                  if (!['http:', 'https:'].includes(url.protocol)) {
                    throw new Error("Protocolo inválido");
                  }
                } catch (err) {
                  toast.error("O link do Google Maps deve ser uma URL válida (ex: https://maps.app.goo.gl/...).");
                  return;
                }
              }

              setSavingAddress(true);
              try {
                const finalString = JSON.stringify(tempAddressObj);
                const { error } = await supabase.from("app_settings").upsert({ key: "catalog_address", value: finalString, updated_at: new Date().toISOString() });
                if (error) throw error;
                setCatalogAddress(finalString);
                toast.success("Endereço atualizado!");
                setShowAddressModal(false);
              } catch (err) {
                toast.error("Erro ao salvar endereço.");
              }
              setSavingAddress(false);
            }} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label>CEP</Label>
                  <Input 
                    value={tempAddressObj.cep} 
                    onChange={e => setTempAddressObj({...tempAddressObj, cep: e.target.value})} 
                    maxLength={9} 
                    placeholder="Ex: 00000-000" 
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Logradouro</Label>
                  <Input 
                    value={tempAddressObj.logradouro} 
                    onChange={e => setTempAddressObj({...tempAddressObj, logradouro: e.target.value})} 
                    maxLength={100} 
                    placeholder="Rua, Avenida, Alameda..."
                  />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input 
                    value={tempAddressObj.numero} 
                    onChange={e => setTempAddressObj({...tempAddressObj, numero: e.target.value})} 
                    maxLength={10} 
                    placeholder="Ex: 123 ou S/N"
                  />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input 
                    value={tempAddressObj.complemento} 
                    onChange={e => setTempAddressObj({...tempAddressObj, complemento: e.target.value})} 
                    maxLength={50} 
                    placeholder="Apto, Sala, Bloco..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Bairro</Label>
                  <Input 
                    value={tempAddressObj.bairro} 
                    onChange={e => setTempAddressObj({...tempAddressObj, bairro: e.target.value})} 
                    maxLength={60} 
                    placeholder="Seu bairro"
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input 
                    value={tempAddressObj.cidade} 
                    onChange={e => setTempAddressObj({...tempAddressObj, cidade: e.target.value})} 
                    maxLength={50} 
                  />
                </div>
                <div>
                  <Label>Estado (UF)</Label>
                  <Input 
                    value={tempAddressObj.estado} 
                    onChange={e => setTempAddressObj({...tempAddressObj, estado: e.target.value.toUpperCase()})} 
                    maxLength={2} 
                    placeholder="Ex: SP"
                    className="uppercase"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Link do Google Maps</Label>
                  <Input 
                    type="url"
                    value={tempAddressObj.mapsLink} 
                    onChange={e => setTempAddressObj({...tempAddressObj, mapsLink: e.target.value})} 
                    placeholder="https://maps.app.goo.gl/..." 
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
                 <Button type="button" variant="outline" onClick={() => setShowAddressModal(false)} className="rounded-full shadow-sm">Cancelar</Button>
                 <Button type="submit" disabled={savingAddress} className="rounded-full shadow-sm">{savingAddress ? "Salvando..." : "Salvar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}