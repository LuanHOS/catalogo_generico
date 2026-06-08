import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_WHATSAPP_NUMBER = "5545984311918";

export function whatsappLink(message: string, number: string = DEFAULT_WHATSAPP_NUMBER) {
  const clean = (number || DEFAULT_WHATSAPP_NUMBER).replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

let cachedNumber: string | null = null;

export function useWhatsAppNumber() {
  const [num, setNum] = useState<string>(cachedNumber ?? DEFAULT_WHATSAPP_NUMBER);
  useEffect(() => {
    let alive = true;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "whatsapp_number")
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const v = data?.value?.trim();
        if (v) {
          cachedNumber = v;
          setNum(v);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  return num;
}