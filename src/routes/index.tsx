import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cart, useCart } from "@/lib/cart";
import { brl, useWhatsAppNumber, whatsappLink } from "@/lib/whatsapp";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast, Toaster } from "sonner";
import { ShoppingBag, Plus, Minus, Trash2, ChevronDown, Search, X, Tag, ShieldCheck, Lock } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Catálogo de Produtos" },
      { name: "description", content: "Catálogo de Produtos. Monte seu pedido e finalize pelo WhatsApp." },
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
  stock: number;
  min_stock: number;
  barcode: string | null;
  max_per_cart: number;
};
type Category = { id: string; name: string; sort_order: number };

export const SYSTEM_THEMES = [
  { id: "strong-gray", name: "Cinza Forte", group: "strong", primary: "#374151", primaryFg: "#FFFFFF", secondary: "#F3F4F6", accent: "#E5E7EB" },
  { id: "strong-blue", name: "Azul Forte", group: "strong", primary: "#1D4ED8", primaryFg: "#FFFFFF", secondary: "#EFF6FF", accent: "#DBEAFE" },
  { id: "strong-red", name: "Vermelho Forte", group: "strong", primary: "#B91C1C", primaryFg: "#FFFFFF", secondary: "#FEF2F2", accent: "#FEE2E2" },
  { id: "strong-green", name: "Verde Forte", group: "strong", primary: "#15803D", primaryFg: "#FFFFFF", secondary: "#F0FDF4", accent: "#DCFCE7" },
  { id: "strong-orange", name: "Laranja Forte", group: "strong", primary: "#C2410C", primaryFg: "#FFFFFF", secondary: "#FFF7ED", accent: "#FFEDD5" },
  { id: "strong-purple", name: "Roxo Forte", group: "strong", primary: "#6D28D9", primaryFg: "#FFFFFF", secondary: "#FAF5FF", accent: "#F3E8FF" },
  { id: "strong-pink", name: "Rosa Forte", group: "strong", primary: "#BE185D", primaryFg: "#FFFFFF", secondary: "#FDF2F8", accent: "#FCE7F3" },
  { id: "strong-black", name: "Preto", group: "strong", primary: "#000000", primaryFg: "#FFFFFF", secondary: "#F3F4F6", accent: "#E5E7EB" },
  { id: "strong-teal", name: "Azul Petróleo", group: "strong", primary: "#0F766E", primaryFg: "#FFFFFF", secondary: "#F0FDFA", accent: "#CCFBF1" },
  { id: "strong-brown", name: "Marrom Forte", group: "strong", primary: "#78350F", primaryFg: "#FFFFFF", secondary: "#FEF3C7", accent: "#FFEDD5" },
];

export function applyTheme(themeId: string) {
  const t = SYSTEM_THEMES.find(x => x.id === themeId) || SYSTEM_THEMES.find(x => x.id === "strong-gray")!;
  const root = document.documentElement;
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--primary-foreground', t.primaryFg);
  root.style.setProperty('--secondary', t.secondary);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--ring', t.primary);
}

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
  const [catalogName, setCatalogName] = useState("Catálogo de Produtos");
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const items = useCart();
  const whatsNumber = useWhatsAppNumber();

  // Estados do Modo Privado
  const [accessDenied, setAccessDenied] = useState(false);
  const [vipCodeInput, setVipCodeInput] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  
  // Estados para a Faixa do Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPrivateModeActive, setIsPrivateModeActive] = useState(false);

  useEffect(() => {
    (async () => {
      const savedCode = localStorage.getItem("vip_code") || "";
      
      const [sessionRes, c, p, s] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from("categories").select("*").order("sort_order"),
        // @ts-ignore
        supabase.rpc("get_catalog_secure", { p_code: savedCode }),
        supabase.from("app_settings").select("key, value").in("key", ["catalog_name", "system_theme", "private_mode"]),
      ]);
      
      const settingsMap = new Map(s.data?.map(x => [x.key, x.value]) || []);
      if (settingsMap.has("catalog_name")) setCatalogName(settingsMap.get("catalog_name")!);
      
      const themeId = settingsMap.get("system_theme") || "strong-gray";
      applyTheme(themeId);
      
      const privateModeStatus = settingsMap.get("private_mode") === "true";
      setIsPrivateModeActive(privateModeStatus);

      // Checa se o usuário atual é admin para podermos mostrar a faixa de aviso
      if (sessionRes.data.session?.user) {
        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", sessionRes.data.session.user.id).eq("role", "admin").maybeSingle();
        if (roleData) setIsAdmin(true);
      }
      
      if (c.error) {
        setLoadError(c.error.message);
      }
      
      if (p.error) {
         if (p.error.message.includes("ACCESS_DENIED")) {
             setAccessDenied(true);
             // Limpa a senha inválida do navegador imediatamente
             localStorage.removeItem("vip_code");
         } else {
             setLoadError(p.error.message ?? "Erro ao carregar catálogo");
         }
      } else {
         setProds((p.data ?? []) as Product[]);
         setAccessDenied(false);
      }

      setCats(c.data ?? []);
      setLoading(false);
    })();
  }, []);

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifyingCode(true);
    const code = vipCodeInput.trim();
    // @ts-ignore
    const p = await supabase.rpc("get_catalog_secure", { p_code: code });
    setVerifyingCode(false);
    
    if (p.error) {
      if (p.error.message.includes("ACCESS_DENIED")) {
        toast.error("Senha inválida ou revogada.", { description: "Peça uma senha válida ao proprietário." });
        localStorage.removeItem("vip_code"); // Garante que não salve senha errada
      } else {
        toast.error("Erro ao verificar senha.");
      }
    } else {
      localStorage.setItem("vip_code", code);
      setProds((p.data ?? []) as Product[]);
      setAccessDenied(false);
      setVipCodeInput(""); // Limpa o campo para o futuro
      toast.success("Acesso liberado com sucesso!");
    }
  }

  const filtered = useMemo(() => {
    const exactQuery = searchTerm.trim();
    const query = exactQuery.toLocaleLowerCase("pt-BR");
    return prods.filter((p) => {
      if (!p.in_stock) return false; 
      const matchesCat = activeCat === "all" || p.category_id === activeCat;
      const isExactBarcode = exactQuery !== "" && p.barcode === exactQuery;
      const searchable = `${p.name} ${p.description ?? ""}`.toLocaleLowerCase("pt-BR");
      const matchesSearch = !query || isExactBarcode || searchable.includes(query);
      return matchesCat && matchesSearch;
    });
  }, [prods, activeCat, searchTerm]);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = items.reduce((s, i) => s + i.qty, 0);

  async function finalizar() {
    if (!items.length) return;
    setCheckoutLoading(true);

    // Puxa os produtos atualizados do banco usando a rota segura
    // @ts-ignore
    const { data: currentProducts, error: checkError } = await supabase.rpc("get_catalog_secure", { p_code: localStorage.getItem("vip_code") || "" });

    // Se der erro aqui, a senha expirou/foi revogada no meio da compra
    if (checkError || !currentProducts) {
      toast.error("Sua sessão expirou ou a senha foi revogada.", { description: "Solicite uma nova senha para continuar comprando." });
      setCheckoutLoading(false);
      setCartOpen(false); // Fecha o carrinho
      setAccessDenied(true); // Joga a tela de bloqueio
      localStorage.removeItem("vip_code"); // Limpa a senha revogada
      return;
    }

    const currentProductMap = new Map((currentProducts as Product[]).map(p => [p.id, p]));
    
    // Filtra o carrinho mantendo apenas itens que AINDA existem no banco de dados
    const validItems = items.filter(i => currentProductMap.has(i.id));

    if (validItems.length === 0) {
      toast.error("Os produtos do seu carrinho não estão mais disponíveis no catálogo.");
      setCheckoutLoading(false);
      cart.clear();
      setCartOpen(false);
      return;
    }

    if (validItems.length < items.length) {
      toast.info("Alguns itens foram removidos do seu pedido pois não estão mais disponíveis.");
    }

    // Recalcula o total ignorando os itens removidos
    const newTotal = validItems.reduce((s, i) => s + i.price * i.qty, 0);

    const itemsJson = validItems.map((i) => {
      const p = currentProductMap.get(i.id);
      return {
        id: i.id,
        name: p?.name || i.name,
        price: i.price,
        quantity: i.qty,
        category_id: p?.category_id || null,
      };
    });

    const { data: orderId, error } = await supabase.rpc("checkout_order", {
      order_total: newTotal,
      order_items: itemsJson,
    });

    setCheckoutLoading(false);

    if (error) {
      toast.error("Erro ao criar pedido.", { description: error.message });
      return;
    }

    const orderHash = String(orderId).split("-")[0];

    const lines = [
      `*Pedido #${orderHash} — Catálogo*`,
      "",
      ...validItems.map((i, idx) => {
        const sub = i.price * i.qty;
        return `${idx + 1}. *${i.name}*\n   ${i.qty} × ${brl(i.price)} = *${brl(sub)}*`;
      }),
      "",
      `*Total: ${brl(newTotal)}*`,
    ];
    window.open(whatsappLink(lines.join("\n"), whatsNumber), "_blank");
    
    // Limpa o carrinho e fecha a gaveta lateral
    cart.clear();
    setCartOpen(false);

    // Recarrega os produtos para atualizar o estoque visualmente na tela
    // @ts-ignore
    const p = await supabase.rpc("get_catalog_secure", { p_code: localStorage.getItem("vip_code") || "" });
    if (p.data) setProds(p.data as Product[]);
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <Toaster position="top-center" richColors />
      
      {/* FAIXA DO ADMIN */}
      {isAdmin && isPrivateModeActive && (
        <div className="bg-yellow-500 text-yellow-950 px-4 py-1.5 text-center text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 relative z-50">
          <span>👁️ Visualizando como Admin</span>
          <span className="hidden sm:inline opacity-80">- O Modo Privado está ATIVO para clientes.</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-black uppercase shadow-sm">
              {catalogName.charAt(0)}
            </div>
            <div className="leading-tight">
              <div className="font-display text-xl font-black text-foreground sm:text-2xl">
                {catalogName}
              </div>
              <div className="text-xs text-muted-foreground font-semibold">Catálogo de produtos</div>
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
              disabled={accessDenied}
              className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-sm transition ${
                accessDenied
                  ? "bg-secondary text-muted-foreground opacity-60 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Carrinho</span>
              {!accessDenied && itemCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-black text-accent-foreground">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* TELA DE BLOQUEIO */}
      {accessDenied ? (
        <main className="relative mx-auto max-w-7xl px-4 py-20 flex flex-col items-center justify-center min-h-[70vh] z-10">
           <div className="bg-card w-full max-w-md p-8 rounded-3xl shadow-2xl border border-border text-center relative z-20">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
                 <Lock className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-black font-display mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground font-medium mb-6">
                Este catálogo é exclusivo para clientes autorizados. Por favor, insira sua senha de acesso para visualizar os produtos.
              </p>
              <form onSubmit={handleVerifyCode} className="space-y-4">
                 <Input 
                   type="password" 
                   placeholder="Sua senha VIP" 
                   value={vipCodeInput} 
                   onChange={e => setVipCodeInput(e.target.value)}
                   className="h-12 text-center text-lg font-bold"
                 />
                 <Button type="submit" disabled={verifyingCode || !vipCodeInput.trim()} className="w-full h-12 rounded-full text-base font-black shadow-sm">
                   {verifyingCode ? "Verificando..." : "Acessar Catálogo"}
                 </Button>
              </form>
           </div>
           
           {/* Fundo Embaçado */}
           <div className="fixed inset-0 z-0 top-[64px] bg-background/50 backdrop-blur-xl pointer-events-none" />
        </main>
      ) : (
        <>
          {/* Hero */}
          <section className="border-b border-border/60 bg-gradient-to-br from-secondary via-background to-secondary/40">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Bem-vindo(a)</p>
              <h1 className="mt-2 text-4xl font-black leading-tight text-foreground sm:text-5xl md:text-6xl">
                {catalogName === "Catálogo de Produtos" ? (
                  "Catálogo de Produtos."
                ) : (
                  <>
                    Catálogo de Produtos do(a)<br />{catalogName}.
                  </>
                )}
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
                    placeholder="Buscar por nome ou código de barras..."
                    className="h-11 w-full rounded-full border border-input bg-card pl-10 pr-4 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-ring"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-black text-primary-foreground shadow-sm transition hover:opacity-90"
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
              <p className="text-muted-foreground font-semibold">Carregando catálogo…</p>
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
                    : "O estoque está sendo organizado. Volte logo!"}
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
                  disabled={checkoutLoading}
                  className="inline-flex items-center gap-3 rounded-full bg-whatsapp px-8 py-5 text-lg font-black text-whatsapp-foreground shadow-xl shadow-black/15 transition hover:scale-[1.02] active:scale-100 disabled:opacity-70 disabled:hover:scale-100"
                >
                  {checkoutLoading ? "Processando..." : "Finalizar Compra pelo WhatsApp"}
                  {!checkoutLoading && <span className="rounded-full bg-black/15 px-3 py-1 text-sm">{brl(total)}</span>}
                </button>
              </div>
            )}
          </main>
        </>
      )}

      <footer className="mt-10 border-t border-border/60 bg-secondary/40 relative z-10">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
          © {new Date().getFullYear()} Catálogo de Produtos. Todos os direitos reservados.
        </div>
      </footer>

      {/* Componentes removidos do DOM quando o acesso é negado */}
      {!accessDenied && cartOpen && (
        <CartDrawer 
          onClose={() => setCartOpen(false)} 
          total={total} 
          onFinalize={finalizar} 
          checkoutLoading={checkoutLoading}
          prods={prods}
        />
      )}
      {!accessDenied && detail && <ProductDetail p={detail} onClose={() => setDetail(null)} />}
      {!accessDenied && <WhatsAppFloat />}
    </div>
  );
}

function CatChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition shadow-sm " +
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

function ProductCard({ p, onOpen }: { p: Product; onOpen: () => void }) {
  const items = useCart();
  const inCart = items.find((i) => i.id === p.id);
  const qty = inCart?.qty ?? 0;
  
  const outOfStock = !p.in_stock || p.stock <= 0;
  const isLowStock = !outOfStock && p.stock <= p.min_stock;
  
  // Se max_per_cart for 0, o limite é o próprio estoque
  const currentMax = p.max_per_cart > 0 ? Math.min(p.max_per_cart, p.stock) : p.stock;
  const reachedMax = qty >= currentMax;
  const eff = effectivePrice(p);

  function addToCart(e: React.MouseEvent) {
    e.stopPropagation();
    cart.add({ id: p.id, name: p.name, price: eff, max: currentMax });
  }

  return (
    <article
      onClick={onOpen}
      className={`group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:shadow-md ${
        isLowStock ? "border-yellow-600 ring-2 ring-yellow-600" : "border-border"
      }`}
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
        {outOfStock && (
          <span className="absolute left-3 top-3 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground z-10 shadow-sm">
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
              disabled={outOfStock}
              onClick={addToCart}
              className="h-10 text-xs w-full rounded-full bg-primary font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm"
            >
              {outOfStock ? "Esgotado" : "Adicionar"}
            </Button>
          ) : (
            <div className="flex items-center justify-between gap-1 rounded-full bg-secondary p-1">
              <button onClick={() => cart.setQty(p.id, qty - 1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-background text-foreground hover:bg-background/70 shadow-sm" aria-label="Diminuir">
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-black">{qty}</span>
              <button
                disabled={reachedMax}
                onClick={() => cart.add({ id: p.id, name: p.name, price: eff, max: currentMax })}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 shadow-sm"
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
  const outOfStock = !p.in_stock || p.stock <= 0;
  const currentMax = p.max_per_cart > 0 ? Math.min(p.max_per_cart, p.stock) : p.stock;
  const reachedMax = qty >= currentMax;
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
            {outOfStock && (
              <span className="absolute left-4 bottom-4 rounded-full bg-destructive px-4 py-2 text-sm font-black text-destructive-foreground shadow-sm">
                Sem estoque
              </span>
            )}
          </div>
          <div className="flex flex-col gap-4 p-6">
            <div>
              <h2 className="font-display text-2xl font-black leading-tight sm:text-3xl">{p.name}</h2>
              {p.description && <p className="mt-2 text-sm font-medium text-muted-foreground">{p.description}</p>}
            </div>
            <PriceBlock p={p} big />
            <div className="mt-auto">
              {qty === 0 ? (
                <Button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => cart.add({ id: p.id, name: p.name, price: eff, max: currentMax })}
                  className="w-full rounded-full bg-primary py-6 text-base font-black text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {outOfStock ? "Produto Esgotado" : "Adicionar ao carrinho"}
                </Button>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-full bg-secondary p-2">
                  <button onClick={() => cart.setQty(p.id, qty - 1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-sm hover:bg-background/70" aria-label="Diminuir">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-black">{qty} no carrinho</span>
                  <button
                    disabled={reachedMax}
                    onClick={() => cart.add({ id: p.id, name: p.name, price: eff, max: currentMax })}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-40"
                    aria-label="Aumentar"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
              {reachedMax && !outOfStock && (
                <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">
                  Lembrete: Limite de {currentMax} unidades atingido.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ 
  onClose, 
  total, 
  onFinalize, 
  checkoutLoading, 
  prods 
}: { 
  onClose: () => void; 
  total: number; 
  onFinalize: () => void; 
  checkoutLoading: boolean; 
  prods: Product[] 
}) {
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
            <p className="mt-10 text-center text-muted-foreground font-medium">
              Seu carrinho está vazio. Adicione produtos no catálogo!
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((i) => {
                const p = prods.find((prod) => prod.id === i.id);
                const currentMax = p ? (p.max_per_cart > 0 ? Math.min(p.max_per_cart, p.stock) : p.stock) : i.max;

                return (
                  <li key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                    <div className="flex-1">
                      <div className="font-bold leading-tight">{i.name}</div>
                      <div className="text-sm font-semibold text-muted-foreground">{brl(i.price)} cada</div>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-secondary px-1">
                      <button onClick={() => cart.setQty(i.id, i.qty - 1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-background">
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
                    <button onClick={() => cart.remove(i.id)} className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="border-t border-border p-5">
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
  );
}