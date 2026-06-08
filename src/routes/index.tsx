import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cart, useCart } from "@/lib/cart";
import { brl, useWhatsAppNumber, whatsappLink } from "@/lib/whatsapp";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Plus, Minus, Trash2, ChevronDown, Search, X, Tag, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Banca da Pamela — Catálogo" },
      { name: "description", content: "Catálogo da Banca da Pamela. Monte seu pedido e finalize pelo WhatsApp." },
    ],
  }),
  component: Index,
});

type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  sale_price: number | null;
  in_stock: boolean;
  max_per_cart: number;
};
type Category = { id: string; name: string; sort_order: number };

function effectivePrice(p: Pick<Product, "price" | "sale_price">) {
  const sale = p.sale_price != null ? Number(p.sale_price) : null;
  const price = Number(p.price);
  return sale != null && sale > 0 && sale < price ? sale : price;
}
function isPromo(p: Pick<Product, "price" | "sale_price">) {
  const sale = p.sale_price != null ? Number(p.sale_price) : null;
  return sale != null && sale > 0 && sale < Number(p.price);
}

function Index() {
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const items = useCart();
  const whatsNumber = useWhatsAppNumber();

  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase
          .from("products")
          .select(
            "id, name, description, price, sale_price, in_stock, max_per_cart, sort_order, category_id, image_url, created_at, updated_at",
          )
          .order("sort_order"),
      ]);
      if (c.error || p.error) {
        setLoadError(c.error?.message ?? p.error?.message ?? "Erro ao carregar catálogo");
      }
      setCats(c.data ?? []);
      setProds((p.data ?? []) as Product[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("pt-BR");
    return prods.filter((p) => {
      const matchesCat = activeCat === "all" || p.category_id === activeCat;
      const searchable = `${p.name} ${p.description ?? ""}`.toLocaleLowerCase("pt-BR");
      const matchesSearch = !query || searchable.includes(query);
      return matchesCat && matchesSearch;
    });
  }, [prods, activeCat, searchTerm]);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = items.reduce((s, i) => s + i.qty, 0);

  function finalizar() {
    if (!items.length) return;
    const lines = [
      "*Pedido — Banca da Pamela*",
      "",
      ...items.map((i, idx) => {
        const sub = i.price * i.qty;
        return `${idx + 1}. *${i.name}*\n   ${i.qty} × ${brl(i.price)} = *${brl(sub)}*`;
      }),
      "",
      `*Total: ${brl(total)}*`,
    ];
    window.open(whatsappLink(lines.join("\n"), whatsNumber), "_blank");
    
    // LINHAS ADICIONADAS: Limpa o carrinho e fecha a gaveta lateral
    cart.clear();
    setCartOpen(false);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-black">
              P
            </div>
            <div className="leading-tight">
              <div className="font-display text-xl font-black text-foreground sm:text-2xl">
                Banca da Pamela
              </div>
              <div className="text-xs text-muted-foreground">Catálogo de produtos</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              aria-label="Área do Administrador"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80 sm:px-4"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Área do Administrador</span>
            </Link>
            <button
              onClick={() => setCartOpen(true)}
              className="relative inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Carrinho</span>
              {itemCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-black text-accent-foreground">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border/60 bg-gradient-to-br from-secondary via-background to-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Bem-vindo(a)</p>
          <h1 className="mt-2 text-4xl font-black leading-tight text-foreground sm:text-5xl md:text-6xl">
            Catálogo de Produtos da<br />Banca da Pamela.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Consulte o estoque, monte seu pedido e finalize direto pelo WhatsApp.
          </p>
        </div>
      </section>

      {/* Filters */}
      <div className="sticky top-[64px] z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearchTerm(searchInput);
              if (searchInput.trim()) setActiveCat("all");
            }}
            className="flex gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (!e.target.value.trim()) setSearchTerm("");
                }}
                placeholder="Buscar produto"
                className="h-11 w-full rounded-full border border-input bg-card pl-10 pr-4 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-black text-primary-foreground transition hover:opacity-90"
            >
              Buscar
            </button>
          </form>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto">
            <CatChip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
              Todos
            </CatChip>
            {cats.map((c) => (
              <CatChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
                {c.name}
              </CatChip>
            ))}
          </div>
        </div>
      </div>

      {/* Products */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <p className="text-muted-foreground">Carregando catálogo…</p>
        ) : loadError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
            <p className="text-lg font-semibold text-destructive">Não foi possível carregar o catálogo.</p>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-lg font-semibold">
              {searchTerm ? "Produto não encontrado." : "Nenhum produto por aqui ainda."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm
                ? "Tente buscar por outro nome ou limpe a pesquisa."
                : "A Pamela está organizando o estoque. Volte logo!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((p) => (
              <ProductCard key={p.id} p={p} onOpen={() => setDetail(p)} />
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-12 flex justify-center">
            <button
              onClick={finalizar}
              className="inline-flex items-center gap-3 rounded-full bg-whatsapp px-8 py-5 text-lg font-black text-whatsapp-foreground shadow-xl shadow-black/15 transition hover:scale-[1.02] active:scale-100"
            >
              Finalizar Compra pelo WhatsApp
              <span className="rounded-full bg-black/15 px-3 py-1 text-sm">{brl(total)}</span>
            </button>
          </div>
        )}
      </main>

      <footer className="mt-10 border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Banca da Pamela — Feito com 💛
        </div>
      </footer>

      {cartOpen && (
        <CartDrawer onClose={() => setCartOpen(false)} total={total} onFinalize={finalizar} />
      )}
      {detail && <ProductDetail p={detail} onClose={() => setDetail(null)} />}
      <WhatsAppFloat />
    </div>
  );
}

function CatChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition " +
        (active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70")
      }
    >
      {children}
    </button>
  );
}

function PromoBadge() {
  return (
    <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] font-black uppercase tracking-wide text-accent-foreground shadow">
      <Tag className="h-3 w-3" /> Promoção
    </span>
  );
}

function PriceBlock({ p, big = false }: { p: Product; big?: boolean }) {
  const promo = isPromo(p);
  const eff = effectivePrice(p);
  if (promo) {
    return (
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={(big ? "text-base" : "text-xs") + " text-muted-foreground line-through"}>
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

function ProductCard({ p, onOpen }: { p: Product; onOpen: () => void }) {
  const items = useCart();
  const inCart = items.find((i) => i.id === p.id);
  const qty = inCart?.qty ?? 0;
  const disabled = !p.in_stock;
  const reachedMax = qty >= p.max_per_cart;
  const eff = effectivePrice(p);

  function addToCart(e: React.MouseEvent) {
    e.stopPropagation();
    cart.add({ id: p.id, name: p.name, price: eff, max: p.max_per_cart });
  }

  return (
    <article
      onClick={onOpen}
      className="group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md"
    >
      {isPromo(p) && <PromoBadge />}
      <div className="aspect-[4/3] relative overflow-hidden bg-secondary">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-12 w-12 opacity-30" />
          </div>
        )}
        {!p.in_stock && (
          <span className="absolute left-3 top-3 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground">
            Sem estoque
          </span>
        )}
      </div>
      <div className="p-3 flex flex-1 flex-col">
        <h3 className="text-sm line-clamp-2 font-display font-bold leading-tight text-card-foreground">
          {p.name}
        </h3>
        <div className="mt-2"><PriceBlock p={p} /></div>

        <div className="pt-3 mt-auto" onClick={(e) => e.stopPropagation()}>
          {qty === 0 ? (
            <Button
              type="button"
              disabled={disabled}
              onClick={addToCart}
              className="h-10 text-xs w-full rounded-full bg-primary font-bold text-primary-foreground hover:bg-primary/90"
            >
              Adicionar
            </Button>
          ) : (
            <div className="flex items-center justify-between gap-1 rounded-full bg-secondary p-1">
              <button onClick={() => cart.setQty(p.id, qty - 1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-background text-foreground hover:bg-background/70" aria-label="Diminuir">
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-black">{qty}</span>
              <button
                disabled={reachedMax}
                onClick={() => cart.add({ id: p.id, name: p.name, price: eff, max: p.max_per_cart })}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
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

function ProductDetail({ p, onClose }: { p: Product; onClose: () => void }) {
  const items = useCart();
  const inCart = items.find((i) => i.id === p.id);
  const qty = inCart?.qty ?? 0;
  const disabled = !p.in_stock;
  const reachedMax = qty >= p.max_per_cart;
  const eff = effectivePrice(p);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-0 sm:items-center sm:p-6" role="dialog">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow hover:bg-secondary"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="relative aspect-square w-full bg-secondary">
            {isPromo(p) && <PromoBadge />}
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ShoppingBag className="h-16 w-16 opacity-30" />
              </div>
            )}
            {!p.in_stock && (
              <span className="absolute left-4 bottom-4 rounded-full bg-destructive px-4 py-2 text-sm font-black text-destructive-foreground">
                Sem estoque
              </span>
            )}
          </div>
          <div className="flex flex-col gap-4 p-6">
            <div>
              <h2 className="font-display text-2xl font-black leading-tight sm:text-3xl">{p.name}</h2>
              {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
            </div>
            <PriceBlock p={p} big />
            <div className="mt-auto">
              {qty === 0 ? (
                <Button
                  type="button"
                  disabled={disabled}
                  onClick={() => cart.add({ id: p.id, name: p.name, price: eff, max: p.max_per_cart })}
                  className="w-full rounded-full bg-primary py-6 text-base font-black text-primary-foreground hover:bg-primary/90"
                >
                  Adicionar ao carrinho
                </Button>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-full bg-secondary p-2">
                  <button onClick={() => cart.setQty(p.id, qty - 1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-background hover:bg-background/70" aria-label="Diminuir">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-black">{qty} no carrinho</span>
                  <button
                    disabled={reachedMax}
                    onClick={() => cart.add({ id: p.id, name: p.name, price: eff, max: p.max_per_cart })}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
                    aria-label="Aumentar"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
              {reachedMax && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Máximo de {p.max_per_cart} por pedido
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ onClose, total, onFinalize }: { onClose: () => void; total: number; onFinalize: () => void }) {
  const items = useCart();
  function limpar() {
    if (!items.length) return;
    if (!confirm("Tem certeza que deseja limpar o carrinho?")) return;
    cart.clear();
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog">
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
            <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary" aria-label="Fechar">
              <ChevronDown className="h-5 w-5 rotate-[-90deg]" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="mt-10 text-center text-muted-foreground">
              Seu carrinho está vazio. Adicione produtos no catálogo!
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="flex-1">
                    <div className="font-bold leading-tight">{i.name}</div>
                    <div className="text-sm text-muted-foreground">{brl(i.price)} cada</div>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-secondary px-1">
                    <button onClick={() => cart.setQty(i.id, i.qty - 1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-background">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center font-bold">{i.qty}</span>
                    <button
                      onClick={() => cart.setQty(i.id, Math.min(i.qty + 1, i.max))}
                      disabled={i.qty >= i.max}
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-background disabled:opacity-40"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button onClick={() => cart.remove(i.id)} className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="border-t border-border p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-muted-foreground">Total</span>
            <span className="font-display text-2xl font-black text-primary">{brl(total)}</span>
          </div>
          <Button
            disabled={!items.length}
            onClick={onFinalize}
            className="w-full rounded-full bg-whatsapp py-6 text-base font-black text-whatsapp-foreground hover:opacity-90"
          >
            Finalizar pelo WhatsApp
          </Button>
        </footer>
      </aside>
    </div>
  );
}
