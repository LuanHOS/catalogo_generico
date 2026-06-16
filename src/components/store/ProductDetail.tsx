import React, { useEffect } from "react";
import { useCart, cart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingBag, Package, Crown, X } from "lucide-react";
import { Product, ScrollLock, effectivePrice, isPromo } from "@/routes/index";
import { PromoBadge, PriceBlock } from "./ProductCard";

export function ProductDetail({ p, isVip, onClose, onRemoveRequested }: { p: Product; isVip: boolean; onClose: () => void; onRemoveRequested: (id: string) => void }) {
  const items = useCart();
  const inCart = items.find((i) => i.id === p.id);
  const qty = inCart?.qty ?? 0;
  
  const outOfStock = p.track_stock && (!p.in_stock || p.stock <= 0);
  const currentMax = p.max_per_cart > 0 
    ? (p.track_stock ? Math.min(p.max_per_cart, p.stock) : p.max_per_cart) 
    : (p.track_stock ? p.stock : 999999);
    
  const reachedMax = qty >= currentMax;
  const eff = effectivePrice(p);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-0 sm:items-center sm:p-6" role="dialog">
      <ScrollLock />
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow hover:bg-secondary"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="overflow-y-auto flex-1 w-full flex flex-col">
          <div className="relative w-full bg-secondary border-b border-border/40 flex-shrink-0 aspect-square sm:aspect-video">
            {isPromo(p) && <PromoBadge />}
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ShoppingBag className="h-16 w-16 opacity-30" />
              </div>
            )}
            {outOfStock && (
              <span className="absolute left-4 bottom-4 rounded-full bg-destructive px-4 py-2 text-sm font-black text-destructive-foreground shadow-sm">
                Sem estoque
              </span>
            )}
          </div>
          <div className="flex flex-col gap-4 p-6 min-w-0 w-full">
            <div className="w-full overflow-hidden break-words">
              <h2 className="font-display text-2xl font-black leading-tight sm:text-3xl break-words whitespace-normal">
                {isVip && <span title="Área Exclusiva" className="inline-block mr-2 align-text-bottom"><Crown className="h-6 w-6 text-yellow-500" /></span>}
                {p.name}
              </h2>
              <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                <Package className="h-4 w-4" /> {p.track_stock ? `${p.stock} unidades em estoque` : "Disponível"}
              </div>
              {p.description && <p className="mt-2 text-sm font-medium text-muted-foreground break-words whitespace-pre-wrap">{p.description}</p>}
            </div>
            <PriceBlock p={p} big />
            <div className="mt-auto pt-4">
              {qty === 0 ? (
                <Button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => cart.add({ id: p.id, name: p.name, price: eff, max: currentMax })}
                  className={`w-full rounded-full py-6 text-base font-black shadow-sm disabled:opacity-50 ${isVip && !outOfStock ? 'vip-chip' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                >
                  {outOfStock ? "Produto Esgotado" : "Adicionar ao carrinho"}
                </Button>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-full bg-secondary p-2">
                  <button onClick={() => qty === 1 ? onRemoveRequested(p.id) : cart.setQty(p.id, qty - 1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-sm hover:bg-background/70" aria-label="Diminuir">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-black">{qty} no carrinho</span>
                  <button
                    disabled={reachedMax}
                    onClick={() => cart.add({ id: p.id, name: p.name, price: eff, max: currentMax })}
                    className={`flex h-10 w-10 items-center justify-center rounded-full shadow-sm disabled:opacity-40 ${isVip && !reachedMax ? 'vip-chip' : 'bg-primary text-primary-foreground hover:opacity-90'}`}
                    aria-label="Aumentar"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
              {reachedMax && !outOfStock && (
                <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">
                  Lembrete: Limite atingido para este produto.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}