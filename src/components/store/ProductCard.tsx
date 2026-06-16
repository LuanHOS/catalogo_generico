import React from "react";
import { useCart, cart } from "@/lib/cart";
import { brl } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingBag, Package, Crown, Tag } from "lucide-react";
import { Product, effectivePrice, isPromo } from "@/routes/index";

export function PromoBadge() {
  return (
    <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-black uppercase tracking-wide text-accent-foreground shadow-md border border-background">
      <Tag className="h-4 w-4" /> Promoção
    </span>
  );
}

export function PriceBlock({ p, big = false }: { p: Product; big?: boolean }) {
  const promo = isPromo(p);
  const eff = effectivePrice(p);
  if (promo) {
    return (
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={(big ? "text-base" : "text-xs") + " text-muted-foreground line-through font-semibold"}>
          {brl(Number(p.price))}
        </span>
        <span className={(big ? "text-3xl" : "text-xl") + " font-black text-primary"}>
          {brl(eff)}
        </span>
      </div>
    );
  }
  return <div className={(big ? "text-3xl" : "text-lg") + " font-black text-primary"}>{brl(eff)}</div>;
}

export function ProductCard({ p, isVip, onOpen, onRemoveRequested }: { p: Product; isVip: boolean; onOpen: () => void; onRemoveRequested: (id: string) => void }) {
  const items = useCart();
  const inCart = items.find((i) => i.id === p.id);
  const qty = inCart?.qty ?? 0;
  
  const outOfStock = p.track_stock && (!p.in_stock || p.stock <= 0);
  
  const currentMax = p.max_per_cart > 0 
    ? (p.track_stock ? Math.min(p.max_per_cart, p.stock) : p.max_per_cart) 
    : (p.track_stock ? p.stock : 999999);
    
  const reachedMax = qty >= currentMax;
  const eff = effectivePrice(p);

  function addToCart(e: React.MouseEvent) {
    e.stopPropagation();
    cart.add({ id: p.id, name: p.name, price: eff, max: currentMax });
  }

  return (
    <article
      onClick={onOpen}
      className="group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm transition hover:shadow-md"
    >
      {isPromo(p) && <PromoBadge />}
      <div className="aspect-[4/3] relative overflow-hidden bg-secondary border-b border-border/40">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-12 w-12 opacity-30" />
          </div>
        )}
        {outOfStock && (
          <span className="absolute left-3 bottom-3 rounded-full bg-destructive px-3 py-1 text-xs font-black text-destructive-foreground z-10 shadow-sm">
            Sem estoque
          </span>
        )}
      </div>
      <div className="p-3 flex flex-1 flex-col">
        <h3 className="text-sm line-clamp-2 font-display font-bold leading-tight text-card-foreground break-words" title={p.name}>
          {isVip && <span title="Área Exclusiva" className="inline-block mr-1 align-text-bottom"><Crown className="h-3.5 w-3.5 text-yellow-500" /></span>}
          {p.name}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <Package className="h-3 w-3" /> {p.track_stock ? `${p.stock} em estoque` : "Disponível"}
        </p>
        <div className="mt-2"><PriceBlock p={p} /></div>

        <div className="pt-3 mt-auto" onClick={(e) => e.stopPropagation()}>
          {qty === 0 ? (
            <Button
              type="button"
              disabled={outOfStock}
              onClick={addToCart}
              className={`h-10 text-xs w-full rounded-full font-bold shadow-sm disabled:opacity-50 ${isVip && !outOfStock ? 'vip-chip' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
            >
              {outOfStock ? "Esgotado" : "Adicionar"}
            </Button>
          ) : (
            <div className="flex items-center justify-between gap-1 rounded-full bg-secondary p-1">
              <button onClick={() => qty === 1 ? onRemoveRequested(p.id) : cart.setQty(p.id, qty - 1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-background text-foreground hover:bg-background/70 shadow-sm" aria-label="Diminuir">
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-black">{qty}</span>
              <button
                disabled={reachedMax}
                onClick={() => cart.add({ id: p.id, name: p.name, price: eff, max: currentMax })}
                className={`h-8 w-8 flex items-center justify-center rounded-full shadow-sm disabled:opacity-40 ${isVip && !reachedMax ? 'vip-chip' : 'bg-primary text-primary-foreground hover:opacity-90'}`}
                aria-label="Aumentar"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}