import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cart, useCart } from "@/lib/cart";
import { brl, useWhatsAppNumber, whatsappLink } from "@/lib/whatsapp";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast, Toaster } from "sonner";
import { ShoppingCart, Search, X, ShieldCheck, Lock, TrendingUp, AlertTriangle, Crown } from "lucide-react";

// Importações dos novos componentes da loja modularizada
import { ProductCard } from "@/components/store/ProductCard";
import { ProductDetail } from "@/components/store/ProductDetail";
import { CartDrawer } from "@/components/store/CartDrawer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Catálogo de Produtos" },
      { name: "description", content: "Catálogo de Produtos. Monte seu pedido e finalize pelo WhatsApp." },
    ],
  }),
  component: Index,
});

export type Product = {
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
  sales_count: number;
  max_per_cart: number;
  track_stock: boolean;
};

export type Category = { id: string; name: string; sort_order: number; is_vip: boolean | null };

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

export function effectivePrice(p: Pick<Product, "price" | "sale_price">) {
  const sale = p.sale_price != null ? Number(p.sale_price) : null;
  const price = Number(p.price);
  return sale != null && sale > 0 && sale < price ? sale : price;
}

export function isPromo(p: Pick<Product, "price" | "sale_price">) {
  const sale = p.sale_price != null ? Number(p.sale_price) : null;
  return sale != null && sale > 0 && sale < Number(p.price);
}

/* ---------- Bloqueio de Scroll Global ---------- */
export function ScrollLock() {
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);
  return null;
}

/* ---------- Modal Reutilizável de Confirmação Genérica ---------- */
export function ConfirmActionModal({
  title,
  description,
  onClose,
  onConfirm,
  loading = false,
  destructive = true,
  confirmText = "Confirmar",
  alertOnly = false
}: {
  title: string;
  description: string | React.ReactNode;
  onClose: () => void;
  onConfirm: () => any;
  loading?: boolean;
  destructive?: boolean;
  confirmText?: string;
  alertOnly?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
      <ScrollLock />
      <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
        <div>
          <h3 className={`text-lg font-black font-display flex items-center gap-2 ${destructive ? 'text-destructive' : 'text-primary'}`}>
            {destructive && <AlertTriangle className="h-5 w-5" />}
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-2 font-medium leading-relaxed">{description}</p>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          {!alertOnly && (
            <Button variant="outline" onClick={onClose} disabled={loading} className="rounded-full shadow-sm">
              Cancelar
            </Button>
          )}
          <Button 
            variant={destructive ? "destructive" : "default"} 
            onClick={onConfirm} 
            disabled={loading} 
            className="rounded-full shadow-sm"
          >
            {loading ? "Processando..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Modal de Conflito de Estoque (Concorrência) ---------- */
function StockConflictModal({
  data,
  onClose,
  onConfirm
}: {
  data: {
    outOfStock: { id: string; name: string }[];
    reduced: { id: string; name: string; requested: number; available: number }[];
  };
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <ScrollLock />
      <div className="bg-background w-full max-w-md rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
        <div>
          <h3 className="text-lg font-black font-display flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Oops! Houve um problema no estoque
          </h3>
          <p className="text-sm text-muted-foreground mt-2 font-medium leading-relaxed">
            Alguns produtos do seu carrinho esgotaram enquanto você comprava:
          </p>
        </div>
        
        <div className="max-h-[40vh] overflow-y-auto space-y-4 py-2">
          {data.outOfStock.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-destructive mb-2">Esgotados</h4>
              <ul className="space-y-1">
                {data.outOfStock.map((item, idx) => (
                  <li key={idx} className="text-sm font-semibold text-foreground bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20 line-clamp-2 break-words" title={item.name}>
                    {item.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.reduced.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-yellow-600 mb-2">Quantidade insuficiente</h4>
              <ul className="space-y-1">
                {data.reduced.map((item, idx) => (
                  <li key={idx} className="text-sm font-semibold text-foreground bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-600/20">
                    <span className="block line-clamp-2 break-words" title={item.name}>{item.name}</span>
                    <span className="text-xs text-muted-foreground">Você pediu {item.requested}, mas só temos <strong className="text-yellow-700">{item.available}</strong>.</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-lg border border-border">
          Ao clicar em <strong>OK, ajustar carrinho</strong>, ajustaremos seu carrinho automaticamente para o que temos disponível agora.
        </p>

        <div className="flex justify-end gap-2 mt-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} className="rounded-full shadow-sm">
            Manter carrinho
          </Button>
          <Button onClick={onConfirm} className="rounded-full shadow-sm bg-primary text-primary-foreground hover:opacity-90">
            OK, ajustar carrinho
          </Button>
        </div>
      </div>
    </div>
  );
}

function Index() {
  const [catalogName, setCatalogName] = useState("Catálogo de Produtos");
  const [catalogLogo, setCatalogLogo] = useState("");
  const [catalogDesc, setCatalogDesc] = useState("");
  const [catalogAddress, setCatalogAddress] = useState("");
  
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [randomTrending, setRandomTrending] = useState<Product[]>([]);
  const items = useCart();
  const whatsNumber = useWhatsAppNumber();

  // Paginação (Infinite Scroll)
  const [visibleCount, setVisibleCount] = useState(24);

  // Estados do Modo Privado (Loja Inteira) e Área Exclusiva (VIP)
  const [accessDenied, setAccessDenied] = useState(false);
  const [storeCodeInput, setStoreCodeInput] = useState("");
  const [verifyingStoreCode, setVerifyingStoreCode] = useState(false);
  
  const [isVipUnlocked, setIsVipUnlocked] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [vipCodeInput, setVipCodeInput] = useState("");
  const [verifyingVip, setVerifyingVip] = useState(false);
  const [showVipButton, setShowVipButton] = useState(false);
  
  // Estados para a Faixa do Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPrivateModeActive, setIsPrivateModeActive] = useState(false);

  // Estado para Remoção de Item Unitário
  const [itemToRemove, setItemToRemove] = useState<string | null>(null);

  // Estado de Conflito de Estoque
  const [stockConflictData, setStockConflictData] = useState<{
    outOfStock: { id: string; name: string }[];
    reduced: { id: string; name: string; requested: number; available: number }[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const savedStoreCode = localStorage.getItem("store_code") || "";
      const savedExclusiveCode = localStorage.getItem("exclusive_code") || "";
      
      const [sessionRes, c, p, s, vipCheckStore, vipCheckExclusive, vipStatusRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from("categories").select("*").order("sort_order"),
        // @ts-ignore
        supabase.rpc("get_catalog_secure", { p_store_code: savedStoreCode, p_vip_code: savedExclusiveCode }),
        supabase.from("app_settings").select("key, value").in("key", ["catalog_name", "system_theme", "private_mode", "catalog_logo", "catalog_description", "catalog_address"]),
        savedStoreCode ? supabase.rpc("verify_exclusive_code", { p_code: savedStoreCode }) : Promise.resolve({ data: false }),
        savedExclusiveCode ? supabase.rpc("verify_exclusive_code", { p_code: savedExclusiveCode }) : Promise.resolve({ data: false }),
        supabase.rpc("check_vip_status")
      ]);
      
      const settingsMap = new Map(s.data?.map(x => [x.key, x.value]) || []);
      if (settingsMap.has("catalog_name")) setCatalogName(settingsMap.get("catalog_name")!);
      if (settingsMap.has("catalog_logo")) setCatalogLogo(settingsMap.get("catalog_logo") || "");
      if (settingsMap.has("catalog_description")) setCatalogDesc(settingsMap.get("catalog_description") || "");
      if (settingsMap.has("catalog_address")) setCatalogAddress(settingsMap.get("catalog_address") || "");
      
      const themeId = settingsMap.get("system_theme") || "strong-gray";
      applyTheme(themeId);
      
      const privateModeStatus = settingsMap.get("private_mode") === "true";
      setIsPrivateModeActive(privateModeStatus);

      // Status do Botão Área Exclusiva
      if (vipStatusRes.data) {
          setShowVipButton(true);
      }

      // Checa se usuário destravou VIP via senha da loja ou via senha exclusiva
      if (vipCheckStore.data || vipCheckExclusive.data) {
         setIsVipUnlocked(true);
      }

      // Admin Bypass
      if (sessionRes.data.session?.user) {
        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", sessionRes.data.session.user.id).eq("role", "admin").maybeSingle();
        if (roleData) {
            setIsAdmin(true);
            setIsVipUnlocked(true);
            setShowVipButton(true);
        }
      }
      
      if (c.error) {
        setLoadError(c.error.message);
      }
      
      if (p.error) {
         if (p.error.message.includes("ACCESS_DENIED")) {
             setAccessDenied(true);
             localStorage.removeItem("store_code"); // Limpa imediatamente se revogado
         } else {
             setLoadError(p.error.message ?? "Erro ao carregar catálogo");
         }
      } else {
         setProds((p.data ?? []) as Product[]);
         setAccessDenied(false);
      }

      setCats((c.data as Category[]) ?? []);
      setLoading(false);
    })();
  }, []);

  // Lógica para preencher produtos em alta aleatórios caso o banco não tenha vendas registradas
  useEffect(() => {
      if (prods.length > 0 && randomTrending.length === 0) {
          const activeProds = prods.filter(p => p.in_stock);
          const hasSales = activeProds.some(p => p.sales_count > 0);
          if (!hasSales) {
              setRandomTrending([...activeProds].sort(() => 0.5 - Math.random()).slice(0, 5));
          }
      }
  }, [prods, randomTrending]);

  // Reseta a paginação ao trocar de categoria ou buscar
  useEffect(() => {
    setVisibleCount(24);
  }, [searchTerm, activeCat]);

  async function handleVerifyStoreCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifyingStoreCode(true);
    const code = storeCodeInput.trim();
    // @ts-ignore
    const p = await supabase.rpc("get_catalog_secure", { p_store_code: code, p_vip_code: localStorage.getItem("exclusive_code") || "" });
    setVerifyingStoreCode(false);
    
    if (p.error) {
      if (p.error.message.includes("ACCESS_DENIED")) {
        toast.error("Senha de loja inválida ou revogada.", { description: "Peça uma senha válida ao proprietário." });
        localStorage.removeItem("store_code");
      } else {
        toast.error("Erro ao verificar senha.");
      }
    } else {
      localStorage.setItem("store_code", code);
      toast.success("Loja liberada com sucesso!");
      setTimeout(() => window.location.reload(), 500); // Recarrega para limpar as validações perfeitamente
    }
  }

  async function handleVerifyVipCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifyingVip(true);
    const code = vipCodeInput.trim();
    const { data, error } = await supabase.rpc("verify_exclusive_code", { p_code: code });
    setVerifyingVip(false);
    
    if (error || !data) {
       toast.error("Senha inválida ou revogada.", { description: "Verifique a senha informada e tente novamente." });
    } else {
       localStorage.setItem("exclusive_code", code);
       toast.success("Área Exclusiva Desbloqueada!");
       setTimeout(() => window.location.reload(), 500);
    }
  }

  const vipCatsIds = useMemo(() => new Set(cats.filter(c => c.is_vip).map(c => c.id)), [cats]);

  const trendingProducts = useMemo(() => {
    const activeProds = prods.filter(p => p.in_stock);
    if (activeProds.length === 0) return [];
    
    const hasSales = activeProds.some(p => p.sales_count > 0);
    if (hasSales) {
        return [...activeProds].sort((a, b) => b.sales_count - a.sales_count).slice(0, 5);
    }
    return randomTrending;
  }, [prods, randomTrending]);

  const filtered = useMemo(() => {
    const exactQuery = searchTerm.trim();
    const query = exactQuery.toLocaleLowerCase("pt-BR");
    return prods.filter((p) => {
      if (!p.in_stock) return false; 
      
      let matchesCat = false;
      if (activeCat === "all") matchesCat = true;
      else if (activeCat === "promocoes") matchesCat = isPromo(p);
      else matchesCat = p.category_id === activeCat;

      const isExactBarcode = exactQuery !== "" && p.barcode === exactQuery;
      const searchable = `${p.name} ${p.description ?? ""}`.toLocaleLowerCase("pt-BR");
      const matchesSearch = !query || isExactBarcode || searchable.includes(query);
      
      return matchesCat && matchesSearch;
    });
  }, [prods, activeCat, searchTerm]);

  const visibleProducts = filtered.slice(0, visibleCount);

  // Filtra as categorias para exibir somente as que possuem produtos cadastrados e ativos
  const populatedCats = cats.filter(c => prods.some(p => p.category_id === c.id));
  const vipCats = populatedCats.filter(c => c.is_vip);
  const normalCats = populatedCats.filter(c => !c.is_vip);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastProductElementRef = useCallback((node: HTMLDivElement) => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => prev + 24);
      }
    }, { threshold: 0.1 });
    if (node) observer.current.observe(node);
  }, []);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = items.reduce((s, i) => s + i.qty, 0);

  function resolveStockConflicts() {
    if (!stockConflictData) return;
    stockConflictData.outOfStock.forEach(item => {
      cart.remove(item.id);
    });
    stockConflictData.reduced.forEach(item => {
      cart.setQty(item.id, item.available);
    });
    setStockConflictData(null);
    window.location.reload(); 
  }

  async function finalizar() {
    if (!items.length) return;
    setCheckoutLoading(true);

    const storeCode = localStorage.getItem("store_code") || "";
    const exclusiveCode = localStorage.getItem("exclusive_code") || "";

    // Puxa os produtos atualizados do banco na exata fração de segundo da compra
    // @ts-ignore
    const { data: currentProducts, error: checkError } = await supabase.rpc("get_catalog_secure", { p_store_code: storeCode, p_vip_code: exclusiveCode });

    // Se der erro aqui, a senha da loja expirou/foi revogada no meio da compra
    if (checkError || !currentProducts) {
      toast.error("Sua sessão expirou ou a senha foi revogada.", { description: "Solicite uma nova senha para continuar comprando." });
      setCheckoutLoading(false);
      setCartOpen(false); 
      setAccessDenied(true); 
      localStorage.removeItem("store_code"); 
      return;
    }

    const currentProductMap = new Map((currentProducts as Product[]).map(p => [p.id, p]));
    
    const outOfStockItems: { id: string; name: string }[] = [];
    const reducedStockItems: { id: string; name: string; requested: number; available: number }[] = [];
    let hasConflict = false;

    const validItems: { id: string; name: string; price: number; qty: number; max: number }[] = [];

    // Checagem rigorosa de concorrência
    for (const i of items) {
      const p = currentProductMap.get(i.id);
      
      if (!p || !p.in_stock || (p.track_stock && p.stock <= 0)) {
        // Produto foi apagado, inativado ou esgotou
        outOfStockItems.push({ id: i.id, name: i.name });
        hasConflict = true;
      } else {
        const currentMax = p.max_per_cart > 0 
          ? (p.track_stock ? Math.min(p.max_per_cart, p.stock) : p.max_per_cart) 
          : (p.track_stock ? p.stock : 999999);

        if (i.qty > currentMax) {
          reducedStockItems.push({ id: i.id, name: i.name, requested: i.qty, available: currentMax });
          hasConflict = true;
          validItems.push({ ...i, qty: currentMax }); 
        } else {
          validItems.push(i);
        }
      }
    }

    if (hasConflict) {
      setCheckoutLoading(false);
      setStockConflictData({ outOfStock: outOfStockItems, reduced: reducedStockItems });
      return;
    }

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

    const usedCodeForTracking = isVipUnlocked && !isAdmin ? (exclusiveCode || storeCode) : (isPrivateModeActive && !isAdmin ? storeCode : null);

    const { data: orderId, error } = await supabase.rpc("checkout_order", {
      order_items: itemsJson,
      p_vip_code: usedCodeForTracking || null
    });

    setCheckoutLoading(false);

    if (error) {
      toast.error("Erro ao criar pedido.", { description: error.message });
      return;
    }

    const orderHash = String(orderId).split("-")[0];
    const vipString = usedCodeForTracking ? ` (Acesso: ${usedCodeForTracking})` : "";

    const lines = [
      `*Pedido #${orderHash}${vipString} — Catálogo*`,
      "",
      ...validItems.map((i, idx) => {
        const sub = i.price * i.qty;
        return `${idx + 1}. *${i.name}*\n   ${i.qty} × ${brl(i.price)} = *${brl(sub)}*`;
      }),
      "",
      `*Total: ${brl(newTotal)}*`,
    ];
    window.open(whatsappLink(lines.join("\n"), whatsNumber), "_blank");
    
    cart.clear();
    setCartOpen(false);

    // Recarrega visualmente na tela
    // @ts-ignore
    const pr = await supabase.rpc("get_catalog_secure", { p_store_code: storeCode, p_vip_code: exclusiveCode });
    if (pr.data) setProds(pr.data as Product[]);
  }

  // Prepara o Objeto de Endereço do JSON salvo
  let addressObj: any = null;
  let isLegacyAddress = false;
  if (catalogAddress) {
    if (catalogAddress.startsWith("{")) {
      try { addressObj = JSON.parse(catalogAddress); } catch (e) { isLegacyAddress = true; }
    } else {
      isLegacyAddress = true;
    }
  }

  return (
    <div className="min-h-screen relative flex flex-col bg-background w-full max-w-[100vw]">
      <Toaster position="top-center" richColors />
      
      {/* Efeito Visual Premium para as Categorias VIP (injetado via estilo local) */}
      <style>{`
        @keyframes shimmer-vip {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .vip-chip {
          background-image: linear-gradient(110deg, var(--primary) 20%, color-mix(in srgb, var(--primary) 50%, white) 50%, var(--primary) 80%);
          background-size: 200% auto;
          animation: shimmer-vip 3.5s linear infinite;
          color: var(--primary-foreground) !important;
          border-color: transparent !important;
        }
        .vip-chip:hover { filter: brightness(1.1); }
      `}</style>

      {/* FAIXA DO ADMIN */}
      {isAdmin && (
        <div className="bg-yellow-500 text-yellow-950 px-4 py-1.5 text-center text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 relative z-50">
          <span>👁️ Visualizando como Admin</span>
          {isPrivateModeActive && (
            <span className="hidden sm:inline opacity-80">- O Modo Privado está ATIVO para clientes.</span>
          )}
        </div>
      )}

      <header className="sticky top-0 z-40 bg-primary shadow-md w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4 px-4 py-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {catalogLogo ? (
               <img 
                 src={catalogLogo} 
                 alt={catalogName} 
                 className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover shadow-sm bg-background cursor-pointer transition hover:scale-105 border-2 border-primary-foreground/20 flex-shrink-0" 
                 onClick={() => setShowLogoModal(true)}
               />
            ) : (
               <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-background text-primary text-lg font-black uppercase shadow-sm flex-shrink-0">
                 {catalogName.charAt(0)}
               </div>
            )}
            <div className="leading-tight truncate">
              <div 
                className="font-display text-lg font-black text-primary-foreground sm:text-2xl cursor-pointer transition hover:opacity-80 truncate"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                {catalogName}
              </div>
              <div className="text-[10px] sm:text-xs text-primary-foreground/80 font-semibold truncate">Catálogo de produtos</div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Link
              to="/admin"
              aria-label="Área do Administrador"
              className="inline-flex items-center gap-2 rounded-full border border-transparent bg-primary-foreground/10 px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-foreground/20 sm:px-4"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Área do Administrador</span>
            </Link>
            {!accessDenied && showVipButton && (
              <button
                onClick={() => { if (!isVipUnlocked) setShowVipModal(true); }}
                disabled={isVipUnlocked}
                className={`inline-flex items-center justify-center h-10 px-3 sm:px-4 rounded-full text-sm font-bold shadow-md transition whitespace-nowrap ${
                  isVipUnlocked 
                    ? "bg-yellow-500/20 text-yellow-400 cursor-default border border-yellow-500/30" 
                    : "bg-yellow-500 text-yellow-950 hover:bg-yellow-400 border border-yellow-400"
                }`}
                title={isVipUnlocked ? "Área Exclusiva Liberada" : "Acessar Área Exclusiva"}
              >
                <Crown className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{isVipUnlocked ? "VIP Liberado" : "Área Exclusiva"}</span>
              </button>
            )}
            <button
              onClick={() => setCartOpen(true)}
              disabled={accessDenied}
              className={`relative inline-flex items-center justify-center h-10 px-3 sm:px-4 rounded-full text-sm font-bold shadow-md transition whitespace-nowrap ${
                accessDenied
                  ? "bg-primary-foreground/20 text-primary-foreground/50 cursor-not-allowed"
                  : "bg-background text-primary hover:bg-background/90"
              }`}
            >
              <ShoppingCart className="h-4 w-4 sm:mr-1.5" />
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

      {/* TELA DE BLOQUEIO DA LOJA */}
      {accessDenied ? (
        <main className="relative mx-auto max-w-7xl px-4 py-20 flex flex-col items-center justify-center min-h-[70vh] z-10 flex-1 w-full">
           <div className="bg-card w-full max-w-md p-8 rounded-3xl shadow-2xl border border-border text-center relative z-20">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
                 <Lock className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-black font-display mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground font-medium mb-6">
                Este catálogo é exclusivo para clientes autorizados. Por favor, insira sua senha de acesso para visualizar os produtos.
              </p>
              <form onSubmit={handleVerifyStoreCode} className="space-y-4">
                 <Input 
                   type="password" 
                   placeholder="Sua senha da loja" 
                   value={storeCodeInput} 
                   onChange={e => setStoreCodeInput(e.target.value)}
                   className="h-12 text-center text-lg font-bold"
                   maxLength={20}
                 />
                 <Button type="submit" disabled={verifyingStoreCode || !storeCodeInput.trim()} className="w-full h-12 rounded-full text-base font-black shadow-sm">
                   {verifyingStoreCode ? "Verificando..." : "Acessar Catálogo"}
                 </Button>
              </form>
           </div>
           <div className="fixed inset-0 z-0 top-[64px] bg-background/50 backdrop-blur-xl pointer-events-none" />
        </main>
      ) : (
        <div className="flex-1 w-full flex flex-col relative bg-[#EAEAEA]">
          <div className="bg-background">
            <section className="border-b border-border/60 bg-gradient-to-br from-secondary via-background to-secondary/40">
              <div className="mx-auto max-w-7xl px-4 py-10 sm:py-14 w-full">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Bem-vindo(a)</p>
                <h1 className="mt-2 text-4xl font-black leading-tight text-foreground sm:text-5xl md:text-6xl break-words">
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
          </div>

          <div className="sticky top-[64px] z-30 border-b border-border/60 bg-card w-full shadow-sm transition-all">
            <div className="mx-auto max-w-7xl px-4 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearchTerm(searchInput);
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
                    placeholder="Buscar produto..."
                    className="h-11 w-full rounded-full border border-input bg-background pl-10 pr-4 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-ring"
                    maxLength={100}
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-black text-primary-foreground shadow-sm transition hover:opacity-90"
                >
                  Buscar
                </button>
              </form>
            </div>
          </div>

          <div className="bg-card border-b border-border/60 w-full relative z-20">
            <div className="mx-auto max-w-7xl px-4 py-2">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 px-1 custom-scrollbar">
                <CatChip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
                  Todos
                </CatChip>
                <CatChip active={activeCat === "promocoes"} onClick={() => setActiveCat("promocoes")}>
                  Promoções
                </CatChip>
                
                {/* Categorias VIP - Ocultadas para quem não tem acesso e vazias */}
                {isVipUnlocked && vipCats.map((c) => (
                  <CatChip key={c.id} active={activeCat === c.id} isVip={true} onClick={() => setActiveCat(c.id)}>
                    {c.name}
                  </CatChip>
                ))}

                {/* Categorias Normais - Ocultadas as vazias */}
                {normalCats.map((c) => (
                  <CatChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
                    {c.name}
                  </CatChip>
                ))}
              </div>
            </div>
          </div>

          <main className="mx-auto max-w-7xl px-4 py-8 w-full flex-1">
            {loading ? (
              <p className="text-muted-foreground font-semibold">Carregando catálogo…</p>
            ) : loadError ? (
              <div className="rounded-2xl border border-destructive/40 bg-white p-8 text-center shadow-sm">
                <p className="text-lg font-semibold text-destructive">Não foi possível carregar o catálogo.</p>
                <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center shadow-sm">
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
              <>
                {!loading && !loadError && activeCat === "all" && !searchTerm && trendingProducts.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 px-1">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-display font-black text-foreground">Produtos em Alta</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {trendingProducts.map((p) => (
                        <ProductCard key={p.id} p={p} isVip={p.category_id ? vipCatsIds.has(p.category_id) : false} onOpen={() => setDetail(p)} onRemoveRequested={setItemToRemove} />
                      ))}
                    </div>
                    <div className="relative mt-12 mb-6 flex items-center py-5">
                      <div className="flex-grow border-t border-black/15"></div>
                      <span className="mx-4 flex-shrink-0 text-xs font-bold uppercase tracking-widest text-black/50">
                        Catálogo Completo
                      </span>
                      <div className="flex-grow border-t border-black/15"></div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {visibleProducts.map((p) => (
                    <ProductCard key={p.id} p={p} isVip={p.category_id ? vipCatsIds.has(p.category_id) : false} onOpen={() => setDetail(p)} onRemoveRequested={setItemToRemove} />
                  ))}
                </div>

                {visibleCount < filtered.length ? (
                  <div ref={lastProductElementRef} className="h-16 w-full flex items-center justify-center mt-6">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  </div>
                ) : (
                  filtered.length > 0 && (
                    <div className="relative mt-12 mb-6 flex items-center py-5">
                      <div className="flex-grow border-t border-black/15"></div>
                      <span className="mx-4 flex-shrink-0 text-xs font-bold uppercase tracking-widest text-black/50">
                        Fim da lista de produtos
                      </span>
                      <div className="flex-grow border-t border-black/15"></div>
                    </div>
                  )
                )}
              </>
            )}
          </main>

          {/* NOVO RODAPÉ DE 3 COLUNAS */}
          <footer className="mt-auto border-t border-border/60 bg-background relative z-10 w-full">
            <div className="mx-auto max-w-7xl px-4 py-12">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm text-muted-foreground mb-8 text-center sm:text-left min-w-0">
                {/* Coluna 1: Sobre */}
                <div className="flex flex-col gap-3 min-w-0">
                  <h3 className="font-display font-black text-foreground text-lg uppercase tracking-wide break-words">{catalogName}</h3>
                  <p className="leading-relaxed font-medium break-words whitespace-pre-wrap">
                    {catalogDesc || "Este site funciona apenas como um catálogo para vendas online e para consulta de nossos produtos. Faça seu pedido diretamente pelo WhatsApp."}
                  </p>
                </div>
                
                {/* Coluna 2: Endereço */}
                <div className="flex flex-col gap-3 min-w-0">
                  <h3 className="font-display font-black text-foreground text-lg uppercase tracking-wide break-words">Endereço</h3>
                  <div className="leading-relaxed font-medium whitespace-pre-wrap break-words">
                    {!catalogAddress && "Para saber o endereço, pergunte diretamente através do WhatsApp."}
                    {isLegacyAddress && catalogAddress}
                    {addressObj && (
                      <>
                        {addressObj.logradouro}, {addressObj.numero}
                        {addressObj.complemento && ` - ${addressObj.complemento}`}
                        <br />
                        {addressObj.bairro} - {addressObj.cidade}/{addressObj.estado}
                        {addressObj.cep && <br />}
                        {addressObj.cep && `CEP: ${addressObj.cep}`}
                      </>
                    )}
                  </div>
                  {addressObj?.mapsLink && (
                    <a href={addressObj.mapsLink} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80 font-bold text-sm transition-colors flex items-center justify-center sm:justify-start gap-1 mt-1 break-words">
                      📍 Ver no mapa
                    </a>
                  )}
                </div>

                {/* Coluna 3: Contato */}
                <div className="flex flex-col gap-3 min-w-0">
                  <h3 className="font-display font-black text-foreground text-lg uppercase tracking-wide break-words">Contato</h3>
                  <p className="leading-relaxed font-medium break-words">
                    WhatsApp:<br/>
                    <a href={whatsappLink("Olá! Vim pelo catálogo.", whatsNumber)} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80 font-bold text-base transition-colors break-words">
                      +{whatsNumber}
                    </a>
                  </p>
                </div>
              </div>
              
              <div className="text-center text-xs sm:text-sm font-semibold text-muted-foreground border-t border-border/60 pt-8">
                © {new Date().getFullYear()} Catálogo de Produtos. Todos os direitos reservados.
              </div>
            </div>
          </footer>

        </div>
      )}

      {/* MODAL DE DESBLOQUEIO VIP */}
      {showVipModal && !accessDenied && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <ScrollLock />
            <div className="bg-background w-full max-w-sm rounded-3xl p-8 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 relative border border-border">
               <button onClick={() => setShowVipModal(false)} className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground bg-secondary/50 rounded-full transition-colors">
                  <X className="h-4 w-4" />
               </button>
               <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10 mb-2 border border-yellow-500/20">
                  <Crown className="h-8 w-8 text-yellow-600" />
               </div>
               <div className="text-center">
                  <h3 className="text-2xl font-black font-display text-foreground leading-tight">Área Exclusiva</h3>
                  <p className="text-sm text-muted-foreground mt-3 font-medium leading-relaxed">
                     Categorias exclusivas devido à quantidade limitada de produtos. Insira sua senha para acessar.
                  </p>
               </div>
               <form onSubmit={handleVerifyVipCode} className="mt-4 space-y-4">
                  <Input 
                     type="password" 
                     placeholder="Sua senha secreta..." 
                     value={vipCodeInput} 
                     onChange={e => setVipCodeInput(e.target.value)}
                     className="h-12 text-center text-lg font-bold border-yellow-500/30 focus-visible:ring-yellow-500"
                     maxLength={20}
                  />
                  <Button type="submit" disabled={verifyingVip || !vipCodeInput.trim()} className="w-full h-12 rounded-full text-base font-black shadow-md bg-yellow-500 hover:bg-yellow-600 text-yellow-950 transition-all">
                     {verifyingVip ? "Verificando..." : "Desbloquear Acesso"}
                  </Button>
               </form>
            </div>
         </div>
      )}

      {!accessDenied && items.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-[90px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition hover:scale-105 sm:bottom-[100px] sm:right-6"
          aria-label="Abrir carrinho"
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-black text-destructive-foreground shadow-md border-2 border-background">
            {itemCount}
          </span>
        </button>
      )}

      {stockConflictData && (
        <StockConflictModal
          data={stockConflictData}
          onClose={() => setStockConflictData(null)}
          onConfirm={resolveStockConflicts}
        />
      )}

      {!accessDenied && cartOpen && (
        <CartDrawer 
          onClose={() => setCartOpen(false)} 
          total={total} 
          onFinalize={finalizar} 
          checkoutLoading={checkoutLoading}
          prods={prods}
          onRemoveRequested={setItemToRemove}
        />
      )}
      {!accessDenied && detail && <ProductDetail p={detail} isVip={detail.category_id ? vipCatsIds.has(detail.category_id) : false} onClose={() => setDetail(null)} onRemoveRequested={setItemToRemove} />}
      
      {!accessDenied && showLogoModal && catalogLogo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setShowLogoModal(false)}>
          <ScrollLock />
          <div className="relative max-w-md w-full flex justify-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowLogoModal(false)}
              className="absolute -top-12 right-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition backdrop-blur-md"
              aria-label="Fechar"
            >
              <X className="h-6 w-6" />
            </button>
            <img src={catalogLogo} alt={catalogName} className="max-h-[85vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}

      {!accessDenied && itemToRemove && (
        <ConfirmActionModal
          title="Remover Produto"
          description="Tem certeza que deseja remover este item do carrinho?"
          onClose={() => setItemToRemove(null)}
          onConfirm={() => {
            cart.remove(itemToRemove);
            setItemToRemove(null);
          }}
          destructive={true}
          confirmText="Sim, remover"
        />
      )}

      {!accessDenied && <WhatsAppFloat />}
    </div>
  );
}

function CatChip({ active, isVip = false, onClick, children }: { active: boolean; isVip?: boolean; onClick: () => void; children: React.ReactNode }) {
  const baseClasses = "whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition shadow-sm flex items-center gap-1.5 flex-shrink-0 ";
  let styleClasses = "";

  if (isVip) {
      styleClasses = "vip-chip " + (active ? "ring-2 ring-background ring-offset-2 ring-offset-primary" : "");
  } else {
      styleClasses = active ? "bg-primary text-primary-foreground" : "bg-background text-secondary-foreground hover:bg-background/80 border border-border";
  }

  return (
    <button onClick={onClick} className={baseClasses + styleClasses}>
      {isVip && <span title="Área Exclusiva"><Crown className="h-4 w-4" /></span>}
      {children}
    </button>
  );
}