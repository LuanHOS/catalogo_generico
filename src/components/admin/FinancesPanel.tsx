import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { TrendingUp, DollarSign, ShoppingBag, Layers, Package, Clock, AlertTriangle } from "lucide-react";
import { brl } from "@/lib/whatsapp";

// Importações dos tipos e utilitários compartilhados do arquivo admin principal
import { Product, OrderRow } from "@/routes/admin";

export function FinancesPanel() {
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
  const itemStats: Record<string, { name: string, qty: number, revenue: number, short_id?: number }> = {};
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
                  itemStats[i.id] = { name: i.name, qty: 0, revenue: 0, short_id: p?.short_id };
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

  const rankingProdutos = Object.values(itemStats).sort((a, b) => b.qty - a.qty);

  return (
      <div className="space-y-6 min-w-0">
          <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm min-w-0">
            <div className="flex gap-2 p-1 bg-secondary rounded-lg border border-border w-full xl:w-auto overflow-x-auto min-w-0">
                <button onClick={() => applyPreset('today')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap flex-shrink-0 ${periodPreset === 'today' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Hoje</button>
                <button onClick={() => applyPreset('7d')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap flex-shrink-0 ${periodPreset === '7d' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>7 Dias</button>
                <button onClick={() => applyPreset('30d')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap flex-shrink-0 ${periodPreset === '30d' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>30 Dias</button>
                <button onClick={() => applyPreset('month')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap flex-shrink-0 ${periodPreset === 'month' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Este Mês</button>
                <button onClick={() => applyPreset('year')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap flex-shrink-0 ${periodPreset === 'year' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Este Ano</button>
                <button onClick={() => applyPreset('all')} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition whitespace-nowrap flex-shrink-0 ${periodPreset === 'all' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Desde o começo</button>
            </div>
            <div className="flex items-center gap-2 w-full xl:w-auto min-w-0 overflow-x-auto">
                <Input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setPeriodPreset('custom');}} className="h-9 text-sm w-[130px] sm:w-auto flex-shrink-0" />
                <span className="text-muted-foreground text-sm font-semibold flex-shrink-0">até</span>
                <Input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setPeriodPreset('custom');}} className="h-9 text-sm w-[130px] sm:w-auto flex-shrink-0" />
            </div>
          </div>

          {loading ? (
              <p className="text-muted-foreground text-center font-semibold py-10">Carregando métricas financeiras...</p>
          ) : (
              <>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 min-w-0">
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm break-words min-w-0 max-w-full">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1 truncate"><TrendingUp className="h-3.5 w-3.5 text-primary flex-shrink-0"/> <span className="truncate">Faturamento Bruto</span></h3>
                      <p className="text-xl sm:text-2xl font-black mt-2 text-foreground truncate">{brl(totalEarned)}</p>
                    </div>
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm break-words min-w-0 max-w-full">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1 truncate"><DollarSign className="h-3.5 w-3.5 text-green-600 flex-shrink-0"/> <span className="truncate">Lucro Líquido</span></h3>
                      <p className="text-xl sm:text-2xl font-black mt-2 text-green-600 truncate">{brl(netProfit)}</p>
                    </div>
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm break-words min-w-0 max-w-full">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1 truncate"><ShoppingBag className="h-3.5 w-3.5 text-accent-foreground flex-shrink-0"/> <span className="truncate">Vendas</span></h3>
                      <p className="text-xl sm:text-2xl font-black mt-2 text-foreground truncate">{totalOrders}</p>
                    </div>
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm break-words min-w-0 max-w-full">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1 truncate"><DollarSign className="h-3.5 w-3.5 text-green-600 flex-shrink-0"/> <span className="truncate">Ticket Médio</span></h3>
                      <p className="text-xl sm:text-2xl font-black mt-2 text-green-600 truncate">{brl(ticketMedio)}</p>
                    </div>
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm break-words min-w-0 max-w-full">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1 truncate"><Layers className="h-3.5 w-3.5 text-blue-600 flex-shrink-0"/> <span className="truncate">Itens por Venda</span></h3>
                      <p className="text-xl sm:text-2xl font-black mt-2 text-blue-600 truncate">{itensPorVenda.toFixed(1)}</p>
                    </div>
                  </div>

                  <h2 className="text-lg font-display font-black mt-8 mb-4 border-b border-border pb-2 truncate">Posição de Estoque Físico</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm flex items-center justify-between break-words min-w-0 max-w-full gap-3">
                       <div className="min-w-0">
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 truncate">Capital Imobilizado</h3>
                          <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                             <span className="text-2xl font-black text-foreground truncate max-w-full">{brl(capitalCusto)}</span>
                             <span className="text-xs font-semibold text-muted-foreground truncate">a preço de custo</span>
                          </div>
                          <p className="text-xs font-bold text-green-600 mt-1 truncate max-w-full">Potencial de Venda: {brl(capitalVenda)}</p>
                       </div>
                       <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"><Package className="h-6 w-6 text-muted-foreground"/></div>
                    </div>
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm flex items-center justify-between break-words min-w-0 max-w-full gap-3">
                       <div className="min-w-0">
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1 truncate">Volume Físico</h3>
                          <p className="text-2xl font-black text-foreground truncate max-w-full">{totalFisico} <span className="text-sm font-semibold text-muted-foreground">unidades</span></p>
                       </div>
                       <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"><Layers className="h-6 w-6 text-muted-foreground"/></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6 min-w-0 max-w-full">
                    <div className="border border-border bg-card rounded-xl p-5 shadow-sm flex flex-col min-w-0 max-w-full">
                       <h3 className="text-sm font-bold uppercase tracking-wide mb-4 truncate">Faturamento Diário (Período)</h3>
                       {chartData.length === 0 ? (
                          <p className="text-xs text-muted-foreground m-auto truncate">Sem dados para o gráfico.</p>
                       ) : (
                          <div className="flex h-48 items-end gap-1 sm:gap-2 mt-auto min-w-0 max-w-full">
                            {chartData.map(d => {
                               const isActive = activeChartBar === d.date;
                               return (
                               <div 
                                 key={d.date} 
                                 className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer min-w-0"
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

                    <div className="border border-border bg-card rounded-xl overflow-hidden shadow-sm flex flex-col break-words min-w-0 max-w-full">
                       <div className="bg-secondary/50 px-5 py-3 border-b border-border min-w-0">
                           <h3 className="text-sm font-bold uppercase tracking-wide truncate">Ranking de Produtos (Curva ABC)</h3>
                       </div>
                       <div className="flex-1 overflow-y-auto min-w-0 max-w-full" style={{ maxHeight: '400px' }}>
                          {rankingProdutos.length === 0 ? (
                              <p className="p-5 text-center text-muted-foreground text-xs font-semibold truncate">Nenhuma venda no período.</p>
                          ) : (
                              <div className="divide-y divide-border min-w-0">
                                  {rankingProdutos.map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-3 px-5 hover:bg-secondary/20 transition gap-2 min-w-0 max-w-full">
                                          <div className="flex items-center gap-3 min-w-0 flex-1">
                                              <span className="flex items-center justify-center h-6 w-6 flex-shrink-0 rounded-full bg-secondary text-xs font-black text-muted-foreground">
                                                  {idx + 1}
                                              </span>
                                              <span className="font-semibold text-sm truncate w-full" title={item.name}>
                                                  {item.short_id && <span className="text-muted-foreground mr-1.5">#{item.short_id}</span>}{item.name}
                                              </span>
                                          </div>
                                          <div className="text-right flex-shrink-0 min-w-0 max-w-[100px]">
                                              <div className="font-black text-primary text-sm truncate max-w-full">{item.qty} un.</div>
                                              <div className="text-[10px] font-semibold text-muted-foreground truncate max-w-full">{brl(item.revenue)}</div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6 min-w-0 max-w-full">
                     <div className="border border-border bg-card rounded-xl overflow-hidden shadow-sm flex flex-col break-words min-w-0 max-w-full">
                       <div className="bg-red-500/10 px-5 py-3 border-b border-border flex items-center gap-2 text-red-600 min-w-0">
                           <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                           <h3 className="text-sm font-bold uppercase tracking-wide truncate">Alerta de Estoque Crítico</h3>
                       </div>
                       <div className="overflow-y-auto min-w-0 max-w-full" style={{ maxHeight: '400px' }}>
                           {criticalStock.length === 0 ? (
                              <p className="p-5 text-center text-muted-foreground text-xs font-semibold truncate">Nenhum produto em nível crítico de estoque.</p>
                           ) : (
                              <div className="divide-y divide-border min-w-0">
                                 {criticalStock.map(p => (
                                    <div key={p.id} className="flex justify-between p-3 px-5 text-sm hover:bg-secondary/20 transition gap-2 min-w-0">
                                       <span className="font-semibold text-foreground truncate w-full flex-1" title={p.name}>
                                          <span className="text-muted-foreground mr-1.5">#{p.short_id}</span>{p.name}
                                       </span>
                                       <span className="font-black text-red-600 whitespace-nowrap flex-shrink-0 truncate">{p.stock} un.</span>
                                    </div>
                                 ))}
                              </div>
                           )}
                       </div>
                     </div>

                     <div className="border border-border bg-card rounded-xl overflow-hidden shadow-sm flex flex-col break-words min-w-0 max-w-full">
                       <div className="bg-orange-500/10 px-5 py-3 border-b border-border flex items-center gap-2 text-orange-600 min-w-0">
                           <Clock className="h-4 w-4 flex-shrink-0" />
                           <h3 className="text-sm font-bold uppercase tracking-wide truncate">Baixo Giro Físico (Encalhados)</h3>
                       </div>
                       <div className="overflow-y-auto min-w-0 max-w-full" style={{ maxHeight: '400px' }}>
                           {deadStock.length === 0 ? (
                              <p className="p-5 text-center text-muted-foreground text-xs font-semibold whitespace-normal break-words">Todos os produtos físicos em estoque tiveram saída no período.</p>
                           ) : (
                              <div className="divide-y divide-border min-w-0">
                                 {deadStock.map(p => (
                                    <div key={p.id} className="flex justify-between p-3 px-5 text-sm hover:bg-secondary/20 transition gap-2 min-w-0">
                                       <span className="font-semibold text-foreground truncate w-full flex-1" title={p.name}>
                                          <span className="text-muted-foreground mr-1.5">#{p.short_id}</span>{p.name}
                                       </span>
                                       <span className="font-black text-orange-600 whitespace-nowrap flex-shrink-0 truncate">Estoque: {p.stock}</span>
                                    </div>
                                 ))}
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