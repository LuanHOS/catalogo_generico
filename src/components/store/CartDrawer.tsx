import React, { useState } from "react";
import { useCart, cart } from "@/lib/cart";
import { brl } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Trash2, ChevronDown } from "lucide-react";

// Importações dos tipos e utilitários compartilhados do arquivo index principal
import { Product, ScrollLock, ConfirmActionModal } from "@/routes/index";

export function CartDrawer({ 
  onClose, 
  total, 
  onFinalize, 
  checkoutLoading, 
  prods,
  onRemoveRequested
}: { 
  onClose: () => void; 
  total: number; 
  onFinalize: () => void; 
  checkoutLoading: boolean; 
  prods: Product[];
  onRemoveRequested: (id: string) => void;
}) {
  const items = useCart();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  function limpar() {
    if (!items.length) return;
    setShowClearConfirm(true);
  }

  function confirmLimpar() {
    cart.clear();
    setShowClearConfirm(false);
  }
  
  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end" role="dialog">
        <ScrollLock />
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <aside className="relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-xl font-black">Seu Carrinho</h2>
            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <button
                  onClick={limpar}
                  className="rounded-full px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
                >
                  Limpar
                </button>
              )}
              <Button variant="secondary" size="sm" onClick={onClose} className="rounded-full px-4 font-bold ml-2 shadow-sm hover:bg-secondary/80 flex items-center gap-1.5" aria-label="Minimizar">
                Minimizar <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
              </Button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4 bg-secondary/10">
            {items.length === 0 ? (
              <p className="mt-10 text-center text-muted-foreground font-medium">
                Seu carrinho está vazio. Adicione produtos no catálogo!
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((i) => {
                  const p = prods.find((prod) => prod.id === i.id);
                  const currentMax = p 
                    ? (p.max_per_cart > 0 ? (p.track_stock ? Math.min(p.max_per_cart, p.stock) : p.max_per_cart) : (p.track_stock ? p.stock : 999999)) 
                    : i.max;

                  return (
                    <li key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold leading-tight line-clamp-2 break-words" title={i.name}>{i.name}</div>
                        <div className="text-sm font-semibold text-muted-foreground">{brl(i.price)} cada</div>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-secondary px-1 border border-border/50 flex-shrink-0">
                        <button onClick={() => i.qty === 1 ? onRemoveRequested(i.id) : cart.setQty(i.id, i.qty - 1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-background">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center font-bold">{i.qty}</span>
                        <button
                          onClick={() => cart.setQty(i.id, Math.min(i.qty + 1, currentMax))}
                          disabled={i.qty >= currentMax}
                          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-background disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button onClick={() => onRemoveRequested(i.id)} className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex-shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <footer className="border-t border-border p-5 bg-card">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Total</span>
              <span className="font-display text-2xl font-black text-primary">{brl(total)}</span>
            </div>
            <Button
              disabled={!items.length || checkoutLoading}
              onClick={onFinalize}
              className="w-full rounded-full bg-whatsapp py-6 text-base font-black text-whatsapp-foreground shadow-sm hover:opacity-90 disabled:opacity-70"
            >
              {checkoutLoading ? "Processando..." : "Finalizar pelo WhatsApp"}
            </Button>
          </footer>
        </aside>
      </div>

      {showClearConfirm && (
        <ConfirmActionModal
          title="Limpar Carrinho"
          description="Tem certeza que deseja remover todos os produtos do seu carrinho?"
          onClose={() => setShowClearConfirm(false)}
          onConfirm={confirmLimpar}
          destructive={true}
          confirmText="Sim, limpar"
        />
      )}
    </>
  );
}