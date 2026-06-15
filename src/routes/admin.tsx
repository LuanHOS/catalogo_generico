import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback, useMemo } from "react";
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
  updatePrivateMode,
  updateCatalogLogo,
  listAccessCodes,
  createAccessCode,
  deleteAccessCode,
} from "@/lib/admin.functions";
import { brl, DEFAULT_WHATSAPP_NUMBER, whatsappLink } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast, Toaster } from "sonner";
import { ArrowLeft, LogOut, Plus, Pencil, Trash2, Upload, UserPlus, Phone, ShieldAlert, Search, CheckCircle, XCircle, TrendingUp, ShoppingBag, DollarSign, Package, Layers, Palette, Lock, Share2, AlertTriangle, Clock, Image as ImageIcon, X, Crown } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administração — Catálogo" }] }),
  component: AdminPage,
});

type Category = { id: string; name: string; sort_order: number; is_vip: boolean | null };
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
  min_stock: number;
  barcode: string | null;
  sales_count: number;
  max_per_cart: number;
  sort_order: number;
  track_stock: boolean;
};
type OrderRow = { 
  id: string; 
  created_at: string; 
  status: string; 
  total: number; 
  items: any; 
  vip_code: string | null;
  cancellation_reason?: string | null;
  canceled_by_name?: string | null;
  completed_at?: string | null;
  canceled_at?: string | null;
  is_presential?: boolean | null;
};

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

const blockInvalidNumberChars = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['e', 'E', '+', '-'].includes(e.key)) {
    e.preventDefault();
  }
};

/* ---------- Bloqueio de Scroll Global ---------- */
function ScrollLock() {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <ScrollLock />
      <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto break-words">
        <div>
          <h3 className={`text-lg font-black font-display flex items-center gap-2 ${destructive ? 'text-destructive' : 'text-primary'}`}>
            {destructive && <AlertTriangle className="h-5 w-5" />}
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-2 font-medium leading-relaxed">{description}</p>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          {!alertOnly && (
            <Button variant="outline" onClick={onClose} disabled={loading} className="rounded-full shadow-sm flex-shrink-0">
              Cancelar
            </Button>
          )}
          <Button 
            variant={destructive ? "destructive" : "default"} 
            onClick={onConfirm} 
            disabled={loading} 
            className="rounded-full shadow-sm flex-shrink-0"
          >
            {loading ? "Processando..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdminPage() {
  const [session, setSession] = useState<{ userId: string; email: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isMaster, setIsMaster] = useState<boolean>(false);
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
    if (!session) { setIsAdmin(null); setIsMaster(false); return; }
    supabase
      .from("user_roles")
      .select("role, is_master")
      .eq("user_id", session.userId)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(!!data);
        setIsMaster(!!data?.is_master);
      });
  }, [session]);

  if (checking) return <Shell><p className="p-8 text-muted-foreground font-semibold">Carregando…</p></Shell>;
  if (!session) return <Shell><LoginForm /></Shell>;
  if (isAdmin === null) return <Shell><p className="p-8 text-muted-foreground font-semibold">Verificando permissões…</p></Shell>;
  if (!isAdmin) return <Shell><NotAdmin email={session.email} /></Shell>;

  return <Shell><Dashboard email={session.email} isMaster={isMaster} currentUserId={session.userId} currentUserName={usernameFromEmail(session.email)} /></Shell>;
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
          <Label htmlFor="u">Usuário <span className="text-destructive">*</span></Label>
          <Input id="u" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="" autoFocus required maxLength={30} />
        </div>
        <div>
          <Label htmlFor="p">Senha <span className="text-destructive">*</span></Label>
          <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={50} />
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

function Dashboard({ email, isMaster, currentUserId, currentUserName }: { email: string, isMaster: boolean, currentUserId: string, currentUserName: string }) {
  const [tab, setTab] = useState<string>("orders");
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(() => {
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .then(({ count }) => setPendingCount(count || 0));
  }, []);

  useEffect(() => {
    fetchPendingCount();
    
    supabase.from("app_settings").select("value").eq("key", "system_theme").maybeSingle().then(({data}) => {
       applyTheme(data?.value || "strong-gray");
    });
    
    const sub = supabase.channel('orders_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchPendingCount();
      }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchPendingCount]);

  const allTabs = [
    { id: "orders", label: "Pedidos", masterOnly: false },
    { id: "products", label: "Produtos", masterOnly: false },
    { id: "categories", label: "Categorias", masterOnly: false },
    { id: "finances", label: "Finanças", masterOnly: true },
    { id: "admins", label: "Administradores", masterOnly: true },
    { id: "settings", label: "Configurações", masterOnly: true }
  ];

  const visibleTabs = allTabs.filter(t => !t.masterOnly || isMaster);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">Gerenciar Catálogo</h1>
          <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
            Logado como <span className="font-bold text-foreground">{usernameFromEmail(email)}</span>
            {isMaster ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary">Master</span>
            ) : (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">Operador</span>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut()} className="rounded-full shadow-sm">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>

      <div className="mb-6 flex gap-2 border-b border-border overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "whitespace-nowrap border-b-2 px-4 py-2 text-sm font-bold transition " +
              (tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t.id === "orders" ? (
              <span className="flex items-center gap-1.5">
                {t.label}
                {pendingCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-black text-destructive-foreground shadow-sm">{pendingCount}</span>}
              </span>
            ) : t.label}
          </button>
        ))}
      </div>

      {tab === "orders" && <OrdersPanel onStatusChange={fetchPendingCount} currentUserName={currentUserName} />}
      {tab === "products" && <ProductsPanel isMaster={isMaster} currentUserName={currentUserName} />}
      {tab === "categories" && <CategoriesPanel isMaster={isMaster} currentUserName={currentUserName} />}
      {tab === "finances" && isMaster && <FinancesPanel />}
      {tab === "admins" && isMaster && <AdminsPanel currentUserId={currentUserId} />}
      {tab === "settings" && isMaster && <SettingsPanel />}
    </div>
  );
}

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
      <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto break-words">
        <div>
          <h3 className="text-lg font-black font-display text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5"/> Cancelar Pedido</h3>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Os produtos voltarão automaticamente para o estoque.</p>
        </div>
        <div>
          <Label>Motivo (Opcional)</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Cliente desistiu da compra" className="mt-1 resize-y min-h-[80px] max-h-[200px]" maxLength={255} />
        </div>
        <div className="flex justify-end gap-2 mt-2">
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
      <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto break-words">
        <div>
          <h3 className="text-lg font-black font-display text-primary flex items-center gap-2"><CheckCircle className="h-5 w-5"/> Concluir Pedido</h3>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Tem certeza que deseja marcar este pedido como concluído? Ele será contabilizado nas suas estatísticas de vendas.</p>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-full shadow-sm flex-shrink-0">Voltar</Button>
          <Button onClick={submit} disabled={saving} className="rounded-full shadow-sm bg-primary text-primary-foreground hover:opacity-90 flex-shrink-0">
             {saving ? "Processando..." : "Confirmar Conclusão"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Orders ---------- */
function OrdersPanel({ onStatusChange, currentUserName }: { onStatusChange?: () => void, currentUserName: string }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [showManual, setShowManual] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  
  // Modais Rápidos
  const [cancelModalOrder, setCancelModalOrder] = useState<OrderRow | null>(null);
  const [completeModalOrder, setCompleteModalOrder] = useState<OrderRow | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchOrders = useCallback(async () => {
    let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
    
    if (startDate) q = q.gte("created_at", `${startDate}T00:00:00Z`);
    if (endDate) q = q.lte("created_at", `${endDate}T23:59:59Z`);

    const { data } = await q;
    setOrders((data as OrderRow[]) || []);
  }, [startDate, endDate]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function updateStatus(id: string, newStatus: string, newTotal?: number, reason?: string) {
    const { error } = await supabase.rpc("update_order_status", { 
       order_id: id, 
       new_status: newStatus, 
       new_total: newTotal, 
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
        <Button onClick={() => setShowManual(true)} className="rounded-full shadow-sm flex-shrink-0">
          <Plus className="mr-1 h-4 w-4" /> Fazer Venda Presencial
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por ID, produto ou senha VIP..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="pl-9 h-10" 
            maxLength={100}
          />
        </div>
        <div className="flex items-center gap-2">
          <Input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            className="h-10 w-full sm:w-auto text-sm" 
          />
          <span className="text-muted-foreground text-sm font-semibold">até</span>
          <Input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            className="h-10 w-full sm:w-auto text-sm" 
          />
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground font-semibold border border-dashed border-border rounded-xl">Nenhum pedido encontrado.</div>}
        {filtered.map(o => (
          <div 
            key={o.id} 
            className="border border-border bg-card p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm cursor-pointer hover:border-primary/30 transition break-words"
            onClick={() => setSelectedOrder(o)}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-lg">Pedido #{o.id.split("-")[0]}</span>
                {o.status === 'pending' && <span className="bg-yellow-500/15 text-yellow-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide">Pendente</span>}
                {o.status === 'completed' && <span className="bg-green-500/15 text-green-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide">Concluído</span>}
                {o.status === 'canceled' && <span className="bg-destructive/15 text-destructive px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide">Cancelado</span>}
                {o.is_presential && <span className="bg-primary/15 text-primary px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide">Venda Presencial</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-medium">{new Date(o.created_at).toLocaleString('pt-BR')}</p>
              {o.vip_code && (
                <div className="mt-1 text-xs font-bold text-green-600">Acesso VIP: {o.vip_code}</div>
              )}
              <div className="text-sm mt-2 font-medium line-clamp-2 break-words" title={Array.isArray(o.items) ? o.items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ") : ""}>
                {Array.isArray(o.items) && o.items.map((i: any) => {
                   const shortName = i.name && i.name.length > 20 ? i.name.substring(0, 20) + "..." : i.name;
                   return `${i.quantity}x ${shortName}`;
                }).join(", ")}
              </div>
              <div className="text-primary font-black mt-2">{brl(Number(o.total))}</div>
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

function OrderDetailsModal({
  order,
  onClose,
  onUpdateStatus
}: {
  order: OrderRow;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string, total?: number, reason?: string) => Promise<void>;
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
    await onUpdateStatus(order.id, 'completed', parsedTotal);
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
      if (!(window as any).jspdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const { jsPDF } = (window as any).jspdf;
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
      <div className="bg-background w-full max-w-lg rounded-2xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden break-words">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl font-display font-black">Detalhes do Pedido</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => generatePDF(order)} title="Baixar PDF" className="text-muted-foreground hover:text-foreground">
              <Share2 className="h-5 w-5" />
            </Button>
            <button onClick={onClose} className="text-sm font-semibold text-muted-foreground hover:text-foreground flex-shrink-0">Fechar</button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col gap-1">
            <h3 className="font-bold text-lg leading-tight flex items-center gap-2 flex-wrap">
               Pedido #{order.id.split("-")[0]}
               {order.is_presential && <span className="bg-primary/15 text-primary px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide">Venda Presencial</span>}
            </h3>
            <p className="text-sm text-muted-foreground font-medium">Criado em: {new Date(order.created_at).toLocaleString('pt-BR')}</p>
            
            {order.status === 'completed' && order.completed_at && (
               <p className="text-sm text-green-600 font-medium">Concluído em: {new Date(order.completed_at).toLocaleString('pt-BR')}</p>
            )}

            {order.status === 'canceled' && order.canceled_at && (
               <p className="text-sm text-destructive font-medium">Cancelado em: {new Date(order.canceled_at).toLocaleString('pt-BR')}</p>
            )}

            {order.vip_code && (
              <p className="text-sm font-bold text-green-600 mt-1">Acesso VIP: {order.vip_code}</p>
            )}
            {order.status === 'canceled' && order.cancellation_reason && (
              <div className="mt-2 bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
                 <p className="text-xs font-bold text-destructive uppercase tracking-wide">Motivo do Cancelamento</p>
                 <p className="text-sm font-medium mt-1 break-words whitespace-pre-wrap">{order.cancellation_reason}</p>
              </div>
            )}
          </div>

          <div>
            <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3">Itens do Pedido</h4>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm border-b border-border pb-2 gap-4">
                  <div className="flex gap-2 min-w-0">
                    <span className="font-bold flex-shrink-0">{item.quantity}x</span>
                    <span className="font-medium line-clamp-2 break-words" title={item.name}>{item.name}</span>
                  </div>
                  <span className="font-bold text-muted-foreground flex-shrink-0">{brl((Number(item.price || 0)) * Number(item.quantity || 0))}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-secondary/30 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-muted-foreground">Soma dos Itens</span>
              <span className="font-bold text-foreground">{brl(originalTotal)}</span>
            </div>

            {isPending ? (
              <>
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <Label>Valor Final (Desconto)</Label>
                  <div className="relative">
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
                      className="pl-9 font-black text-lg h-12"
                      disabled={showCancelConfirm || showCompleteConfirm}
                    />
                  </div>
                </div>
                {discountVal > 0 && (
                  <div className="text-sm font-bold text-green-600 bg-green-500/10 px-3 py-2 rounded-lg text-center">
                    Desconto aplicado: {brl(discountVal)} ({discountPerc.toFixed(1)}%)
                  </div>
                )}
                {discountVal < 0 && (
                  <div className="text-sm font-bold text-yellow-600 bg-yellow-500/10 px-3 py-2 rounded-lg text-center">
                    Acréscimo aplicado: {brl(Math.abs(discountVal))}
                  </div>
                )}
              </>
            ) : (
              <div className="pt-2 border-t border-border space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold uppercase text-xs tracking-wide">Total Cobrado</span>
                  <span className="font-black text-xl text-primary">{brl(order.total)}</span>
                </div>
                {(originalTotal - order.total) > 0 && (
                  <div className="text-xs font-bold text-green-600 text-right">
                    Desconto de {brl(originalTotal - order.total)} dado na venda.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isPending && !showCancelConfirm && !showCompleteConfirm && (
          <div className="flex flex-col sm:flex-row justify-end gap-3 px-6 py-4 border-t border-border bg-secondary/10">
            <Button variant="outline" onClick={() => setShowCancelConfirm(true)} disabled={saving} className="rounded-full shadow-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 flex-shrink-0">
              Cancelar Pedido
            </Button>
            <Button onClick={() => setShowCompleteConfirm(true)} disabled={saving || parsedTotal < 0} className="rounded-full shadow-sm bg-primary text-primary-foreground hover:opacity-90 flex-shrink-0">
              Concluir Pedido
            </Button>
          </div>
        )}

        {isPending && showCancelConfirm && (
          <div className="flex flex-col gap-3 px-6 py-4 border-t border-border bg-destructive/5 animate-in fade-in zoom-in-95 duration-200">
             <Label className="text-destructive font-bold">Confirmação de Cancelamento</Label>
             <p className="text-xs text-muted-foreground font-semibold -mt-2">O estoque será devolvido automaticamente.</p>
             <Textarea placeholder="Motivo do cancelamento (opcional)" value={cancelReason} onChange={e => setCancelReason(e.target.value)} maxLength={255} className="resize-y min-h-[80px] max-h-[200px]" />
             <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => setShowCancelConfirm(false)} disabled={saving} className="rounded-full shadow-sm flex-shrink-0">Voltar</Button>
                <Button variant="destructive" onClick={handleCancelar} disabled={saving} className="rounded-full shadow-sm flex-shrink-0">
                   {saving ? "Cancelando..." : "Confirmar Exclusão"}
                </Button>
             </div>
          </div>
        )}

        {isPending && showCompleteConfirm && (
          <div className="flex flex-col gap-3 px-6 py-4 border-t border-border bg-green-500/5 animate-in fade-in zoom-in-95 duration-200">
             <Label className="text-primary font-bold flex items-center gap-1.5"><CheckCircle className="h-4 w-4"/> Confirmação de Conclusão</Label>
             <p className="text-xs text-muted-foreground font-semibold -mt-2 mb-1">O pedido será marcado como pago e contabilizado nas vendas.</p>
             <div className="flex justify-end gap-2 mt-2">
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

function ManualOrderModal({ onClose, onSaved }: { onClose: () => void, onSaved: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  
  const [productDetailsToShow, setProductDetailsToShow] = useState<Product | null>(null);

  const originalTotal = cart.reduce((acc, item) => acc + (Number(item.product.sale_price) || Number(item.product.price)) * item.quantity, 0);
  const [customTotal, setCustomTotal] = useState("");
  const [isCustomTotalDirty, setIsCustomTotalDirty] = useState(false);
  
  const parsedTotal = Number(customTotal) || 0;
  const discountVal = originalTotal - parsedTotal;
  const discountPerc = originalTotal > 0 ? (discountVal / originalTotal) * 100 : 0;

  useEffect(() => {
      supabase.from("products").select("*").is("deleted_at", null).order("name").then(({data}) => setProducts(data as Product[] || []));
  }, []);

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

  const save = async () => {
      if (cart.length === 0) return;

      const rawTotal = customTotal.trim();
      if (rawTotal === "" || rawTotal === "," || rawTotal === ".") {
          toast.error("Valor final inválido. Por favor, insira um número válido.");
          return;
      }

      setSaving(true);
      const finalParsedTotal = Number(rawTotal) || 0;

      const itemsJson = cart.map(c => ({
          id: c.product.id,
          name: c.product.name,
          price: Number(c.product.sale_price) || Number(c.product.price),
          quantity: c.quantity,
          category_id: c.product.category_id
      }));
      
      const { error } = await supabase.rpc("checkout_presential_order", { order_total: finalParsedTotal, order_items: itemsJson });
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
     if (!exactSearch) return true;
     if (p.barcode && p.barcode === exactSearch) return true;
     return p.name.toLowerCase().includes(q);
  });

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-sm">
         <ScrollLock />
         <div className="bg-background w-full max-w-4xl rounded-2xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden">
             <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0">
                <h2 className="text-xl font-display font-black">Nova Venda Presencial</h2>
                <button onClick={onClose} className="text-sm font-semibold text-muted-foreground hover:text-foreground flex-shrink-0">Fechar</button>
             </div>
             
             <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col sm:flex-row min-h-0">
                 <div className="w-full sm:w-3/5 p-6 border-b sm:border-b-0 sm:border-r border-border flex flex-col min-w-0">
                     <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex-shrink-0">Produtos Disponíveis</h3>
                     <div className="relative mb-4 flex-shrink-0">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                         <Input placeholder="Buscar por nome ou código de barras..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" maxLength={100} />
                     </div>
                     <div className="grid gap-2 overflow-y-auto overflow-x-hidden flex-1 pr-1 min-w-0">
                     {filteredProducts.map(p => {
                         const outOfStock = p.track_stock && p.stock <= 0;
                         const isLowStock = !outOfStock && p.track_stock && p.stock <= (p.min_stock || 0);
                         return (
                         <div key={p.id} className={"flex justify-between border p-3 rounded-xl items-center shadow-sm transition gap-3 min-w-0 " + (outOfStock ? "opacity-50 bg-secondary border-border" : isLowStock ? "border-yellow-600 ring-1 ring-yellow-600/50 bg-yellow-500/5" : "bg-card border-border")}>
                             <div className="flex items-center flex-shrink-0">
                                <Button size="sm" onClick={() => addToCart(p)} disabled={outOfStock} className="rounded-full h-8 px-3 shadow-sm">
                                    <Plus className="h-3 w-3" />
                                </Button>
                             </div>
                             <div className="min-w-0 flex-1 overflow-hidden">
                                <div 
                                    className="font-semibold text-sm line-clamp-2 break-words cursor-pointer hover:text-primary transition-colors block w-full" 
                                    onClick={() => setProductDetailsToShow(p)} 
                                    title="Clique para ver os detalhes"
                                >
                                    {p.name}
                                </div>
                                <div className="text-xs font-semibold text-muted-foreground mt-0.5">Estoque: {p.track_stock ? p.stock : '∞ Ilimitado'}</div>
                             </div>
                             <div className="flex items-center flex-shrink-0">
                                <span className="font-bold text-primary">{brl(Number(p.sale_price) || Number(p.price))}</span>
                             </div>
                         </div>
                     )})}
                     {filteredProducts.length === 0 && <p className="text-sm font-semibold text-muted-foreground text-center py-4">Nenhum produto encontrado.</p>}
                     </div>
                 </div>
                 <div className="w-full sm:w-2/5 p-6 bg-secondary/20 flex flex-col min-w-0">
                     <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex-shrink-0">Carrinho</h3>
                     {cart.length === 0 && <p className="text-sm font-medium text-muted-foreground flex-shrink-0">O carrinho está vazio.</p>}
                     <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-1 min-w-0">
                     {cart.map(c => {
                         const currentMax = c.product.track_stock ? c.product.stock : 999999;
                         return (
                         <div key={c.product.id} className="flex flex-col text-sm border-b border-border/50 pb-3 min-w-0 overflow-hidden">
                             <div 
                                className="font-semibold line-clamp-2 break-words cursor-pointer hover:text-primary transition-colors block w-full" 
                                onClick={() => setProductDetailsToShow(c.product)}
                                title="Clique para ver os detalhes"
                             >
                                {c.product.name}
                             </div>
                             <div className="flex justify-between items-center mt-2 gap-2">
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button onClick={() => removeFromCart(c.product)} className="bg-secondary text-foreground rounded-full w-7 h-7 flex items-center justify-center border border-border hover:bg-border transition shadow-sm flex-shrink-0">-</button>
                                    <span className="w-4 text-center font-bold flex-shrink-0">{c.quantity}</span>
                                    <button onClick={() => addToCart(c.product)} disabled={c.quantity >= currentMax} className="bg-secondary text-foreground rounded-full w-7 h-7 flex items-center justify-center border border-border hover:bg-border transition disabled:opacity-50 shadow-sm flex-shrink-0">+</button>
                                </div>
                                <span className="font-bold text-primary flex-shrink-0">{brl((Number(c.product.sale_price) || Number(c.product.price)) * c.quantity)}</span>
                             </div>
                         </div>
                     )})}
                     </div>
                     <div className="pt-4 mt-4 border-t border-border flex flex-col gap-2 flex-shrink-0">
                         <div className="flex justify-between text-sm text-muted-foreground font-semibold">
                             <span>Soma dos Itens</span>
                             <span>{brl(originalTotal)}</span>
                         </div>
                         <div className="flex justify-between items-center mt-1 gap-2">
                            <Label className="text-base font-black flex-shrink-0">Valor Final (R$)</Label>
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
                               className="w-32 font-black text-right h-10 flex-shrink-0" 
                               disabled={cart.length === 0}
                            />
                         </div>
                         {discountVal > 0 && (
                            <div className="text-sm font-bold text-green-600 bg-green-500/10 px-3 py-2 rounded-lg text-center mt-2">
                                Desconto aplicado: {brl(discountVal)} ({discountPerc.toFixed(1)}%)
                            </div>
                         )}
                         {discountVal < 0 && (
                            <div className="text-sm font-bold text-yellow-600 bg-yellow-500/10 px-3 py-2 rounded-lg text-center mt-2">
                                Acréscimo aplicado: {brl(Math.abs(discountVal))}
                            </div>
                         )}
                     </div>
                 </div>
             </div>
             <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
                 <Button variant="outline" onClick={onClose} className="rounded-full shadow-sm flex-shrink-0">Cancelar</Button>
                 <Button onClick={save} disabled={cart.length === 0 || saving} className="rounded-full shadow-sm flex-shrink-0">{saving ? "Processando..." : "Concluir Venda"}</Button>
             </div>
         </div>

         {/* Pop-up de detalhes do produto do pedido manual */}
         {productDetailsToShow && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <ScrollLock />
                <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
                    <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                        <h3 className="text-lg font-black font-display break-words whitespace-normal leading-tight flex-1 min-w-0">{productDetailsToShow.name}</h3>
                        <button onClick={() => setProductDetailsToShow(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-1"><X className="h-5 w-5"/></button>
                    </div>
                    
                    <div className="flex flex-col gap-3 text-sm">
                        {productDetailsToShow.image_url && (
                           <img src={productDetailsToShow.image_url} alt={productDetailsToShow.name} className="w-full h-40 object-cover rounded-xl border border-border flex-shrink-0" />
                        )}
                        <div className="flex justify-between border-b border-border pb-2 mt-1 gap-2">
                           <span className="text-muted-foreground font-semibold flex-shrink-0">Preço:</span>
                           <span className="font-bold text-primary text-right break-words min-w-0">
                              {productDetailsToShow.sale_price ? (
                                 <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                                    <span className="text-xs line-through text-muted-foreground">{brl(Number(productDetailsToShow.price))}</span>
                                    <span>{brl(Number(productDetailsToShow.sale_price))}</span>
                                 </div>
                              ) : brl(Number(productDetailsToShow.price))}
                           </span>
                        </div>
                        <div className="flex justify-between border-b border-border pb-2 gap-2">
                           <span className="text-muted-foreground font-semibold flex-shrink-0">Estoque atual:</span>
                           <span className="font-bold text-right break-words min-w-0">{productDetailsToShow.track_stock ? `${productDetailsToShow.stock} un.` : '∞ Ilimitado'}</span>
                        </div>
                        {productDetailsToShow.barcode && (
                           <div className="flex justify-between border-b border-border pb-2 gap-2">
                              <span className="text-muted-foreground font-semibold flex-shrink-0">Cód. Barras:</span>
                              <span className="font-bold break-all text-right min-w-0">{productDetailsToShow.barcode}</span>
                           </div>
                        )}
                        {productDetailsToShow.description && (
                           <div className="mt-1">
                              <span className="text-muted-foreground font-semibold">Descrição:</span>
                              <p className="mt-1 font-medium text-muted-foreground break-words whitespace-normal">{productDetailsToShow.description}</p>
                           </div>
                        )}
                    </div>
                    
                    <div className="flex justify-end mt-2 pt-2 flex-shrink-0">
                        <Button onClick={() => setProductDetailsToShow(null)} className="rounded-full shadow-sm w-full">Fechar</Button>
                    </div>
                </div>
            </div>
         )}
      </div>
  );
}

/* ---------- Finances ---------- */
function FinancesPanel() {
  const [periodPreset, setPeriodPreset] = useState("30d");
  const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [globalStats, setGlobalStats] = useState({ revenue: 0, orders: 0, cost: 0 });
  const [loading, setLoading] = useState(false);
  const [activeChartBar, setActiveChartBar] = useState<string | null>(null);

  useEffect(() => {
      setLoading(true);
      Promise.all([
          supabase.from("orders")
              .select("*")
              .eq("status", "completed")
              .gte("created_at", `${startDate}T00:00:00Z`)
              .lte("created_at", `${endDate}T23:59:59Z`),
          supabase.from("products").select("*").is("deleted_at", null),
          supabase.from("orders").select("total, items").eq("status", "completed")
      ]).then(([ordersRes, prodsRes, globalRes]) => {
          setOrders((ordersRes.data as OrderRow[]) || []);
          setProducts(prodsRes.data as Product[] || []);
          if (globalRes.data) {
              let rev = 0;
              let cost = 0;
              globalRes.data.forEach(o => {
                  rev += Number(o.total);
                  if (Array.isArray(o.items)) {
                      o.items.forEach((i: any) => {
                          const p = (prodsRes.data as Product[]).find(prod => prod.id === i.id);
                          const c = p ? Number(p.cost) : 0;
                          cost += c * (Number(i.quantity) || 0);
                      });
                  }
              });
              setGlobalStats({ revenue: rev, orders: globalRes.data.length, cost: cost });
          }
          setLoading(false);
      });
  }, [startDate, endDate]);

  function applyPreset(preset: string) {
    setPeriodPreset(preset);
    const end = new Date();
    const start = new Date();
    if (preset === 'today') {
        // keep start = today
    } else if (preset === '7d') {
        start.setDate(end.getDate() - 7);
    } else if (preset === '30d') {
        start.setDate(end.getDate() - 30);
    } else if (preset === 'month') {
        start.setDate(1);
    } else if (preset === 'year') {
        start.setMonth(0, 1);
    } else if (preset === 'all') {
        start.setFullYear(2000, 0, 1);
    }
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }

  const totalEarned = orders.reduce((acc, o) => acc + Number(o.total), 0);
  const totalOrders = orders.length;
  const ticketMedio = totalOrders > 0 ? totalEarned / totalOrders : 0;
  
  let totalItemsSold = 0;
  let totalCosts = 0;
  const itemStats: Record<string, { name: string, qty: number, revenue: number }> = {};
  const soldProductIds = new Set<string>();

  orders.forEach(o => {
      if (Array.isArray(o.items)) {
          o.items.forEach((i: any) => {
              const qty = Number(i.quantity) || 0;
              const price = Number(i.price) || 0;
              
              const p = products.find(prod => prod.id === i.id);
              const cost = p ? Number(p.cost) : 0;
              totalCosts += (cost * qty);

              totalItemsSold += qty;
              if (i.id) soldProductIds.add(i.id);

              if (!itemStats[i.id]) {
                  itemStats[i.id] = { name: i.name, qty: 0, revenue: 0 };
              }
              itemStats[i.id].qty += qty;
              itemStats[i.id].revenue += (price * qty);
          });
      }
  });

  const netProfit = totalEarned - totalCosts;
  const itensPorVenda = totalOrders > 0 ? totalItemsSold / totalOrders : 0;

  let capitalCusto = 0;
  let capitalVenda = 0;
  let totalFisico = 0;
  const criticalStock: Product[] = [];
  const deadStock: Product[] = [];

  products.forEach(p => {
     const pStock = Number(p.stock) || 0;
     if (p.in_stock && p.track_stock && pStock > 0) {
        capitalCusto += pStock * (Number(p.cost) || 0);
        const effPrice = Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price) ? Number(p.sale_price) : Number(p.price);
        capitalVenda += pStock * effPrice;
        totalFisico += pStock;

        if (pStock <= (p.min_stock || 0)) {
           criticalStock.push(p);
        }
        if (!soldProductIds.has(p.id)) {
           deadStock.push(p);
        }
     }
  });

  const chartMap = new Map<string, number>();
  [...orders].reverse().forEach(o => {
     const d = new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
     chartMap.set(d, (chartMap.get(d) || 0) + Number(o.total));
  });
  const chartData = Array.from(chartMap.entries()).map(([date, total]) => ({ date, total }));
  const maxChartVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.total)) : 1;

  const top10 = Object.values(itemStats).sort((a, b) => b.qty - a.qty).slice(0, 10);

  return (
      <div className="space-y-6">
          <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
            <div className="flex gap-2 p-1 bg-secondary rounded-lg border border-border w-full xl:w-auto overflow-x-auto">
                <button onClick={() => applyPreset('today')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap ${periodPreset === 'today' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Hoje</button>
                <button onClick={() => applyPreset('7d')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap ${periodPreset === '7d' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>7 Dias</button>
                <button onClick={() => applyPreset('30d')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap ${periodPreset === '30d' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>30 Dias</button>
                <button onClick={() => applyPreset('month')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap ${periodPreset === 'month' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Este Mês</button>
                <button onClick={() => applyPreset('year')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap ${periodPreset === 'year' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Este Ano</button>
                <button onClick={() => applyPreset('all')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap ${periodPreset === 'all' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Desde o começo</button>
            </div>
            <div className="flex items-center gap-2 w-full xl:w-auto">
                <Input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setPeriodPreset('custom');}} className="h-9 text-sm w-full" />
                <span className="text-muted-foreground text-sm font-semibold">até</span>
                <Input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setPeriodPreset('custom');}} className="h-9 text-sm w-full" />
            </div>
          </div>

          {loading ? (
              <p className="text-muted-foreground text-center font-semibold py-10">Carregando métricas financeiras...</p>
          ) : (
              <>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm break-words">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-primary"/> Faturamento Bruto</h3>
                      <p className="text-xl sm:text-2xl font-black mt-2 text-foreground">{brl(totalEarned)}</p>
                    </div>
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm break-words">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><DollarSign className="h-3.5 w-3.5 text-green-600"/> Lucro Líquido</h3>
                      <p className="text-xl sm:text-2xl font-black mt-2 text-green-600">{brl(netProfit)}</p>
                    </div>
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm break-words">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5 text-accent-foreground"/> Vendas</h3>
                      <p className="text-xl sm:text-2xl font-black mt-2 text-foreground">{totalOrders}</p>
                    </div>
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm break-words">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><DollarSign className="h-3.5 w-3.5 text-green-600"/> Ticket Médio</h3>
                      <p className="text-xl sm:text-2xl font-black mt-2 text-green-600">{brl(ticketMedio)}</p>
                    </div>
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm break-words">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-blue-600"/> Itens por Venda</h3>
                      <p className="text-xl sm:text-2xl font-black mt-2 text-blue-600">{itensPorVenda.toFixed(1)}</p>
                    </div>
                  </div>

                  <h2 className="text-lg font-display font-black mt-8 mb-4 border-b border-border pb-2">Posição de Estoque Físico</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm flex items-center justify-between break-words">
                       <div>
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Capital Imobilizado</h3>
                          <div className="flex items-baseline gap-2">
                             <span className="text-2xl font-black text-foreground">{brl(capitalCusto)}</span>
                             <span className="text-xs font-semibold text-muted-foreground">a preço de custo</span>
                          </div>
                          <p className="text-xs font-bold text-green-600 mt-1">Potencial de Venda: {brl(capitalVenda)}</p>
                       </div>
                       <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"><Package className="h-6 w-6 text-muted-foreground"/></div>
                    </div>
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm flex items-center justify-between break-words">
                       <div>
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Volume Físico</h3>
                          <p className="text-2xl font-black text-foreground">{totalFisico} <span className="text-sm font-semibold text-muted-foreground">unidades</span></p>
                       </div>
                       <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"><Layers className="h-6 w-6 text-muted-foreground"/></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm flex flex-col">
                       <h3 className="text-sm font-bold uppercase tracking-wide mb-4">Faturamento Diário (Período)</h3>
                       {chartData.length === 0 ? (
                          <p className="text-xs text-muted-foreground m-auto">Sem dados para o gráfico.</p>
                       ) : (
                          <div className="flex h-48 items-end gap-1 sm:gap-2 mt-auto">
                            {chartData.map(d => {
                               const isActive = activeChartBar === d.date;
                               return (
                               <div 
                                 key={d.date} 
                                 className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer"
                                 onClick={() => setActiveChartBar(isActive ? null : d.date)}
                               >
                                  <div className={`absolute bottom-full mb-2 ${isActive ? 'block' : 'hidden group-hover:block'} bg-foreground text-background text-xs font-bold py-1 px-2 rounded whitespace-nowrap z-10 shadow-xl`}>
                                     {d.date}: {brl(d.total)}
                                  </div>
                                  <div className={`w-full rounded-t-sm transition-all ${isActive ? 'bg-primary' : 'bg-primary/30 group-hover:bg-primary'}`} style={{ height: `${(d.total / maxChartVal) * 100}%`, minHeight: '4px' }}></div>
                                  <span className="text-[9px] text-muted-foreground mt-2 truncate w-full text-center hidden sm:block">{d.date.substring(0, 5)}</span>
                               </div>
                            )})}
                          </div>
                       )}
                    </div>

                    <div className="border border-border bg-card rounded-xl overflow-hidden shadow-sm flex flex-col break-words">
                       <div className="bg-secondary/50 px-5 py-3 border-b border-border">
                           <h3 className="text-sm font-bold uppercase tracking-wide">Top 10 Produtos (Curva ABC)</h3>
                       </div>
                       <div className="flex-1 overflow-y-auto" style={{ maxHeight: '240px' }}>
                          {top10.length === 0 ? (
                              <p className="p-5 text-center text-muted-foreground text-xs font-semibold">Nenhuma venda no período.</p>
                          ) : (
                              <div className="divide-y divide-border">
                                  {top10.map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-3 px-5 hover:bg-secondary/20 transition gap-2">
                                          <div className="flex items-center gap-3 min-w-0">
                                              <span className="flex items-center justify-center h-6 w-6 flex-shrink-0 rounded-full bg-secondary text-xs font-black text-muted-foreground">
                                                  {idx + 1}
                                              </span>
                                              <span className="font-semibold text-sm line-clamp-1 break-words">{item.name}</span>
                                          </div>
                                          <div className="text-right flex-shrink-0">
                                              <div className="font-black text-primary text-sm">{item.qty} un.</div>
                                              <div className="text-[10px] font-semibold text-muted-foreground">{brl(item.revenue)}</div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                     <div className="border border-border bg-card rounded-xl overflow-hidden shadow-sm flex flex-col break-words">
                       <div className="bg-red-500/10 px-5 py-3 border-b border-border flex items-center gap-2 text-red-600">
                           <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                           <h3 className="text-sm font-bold uppercase tracking-wide">Alerta de Estoque Crítico</h3>
                       </div>
                       <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                           {criticalStock.length === 0 ? (
                              <p className="p-5 text-center text-muted-foreground text-xs font-semibold">Nenhum produto em nível crítico de estoque.</p>
                           ) : (
                              <div className="divide-y divide-border">
                                 {criticalStock.map(p => (
                                    <div key={p.id} className="flex justify-between p-3 px-5 text-sm hover:bg-secondary/20 transition gap-2">
                                       <span className="font-semibold text-foreground line-clamp-1 break-words">{p.name}</span>
                                       <span className="font-black text-red-600 whitespace-nowrap flex-shrink-0">{p.stock} un.</span>
                                    </div>
                                 ))}
                              </div>
                           )}
                       </div>
                     </div>

                     <div className="border border-border bg-card rounded-xl overflow-hidden shadow-sm flex flex-col break-words">
                       <div className="bg-orange-500/10 px-5 py-3 border-b border-border flex items-center gap-2 text-orange-600">
                           <Clock className="h-4 w-4 flex-shrink-0" />
                           <h3 className="text-sm font-bold uppercase tracking-wide">Baixo Giro Físico (Encalhados)</h3>
                       </div>
                       <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                           {deadStock.length === 0 ? (
                              <p className="p-5 text-center text-muted-foreground text-xs font-semibold">Todos os produtos físicos em estoque tiveram saída no período.</p>
                           ) : (
                              <div className="divide-y divide-border">
                                 {deadStock.slice(0, 50).map(p => (
                                    <div key={p.id} className="flex justify-between p-3 px-5 text-sm hover:bg-secondary/20 transition gap-2">
                                       <span className="font-semibold text-foreground line-clamp-1 break-words">{p.name}</span>
                                       <span className="font-black text-orange-600 whitespace-nowrap flex-shrink-0">Estoque: {p.stock}</span>
                                    </div>
                                 ))}
                                 {deadStock.length > 50 && (
                                    <div className="p-2 text-center text-xs font-bold text-muted-foreground bg-secondary/30">
                                       + {deadStock.length - 50} outros itens
                                    </div>
                                 )}
                              </div>
                           )}
                       </div>
                     </div>
                  </div>
              </>
          )}
      </div>
  );
}

/* ---------- Categories ---------- */
function CategoriesPanel({ isMaster, currentUserName }: { isMaster: boolean, currentUserName: string }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [isVip, setIsVip] = useState(false);
  
  // Estado para Edição da Categoria no Modal
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatVip, setEditCatVip] = useState(false);

  // Estado para Modal de Confirmação de Exclusão (sobreposto)
  const [deletingCat, setDeletingCat] = useState<{ cat: Category, warning?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("categories").select("*").is("deleted_at", null).order("sort_order");
    setCats((data as Category[]) ?? []);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

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
    toast.success("Categoria criada");
    refresh();
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
    const { count, error: countErr } = await supabase.from("products").select("id", { count: 'exact', head: true }).eq("category_id", c.id).is("deleted_at", null);
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
    
    await supabase.from("products").update({ category_id: null }).eq("category_id", c.id).is("deleted_at", null);
    const { error } = await supabase.from("categories").update({ deleted_at: new Date().toISOString(), deleted_by_name: currentUserName }).eq("id", c.id);
    
    setIsDeleting(false);
    setDeletingCat(null);
    setEditingCat(null); // Fecha o modal de edição se estiver aberto
    
    if (error) return toast.error(error.message);
    toast.success("Categoria removida");
    refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="flex flex-col sm:flex-row gap-3 rounded-xl border border-border bg-card p-4 shadow-sm items-start sm:items-center">
        <div className="flex-1 w-full">
           <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da categoria (ex: Doces)" required maxLength={50} />
        </div>
        <div className="flex items-center gap-2 bg-secondary/50 px-3 py-2 rounded-lg border border-border flex-shrink-0 w-full sm:w-auto">
           <Switch checked={isVip} onCheckedChange={setIsVip} id="new-vip-switch" />
           <Label htmlFor="new-vip-switch" className="text-xs font-bold cursor-pointer whitespace-nowrap flex items-center gap-1.5"><Crown className="h-3.5 w-3.5 text-yellow-600"/> Área Exclusiva</Label>
        </div>
        <Button type="submit" className="rounded-full shadow-sm flex-shrink-0 w-full sm:w-auto"><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
      </form>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {cats.length === 0 && <li className="p-6 text-center text-muted-foreground font-medium">Nenhuma categoria ainda.</li>}
        {cats.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 p-4 break-words">
            <span className="font-semibold break-words flex items-center gap-2">
               {c.is_vip && <span title="Área Exclusiva" className="flex items-center flex-shrink-0"><Crown className="h-4 w-4 text-yellow-500" /></span>}
               {c.name}
            </span>
            <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="flex-shrink-0"><Pencil className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>

      {editingCat && !deletingCat && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-sm">
            <ScrollLock />
            <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto break-words">
               <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black font-display">Editar Categoria</h3>
                  <button type="button" onClick={() => setEditingCat(null)} className="text-sm font-semibold text-muted-foreground hover:text-foreground flex-shrink-0"><X className="h-4 w-4"/></button>
               </div>
               <form onSubmit={handleRenameCat} className="flex flex-col gap-4">
                  <div>
                     <Label>Nome da categoria <span className="text-destructive">*</span></Label>
                     <Input value={editCatName} onChange={e => setEditCatName(e.target.value)} className="mt-1" autoFocus required maxLength={50} />
                  </div>
                  <div className="flex items-center justify-between bg-secondary/30 p-3 rounded-lg border border-border">
                     <div>
                        <Label className="font-bold flex items-center gap-1.5"><Crown className="h-4 w-4 text-yellow-600"/> Área Exclusiva</Label>
                        <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">Exige senha VIP para acessar.</p>
                     </div>
                     <Switch checked={editCatVip} onCheckedChange={setEditCatVip} />
                  </div>
                  <div className="flex justify-between border-t border-border pt-4 mt-2">
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

/* ---------- Products ---------- */
function ProductsPanel({ isMaster, currentUserName }: { isMaster: boolean, currentUserName: string }) {
  const [prods, setProds] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterOption, setFilterOption] = useState("all");

  const refresh = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from("products").select("*").is("deleted_at", null).order("sort_order"),
      supabase.from("categories").select("*").is("deleted_at", null).order("sort_order"),
    ]);
    setProds((p.data ?? []) as Product[]);
    setCats((c.data as Category[]) ?? []);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

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
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xl flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou código de barras..."
              className="pl-9 shadow-sm"
              maxLength={100}
            />
          </div>
          <select
            value={filterOption}
            onChange={(e) => setFilterOption(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input"
          >
            <option value="all">Todos os produtos</option>
            <option value="none">Sem categoria</option>
            <option value="out_of_stock">Sem estoque</option>
            <option value="low_stock">Estoque mínimo atingido</option>
            <option value="inactive">Inativos</option>
            {activeCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="rounded-full shadow-sm flex-shrink-0">
          <Plus className="mr-1 h-4 w-4" /> Novo produto
        </Button>
      </div>

      {prods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground font-semibold">
          Nenhum produto ainda. Adicione o primeiro!
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground font-semibold">
          Nenhum produto encontrado com este filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
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
                  "relative flex gap-3 rounded-xl border bg-card p-3 shadow-sm transition " +
                  (hasIssue ? "border-destructive/60 ring-2 ring-destructive/30 bg-destructive/5" : isLowStock ? "border-yellow-600 ring-2 ring-yellow-600/50 bg-yellow-500/5" : "border-border")
                }
              >
                <div className={"h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-secondary " + (hasIssue ? "opacity-40" : "")}>
                  {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
                </div>
                <div className={"flex flex-1 flex-col min-w-0 break-words " + (hasIssue ? "opacity-60" : "")}>
                  <div className="font-bold line-clamp-2 break-words" title={p.name}>
                     {isVipProd && <span title="Área Exclusiva"><Crown className="h-3.5 w-3.5 text-yellow-500 inline-block mr-1 align-text-bottom" /></span>}
                     {p.name}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground mt-0.5">Estoque: {p.track_stock ? p.stock : '∞ Ilimitado'}</div>
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
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="rounded-full p-1.5 hover:bg-secondary transition flex-shrink-0"><Pencil className="h-3.5 w-3.5" /></button>
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
        className="flex w-full max-w-2xl max-h-[100dvh] flex-col rounded-t-2xl bg-background shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-display text-xl font-black">{product ? "Editar" : "Novo"} produto</h3>
          <button type="button" onClick={handleAttemptClose} className="text-sm font-semibold text-muted-foreground flex-shrink-0">Fechar</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Foto</Label>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-24 w-24 overflow-hidden rounded-lg border border-border bg-secondary shadow-sm flex-shrink-0">
                {currentPreview && <img src={currentPreview} className="h-full w-full object-cover" alt="" />}
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                 <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary shadow-sm transition break-words">
                      <Upload className="h-4 w-4 flex-shrink-0" />
                      {uploading ? "Enviando…" : "Enviar imagem"}
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
                    <Button type="button" variant="ghost" onClick={undoImageChanges} className="text-xs h-7 px-2 justify-start w-max text-muted-foreground break-words whitespace-normal text-left">
                       Desfazer mudança de imagem
                    </Button>
                 )}
              </div>
            </div>
          </div>

          <div className="sm:col-span-2">
            <Label>Código de Barras</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Ex: 789102030" maxLength={50} />
          </div>
          <div className="sm:col-span-2">
            <Label>Nome <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={255} className="resize-y min-h-[80px]" />
          </div>
          <div>
            <Label>Categoria</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium"
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
          
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm sm:col-span-2 break-words gap-2 mt-2">
            <div className="min-w-0">
              <div className="font-semibold break-words">Controlar Estoque</div>
              <div className="text-xs font-semibold text-muted-foreground break-words">Desative caso este produto seja um serviço ou tenha estoque infinito.</div>
            </div>
            <Switch checked={trackStock} onCheckedChange={setTrackStock} className="flex-shrink-0" />
          </div>

          <div className={!trackStock ? "opacity-40 pointer-events-none" : "transition-opacity"}>
            <Label>Quantidade em Estoque <span className="text-destructive">*</span></Label>
            <Input type="number" min={0} value={stock} onChange={(e) => { if(e.target.value.length <= 15) setStock(e.target.value); }} onKeyDown={blockInvalidNumberChars} required disabled={!trackStock} />
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
          <div className={!trackStock ? "opacity-40 pointer-events-none" : "transition-opacity"}>
            <Label>Estoque Mínimo (Alerta) <span className="text-destructive">*</span></Label>
            <Input type="number" min={0} value={minStock} onChange={(e) => { if(e.target.value.length <= 15) setMinStock(e.target.value); }} onKeyDown={blockInvalidNumberChars} required disabled={!trackStock} />
          </div>
          <div>
            <Label>Preço de venda (R$) <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.01" min={0} value={price} onChange={(e) => { if(e.target.value.length <= 15) setPrice(e.target.value); }} onKeyDown={blockInvalidNumberChars} required />
          </div>
          <div>
            <Label>Preço promocional (R$) <span className="text-xs font-semibold text-muted-foreground">opcional</span></Label>
            <Input type="number" step="0.01" min={0} value={salePrice} onChange={(e) => { if(e.target.value.length <= 15) setSalePrice(e.target.value); }} onKeyDown={blockInvalidNumberChars} placeholder="deixe vazio se sem promoção" />
          </div>
          <div>
            <Label>Custo interno (R$) <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.01" min={0} value={cost} onChange={(e) => { if(e.target.value.length <= 15) setCost(e.target.value); }} onKeyDown={blockInvalidNumberChars} required />
          </div>
          <div>
            <Label>Limite por carrinho</Label>
            <Input type="number" min={0} value={maxPerCart} onChange={(e) => { if(e.target.value.length <= 15) setMaxPerCart(e.target.value); }} onKeyDown={blockInvalidNumberChars} />
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Deixem em 0 caso queira deixar sem limite</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm sm:col-span-2 break-words gap-2">
            <div className="min-w-0">
              <div className="font-semibold break-words">Exibir na Loja (Ativo)</div>
              <div className="text-xs font-semibold text-muted-foreground break-words">Desative para ocultar o produto completamente sem excluí-lo.</div>
            </div>
            <Switch checked={inStock} onCheckedChange={setInStock} className="flex-shrink-0" />
          </div>
        </div>
        </div>

        <div className="flex justify-between w-full border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
          <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto break-words">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display flex items-center gap-2 text-primary">
                <Package className="h-5 w-5 flex-shrink-0" /> Entrada de Estoque
              </h3>
              <button type="button" onClick={() => setShowAddStockModal(false)} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X className="h-4 w-4"/></button>
            </div>
            <p className="text-sm text-muted-foreground font-medium -mt-2 leading-relaxed">
               Adicione novas unidades e o sistema calculará o <strong>Custo Médio Ponderado</strong> automaticamente.
            </p>
            
            <div className="space-y-3">
               <div>
                  <Label>Quantidade Recebida <span className="text-destructive">*</span></Label>
                  <Input type="number" min="1" value={addStockQty} onChange={e => { if(e.target.value.length <= 15) setAddStockQty(e.target.value); }} onKeyDown={blockInvalidNumberChars} placeholder="Ex: 10" className="mt-1" autoFocus required />
               </div>
               <div>
                  <Label>Custo Unitário da Compra (R$) <span className="text-destructive">*</span></Label>
                  <Input type="number" step="0.01" min="0" value={addStockCost} onChange={e => { if(e.target.value.length <= 15) setAddStockCost(e.target.value); }} onKeyDown={blockInvalidNumberChars} className="mt-1" required />
               </div>
            </div>

            <div className="bg-secondary/30 p-3 rounded-lg border border-border mt-1 break-words">
               <div className="flex justify-between text-xs font-semibold mb-1 gap-2">
                  <span className="text-muted-foreground">Estoque atual:</span>
                  <span className="text-foreground">{parseInt(stock || "0", 10)} un</span>
               </div>
               <div className="flex justify-between text-xs font-semibold mb-2 pb-2 border-b border-border/50 gap-2">
                  <span className="text-muted-foreground">Custo atual:</span>
                  <span className="text-foreground">{brl(parseFloat(cost || "0"))}</span>
               </div>
               <div className="flex justify-between text-sm font-bold mb-1 gap-2">
                  <span className="text-muted-foreground">Novo Estoque:</span>
                  <span className="text-foreground">{(parseInt(stock || "0", 10) || 0) + (parseInt(addStockQty || "0", 10) || 0)} un</span>
               </div>
               <div className="flex justify-between text-sm font-bold gap-2">
                  <span className="text-muted-foreground">Novo Custo Médio:</span>
                  <span className="text-primary break-all text-right">
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

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" type="button" onClick={() => setShowAddStockModal(false)} className="rounded-full shadow-sm flex-shrink-0">Cancelar</Button>
              <Button type="button" onClick={confirmAddStock} disabled={!addStockQty || parseInt(addStockQty) <= 0} className="rounded-full shadow-sm bg-primary text-primary-foreground hover:opacity-90 flex-shrink-0">Aplicar Valores</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Admins ---------- */
type AdminRow = { id: string; email: string; username: string; fixed: boolean; isMaster: boolean };

function AdminsPanel({ currentUserId }: { currentUserId: string }) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminRow | null>(null);

  // Estado para Modal de Exclusão
  const [adminToDelete, setAdminToDelete] = useState<AdminRow | null>(null);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false);

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

  async function confirmDeleteAdmin() {
    if (!adminToDelete) return;
    setIsDeletingAdmin(true);
    try {
      await del({ data: { userId: adminToDelete.id } });
      toast.success("Administrador removido");
      if (adminToDelete.id === currentUserId) {
        await supabase.auth.signOut();
        window.location.reload();
        return;
      }
      refresh();
      setEditing(null); // Fecha o modal de edição se estivesse aberto
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    } finally {
      setIsDeletingAdmin(false);
      setAdminToDelete(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground break-words">
          <ShieldAlert className="mr-1 inline h-4 w-4" />
          O usuário <code className="rounded bg-secondary px-1.5 py-0.5">admin</code> é fixo e não pode ser excluído nem renomeado.
        </p>
        <Button onClick={() => setShowCreate(true)} className="rounded-full shadow-sm flex-shrink-0">
          <UserPlus className="mr-1 h-4 w-4" /> Novo administrador
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
        {loading && <li className="p-6 text-center text-muted-foreground font-semibold">Carregando…</li>}
        {!loading && admins.length === 0 && <li className="p-6 text-center text-muted-foreground font-semibold">Nenhum administrador.</li>}
        {admins.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 p-4 break-words">
            <div className="min-w-0 flex-1">
              <div className="font-semibold flex flex-wrap items-center gap-2">
                <span className="truncate break-words">{a.username}</span>
                {a.isMaster ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary">Master</span>
                ) : (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">Operador</span>
                )}
                {a.fixed && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground border border-border shadow-sm">Fixo</span>}
              </div>
              <div className="text-xs font-semibold text-muted-foreground break-all">{a.email}</div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setEditing(a)} title="Editar"><Pencil className="h-4 w-4" /></Button>
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
          onDelete={() => setAdminToDelete(editing)}
        />
      )}

      {adminToDelete && (
        <ConfirmActionModal
          title="Excluir Administrador"
          description={`Tem certeza que deseja excluir o administrador "${adminToDelete.username}"? O acesso dele ao painel será revogado imediatamente.`}
          onClose={() => setAdminToDelete(null)}
          onConfirm={confirmDeleteAdmin}
          loading={isDeletingAdmin}
          confirmText="Excluir Administrador"
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
  onDelete,
}: {
  title: string;
  editing?: AdminRow;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const isEdit = !!editing;
  const [user, setUser] = useState(editing?.username ?? "");
  const [pass, setPass] = useState("");
  const [originalPass, setOriginalPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isMasterRole, setIsMasterRole] = useState(editing?.isMaster ?? false);
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
        const payload: { userId: string; user?: string; password?: string; isMaster?: boolean } = { userId: editing.id };
        if (!editing.fixed && user.trim() && user.trim() !== editing.username) payload.user = user.trim();
        if (pass !== originalPass) {
          if (pass.length < 6) {
            setLoading(false);
            return toast.error("Senha precisa ter no mínimo 6 caracteres.");
          }
          payload.password = pass;
        }
        if (!editing.fixed && isMasterRole !== editing.isMaster) {
          payload.isMaster = isMasterRole;
        }

        if (!payload.user && !payload.password && payload.isMaster === undefined) {
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
        await create({ data: { user: user.trim(), password: pass, isMaster: isMasterRole } });
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
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-0 sm:items-center sm:p-6 backdrop-blur-sm">
      <ScrollLock />
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-t-2xl bg-background p-6 shadow-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto break-words">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-black truncate">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-muted-foreground flex-shrink-0 ml-2">Fechar</button>
        </div>
        <div>
          <Label htmlFor="au">Usuário <span className="text-destructive">*</span></Label>
          <Input
            id="au"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="ex: nome"
            disabled={isEdit && editing?.fixed}
            required
            maxLength={30}
          />
          {isEdit && editing?.fixed && (
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Esse usuário é fixo — não pode renomear.</p>
          )}
        </div>
        <div>
          <Label htmlFor="ap">Senha {(!isEdit || isEdit) && <span className="text-destructive">*</span>}</Label>
          <div className="relative">
            <Input
              id="ap"
              type={showPass ? "text" : "password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={loadingPass ? "Carregando…" : "mínimo 6 caracteres"}
              className="pr-16"
              required={!isEdit}
              maxLength={50}
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

        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm gap-2 break-words">
          <div className={(isEdit && editing?.fixed) ? "opacity-50 min-w-0" : "min-w-0"}>
            <div className="font-semibold break-words">Administrador Master</div>
            <div className="text-xs font-semibold text-muted-foreground break-words">Desative para limitar acesso.</div>
          </div>
          <Switch checked={isMasterRole || (isEdit && editing?.fixed)} onCheckedChange={setIsMasterRole} disabled={isEdit && editing?.fixed} className="flex-shrink-0" />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
          {isEdit && !editing?.fixed && onDelete ? (
            <Button type="button" variant="ghost" size="icon" onClick={onDelete} disabled={loading} className="text-destructive hover:bg-destructive/10 hover:text-destructive flex-shrink-0">
               <Trash2 className="h-5 w-5" />
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full shadow-sm flex-shrink-0">Cancelar</Button>
            <Button type="submit" disabled={loading} className="rounded-full shadow-sm flex-shrink-0">
              {loading ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------- Settings ---------- */
function SettingsPanel() {
  const [number, setNumber] = useState("");
  const [catalogName, setCatalogName] = useState("");
  const [catalogLogo, setCatalogLogo] = useState("");
  const [theme, setTheme] = useState("");
  
  // UI states for logo preview/remove
  const [previewLogo, setPreviewLogo] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const [showRemoveLogoConfirm, setShowRemoveLogoConfirm] = useState(false);
  
  // Novos estados do Modo Privado e Área Exclusiva
  const [privateMode, setPrivateMode] = useState(false);
  
  // Array com todas as senhas (buscadas direto do banco para ter acesso aos novos campos)
  const [accessCodes, setAccessCodes] = useState<{id: string, code: string, code_type: string, unlocks_vip: boolean}[]>([]);
  
  // Formulário: Senha da Loja
  const [newStoreCode, setNewStoreCode] = useState("");
  const [newStoreUnlocksVip, setNewStoreUnlocksVip] = useState(false);

  // Formulário: Senha da Área Exclusiva
  const [newVipCode, setNewVipCode] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [savingNumber, setSavingNumber] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingPrivate, setSavingPrivate] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(false);
  
  // Estado para Modal de Exclusão de Senha VIP e Validação do WPP
  const [codeToDelete, setCodeToDelete] = useState<string | null>(null);
  const [isDeletingCode, setIsDeletingCode] = useState(false);
  const [showInvalidWhatsApp, setShowInvalidWhatsApp] = useState(false);
  
  const saveNumberFn = useServerFn(updateWhatsAppNumber);
  const saveNameFn = useServerFn(updateCatalogName);
  const saveLogoFn = useServerFn(updateCatalogLogo);
  const saveThemeFn = useServerFn(updateSystemTheme);
  const savePrivateModeFn = useServerFn(updatePrivateMode);

  useEffect(() => {
    Promise.all([
      supabase.from("app_settings").select("value").eq("key", "whatsapp_number").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "catalog_name").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "system_theme").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "private_mode").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "catalog_logo").maybeSingle()
    ]).then(([waRes, catRes, themeRes, privRes, logoRes]) => {
      setNumber(waRes.data?.value ?? DEFAULT_WHATSAPP_NUMBER);
      setCatalogName(catRes.data?.value ?? "Catálogo de Produtos");
      setTheme(themeRes.data?.value ?? "strong-gray");
      setPrivateMode(privRes.data?.value === "true");
      
      const logoVal = logoRes.data?.value ?? "";
      setCatalogLogo(logoVal);
      setPreviewLogo(logoVal);
      
      setLoading(false);
    });
  }, []);

  const fetchCodes = useCallback(async () => {
    setLoadingCodes(true);
    try {
      const { data, error } = await supabase.from("access_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setAccessCodes(data as any);
    } catch(e) {
      toast.error("Erro ao carregar senhas VIP.");
    }
    setLoadingCodes(false);
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  async function submitNumber(e: React.FormEvent) {
    e.preventDefault();
    
    const cleanNumber = number.replace(/\D/g, '');
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      setShowInvalidWhatsApp(true);
      return;
    }

    setSavingNumber(true);
    try {
      const res = await saveNumberFn({ data: { number: cleanNumber } });
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

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedLogoFile(file);
    setPreviewLogo(URL.createObjectURL(file));
    setIsRemovingLogo(false);
  }

  function handleLogoRemoveClick() {
    setShowRemoveLogoConfirm(true);
  }

  function confirmRemoveLogo() {
    setPreviewLogo("");
    setSelectedLogoFile(null);
    setIsRemovingLogo(true);
    setShowRemoveLogoConfirm(false);
  }

  function undoLogoChanges() {
    setPreviewLogo(catalogLogo);
    setSelectedLogoFile(null);
    setIsRemovingLogo(false);
  }

  async function submitLogo(e: React.FormEvent) {
    e.preventDefault();
    setSavingLogo(true);
    try {
      let finalUrl = catalogLogo;

      if (isRemovingLogo) {
        finalUrl = "";
      } else if (selectedLogoFile) {
        const options = { maxSizeMB: 0.2, maxWidthOrHeight: 600, useWebWorker: true };
        const compressedFile = await imageCompression(selectedLogoFile, options);
        const ext = compressedFile.name.split(".").pop() || "png";
        const path = `logos/${crypto.randomUUID()}.${ext}`;
        
        const { error } = await supabase.storage.from("product-images").upload(path, compressedFile, { upsert: false });
        if (error) { 
          toast.error("Falha no envio da imagem"); 
          setSavingLogo(false); 
          return; 
        }
        
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        if (!data?.publicUrl) { 
          toast.error("Falha ao gerar URL"); 
          setSavingLogo(false); 
          return; 
        }
        
        finalUrl = data.publicUrl;
      }

      if (finalUrl !== catalogLogo || isRemovingLogo) {
        await saveLogoFn({ data: { logoUrl: finalUrl } });
        setCatalogLogo(finalUrl);
        setPreviewLogo(finalUrl);
        setSelectedLogoFile(null);
        setIsRemovingLogo(false);
        toast.success("Logo salva com sucesso!");
      } else {
        toast.info("Nenhuma alteração para salvar.");
      }
    } catch (error) {
      toast.error("Erro ao salvar a logo.");
    } finally {
      setSavingLogo(false);
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

  async function togglePrivateMode(checked: boolean) {
    setSavingPrivate(true);
    try {
       await savePrivateModeFn({ data: { enabled: checked } });
       setPrivateMode(checked);
       toast.success(checked ? "Loja Privada ativada." : "Loja Privada desativada.");
    } catch(err) {
       toast.error("Erro ao alterar modo.");
    }
    setSavingPrivate(false);
  }

  async function handleCreateStoreCode(e: React.FormEvent) {
    e.preventDefault();
    if (!newStoreCode.trim()) return;
    try {
      const { error } = await supabase.from("access_codes").insert({
        code: newStoreCode.trim(),
        code_type: 'store',
        unlocks_vip: newStoreUnlocksVip
      });
      if (error) throw error;
      setNewStoreCode("");
      setNewStoreUnlocksVip(false);
      toast.success("Senha da loja criada com sucesso.");
      fetchCodes();
    } catch(err: any) {
      toast.error(err.message || "Erro ao criar senha");
    }
  }

  async function handleCreateVipCode(e: React.FormEvent) {
    e.preventDefault();
    if (!newVipCode.trim()) return;
    try {
      const { error } = await supabase.from("access_codes").insert({
        code: newVipCode.trim(),
        code_type: 'vip',
        unlocks_vip: true
      });
      if (error) throw error;
      setNewVipCode("");
      toast.success("Senha da Área Exclusiva criada com sucesso.");
      fetchCodes();
    } catch(err: any) {
      toast.error(err.message || "Erro ao criar senha");
    }
  }

  function handleDeleteCode(id: string) {
    setCodeToDelete(id);
  }

  async function confirmDeleteCode() {
    if (!codeToDelete) return;
    setIsDeletingCode(true);
    try {
      const { error } = await supabase.from("access_codes").delete().eq("id", codeToDelete);
      if (error) throw error;
      toast.success("Senha revogada.");
      fetchCodes();
    } catch(err) {
      toast.error("Erro ao remover senha.");
    } finally {
      setIsDeletingCode(false);
      setCodeToDelete(null);
    }
  }

  const storeCodes = accessCodes.filter(c => c.code_type === 'store');
  const vipCodes = accessCodes.filter(c => c.code_type === 'vip');

  if (loading) return <p className="text-muted-foreground font-semibold">Carregando…</p>;

  const hasLogoChanges = selectedLogoFile !== null || isRemovingLogo;

  return (
    <div className="space-y-4">
      
      {/* Bloco de Loja Privada e Área Exclusiva */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-5 mb-5">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-black flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary flex-shrink-0" /> Loja Privada (Bloqueio Total)
            </h3>
            <p className="mt-1 text-sm font-medium text-muted-foreground break-words">
              Exija uma senha para os clientes visualizarem qualquer produto do site.
            </p>
          </div>
          <Switch checked={privateMode} onCheckedChange={togglePrivateMode} disabled={savingPrivate} className="flex-shrink-0" />
        </div>

        <div className="space-y-8">
           {/* Senhas da Loja */}
           <div>
              <h4 className="font-bold text-foreground mb-1">Senhas de Acesso à Loja</h4>
              <p className="text-xs text-muted-foreground mb-4">Crie as senhas que os clientes usarão para entrar no site.</p>
              
              <form onSubmit={handleCreateStoreCode} className="flex flex-col gap-3 mb-4 max-w-lg">
                <div className="flex gap-2">
                   <Input 
                     value={newStoreCode} 
                     onChange={e => setNewStoreCode(e.target.value)} 
                     placeholder="Ex: cliente123" 
                     className="flex-1" 
                     required
                     maxLength={20}
                   />
                   <Button type="submit" className="flex-shrink-0"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
                </div>
                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-2 rounded-lg border border-border">
                   <Switch checked={newStoreUnlocksVip} onCheckedChange={setNewStoreUnlocksVip} id="unlock-vip-switch" />
                   <Label htmlFor="unlock-vip-switch" className="text-xs font-bold cursor-pointer flex items-center gap-1.5"><Crown className="h-3.5 w-3.5 text-yellow-600"/> Esta senha também libera a Área Exclusiva</Label>
                </div>
              </form>

              {loadingCodes ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : storeCodes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhuma senha da loja cadastrada.</p>
              ) : (
                <ul className="space-y-2 max-w-lg">
                  {storeCodes.map(c => (
                    <li key={c.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-2 bg-secondary/30 gap-2">
                      <div className="min-w-0">
                         <span className="font-mono font-bold break-all block">{c.code}</span>
                         {c.unlocks_vip && <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide flex items-center gap-1 mt-0.5"><Crown className="h-3 w-3"/> Libera Área Exclusiva</span>}
                      </div>
                      <button onClick={() => handleDeleteCode(c.id)} className="text-muted-foreground hover:text-destructive p-2 rounded-full hover:bg-destructive/10 transition flex-shrink-0" title="Revogar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
           </div>

           {/* Senhas da Área Exclusiva (VIP) */}
           <div className="pt-6 border-t border-border/50">
              <h4 className="font-bold text-foreground mb-1 flex items-center gap-2"><Crown className="h-4 w-4 text-yellow-600"/> Senhas de Acesso à Área Exclusiva</h4>
              <p className="text-xs text-muted-foreground mb-4">Senhas criadas aqui liberam apenas as categorias marcadas como Área Exclusiva.</p>
              
              <form onSubmit={handleCreateVipCode} className="flex gap-2 mb-4 max-w-lg">
                <Input 
                  value={newVipCode} 
                  onChange={e => setNewVipCode(e.target.value)} 
                  placeholder="Ex: vip_premium" 
                  className="flex-1" 
                  required
                  maxLength={20}
                />
                <Button type="submit" variant="secondary" className="flex-shrink-0 bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 border border-yellow-500/30 font-bold"><Plus className="h-4 w-4 mr-1" /> Adicionar VIP</Button>
              </form>

              {loadingCodes ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : vipCodes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhuma senha exclusiva cadastrada.</p>
              ) : (
                <ul className="space-y-2 max-w-lg">
                  {vipCodes.map(c => (
                    <li key={c.id} className="flex items-center justify-between border border-yellow-500/30 rounded-lg px-4 py-2 bg-yellow-500/5 gap-2">
                      <span className="font-mono font-bold text-yellow-700 break-all">{c.code}</span>
                      <button onClick={() => handleDeleteCode(c.id)} className="text-yellow-700 hover:text-destructive p-2 rounded-full hover:bg-destructive/10 transition flex-shrink-0" title="Revogar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
           </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words">
        <h3 className="font-display text-lg font-black flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary flex-shrink-0" /> Cores do Sistema
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words">
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

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words">
        <h3 className="font-display text-lg font-black flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary flex-shrink-0" /> Nome do Catálogo
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words">
          Este é o nome que aparecerá no cabeçalho e na página inicial da loja.
        </p>
        <form onSubmit={submitName} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={catalogName}
            onChange={(e) => setCatalogName(e.target.value)}
            placeholder="ex: Catálogo de Produtos"
            className="flex-1"
            required
            maxLength={50}
          />
          <Button type="submit" disabled={savingName} className="rounded-full shadow-sm flex-shrink-0">
            {savingName ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words">
        <h3 className="font-display text-lg font-black flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary flex-shrink-0" /> Logo da Loja
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words">
          Adicione a logomarca da sua empresa. Ela aparecerá no cabeçalho do catálogo.
        </p>
        <form onSubmit={submitLogo} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-secondary shadow-sm flex items-center justify-center flex-shrink-0">
              {previewLogo ? (
                <img src={previewLogo} className="h-full w-full object-cover" alt="Logo preview" />
              ) : (
                <span className="text-xl font-black text-muted-foreground uppercase">{catalogName.charAt(0)}</span>
              )}
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary shadow-sm transition break-words">
                  <Upload className="h-4 w-4 flex-shrink-0" />
                  Escolher imagem
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} disabled={savingLogo} />
                </label>
                {previewLogo && !isRemovingLogo && (
                   <Button type="button" variant="outline" size="icon" onClick={handleLogoRemoveClick} disabled={savingLogo} className="rounded-full shadow-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                   </Button>
                )}
              </div>
              {hasLogoChanges && (
                 <Button type="button" variant="ghost" onClick={undoLogoChanges} disabled={savingLogo} className="text-xs h-7 px-2 justify-start w-max text-muted-foreground break-words whitespace-normal text-left">
                    Desfazer mudança de logo
                 </Button>
              )}
            </div>
          </div>
          <div className="flex justify-start pt-2">
            <Button type="submit" disabled={savingLogo || !hasLogoChanges} className="rounded-full shadow-sm w-full sm:w-auto">
              {savingLogo ? "Salvando…" : "Salvar Logo"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words">
        <h3 className="font-display text-lg font-black flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary flex-shrink-0" /> Número do WhatsApp
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words">
          Este é o número que receberá os pedidos do site e o botão flutuante.
        </p>
        <form onSubmit={submitNumber} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="ex: 5545912345678"
            className="flex-1"
            required
            maxLength={20}
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => {
                const cleanNumber = number.replace(/\D/g, '');
                if (cleanNumber.length < 10 || cleanNumber.length > 15) {
                  setShowInvalidWhatsApp(true);
                  return;
                }
                window.open(whatsappLink("Teste de número válido - Catálogo", cleanNumber), "_blank");
              }} className="rounded-full shadow-sm flex-1 sm:flex-auto">
              Testar número
            </Button>
            <Button type="submit" disabled={savingNumber} className="rounded-full shadow-sm flex-1 sm:flex-auto">
              {savingNumber ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
        <p className="mt-2 text-xs font-semibold text-muted-foreground break-words">
          Use o formato internacional sem espaços (DDI + DDD + número). Ex: <code>5545912345678</code>
        </p>
      </div>

      {showInvalidWhatsApp && (
        <ConfirmActionModal
          title="Número de WhatsApp Inválido"
          description="O número inserido está muito curto ou incompleto. Por favor, certifique-se de digitar o Código do País + DDD + Número. Exemplo: 5545984311918."
          onClose={() => setShowInvalidWhatsApp(false)}
          onConfirm={() => setShowInvalidWhatsApp(false)}
          destructive={true}
          confirmText="Entendi"
          alertOnly={true}
        />
      )}

      {showRemoveLogoConfirm && (
        <ConfirmActionModal
          title="Remover Logo"
          description="Tem certeza que deseja remover a logo do catálogo? A alteração só será definitiva ao clicar em 'Salvar Logo'."
          onClose={() => setShowRemoveLogoConfirm(false)}
          onConfirm={confirmRemoveLogo}
          confirmText="Remover"
        />
      )}

      {codeToDelete && (
        <ConfirmActionModal
          title="Revogar Senha"
          description="Tem certeza que deseja remover esta senha? Quem estiver usando perderá o acesso na mesma hora."
          onClose={() => setCodeToDelete(null)}
          onConfirm={confirmDeleteCode}
          loading={isDeletingCode}
          confirmText="Revogar Acesso"
        />
      )}
    </div>
  );
}