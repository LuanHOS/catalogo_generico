import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Upload, Package, Crown, X } from "lucide-react";
import { brl } from "@/lib/whatsapp";

// Importações dos tipos e utilitários compartilhados do arquivo admin principal
import { Product, Category, ScrollLock, ConfirmActionModal, blockInvalidNumberChars } from "@/routes/admin";

export function ProductsPanel({ isMaster, currentUserName }: { isMaster: boolean, currentUserName: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterOption, setFilterOption] = useState("all");

  // Limite de exibição simultânea na tela (paginação)
  const [visibleCount, setVisibleCount] = useState(50);

  // Sempre que os filtros mudarem, resetamos a paginação
  useEffect(() => {
     setVisibleCount(50);
  }, [search, filterOption]);

  const { data: prods = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from("active_products").select("*").order("sort_order");
      if (error) throw error;
      return data as Product[];
    }
  });

  const { data: cats = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from("active_categories").select("*").order("sort_order");
      if (error) throw error;
      return data as Category[];
    }
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
  }, [queryClient]);

  const activeCatIds = useMemo(() => new Set(prods.map(p => p.category_id).filter(Boolean)), [prods]);
  const activeCats = useMemo(() => cats.filter(c => activeCatIds.has(c.id)), [cats, activeCatIds]);

  const exactQ = search.trim();
  const q = exactQ.toLowerCase();
  
  const filtered = prods.filter((p) => {
    const matchesSearch = !q ||
      (p.barcode && p.barcode === exactQ) ||
      p.name.toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (filterOption === "inactive") return !p.in_stock;
    if (filterOption === "out_of_stock") return p.track_stock && p.stock <= 0;
    if (filterOption === "low_stock") return p.track_stock && p.stock > 0 && p.stock <= (p.min_stock || 0);
    if (filterOption === "none") return p.category_id === null;
    if (filterOption !== "all") return p.category_id === filterOption;

    return true;
  });

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between w-full">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou código de barras..."
              className="pl-9 shadow-sm w-full"
              maxLength={100}
            />
          </div>
          <select
            value={filterOption}
            onChange={(e) => setFilterOption(e.target.value)}
            className="h-10 w-full sm:max-w-xs md:max-w-sm truncate rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input"
          >
            <option value="all">Todos os produtos</option>
            <option value="none">Sem categoria</option>
            <option value="out_of_stock">Sem estoque</option>
            <option value="low_stock">Estoque mínimo atingido</option>
            <option value="inactive">Inativos</option>
            {activeCats.map((c) => (
              <option key={c.id} value={c.id} className="truncate">
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="rounded-full shadow-sm w-full sm:w-auto flex-shrink-0">
          <Plus className="mr-1 h-4 w-4" /> Novo produto
        </Button>
      </div>

      {prods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground font-semibold break-words whitespace-normal min-w-0">
          Nenhum produto ainda. Adicione o primeiro!
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground font-semibold break-words whitespace-normal min-w-0">
          Nenhum produto encontrado com este filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-w-0 max-w-full">
          {filtered.slice(0, visibleCount).map((p) => {
            const isInactive = !p.in_stock;
            const outOfStock = p.in_stock && p.track_stock && p.stock <= 0;
            const hasIssue = isInactive || outOfStock;
            const isLowStock = !hasIssue && p.track_stock && p.stock > 0 && p.stock <= (p.min_stock || 0);
            const promo = p.sale_price != null && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price);
            
            const catInfo = cats.find(c => c.id === p.category_id);
            const isVipProd = catInfo?.is_vip;

            return (
              <div
                key={p.id}
                className={
                  "relative flex gap-3 rounded-xl border bg-card p-3 shadow-sm transition min-w-0 max-w-full " +
                  (hasIssue ? "border-destructive/60 ring-2 ring-destructive/30 bg-destructive/5" : isLowStock ? "border-yellow-600 ring-2 ring-yellow-600/50 bg-yellow-500/5" : "border-border")
                }
              >
                <div className={"h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-secondary " + (hasIssue ? "opacity-40" : "")}>
                  {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
                </div>
                <div className={"flex flex-1 flex-col min-w-0 break-words " + (hasIssue ? "opacity-60" : "")}>
                  <div className="font-bold line-clamp-2 break-words w-full" title={p.name}>
                     {isVipProd && <span title="Área Exclusiva" className="inline-block mr-1 align-text-bottom"><Crown className="h-3.5 w-3.5 text-yellow-500" /></span>}
                     {p.name}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground mt-0.5 truncate">Estoque: {p.track_stock ? p.stock : '∞ Ilimitado'}</div>
                  {(isInactive || outOfStock) && (
                    <div className="mt-0.5">
                      <span className="inline-block rounded-full bg-destructive px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-destructive-foreground truncate">
                        {isInactive ? "Inativo" : "Sem estoque"}
                      </span>
                    </div>
                  )}
                  <div className="text-sm mt-1 truncate">
                    {promo ? (
                      <>
                        <span className="text-muted-foreground font-semibold line-through mr-1 truncate">{brl(Number(p.price))}</span>
                        <span className="text-primary font-black truncate">{brl(Number(p.sale_price))}</span>
                        <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-accent-foreground flex-shrink-0">Promo</span>
                      </>
                    ) : (
                      <span className="text-primary font-black truncate">{brl(Number(p.price))}</span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-end gap-1 text-xs flex-shrink-0">
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="rounded-full p-1.5 hover:bg-secondary transition flex-shrink-0"><Pencil className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {visibleCount < filtered.length && (
         <div className="mt-6 flex justify-center w-full min-w-0">
            <Button variant="outline" onClick={() => setVisibleCount(v => v + 50)} className="rounded-full shadow-sm w-full sm:w-auto">
               Mostrar mais produtos
            </Button>
         </div>
      )}

      {showForm && (
        <ProductForm
          product={editing}
          cats={cats}
          isMaster={isMaster}
          currentUserName={currentUserName}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refresh(); }}
        />
      )}
    </div>
  );
}

function ProductForm({
  product,
  cats,
  isMaster,
  currentUserName,
  onClose,
  onSaved,
}: {
  product: Product | null;
  cats: Category[];
  isMaster: boolean;
  currentUserName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const originalImageUrl = product?.image_url ?? "";
  
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [salePrice, setSalePrice] = useState(product?.sale_price != null ? String(product.sale_price) : "");
  const [cost, setCost] = useState(product ? String(product.cost) : "");
  const [maxPerCart, setMaxPerCart] = useState(product ? String(product.max_per_cart) : "0");
  const [stock, setStock] = useState(product ? String(product.stock) : "0");
  const [minStock, setMinStock] = useState(product ? String(product.min_stock ?? 0) : "0");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [inStock, setInStock] = useState(product?.in_stock ?? true);
  const [trackStock, setTrackStock] = useState(product?.track_stock ?? true);
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? "");
  const [imageUrl, setImageUrl] = useState(originalImageUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estado Visual e Confirmação de Imagem
  const [isRemovingImage, setIsRemovingImage] = useState(false);
  const [showRemoveImageConfirm, setShowRemoveImageConfirm] = useState(false);
  
  // Estado para Modal de Exclusão do Produto
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Estado para Modal de Entrada de Estoque (Custo Médio) e Proteção de Fechamento
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [addStockQty, setAddStockQty] = useState("");
  const [addStockCost, setAddStockCost] = useState("");
  const [hasUnsavedStockChanges, setHasUnsavedStockChanges] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  async function uploadImage(file: File) {
    setUploading(true);
    
    try {
      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(file, options);
      const ext = compressedFile.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      
      const { error } = await supabase.storage.from("product-images").upload(path, compressedFile, { upsert: false });
      if (error) { 
        toast.error(error.message); 
        setUploading(false); 
        return; 
      }
      
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);

      if (!data?.publicUrl) {
        toast.error("Falha ao gerar URL da imagem");
        setUploading(false);
        return;
      }
      
      setImageUrl(data.publicUrl);
      setIsRemovingImage(false);
    } catch (error) {
      console.error("Erro na compressão:", error);
      toast.error("Erro ao processar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveImageClick() {
    setShowRemoveImageConfirm(true);
  }

  function confirmRemoveImage() {
    setIsRemovingImage(true);
    setShowRemoveImageConfirm(false);
  }

  function undoImageChanges() {
    setImageUrl(originalImageUrl);
    setIsRemovingImage(false);
  }

  function openAddStock() {
    setAddStockQty("");
    setAddStockCost(cost || "0");
    setShowAddStockModal(true);
  }

  function confirmAddStock() {
    const currentQ = parseInt(stock || "0", 10) || 0;
    const currentC = parseFloat(cost || "0") || 0;
    const addedQ = parseInt(addStockQty || "0", 10) || 0;
    const addedC = parseFloat(addStockCost || "0") || 0;

    if (addedQ <= 0) {
      toast.error("A quantidade recebida deve ser maior que zero.");
      return;
    }

    const newTotalQ = currentQ + addedQ;
    const newAvgC = newTotalQ > 0 ? ((currentQ * currentC) + (addedQ * addedC)) / newTotalQ : currentC;

    setStock(newTotalQ.toString());
    setCost(newAvgC.toFixed(2));
    setShowAddStockModal(false);
    setHasUnsavedStockChanges(true);
    toast.success("Estoque e custo médio atualizados na tela. Clique em 'Salvar' para gravar as alterações.");
  }

  function handleAttemptClose() {
    if (hasUnsavedStockChanges) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const saleNum = salePrice.trim() ? Number(salePrice) : null;
    const payload: any = {
      name: name.trim(),
      description: description.trim() || null,
      price: Number(price) || 0,
      sale_price: saleNum && saleNum > 0 ? saleNum : null,
      cost: Number(cost) || 0,
      stock: Number(stock) || 0,
      min_stock: Number(minStock) || 0,
      max_per_cart: Math.max(0, parseInt(maxPerCart || "0", 10)),
      barcode: barcode.trim() || null,
      in_stock: inStock,
      track_stock: trackStock,
      category_id: categoryId || null,
      image_url: isRemovingImage ? null : (imageUrl || null),
    };
    
    if (!product) {
       payload.created_by_name = currentUserName;
    }
    
    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
      
    if (!error && product && (isRemovingImage || (imageUrl !== originalImageUrl))) {
      if (originalImageUrl) {
        const oldPath = originalImageUrl.split('/public/product-images/')[1];
        if (oldPath) {
          await supabase.storage.from("product-images").remove([oldPath]);
        }
      }
    }

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(product ? "Produto atualizado" : "Produto criado");
    onSaved();
  }

  async function confirmDeleteProduct() {
    setSaving(true);
    const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString(), deleted_by_name: currentUserName }).eq("id", product!.id);
    setSaving(false);
    setShowDeleteConfirm(false);
    if (error) return toast.error(error.message);
    toast.success("Produto removido");
    onSaved();
  }

  const currentPreview = isRemovingImage ? "" : imageUrl;
  const hasImageChanges = isRemovingImage || imageUrl !== originalImageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6 backdrop-blur-sm">
      <ScrollLock />
      <form
        onSubmit={save}
        className="flex w-full max-w-2xl max-h-[100dvh] flex-col rounded-t-2xl bg-background shadow-2xl sm:max-h-[90vh] sm:rounded-2xl min-w-0"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0 min-w-0">
          <h3 className="font-display text-xl font-black truncate">{product ? "Editar" : "Novo"} produto</h3>
          <button type="button" onClick={handleAttemptClose} className="text-sm font-semibold text-muted-foreground flex-shrink-0 ml-2">Fechar</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-w-0">
        <div className="grid gap-4 sm:grid-cols-2 min-w-0 max-w-full">
          <div className="sm:col-span-2 min-w-0">
            <Label className="truncate block">Foto</Label>
            <div className="mt-1 flex items-center gap-3 min-w-0">
              <div className="h-24 w-24 overflow-hidden rounded-lg border border-border bg-secondary shadow-sm flex-shrink-0">
                {currentPreview && <img src={currentPreview} className="h-full w-full object-cover" alt="" />}
              </div>
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                 <div className="flex flex-wrap gap-2 min-w-0">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary shadow-sm transition break-words min-w-0 max-w-full">
                      <Upload className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{uploading ? "Enviando…" : "Enviar imagem"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                      />
                    </label>
                    {currentPreview && (
                       <Button type="button" variant="outline" size="icon" onClick={handleRemoveImageClick} className="rounded-full shadow-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 flex-shrink-0">
                          <Trash2 className="h-4 w-4" />
                       </Button>
                    )}
                 </div>
                 {hasImageChanges && (
                    <Button type="button" variant="ghost" onClick={undoImageChanges} className="text-xs h-7 px-2 justify-start w-full sm:w-max text-muted-foreground break-words whitespace-normal text-left min-w-0">
                       Desfazer mudança de imagem
                    </Button>
                 )}
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 min-w-0">
            <Label className="truncate block">Código de Barras</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Ex: 789102030" maxLength={50} className="w-full min-w-0" />
          </div>
          <div className="sm:col-span-2 min-w-0">
            <Label className="truncate block">Nome <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className="w-full min-w-0" />
          </div>
          <div className="sm:col-span-2 min-w-0">
            <Label className="truncate block">Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={255} className="resize-y min-h-[80px] w-full min-w-0" />
          </div>
          <div className="min-w-0">
            <Label className="truncate block">Categoria</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium min-w-0 truncate"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">(sem categoria)</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.is_vip ? `👑 ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm sm:col-span-2 break-words gap-2 mt-2 min-w-0 max-w-full">
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate w-full">Controlar Estoque</div>
              <div className="text-xs font-semibold text-muted-foreground break-words whitespace-normal mt-0.5">Desative caso este produto seja um serviço ou tenha estoque infinito.</div>
            </div>
            <Switch checked={trackStock} onCheckedChange={setTrackStock} className="flex-shrink-0" />
          </div>

          <div className={(!trackStock ? "opacity-40 pointer-events-none" : "transition-opacity") + " min-w-0"}>
            <Label className="truncate block">Quantidade em Estoque <span className="text-destructive">*</span></Label>
            <Input type="number" min={0} value={stock} onChange={(e) => { if(e.target.value.length <= 15) setStock(e.target.value); }} onKeyDown={blockInvalidNumberChars} required disabled={!trackStock} className="w-full min-w-0" />
            {product && trackStock && (
              <Button
                type="button"
                onClick={openAddStock}
                className="mt-2 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm break-words whitespace-normal h-auto py-2"
              >
                <Package className="h-4 w-4 flex-shrink-0" /> Dar Entrada
              </Button>
            )}
          </div>
          <div className={(!trackStock ? "opacity-40 pointer-events-none" : "transition-opacity") + " min-w-0"}>
            <Label className="truncate block">Estoque Mínimo (Alerta) <span className="text-destructive">*</span></Label>
            <Input type="number" min={0} value={minStock} onChange={(e) => { if(e.target.value.length <= 15) setMinStock(e.target.value); }} onKeyDown={blockInvalidNumberChars} required disabled={!trackStock} className="w-full min-w-0" />
          </div>
          <div className="min-w-0">
            <Label className="truncate block">Preço de venda (R$) <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.01" min={0} value={price} onChange={(e) => { if(e.target.value.length <= 15) setPrice(e.target.value); }} onKeyDown={blockInvalidNumberChars} required className="w-full min-w-0" />
          </div>
          <div className="min-w-0">
            <Label className="truncate block">Preço promocional (R$) <span className="text-xs font-semibold text-muted-foreground">opcional</span></Label>
            <Input type="number" step="0.01" min={0} value={salePrice} onChange={(e) => { if(e.target.value.length <= 15) setSalePrice(e.target.value); }} onKeyDown={blockInvalidNumberChars} placeholder="deixe vazio se sem promoção" className="w-full min-w-0" />
          </div>
          <div className="min-w-0">
            <Label className="truncate block">Custo interno (R$) <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.01" min={0} value={cost} onChange={(e) => { if(e.target.value.length <= 15) setCost(e.target.value); }} onKeyDown={blockInvalidNumberChars} required className="w-full min-w-0" />
          </div>
          <div className="min-w-0">
            <Label className="truncate block">Limite por carrinho</Label>
            <Input type="number" min={0} value={maxPerCart} onChange={(e) => { if(e.target.value.length <= 15) setMaxPerCart(e.target.value); }} onKeyDown={blockInvalidNumberChars} className="w-full min-w-0" />
            <p className="mt-1 text-xs font-semibold text-muted-foreground break-words whitespace-normal">Deixem em 0 caso queira deixar sem limite</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm sm:col-span-2 break-words gap-2 mt-2 min-w-0 max-w-full">
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate w-full">Exibir na Loja (Ativo)</div>
              <div className="text-xs font-semibold text-muted-foreground break-words whitespace-normal mt-0.5">Desative para ocultar o produto completamente sem excluí-lo.</div>
            </div>
            <Switch checked={inStock} onCheckedChange={setInStock} className="flex-shrink-0" />
          </div>
        </div>
        </div>

        <div className="flex justify-between w-full border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex-shrink-0 min-w-0">
          {product && isMaster ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(true)} disabled={saving} className="text-destructive hover:bg-destructive/10 hover:text-destructive flex-shrink-0">
               <Trash2 className="h-5 w-5" />
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleAttemptClose} className="rounded-full shadow-sm flex-shrink-0">Cancelar</Button>
            <Button type="submit" disabled={saving} className="rounded-full shadow-sm flex-shrink-0">
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </form>

      {showCancelConfirm && (
        <ConfirmActionModal
          title="Descartar alterações?"
          description="Você adicionou entrada de estoque neste produto. Se fechar agora, essas alterações de quantidade e custo NÃO serão salvas."
          onClose={() => setShowCancelConfirm(false)}
          onConfirm={() => {
            setShowCancelConfirm(false);
            onClose();
          }}
          confirmText="Sim, fechar e descartar"
          destructive={true}
        />
      )}

      {showRemoveImageConfirm && (
        <ConfirmActionModal
          title="Remover Imagem"
          description="Tem certeza que deseja remover a imagem deste produto? A alteração só será salva de fato ao guardar o formulário."
          onClose={() => setShowRemoveImageConfirm(false)}
          onConfirm={confirmRemoveImage}
          confirmText="Remover"
        />
      )}

      {showDeleteConfirm && (
        <ConfirmActionModal
          title="Excluir Produto"
          description={`Tem certeza que deseja remover o produto "${product!.name}"? Ele será retirado da loja.`}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDeleteProduct}
          loading={saving}
          confirmText="Excluir Produto"
        />
      )}

      {showAddStockModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <ScrollLock />
          <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto break-words min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <h3 className="text-lg font-black font-display flex items-center gap-2 text-primary truncate">
                <Package className="h-5 w-5 flex-shrink-0" /> <span className="truncate">Entrada de Estoque</span>
              </h3>
              <button type="button" onClick={() => setShowAddStockModal(false)} className="text-muted-foreground hover:text-foreground flex-shrink-0 ml-2"><X className="h-4 w-4"/></button>
            </div>
            <p className="text-sm text-muted-foreground font-medium -mt-2 leading-relaxed break-words whitespace-normal">
               Adicione novas unidades e o sistema calculará o <strong>Custo Médio Ponderado</strong> automaticamente.
            </p>
            
            <div className="space-y-3 min-w-0 max-w-full">
               <div className="min-w-0">
                  <Label className="truncate block">Quantidade Recebida <span className="text-destructive">*</span></Label>
                  <Input type="number" min="1" value={addStockQty} onChange={e => { if(e.target.value.length <= 15) setAddStockQty(e.target.value); }} onKeyDown={blockInvalidNumberChars} placeholder="Ex: 10" className="mt-1 w-full min-w-0" required />
               </div>
               <div className="min-w-0">
                  <Label className="truncate block">Custo Unitário da Compra (R$) <span className="text-destructive">*</span></Label>
                  <Input type="number" step="0.01" min="0" value={addStockCost} onChange={e => { if(e.target.value.length <= 15) setAddStockCost(e.target.value); }} onKeyDown={blockInvalidNumberChars} className="mt-1 w-full min-w-0" required />
               </div>
            </div>

            <div className="bg-secondary/30 p-3 rounded-lg border border-border mt-1 break-words min-w-0 max-w-full">
               <div className="flex justify-between text-xs font-semibold mb-1 gap-2 min-w-0">
                  <span className="text-muted-foreground truncate">Estoque atual:</span>
                  <span className="text-foreground flex-shrink-0">{parseInt(stock || "0", 10)} un</span>
               </div>
               <div className="flex justify-between text-xs font-semibold mb-2 pb-2 border-b border-border/50 gap-2 min-w-0">
                  <span className="text-muted-foreground truncate">Custo atual:</span>
                  <span className="text-foreground flex-shrink-0">{brl(parseFloat(cost || "0"))}</span>
               </div>
               <div className="flex justify-between text-sm font-bold mb-1 gap-2 min-w-0">
                  <span className="text-muted-foreground truncate">Novo Estoque:</span>
                  <span className="text-foreground flex-shrink-0">{(parseInt(stock || "0", 10) || 0) + (parseInt(addStockQty || "0", 10) || 0)} un</span>
               </div>
               <div className="flex justify-between text-sm font-bold gap-2 min-w-0">
                  <span className="text-muted-foreground truncate">Novo Custo Médio:</span>
                  <span className="text-primary break-words whitespace-normal text-right min-w-0">
                     {(() => {
                        const cQ = parseInt(stock || "0", 10) || 0;
                        const cC = parseFloat(cost || "0") || 0;
                        const aQ = parseInt(addStockQty || "0", 10) || 0;
                        const aC = parseFloat(addStockCost || "0") || 0;
                        const nQ = cQ + aQ;
                        const nC = nQ > 0 ? ((cQ * cC) + (aQ * aC)) / nQ : cC;
                        return brl(nC);
                     })()}
                  </span>
               </div>
            </div>

            <div className="flex justify-end gap-2 mt-2 flex-shrink-0">
              <Button variant="outline" type="button" onClick={() => setShowAddStockModal(false)} className="rounded-full shadow-sm flex-shrink-0">Cancelar</Button>
              <Button type="button" onClick={confirmAddStock} disabled={!addStockQty || parseInt(addStockQty) <= 0} className="rounded-full shadow-sm bg-primary text-primary-foreground hover:opacity-90 flex-shrink-0">Aplicar Valores</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}