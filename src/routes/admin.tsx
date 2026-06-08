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
} from "@/lib/admin.functions";
import { brl, DEFAULT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast, Toaster } from "sonner";
import { ArrowLeft, LogOut, Plus, Pencil, Trash2, Upload, UserPlus, Phone, ShieldAlert, Search } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administração — Banca da Pamela" }] }),
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
  max_per_cart: number;
  sort_order: number;
};

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

  if (checking) return <Shell><p className="p-8 text-muted-foreground">Carregando…</p></Shell>;
  if (!session) return <Shell><LoginForm /></Shell>;
  if (isAdmin === null) return <Shell><p className="p-8 text-muted-foreground">Verificando permissões…</p></Shell>;
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
  const [email, setEmail] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const user = email.trim();
    const fullEmail = user.includes("@") ? user : `${user}@banquinha.local`;
    const { error } = await supabase.auth.signInWithPassword({ email: fullEmail, password });
    setLoading(false);
    if (error) toast.error("Login inválido", { description: error.message });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-6 sm:p-10">
      <div>
        <h1 className="font-display text-3xl font-black">Área do Administrador</h1>
        <p className="mt-1 text-sm text-muted-foreground">Entre para gerenciar o catálogo.</p>
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
        <Button type="submit" disabled={loading} className="w-full rounded-full py-6 text-base font-bold">
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
      <p className="mt-2 text-sm text-muted-foreground">
        Sua conta não tem permissão de administrador.
      </p>
      <Button onClick={() => supabase.auth.signOut()} className="mt-6 rounded-full">Sair</Button>
    </div>
  );
}

function Dashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<"products" | "categories" | "admins" | "settings">("products");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">Gerenciar Catálogo</h1>
          <p className="text-sm text-muted-foreground">Logado como <span className="font-bold text-foreground">{usernameFromEmail(email)}</span></p>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut()} className="rounded-full">
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>

      <div className="mb-6 flex gap-2 border-b border-border overflow-x-auto">
        {(["products", "categories", "admins", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "whitespace-nowrap border-b-2 px-4 py-2 text-sm font-bold transition " +
              (tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t === "products" ? "Produtos" : t === "categories" ? "Categorias" : t === "admins" ? "Administradores" : "Configurações"}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsPanel />}
      {tab === "categories" && <CategoriesPanel />}
      {tab === "admins" && <AdminsPanel />}
      {tab === "settings" && <SettingsPanel />}
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
      <form onSubmit={add} className="flex gap-2 rounded-xl border border-border bg-card p-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da categoria (ex: Doces)" />
        <Button type="submit" className="rounded-full"><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
      </form>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {cats.length === 0 && <li className="p-6 text-center text-muted-foreground">Nenhuma categoria ainda.</li>}
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
            className="pl-9"
          />
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="rounded-full">
          <Plus className="mr-1 h-4 w-4" /> Novo produto
        </Button>
      </div>

      {prods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          Nenhum produto ainda. Adicione o primeiro!
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          Nenhum produto encontrado para "{search}".
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const out = !p.in_stock;
            const promo = p.sale_price != null && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price);
            return (
              <div
                key={p.id}
                className={
                  "relative flex gap-3 rounded-xl border bg-card p-3 transition " +
                  (out ? "border-destructive/60 ring-2 ring-destructive/30 bg-destructive/5" : "border-border")
                }
              >
                <div className={"h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-secondary " + (out ? "opacity-40" : "")}>
                  {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
                </div>
                <div className={"flex flex-1 flex-col " + (out ? "opacity-60" : "")}>
                  <div className="font-bold">{p.name}</div>
                  {out && (
                    <div className="mt-0.5">
                      <span className="inline-block rounded-full bg-destructive px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-destructive-foreground">
                        Sem estoque
                      </span>
                    </div>
                  )}
                  <div className="text-sm">
                    {promo ? (
                      <>
                        <span className="text-muted-foreground line-through mr-1">{brl(Number(p.price))}</span>
                        <span className="text-primary font-black">{brl(Number(p.sale_price))}</span>
                        <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-black uppercase text-accent-foreground">Promo</span>
                      </>
                    ) : (
                      <span className="text-primary font-black">{brl(Number(p.price))}</span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-end gap-1 text-xs">
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="rounded-full p-1.5 hover:bg-secondary"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => del(p)} className="rounded-full p-1.5 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
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
  const [maxPerCart, setMaxPerCart] = useState(product ? String(product.max_per_cart) : "10");
  const [inStock, setInStock] = useState(product?.in_stock ?? true);
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function uploadImage(file: File) {
    setUploading(true);
    
    try {
      // 1. Configura a compressão da imagem
      const options = {
        maxSizeMB: 0.3, // Limite de 300KB
        maxWidthOrHeight: 1200, // Excelente resolução para web
        useWebWorker: true,
      };
      
      // 2. Executa a compressão
      const compressedFile = await imageCompression(file, options);
      
      const ext = compressedFile.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      
      // 3. Faz o upload da imagem já comprimida para o Supabase
      const { error } = await supabase.storage.from("product-images").upload(path, compressedFile, { upsert: false });
      if (error) { 
        toast.error(error.message); 
        setUploading(false); 
        return; 
      }
      
      // 4. Gera a URL pública permanente
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
      max_per_cart: Math.max(1, parseInt(maxPerCart || "10", 10)),
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
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">Fechar</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Foto</Label>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-24 w-24 overflow-hidden rounded-lg border border-border bg-secondary">
                {imageUrl && <img src={imageUrl} className="h-full w-full object-cover" alt="" />}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary">
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
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">(sem categoria)</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Limite por carrinho</Label>
            <Input type="number" min={1} value={maxPerCart} onChange={(e) => setMaxPerCart(e.target.value)} />
          </div>
          <div>
            <Label>Preço de venda (R$)</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div>
            <Label>Preço promocional (R$) <span className="text-xs text-muted-foreground">opcional</span></Label>
            <Input type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="deixe vazio se sem promoção" />
          </div>
          <div>
            <Label>Custo interno (R$)</Label>
            <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 sm:col-span-2">
            <div>
              <div className="font-semibold">Em estoque</div>
              <div className="text-xs text-muted-foreground">Produtos fora de estoque não podem ser adicionados ao carrinho.</div>
            </div>
            <Switch checked={inStock} onCheckedChange={setInStock} />
          </div>
        </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-full">Cancelar</Button>
          <Button type="submit" disabled={saving} className="rounded-full">
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
        <p className="text-sm text-muted-foreground">
          <ShieldAlert className="mr-1 inline h-4 w-4" />
          O usuário <code className="rounded bg-secondary px-1.5 py-0.5">admin</code> é fixo e não pode ser excluído nem renomeado.
        </p>
        <Button onClick={() => setShowCreate(true)} className="rounded-full">
          <UserPlus className="mr-1 h-4 w-4" /> Novo administrador
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {loading && <li className="p-6 text-center text-muted-foreground">Carregando…</li>}
        {!loading && admins.length === 0 && <li className="p-6 text-center text-muted-foreground">Nenhum administrador.</li>}
        {admins.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="font-semibold flex items-center gap-2">
                {a.username}
                {a.fixed && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase text-primary">Fixo</span>}
              </div>
              <div className="text-xs text-muted-foreground">{a.email}</div>
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
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">Fechar</button>
        </div>
        <div>
          <Label htmlFor="au">Usuário</Label>
          <Input
            id="au"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="ex: pamela"
            disabled={isEdit && editing?.fixed}
          />
          {isEdit && editing?.fixed && (
            <p className="mt-1 text-xs text-muted-foreground">Esse usuário é fixo — não pode renomear.</p>
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
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-secondary"
            >
              {showPass ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {isEdit && (
            <p className="mt-1 text-xs text-muted-foreground">
              Senha atual exibida acima. Edite para alterar.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-full">Cancelar</Button>
          <Button type="submit" disabled={loading} className="rounded-full">
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(updateWhatsAppNumber);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "whatsapp_number")
      .maybeSingle()
      .then(({ data }) => {
        setNumber(data?.value ?? DEFAULT_WHATSAPP_NUMBER);
        setLoading(false);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await save({ data: { number } });
      setNumber(res.number);
      toast.success("Número do WhatsApp atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-lg font-black flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" /> Número do WhatsApp
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Este é o número que receberá os pedidos do site e o botão flutuante.
        </p>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="ex: 5545984311918"
            className="flex-1"
          />
          <Button type="submit" disabled={saving} className="rounded-full">
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Use o formato internacional sem espaços (DDI + DDD + número). Ex: <code>5545984311918</code>
        </p>
      </div>
    </div>
  );
}