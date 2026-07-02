import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureSeedAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast, Toaster } from "sonner";
import { ArrowLeft, LogOut, AlertTriangle } from "lucide-react";

// Importando os painéis modulares que criamos
import { OrdersPanel } from "@/components/admin/OrdersPanel";
import { ProductsPanel } from "@/components/admin/ProductsPanel";
import { CategoriesPanel } from "@/components/admin/CategoriesPanel";
import { FinancesPanel } from "@/components/admin/FinancesPanel";
import { AdminsPanel } from "@/components/admin/AdminsPanel";
import { SettingsPanel } from "@/components/admin/SettingsPanel";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administração — Catálogo" }] }),
  component: AdminPage,
});

// Exportando os Tipos Globais para serem usados pelos painéis
export type Category = { id: string; name: string; sort_order: number; is_vip: boolean | null };
export type Product = {
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
  short_id: number;
  track_stock: boolean;
};
export type OrderRow = { 
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

// Configurações de Temas Globais
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

export function usernameFromEmail(email: string) {
  return email.split("@")[0] ?? email;
}

export const blockInvalidNumberChars = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['e', 'E', '+', '-'].includes(e.key)) {
    e.preventDefault();
  }
};

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <ScrollLock />
      <div className="bg-background w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto break-words min-w-0">
        <div className="min-w-0 max-w-full">
          <h3 className={`text-lg font-black font-display flex items-center gap-2 min-w-0 ${destructive ? 'text-destructive' : 'text-primary'}`}>
            {destructive && <AlertTriangle className="h-5 w-5 flex-shrink-0" />}
            <span className="truncate">{title}</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-2 font-medium leading-relaxed break-words whitespace-normal">{description}</p>
        </div>
        <div className="flex justify-end gap-2 mt-2 flex-shrink-0">
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
    <div className="min-h-screen bg-background max-w-[100vw] overflow-x-hidden">
      <Toaster position="top-center" richColors />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 min-w-0">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground flex-shrink-0">
            <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
          </Link>
          <div className="font-display text-lg font-black truncate ml-2">Painel Admin</div>
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
    <div className="mx-auto flex max-w-md flex-col gap-6 p-6 sm:p-10 min-w-0">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-black truncate">Área do Administrador</h1>
        <p className="mt-1 text-sm text-muted-foreground font-medium truncate">Entre para gerenciar o catálogo.</p>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm min-w-0">
        <div className="min-w-0">
          <Label htmlFor="u" className="truncate block">Usuário</Label>
          <Input id="u" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="" autoFocus required maxLength={30} className="w-full min-w-0" />
        </div>
        <div className="min-w-0">
          <Label htmlFor="p" className="truncate block">Senha</Label>
          <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={50} className="w-full min-w-0" />
        </div>
        <Button type="submit" disabled={loading} className="w-full rounded-full py-6 text-base font-bold shadow-sm">
          {loading ? "Entrando…" : "Entrar"}
        </Button>
        <p className="text-center text-xs text-muted-foreground font-semibold truncate">
          Apenas para Funcionários
        </p>
      </form>
    </div>
  );
}

function NotAdmin({ email }: { email: string }) {
  return (
    <div className="mx-auto max-w-md p-10 text-center min-w-0 break-words">
      <p className="text-lg font-bold truncate">Olá, {usernameFromEmail(email)}</p>
      <p className="mt-2 text-sm text-muted-foreground font-medium whitespace-normal break-words">
        Sua conta não tem permissão de administrador.
      </p>
      <Button onClick={() => supabase.auth.signOut()} className="mt-6 rounded-full shadow-sm w-full">Sair</Button>
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
    <div className="mx-auto max-w-6xl px-4 py-8 min-w-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-black truncate">Gerenciar Catálogo</h1>
          <p className="text-sm text-muted-foreground font-medium flex items-center gap-2 flex-wrap min-w-0">
            <span className="truncate">Logado como <span className="font-bold text-foreground">{usernameFromEmail(email)}</span></span>
            {isMaster ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary flex-shrink-0">Master</span>
            ) : (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground flex-shrink-0">Operador</span>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut()} className="rounded-full shadow-sm flex-shrink-0">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>

      <div className="mb-6 flex gap-2 border-b border-border overflow-x-auto min-w-0">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "whitespace-nowrap border-b-2 px-4 py-2 text-sm font-bold transition flex-shrink-0 " +
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

      <div className="min-w-0 max-w-full">
        {tab === "orders" && <OrdersPanel onStatusChange={fetchPendingCount} currentUserName={currentUserName} />}
        {tab === "products" && <ProductsPanel isMaster={isMaster} currentUserName={currentUserName} />}
        {tab === "categories" && <CategoriesPanel isMaster={isMaster} currentUserName={currentUserName} />}
        {tab === "finances" && isMaster && <FinancesPanel />}
        {tab === "admins" && isMaster && <AdminsPanel currentUserId={currentUserId} />}
        {tab === "settings" && isMaster && <SettingsPanel />}
      </div>
    </div>
  );
}