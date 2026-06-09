import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import imageCompression from "browser-image-compression";
import {
  createAdminUser,
  deleteAdminUser,
  ensureSeedAdmin,
  getAdminPassword,
  listAdmins,
  updateAdminUser,
  updateWhatsAppNumber,
  updateCatalogName,
  updateSystemTheme,
} from "@/lib/admin.functions";
import { brl, DEFAULT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast, Toaster } from "sonner";
import { ArrowLeft, LogOut, Plus, Pencil, Trash2, Upload, UserPlus, Phone, ShieldAlert, Search, CheckCircle, XCircle, TrendingUp, ShoppingBag, DollarSign, Package, Layers, Palette } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administração — Catálogo" }] }),
  component: AdminPage,
});

type Category = { id: string; name: string; sort_order: number };
type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  sale_price: number | null;
  cost: number;
  in_stock: boolean;
  stock: number;
  max_per_cart: number;
  sort_order: number;
};
type OrderRow = { id: string; created_at: string; status: string; total: number; items: any };

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

function usernameFromEmail(email: string) {
  return email.split("@")[0] ?? email;
}

function AdminPage() {
  const [session, setSession] = useState<{ userId: string; email: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const seed = useServerFn(ensureSeedAdmin);

  useEffect(() => {
    seed().catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ? { userId: s.user.id, email: s.user.email ?? "" } : null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ? { userId: data.session.user.id, email: data.session.user.email ?? "" } : null);
      setChecking(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [seed]);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.userId)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  if (checking) return <Shell><p className="p-8 text-muted-foreground font-semibold">Carregando…</p></Shell>;
  if (!session) return <Shell><LoginForm /></Shell>;
  if (isAdmin === null) return <Shell><p className="p-8 text-muted-foreground font-semibold">Verificando permissões…</p></Shell>;
  if (!isAdmin) return <Shell><NotAdmin email={session.email} /></Shell>;

  return <Shell><Dashboard email={session.email} /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
          </Link>
          <div className="font-display text-lg font-black">Painel Admin</div>
        </div>
      </header>
      {children}
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const user = email.trim();
    const fullEmail = user.includes("@") ? user : `${user}@catalogo.local`;
    const { error } = await supabase.auth.signInWithPassword({ email: fullEmail, password });
    setLoading(false);
    if (error) toast.error("Login inválido", { description: error.message });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-6 sm:p-10">
      <div>
        <h1 className="font-display text-3xl font-black">Área do Administrador</h1>
        <p className="mt-1 text-sm text-muted-foreground font-medium">Entre para gerenciar o catálogo.</p>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <Label htmlFor="u">Usuário</Label>
          <Input id="u" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="" autoFocus />
        </div>
        <div>
          <Label htmlFor="p">Senha</Label>
          <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="w-full rounded-full py-6 text-base font-bold shadow-sm">
          {loading ? "Entrando…" : "Entrar"}
        </Button>
        <p className="text-center text-xs text-muted-foreground font-semibold">
          Apenas para Funcionários
        </p>
      </form>
    </div>
  );
}

function NotAdmin({ email }: { email: string }) {
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <p className="text-lg font-bold">Olá, {usernameFromEmail(email)}</p>
      <p className="mt-2 text-sm text-muted-foreground font-medium">
        Sua conta não tem permissão de administrador.
      </p>
      <Button onClick={() => supabase.auth.signOut()} className="mt-6 rounded-full shadow-sm">Sair</Button>
    </div>
  );
}

function Dashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<"orders" | "products" | "categories" | "finances" | "admins" | "settings">("orders");
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(() => {
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .then(({ count }) => setPendingCount(count || 0));
  }, []);

  useEffect(() => {
    fetchPendingCount();
    
    // Aplicar o tema globalmente no carregamento inicial do Admin
    supabase.from("app_settings").select("value").eq("key", "system_theme").maybeSingle().then(({data}) => {
       applyTheme(data?.value || "strong-gray");
    });
    
    const sub = supabase.channel('orders_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchPendingCount();
      }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchPendingCount]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">Gerenciar Catálogo</h1>
          <p className="text-sm text-muted-foreground font-medium">Logado como <span className="font-bold text-foreground">{usernameFromEmail(email)}</span></p>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut()} className="rounded-full shadow-sm">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>

      <div className="mb-6 flex gap-2 border-b border-border overflow-x-auto">
        {(["orders", "products", "categories", "finances", "admins", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "whitespace-nowrap border-b-2 px-4 py-2 text-sm font-bold transition " +
              (tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t === "orders" ? (
              <span className="flex items-center gap-1.5">
                Pedidos
                {pendingCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-black text-destructive-foreground shadow-sm">{pendingCount}</span>}
              </span>
            ) : t === "products" ? "Produtos" : t === "categories" ? "Categorias" : t === "finances" ? "Finanças" : t === "admins" ? "Administradores" : "Configurações"}
          </button>
        ))}
      </div>

      {tab === "orders" && <OrdersPanel onStatusChange={fetchPendingCount} />}
      {tab === "products" && <ProductsPanel />}
      {tab === "categories" && <CategoriesPanel />}
      {tab === "finances" && <FinancesPanel />}
      {tab === "admins" && <AdminsPanel />}
      {tab === "settings" && <SettingsPanel />}
    </div>
  );
}

/* ---------- Orders ---------- */
function OrdersPanel({ onStatusChange }: { onStatusChange?: () => void }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [showManual, setShowManual] = useState(false);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function updateStatus(id: string, newStatus: string) {
    if (newStatus === 'canceled' && !confirm("Tem certeza que deseja cancelar? O estoque será devolvido.")) return;
    const { error } = await supabase.rpc("update_order_status", { order_id: id, new_status: newStatus });
    if (error) toast.error("Erro ao atualizar pedido: " + error.message);
    else { 
      toast.success("Status atualizado"); 
      fetchOrders(); 
      if (onStatusChange) onStatusChange();
    }
  }

  const filtered = statusFilter === "all" ? orders : orders.filter(o => o.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex gap-2 p-1 bg-secondary rounded-lg border border-border">
          {(["pending", "completed", "canceled", "all"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md transition ${statusFilter === s ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {s === "pending" ? "Pendentes" : s === "completed" ? "Concluídos" : s === "canceled" ? "Cancelados" : "Todos"}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowManual(true)} className="rounded-full shadow-sm">
          <Plus className="mr-1 h-4 w-4" /> Novo Pedido Manual
        </Button>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground font-semibold border border-dashed border-border rounded-xl">Nenhum pedido encontrado.</div>}
        {filtered.map(o => (
          <div key={o.id} className="border border-border bg-card p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">Pedido #{o.id.split("-")[0]}</span>
                {o.status === 'pending' && <span className="bg-yellow-500/15 text-yellow-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide">Pendente</span>}
                {o.status === 'completed' && <span className="bg-green-500/15 text-green-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide">Concluído</span>}
                {o.status === 'canceled' && <span className="bg-destructive/15 text-destructive px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide">Cancelado</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-medium">{new Date(o.created_at).toLocaleString('pt-BR')}</p>
              <div className="text-sm mt-2 font-medium">
                {Array.isArray(o.items) && o.items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")}
              </div>
              <div className="text-primary font-black mt-2">{brl(Number(o.total))}</div>
            </div>
            {o.status === 'pending' && (
              <div className="flex gap-2 sm:flex-col">
                <Button variant="outline" className="border-green-500/30 text-green-600 shadow-sm hover:bg-green-50 hover:text-green-700" onClick={() => updateStatus(o.id, 'completed')}>
                  <CheckCircle className="mr-1 h-4 w-4" /> Concluir
                </Button>
                <Button variant="outline" className="border-destructive/30 text-destructive shadow-sm hover:bg-destructive/10" onClick={() => updateStatus(o.id, 'canceled')}>
                  <XCircle className="mr-1 h-4 w-4" /> Cancelar
                </Button>
              </div>
            )}
            {o.status === 'completed' && (
                <Button variant="ghost" size="sm" className="text-muted-foreground font-semibold" onClick={() => updateStatus(o.id, 'canceled')}>Cancelar Venda</Button>
            )}
          </div>
        ))}
      </div>
      {showManual && <ManualOrderModal onClose={() => setShowManual(false)} onSaved={() => { fetchOrders(); if (onStatusChange) onStatusChange(); }} />}
    </div>
  );
}

function ManualOrderModal({ onClose, onSaved }: { onClose: () => void, onSaved: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  
  useEffect(() => {
      supabase.from("products").select("*").order("name").then(({data}) => setProducts(data as Product[] || []));
  }, []);

  const addToCart = (p: Product) => {
      setCart(c => {
          const ex = c.find(x => x.product.id === p.id);
          if (ex) {
            if (ex.quantity >= p.stock) return c;
            return c.map(x => x.product.id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
          }
          return [...c, { product: p, quantity: 1 }];
      });
  };

  const removeFromCart = (p: Product) => {
      setCart(c => c.map(x => x.product.id === p.id ? { ...x, quantity: x.quantity - 1 } : x).filter(x => x.quantity > 0));
  };

  const total = cart.reduce((acc, item) => acc + (Number(item.product.sale_price) || Number(item.product.price)) * item.quantity, 0);

  const save = async () => {
      if (cart.length === 0) return;
      setSaving(true);
      const itemsJson = cart.map(c => ({
          id: c.product.id,
          name: c.product.name,
          price: Number(c.product.sale_price) || Number(c.product.price),
          quantity: c.quantity,
          category_id: c.product.category_id
      }));
      const { error } = await supabase.rpc("checkout_order", { order_total: total, order_items: itemsJson });
      setSaving(false);
      if (error) { toast.error("Erro ao criar pedido: " + error.message); return; }
      toast.success("Pedido manual criado com sucesso!");
      onSaved();
      onClose();
  };

  const filteredProducts = products.filter(p => p.in_stock && p.name.toLowerCase().includes(search.toLowerCase()));

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
         <div className="bg-background w-full max-w-4xl rounded-2xl flex flex-col shadow-2xl max-h-[90vh]">
             <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-xl font-display font-black">Novo Pedido Manual</h2>
                <button onClick={onClose} className="text-sm font-semibold text-muted-foreground hover:text-foreground">Fechar</button>
             </div>
             
             <div className="flex-1 overflow-y-auto flex flex-col sm:flex-row">
                 <div className="w-full sm:w-3/5 p-6 border-b sm:border-b-0 sm:border-r border-border flex flex-col">
                     <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3">Produtos Disponíveis</h3>
                     <div className="relative mb-4">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                         <Input placeholder="Buscar produto pelo nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                     </div>
                     <div className="grid gap-2 overflow-y-auto flex-1 pr-1">
                     {filteredProducts.map(p => (
                         <div key={p.id} className={"flex justify-between border border-border p-3 rounded-xl items-center shadow-sm " + (p.stock <= 0 ? "opacity-50 bg-secondary" : "bg-card")}>
                             <div>
                                <div className="font-semibold text-sm">{p.name}</div>
                                <div className="text-xs font-semibold text-muted-foreground">Estoque: {p.stock}</div>
                             </div>
                             <div className="flex items-center gap-3">
                                <span className="font-bold text-primary">{brl(Number(p.sale_price) || Number(p.price))}</span>
                                <Button size="sm" onClick={() => addToCart(p)} disabled={p.stock <= 0} className="rounded-full h-8 px-3 shadow-sm">
                                    <Plus className="h-3 w-3" />
                                </Button>
                             </div>
                         </div>
                     ))}
                     {filteredProducts.length === 0 && <p className="text-sm font-semibold text-muted-foreground text-center py-4">Nenhum produto encontrado.</p>}
                     </div>
                 </div>
                 <div className="w-full sm:w-2/5 p-6 bg-secondary/20 flex flex-col">
                     <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3">Carrinho</h3>
                     {cart.length === 0 && <p className="text-sm font-medium text-muted-foreground">O carrinho está vazio.</p>}
                     <div className="flex-1 overflow-y-auto space-y-3">
                     {cart.map(c => (
                         <div key={c.product.id} className="flex flex-col text-sm border-b border-border/50 pb-3">
                             <div className="font-semibold">{c.product.name}</div>
                             <div className="flex justify-between items-center mt-2">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => removeFromCart(c.product)} className="bg-secondary text-foreground rounded-full w-7 h-7 flex items-center justify-center border border-border hover:bg-border transition shadow-sm">-</button>
                                    <span className="w-4 text-center font-bold">{c.quantity}</span>
                                    <button onClick={() => addToCart(c.product)} disabled={c.quantity >= c.product.stock} className="bg-secondary text-foreground rounded-full w-7 h-7 flex items-center justify-center border border-border hover:bg-border transition disabled:opacity-50 shadow-sm">+</button>
                                </div>
                                <span className="font-bold text-primary">{brl((Number(c.product.sale_price) || Number(c.product.price)) * c.quantity)}</span>
                             </div>
                         </div>
                     ))}
                     </div>
                     <div className="font-black text-xl pt-4 mt-4 border-t border-border flex justify-between">
                         <span>Total</span>
                         <span>{brl(total)}</span>
                     </div>
                 </div>
             </div>
             <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
                 <Button variant="outline" onClick={onClose} className="rounded-full shadow-sm">Cancelar</Button>
                 <Button onClick={save} disabled={cart.length === 0 || saving} className="rounded-full shadow-sm">{saving ? "Processando..." : "Finalizar Pedido"}</Button>
             </div>
         </div>
      </div>
  );
}

/* ---------- Finances ---------- */
function FinancesPanel() {
  const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      d.setDate(1);
      return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
      setLoading(true);
      Promise.all([
          supabase.from("orders")
              .select("*")
              .eq("status", "completed")
              .gte("created_at", `${startDate}T00:00:00Z`)
              .lte("created_at", `${endDate}T23:59:59Z`),
          supabase.from("products").select("id, name, cost, stock")
      ]).then(([ordersRes, prodsRes]) => {
          setOrders(ordersRes.data || []);
          setProducts(prodsRes.data as Product[] || []);
          setLoading(false);
      });
  }, [startDate, endDate]);

  const totalEarned = orders.reduce((acc, o) => acc + Number(o.total), 0);
  
  let totalCosts = 0;
  const itemStats: Record<string, { name: string, qty: number, revenue: number }> = {};

  orders.forEach(o => {
      if (Array.isArray(o.items)) {
          o.items.forEach((i: any) => {
              const qty = Number(i.quantity) || 0;
              const price = Number(i.price) || 0;
              const p = products.find(prod => prod.id === i.id);
              const cost = p ? Number(p.cost) : 0;
              
              totalCosts += (cost * qty);

              if (!itemStats[i.id]) {
                  itemStats[i.id] = { name: i.name, qty: 0, revenue: 0 };
              }
              itemStats[i.id].qty += qty;
              itemStats[i.id].revenue += (price * qty);
          });
      }
  });

  const netProfit = totalEarned - totalCosts;
  const totalItems = Object.values(itemStats).reduce((acc, item) => acc + item.qty, 0);
  const top10 = Object.values(itemStats).sort((a, b) => b.qty - a.qty).slice(0, 10);

  const totalRegisteredProducts = products.length;
  const totalStockUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

  return (
      <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end bg-card p-4 rounded-xl border border-border shadow-sm">
              <div className="flex-1">
                  <Label>Data de Início</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="flex-1">
                  <Label>Data de Fim</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
          </div>

          {loading ? (
              <p className="text-muted-foreground text-center font-semibold py-10">Carregando métricas...</p>
          ) : (
              <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="border border-border bg-card rounded-xl shadow-sm p-6 flex flex-col justify-center items-center text-center">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                              <TrendingUp className="h-6 w-6 text-primary" />
                          </div>
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Lucro Bruto (Receita)</h3>
                          <p className="text-2xl font-black mt-1 text-foreground">{brl(totalEarned)}</p>
                      </div>
                      <div className="border border-border bg-card rounded-xl shadow-sm p-6 flex flex-col justify-center items-center text-center">
                          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                              <DollarSign className="h-6 w-6 text-green-600" />
                          </div>
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Lucro Líquido</h3>
                          <p className="text-2xl font-black mt-1 text-green-600">{brl(netProfit)}</p>
                      </div>
                      <div className="border border-border bg-card rounded-xl shadow-sm p-6 flex flex-col justify-center items-center text-center">
                          <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-3">
                              <ShoppingBag className="h-6 w-6 text-accent-foreground" />
                          </div>
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Produtos Vendidos</h3>
                          <p className="text-2xl font-black mt-1 text-foreground">{totalItems}</p>
                      </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="border border-border bg-card rounded-xl shadow-sm p-6 flex flex-col justify-center items-center text-center">
                          <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                              <Layers className="h-6 w-6 text-blue-600" />
                          </div>
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Produtos Cadastrados</h3>
                          <p className="text-2xl font-black mt-1 text-foreground">{totalRegisteredProducts}</p>
                      </div>
                      <div className="border border-border bg-card rounded-xl shadow-sm p-6 flex flex-col justify-center items-center text-center">
                          <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-3">
                              <Package className="h-6 w-6 text-orange-600" />
                          </div>
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Quantidade em Estoque</h3>
                          <p className="text-2xl font-black mt-1 text-foreground">{totalStockUnits}</p>
                      </div>
                  </div>

                  <div className="mt-8 border border-border bg-card rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-secondary/50 px-6 py-4 border-b border-border">
                          <h3 className="font-display font-black text-lg">Top 10 Produtos Mais Vendidos</h3>
                      </div>
                      {top10.length === 0 ? (
                          <p className="p-6 text-center text-muted-foreground font-semibold">Nenhuma venda no período.</p>
                      ) : (
                          <div className="divide-y divide-border">
                              {top10.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-4 px-6 hover:bg-secondary/20 transition">
                                      <div className="flex items-center gap-4">
                                          <span className="flex items-center justify-center h-8 w-8 rounded-full bg-secondary text-sm font-black text-muted-foreground">
                                              {idx + 1}º
                                          </span>
                                          <span className="font-semibold">{item.name}</span>
                                      </div>
                                      <div className="text-right">
                                          <div className="font-black text-primary">{item.qty} un.</div>
                                          <div className="text-xs font-semibold text-muted-foreground">{brl(item.revenue)}</div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </>
          )}
      </div>
  );
}

/* ---------- Categories ---------- */
function CategoriesPanel() {
  const [cats, setCats] = useState<Category[]>([]);
  const [name, setName] = useState("");

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setCats(data ?? []);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: name.trim(), sort_order: cats.length });
    if (error) return toast.error(error.message);
    setName("");
    toast.success("Categoria criada");
    refresh();
  }

  async function rename(c: Category) {
    const newName = prompt("Novo nome:", c.name);
    if (!newName) return;
    const { error } = await supabase.from("categories").update({ name: newName }).eq("id", c.id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function del(c: Category) {
    if (!confirm(`Remover categoria "${c.name}"? Os produtos ficarão sem categoria.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="flex gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da categoria (ex: Doces)" />
        <Button type="submit" className="rounded-full shadow-sm"><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
      </form>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {cats.length === 0 && <li className="p-6 text-center text-muted-foreground font-medium">Nenhuma categoria ainda.</li>}
        {cats.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 p-4">
            <span className="font-semibold">{c.name}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => rename(c)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => del(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Products ---------- */
function ProductsPanel() {
  const [prods, setProds] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    setProds((p.data ?? []) as Product[]);
    setCats(c.data ?? []);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function del(p: Product) {
    if (!confirm(`Remover "${p.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Produto removido");
    refresh();
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? prods.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q),
      )
    : prods;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto…"
            className="pl-9 shadow-sm"
          />
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="rounded-full shadow-sm">
          <Plus className="mr-1 h-4 w-4" /> Novo produto
        </Button>
      </div>

      {prods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground font-semibold">
          Nenhum produto ainda. Adicione o primeiro!
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground font-semibold">
          Nenhum produto encontrado para "{search}".
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const isInactive = !p.in_stock;
            const outOfStock = p.in_stock && p.stock <= 0;
            const hasIssue = isInactive || outOfStock;
            const promo = p.sale_price != null && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price);
            return (
              <div
                key={p.id}
                className={
                  "relative flex gap-3 rounded-xl border bg-card p-3 shadow-sm transition " +
                  (hasIssue ? "border-destructive/60 ring-2 ring-destructive/30 bg-destructive/5" : "border-border")
                }
              >
                <div className={"h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-secondary " + (hasIssue ? "opacity-40" : "")}>
                  {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
                </div>
                <div className={"flex flex-1 flex-col " + (hasIssue ? "opacity-60" : "")}>
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs font-semibold text-muted-foreground mt-0.5">Estoque: {p.stock}</div>
                  {(isInactive || outOfStock) && (
                    <div className="mt-0.5">
                      <span className="inline-block rounded-full bg-destructive px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-destructive-foreground">
                        {isInactive ? "Inativo" : "Sem estoque"}
                      </span>
                    </div>
                  )}
                  <div className="text-sm mt-1">
                    {promo ? (
                      <>
                        <span className="text-muted-foreground font-semibold line-through mr-1">{brl(Number(p.price))}</span>
                        <span className="text-primary font-black">{brl(Number(p.sale_price))}</span>
                        <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-accent-foreground">Promo</span>
                      </>
                    ) : (
                      <span className="text-primary font-black">{brl(Number(p.price))}</span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-end gap-1 text-xs">
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="rounded-full p-1.5 hover:bg-secondary transition"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => del(p)} className="rounded-full p-1.5 hover:bg-destructive/10 transition"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProductForm
          product={editing}
          cats={cats}
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
  onClose,
  onSaved,
}: {
  product: Product | null;
  cats: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [salePrice, setSalePrice] = useState(product?.sale_price != null ? String(product.sale_price) : "");
  const [cost, setCost] = useState(product ? String(product.cost) : "");
  const [maxPerCart, setMaxPerCart] = useState(product ? String(product.max_per_cart) : "0");
  const [stock, setStock] = useState(product ? String(product.stock) : "0");
  const [inStock, setInStock] = useState(product?.in_stock ?? true);
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    } catch (error) {
      console.error("Erro na compressão:", error);
      toast.error("Erro ao processar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const saleNum = salePrice.trim() ? Number(salePrice) : null;
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price: Number(price) || 0,
      sale_price: saleNum && saleNum > 0 ? saleNum : null,
      cost: Number(cost) || 0,
      stock: Number(stock) || 0,
      max_per_cart: Math.max(0, parseInt(maxPerCart || "0", 10)),
      in_stock: inStock,
      category_id: categoryId || null,
      image_url: imageUrl || null,
    };
    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(product ? "Produto atualizado" : "Produto criado");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <form
        onSubmit={save}
        className="flex w-full max-w-2xl max-h-[100dvh] flex-col rounded-t-2xl bg-background shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-display text-xl font-black">{product ? "Editar" : "Novo"} produto</h3>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-muted-foreground">Fechar</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Foto</Label>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-24 w-24 overflow-hidden rounded-lg border border-border bg-secondary shadow-sm">
                {imageUrl && <img src={imageUrl} className="h-full w-full object-cover" alt="" />}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary shadow-sm transition">
                <Upload className="h-4 w-4" />
                {uploading ? "Enviando…" : "Enviar imagem"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                />
              </label>
            </div>
          </div>

          <div className="sm:col-span-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Categoria</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">(sem categoria)</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Quantidade em Estoque</Label>
            <Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} required />
          </div>
          <div>
            <Label>Preço de venda (R$)</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div>
            <Label>Preço promocional (R$) <span className="text-xs font-semibold text-muted-foreground">opcional</span></Label>
            <Input type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="deixe vazio se sem promoção" />
          </div>
          <div>
            <Label>Custo interno (R$)</Label>
            <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div>
            <Label>Limite por carrinho</Label>
            <Input type="number" min={0} value={maxPerCart} onChange={(e) => setMaxPerCart(e.target.value)} />
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Deixem em 0 caso queira deixar sem limite</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm sm:col-span-2">
            <div>
              <div className="font-semibold">Exibir na Loja (Ativo)</div>
              <div className="text-xs font-semibold text-muted-foreground">Desative para ocultar o produto completamente sem excluí-lo.</div>
            </div>
            <Switch checked={inStock} onCheckedChange={setInStock} />
          </div>
        </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-full shadow-sm">Cancelar</Button>
          <Button type="submit" disabled={saving} className="rounded-full shadow-sm">
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Admins ---------- */
type AdminRow = { id: string; email: string; username: string; fixed: boolean };

function AdminsPanel() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminRow | null>(null);

  const list = useServerFn(listAdmins);
  const del = useServerFn(deleteAdminUser);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await list();
      setAdmins(res.admins);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => { refresh(); }, [refresh]);

  async function remove(a: AdminRow) {
    if (a.fixed) return toast.error("O usuário 'admin' é fixo e não pode ser excluído.");
    if (!confirm(`Excluir administrador "${a.username}"?`)) return;
    try {
      await del({ data: { userId: a.id } });
      toast.success("Administrador removido");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          <ShieldAlert className="mr-1 inline h-4 w-4" />
          O usuário <code className="rounded bg-secondary px-1.5 py-0.5">admin</code> é fixo e não pode ser excluído nem renomeado.
        </p>
        <Button onClick={() => setShowCreate(true)} className="rounded-full shadow-sm">
          <UserPlus className="mr-1 h-4 w-4" /> Novo administrador
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {loading && <li className="p-6 text-center text-muted-foreground font-semibold">Carregando…</li>}
        {!loading && admins.length === 0 && <li className="p-6 text-center text-muted-foreground font-semibold">Nenhum administrador.</li>}
        {admins.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="font-semibold flex items-center gap-2">
                {a.username}
                {a.fixed && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary">Fixo</span>}
              </div>
              <div className="text-xs font-semibold text-muted-foreground">{a.email}</div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setEditing(a)} title="Editar"><Pencil className="h-4 w-4" /></Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(a)}
                disabled={a.fixed}
                title={a.fixed ? "Não pode ser excluído" : "Excluir"}
              >
                <Trash2 className={"h-4 w-4 " + (a.fixed ? "opacity-30" : "text-destructive")} />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {showCreate && (
        <AdminFormModal
          title="Novo administrador"
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); refresh(); }}
        />
      )}
      {editing && (
        <AdminFormModal
          title={`Editar "${editing.username}"`}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function AdminFormModal({
  title,
  editing,
  onClose,
  onSaved,
}: {
  title: string;
  editing?: AdminRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [user, setUser] = useState(editing?.username ?? "");
  const [pass, setPass] = useState("");
  const [originalPass, setOriginalPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loadingPass, setLoadingPass] = useState(isEdit);
  const [loading, setLoading] = useState(false);
  const create = useServerFn(createAdminUser);
  const update = useServerFn(updateAdminUser);
  const getPwd = useServerFn(getAdminPassword);

  useEffect(() => {
    if (!isEdit || !editing) return;
    getPwd({ data: { userId: editing.id } })
      .then((r) => { setPass(r.password ?? ""); setOriginalPass(r.password ?? ""); })
      .catch(() => {})
      .finally(() => setLoadingPass(false));
  }, [isEdit, editing, getPwd]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit && editing) {
        const payload: { userId: string; user?: string; password?: string } = { userId: editing.id };
        if (!editing.fixed && user.trim() && user.trim() !== editing.username) payload.user = user.trim();
        if (pass !== originalPass) {
          if (pass.length < 6) {
            setLoading(false);
            return toast.error("Senha precisa ter no mínimo 6 caracteres.");
          }
          payload.password = pass;
        }
        if (!payload.user && !payload.password) {
          setLoading(false);
          return toast.info("Nada para atualizar.");
        }
        await update({ data: payload });
        toast.success("Administrador atualizado");
      } else {
        if (!user.trim() || pass.length < 6) {
          setLoading(false);
          return toast.error("Usuário e senha (mín. 6 caracteres) obrigatórios");
        }
        await create({ data: { user: user.trim(), password: pass } });
        toast.success(`Administrador "${user}" criado`);
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-0 sm:items-center sm:p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-t-2xl bg-background p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-black">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-muted-foreground">Fechar</button>
        </div>
        <div>
          <Label htmlFor="au">Usuário</Label>
          <Input
            id="au"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="ex: nome"
            disabled={isEdit && editing?.fixed}
          />
          {isEdit && editing?.fixed && (
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Esse usuário é fixo — não pode renomear.</p>
          )}
        </div>
        <div>
          <Label htmlFor="ap">Senha</Label>
          <div className="relative">
            <Input
              id="ap"
              type={showPass ? "text" : "password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={loadingPass ? "Carregando…" : "mínimo 6 caracteres"}
              className="pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-secondary transition"
            >
              {showPass ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {isEdit && (
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Senha atual exibida acima. Edite para alterar.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-full shadow-sm">Cancelar</Button>
          <Button type="submit" disabled={loading} className="rounded-full shadow-sm">
            {loading ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Settings ---------- */
function SettingsPanel() {
  const [number, setNumber] = useState("");
  const [catalogName, setCatalogName] = useState("");
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingNumber, setSavingNumber] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  
  const saveNumberFn = useServerFn(updateWhatsAppNumber);
  const saveNameFn = useServerFn(updateCatalogName);
  const saveThemeFn = useServerFn(updateSystemTheme);

  useEffect(() => {
    Promise.all([
      supabase.from("app_settings").select("value").eq("key", "whatsapp_number").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "catalog_name").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "system_theme").maybeSingle()
    ]).then(([waRes, catRes, themeRes]) => {
      setNumber(waRes.data?.value ?? DEFAULT_WHATSAPP_NUMBER);
      setCatalogName(catRes.data?.value ?? "Catálogo de Produtos");
      setTheme(themeRes.data?.value ?? "strong-gray");
      setLoading(false);
    });
  }, []);

  async function submitNumber(e: React.FormEvent) {
    e.preventDefault();
    setSavingNumber(true);
    try {
      const res = await saveNumberFn({ data: { number } });
      setNumber(res.number);
      toast.success("Número do WhatsApp atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSavingNumber(false);
    }
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    if (!catalogName.trim()) return toast.error("O nome não pode ser vazio.");
    setSavingName(true);
    try {
      const res = await saveNameFn({ data: { name: catalogName } });
      setCatalogName(res.name);
      toast.success("Nome do catálogo atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSavingName(false);
    }
  }

  async function submitTheme(e: React.FormEvent) {
    e.preventDefault();
    setSavingTheme(true);
    try {
      const res = await saveThemeFn({ data: { theme } });
      setTheme(res.theme);
      applyTheme(res.theme);
      toast.success("Cores do sistema atualizadas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSavingTheme(false);
    }
  }

  if (loading) return <p className="text-muted-foreground font-semibold">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-display text-lg font-black flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" /> Cores do Sistema
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Personalize a aparência do seu catálogo. As alterações são aplicadas instantaneamente após salvar.
        </p>

        <form onSubmit={submitTheme} className="mt-4 space-y-6">
          <div>
            <div className="flex flex-wrap gap-3">
              {SYSTEM_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTheme(t.id); applyTheme(t.id); }}
                  className={`h-10 w-10 rounded-full border-4 transition-all hover:scale-110 ${theme === t.id ? "border-foreground scale-110 shadow-md" : "border-transparent shadow-sm"}`}
                  style={{ backgroundColor: t.primary }}
                  title={t.name}
                />
              ))}
            </div>
          </div>
          <Button type="submit" disabled={savingTheme} className="rounded-full shadow-sm">
            {savingTheme ? "Salvando…" : "Salvar Cores"}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-display text-lg font-black flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" /> Nome do Catálogo
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Este é o nome que aparecerá no cabeçalho e na página inicial da loja.
        </p>
        <form onSubmit={submitName} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={catalogName}
            onChange={(e) => setCatalogName(e.target.value)}
            placeholder="ex: Catálogo de Produtos"
            className="flex-1"
          />
          <Button type="submit" disabled={savingName} className="rounded-full shadow-sm">
            {savingName ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-display text-lg font-black flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" /> Número do WhatsApp
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Este é o número que receberá os pedidos do site e o botão flutuante.
        </p>
        <form onSubmit={submitNumber} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="ex: 5545984311918"
            className="flex-1"
          />
          <Button type="submit" disabled={savingNumber} className="rounded-full shadow-sm">
            {savingNumber ? "Salvando…" : "Salvar"}
          </Button>
        </form>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          Use o formato internacional sem espaços (DDI + DDD + número). Ex: <code>5545984311918</code>
        </p>
      </div>
    </div>
  );
}