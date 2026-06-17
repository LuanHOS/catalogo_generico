import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Crown, X, ChevronUp, ChevronDown } from "lucide-react";

// Importações dos tipos e utilitários compartilhados do arquivo admin principal
import { Category, ScrollLock, ConfirmActionModal } from "@/routes/admin";

export function CategoriesPanel({ isMaster, currentUserName }: { isMaster: boolean, currentUserName: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [isVip, setIsVip] = useState(false);
  
  const [catSearch, setCatSearch] = useState("");
  const [showAddCatModal, setShowAddCatModal] = useState(false);

  // Limite de exibição simultânea na tela (paginação)
  const [visibleCount, setVisibleCount] = useState(20);

  // Sempre que buscar mudar, volta para o limite padrão
  useEffect(() => {
     setVisibleCount(20);
  }, [catSearch]);

  // Estado para Edição da Categoria no Modal
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatVip, setEditCatVip] = useState(false);

  // Estado para Modal de Confirmação de Exclusão (sobreposto)
  const [deletingCat, setDeletingCat] = useState<{ cat: Category, warning?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from("active_categories").select("*").order("sort_order");
      if (error) throw error;
      return data as Category[];
    }
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
  };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({ 
       name: name.trim(), 
       sort_order: cats.length, 
       created_by_name: currentUserName,
       is_vip: isVip
    });
    if (error) return toast.error(error.message);
    setName("");
    setIsVip(false);
    setShowAddCatModal(false);
    toast.success("Categoria criada");
    refresh();
  }

  function openNewCat() {
    setName("");
    setIsVip(false);
    setShowAddCatModal(true);
  }

  function openEdit(c: Category) {
    setEditingCat(c);
    setEditCatName(c.name);
    setEditCatVip(c.is_vip || false);
  }

  async function handleRenameCat(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCat || !editCatName.trim()) return;
    const { error } = await supabase.from("categories").update({ name: editCatName.trim(), is_vip: editCatVip }).eq("id", editingCat.id);
    if (error) return toast.error(error.message);
    setEditingCat(null);
    refresh();
    toast.success("Categoria atualizada");
  }

  async function initiateDelete(c: Category) {
    const { count, error: countErr } = await supabase.from("active_products").select("id", { count: 'exact', head: true }).eq("category_id", c.id);
    if (countErr) return toast.error("Erro ao verificar produtos vinculados.");
    
    if ((count ?? 0) > 0) {
      setDeletingCat({ cat: c, warning: `Atenção: Existem ${count} produto(s) nesta categoria. Se você excluí-la, esses produtos ficarão sem categoria.` });
    } else {
      setDeletingCat({ cat: c });
    }
  }

  async function confirmDeleteCat() {
    if (!deletingCat) return;
    setIsDeleting(true);
    const c = deletingCat.cat;
    
    await supabase.from("products").update({ category_id: null }).eq("category_id", c.id);
    const { error } = await supabase.from("categories").update({ deleted_at: new Date().toISOString(), deleted_by_name: currentUserName }).eq("id", c.id);
    
    setIsDeleting(false);
    setDeletingCat(null);
    setEditingCat(null); // Fecha o modal de edição se estiver aberto
    
    if (error) return toast.error(error.message);
    toast.success("Categoria removida");
    refresh();
  }

  async function moveUp(index: number) {
    if (index === 0) return;
    const newCats = [...cats];
    const item = newCats.splice(index, 1)[0];
    newCats.splice(index - 1, 0, item);
    
    const updates = newCats.map((c, i) => ({ ...c, sort_order: i }));
    queryClient.setQueryData(['admin-categories'], updates);
    
    for (const c of updates) {
        supabase.from("categories").update({ sort_order: c.sort_order }).eq("id", c.id).then();
    }
  }

  async function moveDown(index: number) {
    if (index === cats.length - 1) return;
    const newCats = [...cats];
    const item = newCats.splice(index, 1)[0];
    newCats.splice(index + 1, 0, item);
    
    const updates = newCats.map((c, i) => ({ ...c, sort_order: i }));
    queryClient.setQueryData(['admin-categories'], updates);
    
    for (const c of updates) {
        supabase.from("categories").update({ sort_order: c.sort_order }).eq("id", c.id).then();
    }
  }

  const filteredCats = cats.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase().trim()));

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between min-w-0 max-w-full">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={catSearch} 
            onChange={(e) => setCatSearch(e.target.value)} 
            placeholder="Buscar categoria..." 
            className="pl-9 w-full shadow-sm" 
            maxLength={100} 
          />
        </div>
        <Button onClick={openNewCat} className="rounded-full shadow-sm w-full sm:w-auto flex-shrink-0">
          <Plus className="mr-1 h-4 w-4" /> Nova Categoria
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm min-w-0 max-w-full">
        {cats.length === 0 && <li className="p-6 text-center text-muted-foreground font-medium truncate">Nenhuma categoria ainda.</li>}
        {cats.length > 0 && filteredCats.length === 0 && (
          <li className="p-6 text-center text-muted-foreground font-medium truncate">Nenhuma categoria encontrada.</li>
        )}
        {filteredCats.slice(0, visibleCount).map((c) => {
          const originalIdx = cats.findIndex(x => x.id === c.id);
          return (
          <li key={c.id} className="flex items-center justify-between gap-3 p-4 min-w-0 w-full">
            <span className="font-semibold flex items-center gap-2 min-w-0 flex-1">
               {c.is_vip && <span title="Área Exclusiva" className="inline-block flex-shrink-0 align-text-bottom"><Crown className="h-4 w-4 text-yellow-500" /></span>}
               <span className="truncate block" title={c.name}>{c.name}</span>
            </span>
            <div className="flex gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={() => moveUp(originalIdx)} disabled={originalIdx === 0}><ChevronUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => moveDown(originalIdx)} disabled={originalIdx === cats.length - 1}><ChevronDown className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="flex-shrink-0"><Pencil className="h-4 w-4" /></Button>
            </div>
          </li>
        )})}
      </ul>

      {visibleCount < filteredCats.length && (
         <div className="mt-6 flex justify-center w-full min-w-0">
            <Button variant="outline" onClick={() => setVisibleCount(v => v + 20)} className="rounded-full shadow-sm w-full sm:w-auto">
               Mostrar mais categorias
            </Button>
         </div>
      )}

      {showAddCatModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-sm">
            <ScrollLock />
            <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto break-words min-w-0">
               <div className="flex items-center justify-between min-w-0">
                  <h3 className="text-lg font-black font-display truncate">Nova Categoria</h3>
                  <button type="button" onClick={() => setShowAddCatModal(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground flex-shrink-0 ml-2"><X className="h-4 w-4"/></button>
               </div>
               <form onSubmit={add} className="flex flex-col gap-4 min-w-0 max-w-full">
                  <div className="min-w-0">
                     <Label className="truncate block">Nome da categoria <span className="text-destructive">*</span></Label>
                     <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Doces" className="mt-1 w-full min-w-0" required maxLength={50} />
                  </div>
                  <div className="flex items-center justify-between bg-secondary/30 p-3 rounded-lg border border-border min-w-0 gap-3">
                     <div className="min-w-0">
                        <Label className="font-bold flex items-center gap-1.5 truncate"><Crown className="h-4 w-4 text-yellow-600 flex-shrink-0"/> <span className="truncate">Área Exclusiva</span></Label>
                        <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 truncate">Exige senha VIP para acessar.</p>
                     </div>
                     <Switch checked={isVip} onCheckedChange={setIsVip} className="flex-shrink-0" />
                  </div>
                  <div className="flex justify-end border-t border-border pt-4 mt-2 flex-shrink-0">
                     <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setShowAddCatModal(false)} className="rounded-full shadow-sm flex-shrink-0">Cancelar</Button>
                        <Button type="submit" className="rounded-full shadow-sm flex-shrink-0">Adicionar</Button>
                     </div>
                  </div>
               </form>
            </div>
         </div>
      )}

      {editingCat && !deletingCat && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-sm">
            <ScrollLock />
            <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto break-words min-w-0">
               <div className="flex items-center justify-between min-w-0">
                  <h3 className="text-lg font-black font-display truncate">Editar Categoria</h3>
                  <button type="button" onClick={() => setEditingCat(null)} className="text-sm font-semibold text-muted-foreground hover:text-foreground flex-shrink-0 ml-2"><X className="h-4 w-4"/></button>
               </div>
               <form onSubmit={handleRenameCat} className="flex flex-col gap-4 min-w-0 max-w-full">
                  <div className="min-w-0">
                     <Label className="truncate block">Nome da categoria <span className="text-destructive">*</span></Label>
                     <Input value={editCatName} onChange={e => setEditCatName(e.target.value)} className="mt-1 w-full min-w-0" required maxLength={50} />
                  </div>
                  <div className="flex items-center justify-between bg-secondary/30 p-3 rounded-lg border border-border min-w-0 gap-3">
                     <div className="min-w-0">
                        <Label className="font-bold flex items-center gap-1.5 truncate"><Crown className="h-4 w-4 text-yellow-600 flex-shrink-0"/> <span className="truncate">Área Exclusiva</span></Label>
                        <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 truncate">Exige senha VIP para acessar.</p>
                     </div>
                     <Switch checked={editCatVip} onCheckedChange={setEditCatVip} className="flex-shrink-0" />
                  </div>
                  <div className="flex justify-between border-t border-border pt-4 mt-2 flex-shrink-0">
                     {isMaster ? (
                        <Button type="button" variant="ghost" size="icon" onClick={() => initiateDelete(editingCat)} className="text-destructive hover:bg-destructive/10 hover:text-destructive flex-shrink-0">
                           <Trash2 className="h-5 w-5" />
                        </Button>
                     ) : <div/>}
                     <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setEditingCat(null)} className="rounded-full shadow-sm flex-shrink-0">Cancelar</Button>
                        <Button type="submit" className="rounded-full shadow-sm flex-shrink-0">Salvar</Button>
                     </div>
                  </div>
               </form>
            </div>
         </div>
      )}

      {deletingCat && (
        <ConfirmActionModal
          title="Excluir Categoria"
          description={deletingCat.warning || `Tem certeza que deseja remover a categoria "${deletingCat.cat.name}"?`}
          onClose={() => setDeletingCat(null)}
          onConfirm={confirmDeleteCat}
          loading={isDeleting}
          confirmText="Excluir Categoria"
        />
      )}
    </div>
  );
}