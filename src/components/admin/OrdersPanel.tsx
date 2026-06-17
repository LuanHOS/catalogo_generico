import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { brl, whatsappLink } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Search, Plus, CheckCircle, XCircle, Share2, AlertTriangle, X, Crown, Package } from "lucide-react";

// Importações dos tipos e utilitários compartilhados do arquivo admin principal
import { OrderRow, Product, Category, ScrollLock, ConfirmActionModal, blockInvalidNumberChars } from "@/routes/admin";

/* ---------- Modal Reutilizável de Cancelamento de Pedido ---------- */
function CancelOrderModal({ onClose, onConfirm }: { onClose: () => void, onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onConfirm(reason);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <ScrollLock />
      <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto break-words min-w-0">
        <div className="min-w-0 max-w-full">
          <h3 className="text-lg font-black font-display text-destructive flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-5 w-5 flex-shrink-0"/> <span className="truncate">Cancelar Pedido</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1 font-medium whitespace-normal break-words">Os produtos voltarão automaticamente para o estoque.</p>
        </div>
        <div className="min-w-0 max-w-full">
          <Label className="truncate block">Motivo (Opcional)</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Cliente desistiu da compra" className="mt-1 resize-y min-h-[80px] max-h-[200px] w-full" maxLength={255} />
        </div>
        <div className="flex justify-end gap-2 mt-2 flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-full shadow-sm flex-shrink-0">Voltar</Button>
          <Button variant="destructive" onClick={submit} disabled={saving} className="rounded-full shadow-sm flex-shrink-0">
             {saving ? "Processando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Modal Reutilizável de Conclusão de Pedido ---------- */
function CompleteOrderModal({ onClose, onConfirm }: { onClose: () => void, onConfirm: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onConfirm();
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <ScrollLock />
      <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto break-words min-w-0">
        <div className="min-w-0 max-w-full">
          <h3 className="text-lg font-black font-display text-primary flex items-center gap-2 min-w-0">
             <CheckCircle className="h-5 w-5 flex-shrink-0"/> <span className="truncate">Concluir Pedido</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1 font-medium whitespace-normal break-words">Tem certeza que deseja marcar este pedido como concluído? Ele será contabilizado nas suas estatísticas de vendas.</p>
        </div>
        <div className="flex justify-end gap-2 mt-2 flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-full shadow-sm flex-shrink-0">Voltar</Button>
          <Button onClick={submit} disabled={saving} className="rounded-full shadow-sm bg-primary text-primary-foreground hover:opacity-90 flex-shrink-0">
             {saving ? "Processando..." : "Confirmar Conclusão"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Order Details Modal ---------- */
function OrderDetailsModal({
  order,
  onClose,
  onUpdateStatus
}: {
  order: OrderRow;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string, discountAmount?: number, reason?: string) => Promise<void>;
}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const originalTotal = items.reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 0)), 0);
  const isPending = order.status === 'pending';
  
  const [customTotal, setCustomTotal] = useState(String(order.total));
  const [saving, setSaving] = useState(false);
  
  // UI de Cancelamento e Conclusão
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const parsedTotal = Number(customTotal) || 0;
  const discountVal = originalTotal - parsedTotal;
  const discountPerc = originalTotal > 0 ? (discountVal / originalTotal) * 100 : 0;

  async function handleConcluir() {
    const rawTotal = customTotal.trim();
    if (rawTotal === "" || rawTotal === "," || rawTotal === ".") {
       toast.error("Valor final inválido. Por favor, insira um número válido.");
       return;
    }
    setSaving(true);
    await onUpdateStatus(order.id, 'completed', discountVal);
    setSaving(false);
    onClose();
  }

  async function handleCancelar() {
    setSaving(true);
    await onUpdateStatus(order.id, 'canceled', undefined, cancelReason);
    setSaving(false);
    onClose();
  }

  async function generatePDF(orderToPrint: OrderRow) {
    const toastId = toast.loading("Gerando PDF para download...");
    try {
      const doc = new jsPDF();
      
      const printItems = Array.isArray(orderToPrint.items) ? orderToPrint.items : [];
      const statusText = orderToPrint.status === 'completed' ? 'Concluído' : orderToPrint.status === 'canceled' ? 'Cancelado' : 'Pendente';
      const orderShortId = orderToPrint.id.split('-')[0];
      
      let y = 20;
      const marginLeft = 15;
      const lineHeight = 7;
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo do Pedido", marginLeft, y);
      y += 15;
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      
      doc.text(`ID do Pedido: #${orderShortId}`, marginLeft, y); y += lineHeight;
      doc.text(`Data: ${new Date(orderToPrint.created_at).toLocaleString('pt-BR')}`, marginLeft, y); y += lineHeight;
      doc.text(`Status: ${statusText}`, marginLeft, y); y += lineHeight;
      
      if (orderToPrint.status === 'completed' && orderToPrint.completed_at) {
        doc.text(`Concluído em: ${new Date(orderToPrint.completed_at).toLocaleString('pt-BR')}`, marginLeft, y); y += lineHeight;
      }
      if (orderToPrint.status === 'canceled' && orderToPrint.canceled_at) {
        doc.text(`Cancelado em: ${new Date(orderToPrint.canceled_at).toLocaleString('pt-BR')}`, marginLeft, y); y += lineHeight;
      }
      if (orderToPrint.status === 'canceled' && orderToPrint.cancellation_reason) {
        const reasonLines = doc.splitTextToSize(`Motivo do Cancelamento: ${orderToPrint.cancellation_reason}`, 180);
        doc.text(reasonLines, marginLeft, y);
        y += (reasonLines.length * lineHeight);
      }
      if (orderToPrint.vip_code) {
        doc.text(`Acesso: ${orderToPrint.vip_code}`, marginLeft, y); y += lineHeight;
      }
      
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.text("Itens do Pedido", marginLeft, y);
      y += 10;
      
      doc.setFont("helvetica", "normal");
      
      let sumOriginal = 0;
      
      printItems.forEach((i: any) => {
          const itemTotal = Number(i.price || 0) * Number(i.quantity || 0);
          sumOriginal += itemTotal;
          const itemText = `${i.quantity}x ${i.name} - ${brl(itemTotal)}`;
          const lines = doc.splitTextToSize(itemText, 180);
          doc.text(lines, marginLeft, y);
          y += (lines.length * lineHeight);
          
          if (y > 270) {
              doc.addPage();
              y = 20;
          }
      });
      
      y += 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      
      const diff = sumOriginal - Number(orderToPrint.total);
      
      if (diff > 0) {
          doc.text(`Desconto aplicado: ${brl(diff)}`, marginLeft, y);
          y += 8;
      } else if (diff < 0) {
          doc.text(`Acréscimo aplicado: ${brl(Math.abs(diff))}`, marginLeft, y);
          y += 8;
      }
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Final: ${brl(Number(orderToPrint.total))}`, marginLeft, y);
      
      doc.save(`Pedido-${orderShortId}.pdf`);
      toast.success("Download iniciado!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar o PDF.", { id: toastId });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-sm">
      <ScrollLock />
      <div className="bg-background w-full max-w-lg rounded-2xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden break-words min-w-0">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0 min-w-0">
          <h2 className="text-xl font-display font-black truncate">Detalhes do Pedido</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => generatePDF(order)} title="Baixar PDF" className="text-muted-foreground hover:text-foreground">
              <Share2 className="h-5 w-5" />
            </Button>
            <button onClick={onClose} className="text-sm font-semibold text-muted-foreground hover:text-foreground flex-shrink-0">Fechar</button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight flex items-center gap-2 flex-wrap min-w-0">
               <span className="truncate max-w-full">Pedido #{order.id.split("-")[0]}</span>
               {order.is_presential && <span className="bg-primary/15 text-primary px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide text-primary flex-shrink-0">Venda Presencial</span>}
            </h3>
            <p className="text-sm text-muted-foreground font-medium truncate">Criado em: {new Date(order.created_at).toLocaleString('pt-BR')}</p>
            
            {order.status === 'completed' && order.completed_at && (
               <p className="text-sm text-green-600 font-medium truncate">Concluído em: {new Date(order.completed_at).toLocaleString('pt-BR')}</p>
            )}

            {order.status === 'canceled' && order.canceled_at && (
               <p className="text-sm text-destructive font-medium truncate">Cancelado em: {new Date(order.canceled_at).toLocaleString('pt-BR')}</p>
            )}

            {order.vip_code && (
              <p className="text-sm font-bold text-green-600 mt-1 truncate">Acesso VIP: {order.vip_code}</p>
            )}
            {order.status === 'canceled' && order.cancellation_reason && (
              <div className="mt-2 bg-destructive/10 border border-destructive/20 p-3 rounded-xl min-w-0">
                 <p className="text-xs font-bold text-destructive uppercase tracking-wide truncate">Motivo do Cancelamento</p>
                 <p className="text-sm font-medium mt-1 break-words whitespace-pre-wrap">{order.cancellation_reason}</p>
              </div>
            )}
          </div>

          <div className="min-w-0 max-w-full">
            <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 truncate">Itens do Pedido</h4>
            <div className="space-y-3 min-w-0">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm border-b border-border pb-2 gap-4 min-w-0">
                  <div className="flex gap-2 min-w-0 flex-1">
                    <span className="font-bold flex-shrink-0">{item.quantity}x</span>
                    <span className="font-medium line-clamp-2 break-words w-full" title={item.name}>{item.name}</span>
                  </div>
                  <span className="font-bold text-muted-foreground flex-shrink-0">{brl((Number(item.price || 0)) * Number(item.quantity || 0))}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-secondary/30 p-4 rounded-xl space-y-3 min-w-0">
            <div className="flex justify-between items-center text-sm gap-2">
              <span className="font-semibold text-muted-foreground truncate">Soma dos Itens</span>
              <span className="font-bold text-foreground flex-shrink-0">{brl(originalTotal)}</span>
            </div>

            {isPending ? (
              <>
                <div className="flex flex-col gap-2 pt-2 border-t border-border min-w-0">
                  <Label className="truncate">Valor Final (Desconto)</Label>
                  <div className="relative min-w-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">R$</span>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      max="999999"
                      value={customTotal} 
                      onChange={(e) => {
                         let val = e.target.value;
                         if (val.length > 15) return;
                         if (val === "" || val === "," || val === ".") val = "0";
                         setCustomTotal(val);
                      }} 
                      onKeyDown={blockInvalidNumberChars}
                      className="pl-9 font-black text-lg h-12 w-full min-w-0"
                      disabled={showCancelConfirm || showCompleteConfirm}
                    />
                  </div>
                </div>
                {discountVal > 0 && (
                  <div className="text-sm font-bold text-green-600 bg-green-500/10 px-3 py-2 rounded-lg text-center break-words whitespace-normal min-w-0 max-w-full">
                    Desconto aplicado: {brl(discountVal)} ({discountPerc.toFixed(1)}%)
                  </div>
                )}
                {discountVal < 0 && (
                  <div className="text-sm font-bold text-yellow-600 bg-yellow-500/10 px-3 py-2 rounded-lg text-center break-words whitespace-normal min-w-0 max-w-full">
                    Acréscimo aplicado: {brl(Math.abs(discountVal))}
                  </div>
                )}
              </>
            ) : (
              <div className="pt-2 border-t border-border space-y-1 min-w-0">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-bold uppercase text-xs tracking-wide truncate">Total Cobrado</span>
                  <span className="font-black text-xl text-primary flex-shrink-0">{brl(order.total)}</span>
                </div>
                {(originalTotal - order.total) > 0 && (
                  <div className="text-xs font-bold text-green-600 text-right truncate">
                    Desconto de {brl(originalTotal - order.total)} dado na venda.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isPending && !showCancelConfirm && !showCompleteConfirm && (
          <div className="flex flex-col sm:flex-row justify-end gap-3 px-6 py-4 border-t border-border bg-secondary/10 flex-shrink-0 min-w-0">
            <Button variant="outline" onClick={() => setShowCancelConfirm(true)} disabled={saving} className="rounded-full shadow-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 flex-shrink-0 w-full sm:w-auto">
              Cancelar Pedido
            </Button>
            <Button onClick={() => setShowCompleteConfirm(true)} disabled={saving || parsedTotal < 0} className="rounded-full shadow-sm bg-primary text-primary-foreground hover:opacity-90 flex-shrink-0 w-full sm:w-auto">
              Concluir Pedido
            </Button>
          </div>
        )}

        {isPending && showCancelConfirm && (
          <div className="flex flex-col gap-3 px-6 py-4 border-t border-border bg-destructive/5 animate-in fade-in zoom-in-95 duration-200 min-w-0 flex-shrink-0">
             <Label className="text-destructive font-bold truncate">Confirmação de Cancelamento</Label>
             <p className="text-xs text-muted-foreground font-semibold -mt-2 truncate">O estoque será devolvido automaticamente.</p>
             <Textarea placeholder="Motivo do cancelamento (opcional)" value={cancelReason} onChange={e => setCancelReason(e.target.value)} maxLength={255} className="resize-y min-h-[80px] max-h-[200px] w-full min-w-0" />
             <div className="flex justify-end gap-2 mt-2 flex-shrink-0">
                <Button variant="outline" onClick={() => setShowCancelConfirm(false)} disabled={saving} className="rounded-full shadow-sm flex-shrink-0">Voltar</Button>
                <Button variant="destructive" onClick={handleCancelar} disabled={saving} className="rounded-full shadow-sm flex-shrink-0">
                   {saving ? "Cancelando..." : "Confirmar Exclusão"}
                </Button>
             </div>
          </div>
        )}

        {isPending && showCompleteConfirm && (
          <div className="flex flex-col gap-3 px-6 py-4 border-t border-border bg-green-500/5 animate-in fade-in zoom-in-95 duration-200 min-w-0 flex-shrink-0">
             <Label className="text-primary font-bold flex items-center gap-1.5 min-w-0"><CheckCircle className="h-4 w-4 flex-shrink-0"/> <span className="truncate">Confirmação de Conclusão</span></Label>
             <p className="text-xs text-muted-foreground font-semibold -mt-2 mb-1 break-words whitespace-normal">O pedido será marcado como pago e contabilizado nas vendas.</p>
             <div className="flex justify-end gap-2 mt-2 flex-shrink-0">
                <Button variant="outline" onClick={() => setShowCompleteConfirm(false)} disabled={saving} className="rounded-full shadow-sm flex-shrink-0">Voltar</Button>
                <Button onClick={handleConcluir} disabled={saving} className="rounded-full shadow-sm bg-primary text-primary-foreground hover:opacity-90 flex-shrink-0">
                   {saving ? "Processando..." : "Confirmar Conclusão"}
                </Button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Manual Order Modal ---------- */
function ManualOrderModal({ onClose, onSaved }: { onClose: () => void, onSaved: () => void }) {
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  
  const [productDetailsToShow, setProductDetailsToShow] = useState<Product | null>(null);

  const originalTotal = cart.reduce((acc, item) => acc + (Number(item.product.sale_price) || Number(item.product.price)) * item.quantity, 0);
  const [customTotal, setCustomTotal] = useState("");
  const [isCustomTotalDirty, setIsCustomTotalDirty] = useState(false);
  
  const parsedTotal = Number(customTotal) || 0;
  const discountVal = originalTotal - parsedTotal;
  const discountPerc = originalTotal > 0 ? (discountVal / originalTotal) * 100 : 0;

  const { data: products = [] } = useQuery({
    queryKey: ['admin-products-alphabetical'],
    queryFn: async () => {
      const { data, error } = await supabase.from("active_products").select("*").order("name");
      if (error) throw error;
      return (data as Product[]) || [];
    }
  });

  useEffect(() => {
     if (cart.length === 0) {
         setIsCustomTotalDirty(false);
         setCustomTotal("0");
     } else if (!isCustomTotalDirty) {
         setCustomTotal(String(originalTotal));
     }
  }, [originalTotal, cart.length, isCustomTotalDirty]);

  const addToCart = (p: Product) => {
      setIsCustomTotalDirty(false); 
      setCart(c => {
          const ex = c.find(x => x.product.id === p.id);
          if (ex) {
            const currentMax = p.track_stock ? p.stock : 999999;
            if (ex.quantity >= currentMax) return c;
            return c.map(x => x.product.id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
          }
          return [...c, { product: p, quantity: 1 }];
      });
  };

  const removeFromCart = (p: Product) => {
      setIsCustomTotalDirty(false); 
      setCart(c => c.map(x => x.product.id === p.id ? { ...x, quantity: x.quantity - 1 } : x).filter(x => x.quantity > 0));
  };

  function handleAttemptClose() {
      if (cart.length > 0) {
          setShowCancelConfirm(true);
      } else {
          onClose();
      }
  }

  const save = async () => {
      if (cart.length === 0) return;

      const rawTotal = customTotal.trim();
      if (rawTotal === "" || rawTotal === "," || rawTotal === ".") {
          toast.error("Valor final inválido. Por favor, insira um número válido.");
          return;
      }

      setSaving(true);

      const itemsJson = cart.map(c => ({
          id: c.product.id,
          name: c.product.name,
          price: Number(c.product.sale_price) || Number(c.product.price),
          quantity: c.quantity,
          category_id: c.product.category_id
      }));
      
      const { error } = await supabase.rpc("checkout_presential_order", { discount_amount: discountVal, order_items: itemsJson });
      setSaving(false);
      if (error) { toast.error("Erro ao finalizar venda: " + error.message); return; }
      toast.success("Venda presencial concluída com sucesso!");
      onSaved();
      onClose();
  };

  const exactSearch = search.trim();
  const q = exactSearch.toLowerCase();
  const filteredProducts = products.filter(p => {
     if (!p.in_stock) return false;
     if (!exactSearch) return false;
     if (p.barcode && p.barcode === exactSearch) return true;
     return p.name.toLowerCase().includes(q);
  });

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-sm">
         <ScrollLock />
         <div className="bg-background w-full max-w-4xl rounded-2xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden min-w-0">
             <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0 min-w-0">
                <h2 className="text-xl font-display font-black truncate">Nova Venda Presencial</h2>
                <button onClick={handleAttemptClose} className="text-sm font-semibold text-muted-foreground hover:text-foreground flex-shrink-0 ml-2">Fechar</button>
             </div>
             
             <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col sm:flex-row min-h-0">
                 <div className="w-full sm:w-3/5 p-6 border-b sm:border-b-0 sm:border-r border-border flex flex-col min-w-0">
                     <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex-shrink-0 truncate">Produtos Disponíveis</h3>
                     <div className="relative mb-4 flex-shrink-0 min-w-0">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                         <Input placeholder="Buscar por nome ou código de barras..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full min-w-0" maxLength={100} />
                     </div>
                     <div className="grid gap-2 overflow-y-auto overflow-x-hidden flex-1 pr-1 min-w-0 max-w-full">
                     {!exactSearch ? (
                         <div className="flex flex-col items-center justify-center py-10 text-center px-4 h-full min-h-[150px]">
                             <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
                             <p className="text-sm font-semibold text-muted-foreground break-words whitespace-normal">
                                 Digite o nome ou código de barras acima para buscar os produtos.
                             </p>
                         </div>
                     ) : filteredProducts.length === 0 ? (
                         <p className="text-sm font-semibold text-muted-foreground text-center py-8 truncate">Nenhum produto encontrado.</p>
                     ) : (
                         filteredProducts.map(p => {
                             const outOfStock = p.track_stock && p.stock <= 0;
                             const isLowStock = !outOfStock && p.track_stock && p.stock <= (p.min_stock || 0);
                             return (
                             <div key={p.id} className={"flex justify-between border p-3 rounded-xl items-center shadow-sm transition gap-3 min-w-0 max-w-full " + (outOfStock ? "opacity-50 bg-secondary border-border" : isLowStock ? "border-yellow-600 ring-1 ring-yellow-600/50 bg-yellow-500/5" : "bg-card border-border")}>
                                 <div className="flex items-center flex-shrink-0">
                                    <Button size="sm" onClick={() => addToCart(p)} disabled={outOfStock} className="rounded-full h-8 px-3 shadow-sm flex-shrink-0">
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                 </div>
                                 <div className="min-w-0 flex-1 overflow-hidden">
                                    <div 
                                        className="font-semibold text-sm line-clamp-2 break-words cursor-pointer hover:text-primary transition-colors w-full min-w-0" 
                                        onClick={() => setProductDetailsToShow(p)} 
                                        title="Clique para ver os detalhes"
                                    >
                                        {p.name}
                                    </div>
                                    <div className="text-xs font-semibold text-muted-foreground mt-0.5 truncate">Estoque: {p.track_stock ? p.stock : '∞ Ilimitado'}</div>
                                 </div>
                                 <div className="flex items-center flex-shrink-0">
                                    <span className="font-bold text-primary truncate">{brl(Number(p.sale_price) || Number(p.price))}</span>
                                 </div>
                             </div>
                         )})
                     )}
                     </div>
                 </div>
                 <div className="w-full sm:w-2/5 p-6 bg-secondary/20 flex flex-col min-w-0">
                     <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex-shrink-0 truncate">Carrinho</h3>
                     {cart.length === 0 && <p className="text-sm font-medium text-muted-foreground flex-shrink-0 truncate">O carrinho está vazio.</p>}
                     <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-1 min-w-0 max-w-full">
                     {cart.map(c => {
                         const currentMax = c.product.track_stock ? c.product.stock : 999999;
                         return (
                         <div key={c.product.id} className="flex flex-col text-sm border-b border-border/50 pb-3 min-w-0 overflow-hidden max-w-full">
                             <div 
                                className="font-semibold line-clamp-2 break-words cursor-pointer hover:text-primary transition-colors w-full min-w-0" 
                                onClick={() => setProductDetailsToShow(c.product)}
                                title="Clique para ver os detalhes"
                             >
                                {c.product.name}
                             </div>
                             <div className="flex justify-between items-center mt-2 gap-2 min-w-0">
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button onClick={() => removeFromCart(c.product)} className="bg-secondary text-foreground rounded-full w-7 h-7 flex items-center justify-center border border-border hover:bg-border transition shadow-sm flex-shrink-0">-</button>
                                    <span className="w-4 text-center font-bold flex-shrink-0">{c.quantity}</span>
                                    <button onClick={() => addToCart(c.product)} disabled={c.quantity >= currentMax} className="bg-secondary text-foreground rounded-full w-7 h-7 flex items-center justify-center border border-border hover:bg-border transition disabled:opacity-50 shadow-sm flex-shrink-0">+</button>
                                </div>
                                <span className="font-bold text-primary flex-shrink-0 truncate">{brl((Number(c.product.sale_price) || Number(c.product.price)) * c.quantity)}</span>
                             </div>
                         </div>
                     )})}
                     </div>
                     <div className="pt-4 mt-4 border-t border-border flex flex-col gap-2 flex-shrink-0 min-w-0">
                         <div className="flex justify-between text-sm text-muted-foreground font-semibold gap-2 min-w-0">
                             <span className="truncate">Soma dos Itens</span>
                             <span className="flex-shrink-0">{brl(originalTotal)}</span>
                         </div>
                         <div className="flex justify-between items-center mt-1 gap-2 min-w-0">
                            <Label className="text-base font-black flex-shrink-0 truncate">Valor Final (R$)</Label>
                            <Input 
                               type="number" 
                               step="0.01" 
                               min="0" 
                               max="999999" 
                               value={customTotal} 
                               onChange={(e) => {
                                  let val = e.target.value;
                                  if (val.length > 15) return;
                                  if (val === "" || val === "," || val === ".") val = "0";
                                  setCustomTotal(val);
                                  setIsCustomTotalDirty(true);
                               }} 
                               onKeyDown={blockInvalidNumberChars}
                               className="w-32 font-black text-right h-10 flex-shrink-0 min-w-0" 
                               disabled={cart.length === 0}
                            />
                         </div>
                         {discountVal > 0 && (
                            <div className="text-sm font-bold text-green-600 bg-green-500/10 px-3 py-2 rounded-lg text-center mt-2 break-words whitespace-normal min-w-0 max-w-full">
                                Desconto aplicado: {brl(discountVal)} ({discountPerc.toFixed(1)}%)
                            </div>
                         )}
                         {discountVal < 0 && (
                            <div className="text-sm font-bold text-yellow-600 bg-yellow-500/10 px-3 py-2 rounded-lg text-center mt-2 break-words whitespace-normal min-w-0 max-w-full">
                                Acréscimo aplicado: {brl(Math.abs(discountVal))}
                            </div>
                         )}
                     </div>
                 </div>
             </div>
             <div className="flex flex-col sm:flex-row justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0 min-w-0">
                 <Button variant="outline" onClick={handleAttemptClose} className="rounded-full shadow-sm flex-shrink-0 w-full sm:w-auto">Cancelar</Button>
                 <Button onClick={save} disabled={cart.length === 0 || saving} className="rounded-full shadow-sm flex-shrink-0 w-full sm:w-auto">
                    {saving ? "Processando..." : "Concluir Venda"}
                 </Button>
             </div>
         </div>

         {/* Pop-up de detalhes do produto do pedido manual */}
         {productDetailsToShow && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <ScrollLock />
                <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] break-words min-w-0">
                    <div className="flex items-start justify-between gap-3 border-b border-border pb-3 min-w-0">
                        <h3 className="text-lg font-black font-display break-words whitespace-normal leading-tight flex-1 min-w-0">{productDetailsToShow.name}</h3>
                        <button onClick={() => setProductDetailsToShow(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-1"><X className="h-5 w-5"/></button>
                    </div>
                    
                    <div className="flex flex-col gap-3 text-sm min-w-0">
                        {productDetailsToShow.image_url && (
                           <img src={productDetailsToShow.image_url} alt={productDetailsToShow.name} className="w-full h-40 object-cover rounded-xl border border-border flex-shrink-0" />
                        )}
                        <div className="flex justify-between border-b border-border pb-2 mt-1 gap-2 min-w-0">
                           <span className="text-muted-foreground font-semibold flex-shrink-0 truncate">Preço:</span>
                           <span className="font-bold text-primary text-right break-words min-w-0 flex-shrink-0">
                              {productDetailsToShow.sale_price ? (
                                 <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                                    <span className="text-xs line-through text-muted-foreground">{brl(Number(productDetailsToShow.price))}</span>
                                    <span>{brl(Number(productDetailsToShow.sale_price))}</span>
                                 </div>
                              ) : brl(Number(productDetailsToShow.price))}
                           </span>
                        </div>
                        <div className="flex justify-between border-b border-border pb-2 gap-2 min-w-0">
                           <span className="text-muted-foreground font-semibold flex-shrink-0 truncate">Estoque atual:</span>
                           <span className="font-bold text-right break-words min-w-0 flex-shrink-0">{productDetailsToShow.track_stock ? `${productDetailsToShow.stock} un.` : '∞ Ilimitado'}</span>
                        </div>
                        {productDetailsToShow.barcode && (
                           <div className="flex justify-between border-b border-border pb-2 gap-2 min-w-0">
                              <span className="text-muted-foreground font-semibold flex-shrink-0 truncate">Cód. Barras:</span>
                              <span className="font-bold break-all text-right min-w-0 max-w-[150px] sm:max-w-full">{productDetailsToShow.barcode}</span>
                           </div>
                        )}
                        {productDetailsToShow.description && (
                           <div className="mt-1 min-w-0 max-w-full">
                              <span className="text-muted-foreground font-semibold block truncate">Descrição:</span>
                              <p className="mt-1 font-medium text-muted-foreground break-words whitespace-pre-wrap w-full">{productDetailsToShow.description}</p>
                           </div>
                        )}
                    </div>
                    
                    <div className="flex justify-end mt-2 pt-2 flex-shrink-0">
                        <Button onClick={() => setProductDetailsToShow(null)} className="rounded-full shadow-sm w-full">Fechar</Button>
                    </div>
                </div>
            </div>
         )}
         
         {showCancelConfirm && (
            <ConfirmActionModal
                title="Cancelar Venda Presencial?"
                description="Você já adicionou itens ao carrinho. Se fechar agora, a venda será descartada e os itens perdidos."
                onClose={() => setShowCancelConfirm(false)}
                onConfirm={() => {
                    setShowCancelConfirm(false);
                    onClose();
                }}
                destructive={true}
                confirmText="Sim, fechar e descartar"
            />
         )}
      </div>
  );
}

/* ---------- Orders Panel Base ---------- */
export function OrdersPanel({ onStatusChange, currentUserName }: { onStatusChange?: () => void, currentUserName: string }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [showManual, setShowManual] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  
  // Limite de exibição simultânea na tela (paginação)
  const [visibleCount, setVisibleCount] = useState(20);
  
  // Modais Rápidos
  const [cancelModalOrder, setCancelModalOrder] = useState<OrderRow | null>(null);
  const [completeModalOrder, setCompleteModalOrder] = useState<OrderRow | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Sempre que os filtros mudarem, resetamos a paginação para exibir o limite padrão
  useEffect(() => {
     setVisibleCount(20);
  }, [searchQuery, statusFilter, startDate, endDate]);

  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders', startDate, endDate],
    queryFn: async () => {
      let q = supabase.from("orders").select("*").order("created_at", { ascending: false });

      if (startDate) q = q.gte("created_at", `${startDate}T00:00:00Z`);
      if (endDate) q = q.lte("created_at", `${endDate}T23:59:59Z`);

      const { data, error } = await q;
      if (error) throw error;
      return (data as OrderRow[]) || [];
    }
  });

  const fetchOrders = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    // Invalida os produtos também para que o estoque na aba Produtos sempre fique atualizado após a criação/cancelamento de um pedido
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    queryClient.invalidateQueries({ queryKey: ['admin-products-alphabetical'] });
  }, [queryClient]);

  async function updateStatus(id: string, newStatus: string, discountAmount?: number, reason?: string) {
    const { error } = await supabase.rpc("update_order_status", { 
       order_id: id, 
       new_status: newStatus, 
       p_discount_amount: discountAmount, 
       p_reason: reason, 
       p_canceled_by: currentUserName 
    });
    if (error) toast.error("Erro ao atualizar pedido: " + error.message);
    else { 
      toast.success("Status atualizado"); 
      fetchOrders(); 
      if (onStatusChange) onStatusChange();
    }
  }

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!query) return true;

      const idMatch = o.id.toLowerCase().includes(query);
      const vipMatch = o.vip_code && o.vip_code.toLowerCase().includes(query);
      const itemsMatch = Array.isArray(o.items) && o.items.some((i: any) => 
        i.name && i.name.toLowerCase().includes(query)
      );

      return idMatch || vipMatch || itemsMatch;
    });
  }, [orders, statusFilter, searchQuery]);

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 min-w-0">
        <div className="flex gap-2 p-1 bg-secondary rounded-lg border border-border overflow-x-auto w-full sm:w-auto min-w-0">
          {(["pending", "completed", "canceled", "all"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap flex-shrink-0 ${statusFilter === s ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {s === "pending" ? "Pendentes" : s === "completed" ? "Concluídos" : s === "canceled" ? "Cancelados" : "Todos"}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowManual(true)} className="rounded-full shadow-sm flex-shrink-0 w-full sm:w-auto">
          <Plus className="mr-1 h-4 w-4" /> Fazer Venda Presencial
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-xl border border-border shadow-sm min-w-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por ID, produto ou senha VIP..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="pl-9 h-10 w-full min-w-0" 
            maxLength={100}
          />
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0 overflow-x-auto">
          <Input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            className="h-10 w-[130px] sm:w-auto text-sm flex-shrink-0" 
          />
          <span className="text-muted-foreground text-sm font-semibold flex-shrink-0">até</span>
          <Input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            className="h-10 w-[130px] sm:w-auto text-sm flex-shrink-0" 
          />
        </div>
      </div>

      <div className="grid gap-3 min-w-0 max-w-full">
        {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground font-semibold border border-dashed border-border rounded-xl">Nenhum pedido encontrado.</div>}
        {filtered.slice(0, visibleCount).map(o => (
          <div 
            key={o.id} 
            className="border border-border bg-card p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm cursor-pointer hover:border-primary/30 transition break-words min-w-0 max-w-full"
            onClick={() => setSelectedOrder(o)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="font-bold text-lg truncate block max-w-full">Pedido #{o.id.split("-")[0]}</span>
                {o.status === 'pending' && <span className="bg-yellow-500/15 text-yellow-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide flex-shrink-0">Pendente</span>}
                {o.status === 'completed' && <span className="bg-green-500/15 text-green-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide flex-shrink-0">Concluído</span>}
                {o.status === 'canceled' && <span className="bg-destructive/15 text-destructive px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide flex-shrink-0">Cancelado</span>}
                {o.is_presential && <span className="bg-primary/15 text-primary px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide flex-shrink-0">Venda Presencial</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-medium truncate">{new Date(o.created_at).toLocaleString('pt-BR')}</p>
              {o.vip_code && (
                <div className="mt-1 text-xs font-bold text-green-600 truncate">Acesso VIP: {o.vip_code}</div>
              )}
              <div className="text-sm mt-2 font-medium line-clamp-2 break-words max-w-full" title={Array.isArray(o.items) ? o.items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ") : ""}>
                {Array.isArray(o.items) && o.items.map((i: any) => {
                   const shortName = i.name && i.name.length > 20 ? i.name.substring(0, 20) + "..." : i.name;
                   return `${i.quantity}x ${shortName}`;
                }).join(", ")}
              </div>
              <div className="text-primary font-black mt-2 truncate">{brl(Number(o.total))}</div>
            </div>
            {o.status === 'pending' && (
              <div className="flex gap-2 sm:flex-col flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" className="border-green-500/30 text-green-600 shadow-sm hover:bg-green-50 hover:text-green-700" onClick={() => setCompleteModalOrder(o)}>
                  <CheckCircle className="mr-1 h-4 w-4" /> Concluir
                </Button>
                <Button variant="outline" className="border-destructive/30 text-destructive shadow-sm hover:bg-destructive/10" onClick={() => setCancelModalOrder(o)}>
                  <XCircle className="mr-1 h-4 w-4" /> Cancelar
                </Button>
              </div>
            )}
            {o.status === 'completed' && (
                <Button variant="ghost" size="sm" className="text-muted-foreground font-semibold flex-shrink-0" onClick={(e) => { e.stopPropagation(); setCancelModalOrder(o); }}>Cancelar Venda</Button>
            )}
          </div>
        ))}
      </div>

      {visibleCount < filtered.length && (
         <div className="mt-6 flex justify-center w-full min-w-0">
            <Button variant="outline" onClick={() => setVisibleCount(v => v + 20)} className="rounded-full shadow-sm w-full sm:w-auto">
               Mostrar mais pedidos
            </Button>
         </div>
      )}

      {cancelModalOrder && (
        <CancelOrderModal 
          onClose={() => setCancelModalOrder(null)} 
          onConfirm={async (reason) => {
            await updateStatus(cancelModalOrder.id, 'canceled', undefined, reason);
            setCancelModalOrder(null);
          }} 
        />
      )}

      {completeModalOrder && (
        <CompleteOrderModal 
          onClose={() => setCompleteModalOrder(null)} 
          onConfirm={async () => {
            await updateStatus(completeModalOrder.id, 'completed', undefined);
            setCompleteModalOrder(null);
          }} 
        />
      )}

      {showManual && <ManualOrderModal onClose={() => setShowManual(false)} onSaved={() => { fetchOrders(); if (onStatusChange) onStatusChange(); }} />}
      {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onUpdateStatus={updateStatus} />}
    </div>
  );
}