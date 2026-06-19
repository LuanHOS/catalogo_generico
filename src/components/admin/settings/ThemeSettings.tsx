import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Palette } from "lucide-react";
import { updateSystemTheme } from "@/lib/admin.functions";
import { SYSTEM_THEMES, applyTheme } from "@/routes/admin";

export function ThemeSettings() {
  const [theme, setTheme] = useState("");
  const [savingTheme, setSavingTheme] = useState(false);
  const [loading, setLoading] = useState(true);

  const saveThemeFn = useServerFn(updateSystemTheme);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "system_theme").maybeSingle().then((themeRes) => {
      setTheme(themeRes.data?.value ?? "strong-gray");
      setLoading(false);
    });
  }, []);

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
    <>
      {/* 7. Cores do Sistema */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm break-words min-w-0 max-w-full">
        <h3 className="font-display text-lg font-black flex items-center gap-2 truncate">
          <Palette className="h-5 w-5 text-primary flex-shrink-0" /> <span className="truncate">Cores do Sistema</span>
        </h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground break-words whitespace-normal">
          Personalize a aparência do seu catálogo. As alterações são aplicadas instantaneamente após salvar.
        </p>

        <form onSubmit={submitTheme} className="mt-4 space-y-6 min-w-0 max-w-full">
          <div className="min-w-0 max-w-full">
            <div className="flex flex-wrap gap-3 min-w-0">
              {SYSTEM_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTheme(t.id); applyTheme(t.id); }}
                  className={`h-10 w-10 rounded-full border-4 transition-all hover:scale-110 flex-shrink-0 ${theme === t.id ? "border-foreground scale-110 shadow-md" : "border-transparent shadow-sm"}`}
                  style={{ backgroundColor: t.primary }}
                  title={t.name}
                />
              ))}
            </div>
          </div>
          <Button type="submit" disabled={savingTheme} className="rounded-full shadow-sm w-full sm:w-auto">
            {savingTheme ? "Salvando…" : "Salvar Cores"}
          </Button>
        </form>
      </div>
    </>
  );
}