import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Target, DollarSign, Users, Percent, Clock, Settings2, Eye, EyeOff, Loader2, Contact, Globe, Calendar, Briefcase, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface WidgetConfig {
  comercialMetas: boolean;
  comercialFunil: boolean;
  clientes: boolean;
  servicos: boolean;
  redesSociais: boolean;
  cronograma: boolean;
}

const defaultWidgets: WidgetConfig = {
  comercialMetas: true,
  comercialFunil: true,
  clientes: true,
  servicos: true,
  redesSociais: true,
  cronograma: true,
};

const STORAGE_KEY = "resumo_widgets";

export default function Resumo() {
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultWidgets;
    } catch { return defaultWidgets; }
  });

  // Data state
  const [metas, setMetas] = useState<any[]>([]);
  const [oportunidades, setOps] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [redes, setRedes] = useState<any[]>([]);
  const [cronograma, setCronograma] = useState<any[]>([]);
  const [timestamps, setTimestamps] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [metasRes, opsRes, clientesRes, servicosRes, redesRes, cronoRes] = await Promise.all([
      supabase.from("comercial_metas").select("*").order("meta", { ascending: false }),
      supabase.from("comercial_oportunidades").select("*").order("dias_parado", { ascending: false }),
      supabase.from("clientes").select("id, nome, valor_mensal, colaborador_responsavel, updated_at"),
      supabase.from("servicos").select("*").order("contratos", { ascending: false }),
      supabase.from("marketing_redes").select("*").order("seguidores", { ascending: false }),
      supabase.from("cronograma_conteudo").select("*").order("created_at"),
    ]);

    setMetas(metasRes.data || []);
    setOps(opsRes.data || []);
    setClientes(clientesRes.data || []);
    setServicos(servicosRes.data || []);
    setRedes(redesRes.data || []);
    setCronograma(cronoRes.data || []);

    // Calculate latest update per section
    const getLatest = (data: any[]) => {
      if (!data || data.length === 0) return "";
      const dates = data.map(d => d.updated_at || d.created_at).filter(Boolean).sort().reverse();
      return dates[0] || "";
    };
    setTimestamps({
      comercial: getLatest([...(metasRes.data || []), ...(opsRes.data || [])]),
      clientes: getLatest(clientesRes.data || []),
      servicos: getLatest(servicosRes.data || []),
      marketing: getLatest([...(redesRes.data || []), ...(cronoRes.data || [])]),
    });

    setLoading(false);
  };

  const saveWidgets = (updated: WidgetConfig) => {
    setWidgets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const toggleWidget = (key: keyof WidgetConfig) => {
    saveWidgets({ ...widgets, [key]: !widgets[key] });
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  // Computed KPIs
  const totalMeta = metas.reduce((s, m) => s + Number(m.meta), 0);
  const totalRealizado = metas.reduce((s, m) => s + Number(m.realizado), 0);
  const pctMeta = totalMeta > 0 ? Math.round((totalRealizado / totalMeta) * 100) : 0;
  const totalClientes = clientes.length;
  const totalServicosAtivos = servicos.filter(s => s.status === "Ativo").length;
  const totalSeguidores = redes.reduce((s, r) => s + Number(r.seguidores), 0);
  const receitaClientes = clientes.reduce((s, c) => s + Number(c.valor_mensal || 0), 0);
  const opsParadas = oportunidades.filter(o => o.dias_parado > 10).length;

  if (loading) return <div className="p-6 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Resumo</h1>
          <p className="text-sm text-muted-foreground">Visão geral do painel — dados em tempo real</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)} className="gap-1.5">
          <Settings2 className="h-4 w-4" /> Personalizar
        </Button>
      </div>

      {/* KPIs Gerais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Meta Comercial</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold">R$ {totalRealizado.toLocaleString("pt-BR")}</p>
            <div className="flex items-center gap-1 mt-1">
              {pctMeta >= 100 ? <TrendingUp className="h-3 w-3 text-primary" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
              <span className="text-xs text-muted-foreground">{pctMeta}% da meta</span>
            </div>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.min(pctMeta, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Clientes Ativos</span>
              <Contact className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{totalClientes}</p>
            <p className="text-xs text-muted-foreground mt-1">Receita: R$ {receitaClientes.toLocaleString("pt-BR")}/mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Seguidores Total</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{totalSeguidores >= 1000 ? `${(totalSeguidores / 1000).toFixed(1)}K` : totalSeguidores}</p>
            <p className="text-xs text-muted-foreground mt-1">{redes.length} redes sociais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Serviços Ativos</span>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{totalServicosAtivos}</p>
            <p className="text-xs text-muted-foreground mt-1">{servicos.reduce((s, sv) => s + sv.contratos, 0)} contratos</p>
          </CardContent>
        </Card>
      </div>

      {/* Comercial Metas */}
      {widgets.comercialMetas && metas.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Metas Comerciais</CardTitle>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(timestamps.comercial)}</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            {metas.slice(0, 4).map(m => {
              const pct = Number(m.meta) > 0 ? Math.round((Number(m.realizado) / Number(m.meta)) * 100) : 0;
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="text-xs w-24 truncate font-medium">{m.vendedor}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className={`text-xs font-semibold w-10 text-right ${pct >= 100 ? "text-primary" : ""}`}>{pct}%</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Comercial Funil */}
      {widgets.comercialFunil && oportunidades.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Funil & Oportunidades</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid grid-cols-4 gap-2 mb-3">
              {["Lead", "Qualificado", "Proposta", "Fechado"].map(etapa => {
                const count = oportunidades.filter(o => o.etapa === etapa).length;
                return (
                  <div key={etapa} className="text-center p-2 bg-muted rounded-lg">
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{etapa}</p>
                  </div>
                );
              })}
            </div>
            {opsParadas > 0 && (
              <p className="text-xs text-destructive">⚠ {opsParadas} oportunidade{opsParadas > 1 ? "s" : ""} parada{opsParadas > 1 ? "s" : ""} há +10 dias</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Clientes */}
        {widgets.clientes && clientes.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Contact className="h-4 w-4 text-primary" /> Clientes</CardTitle>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(timestamps.clientes)}</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-1.5">
              {clientes.filter(c => Number(c.valor_mensal) > 0).slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.nome}</span>
                  <span className="text-xs font-medium text-primary shrink-0">R$ {Number(c.valor_mensal).toLocaleString("pt-BR")}/mês</span>
                </div>
              ))}
              {clientes.filter(c => Number(c.valor_mensal) > 0).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum cliente com valor mensal cadastrado</p>
              )}
              <p className="text-xs text-muted-foreground pt-1">{totalClientes} clientes totais</p>
            </CardContent>
          </Card>
        )}

        {/* Serviços */}
        {widgets.servicos && servicos.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" /> Serviços</CardTitle>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(timestamps.servicos)}</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-1.5">
              {servicos.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.tendencia === "up" && <TrendingUp className="h-3 w-3 text-primary shrink-0" />}
                    {s.tendencia === "down" && <TrendingDown className="h-3 w-3 text-destructive shrink-0" />}
                    {s.tendencia === "stable" && <span className="w-3 shrink-0 text-center text-muted-foreground">—</span>}
                    <span className="truncate">{s.nome}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{s.contratos} contratos</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Redes Sociais */}
        {widgets.redesSociais && redes.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Redes Sociais</CardTitle>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(timestamps.marketing)}</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              {redes.map(r => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{r.plataforma}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs flex items-center gap-1"><Users className="h-3 w-3" />{r.seguidores >= 1000 ? `${(r.seguidores / 1000).toFixed(1)}K` : r.seguidores}</span>
                    <span className="text-xs text-primary flex items-center gap-1"><Heart className="h-3 w-3" />{Number(r.engajamento).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Cronograma */}
        {widgets.cronograma && cronograma.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Cronograma</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-1.5">
              {cronograma.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary w-14">{item.dia}</span>
                    <span className="truncate">{item.tipo}: {item.descricao}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{item.rede}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Config Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Personalizar Resumo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Escolha quais seções aparecem no resumo:</p>
          <div className="space-y-3 mt-2">
            {([
              ["comercialMetas", "Metas Comerciais", Target],
              ["comercialFunil", "Funil & Oportunidades", TrendingUp],
              ["clientes", "Clientes", Contact],
              ["servicos", "Serviços", Briefcase],
              ["redesSociais", "Redes Sociais", Globe],
              ["cronograma", "Cronograma de Conteúdo", Calendar],
            ] as [keyof WidgetConfig, string, any][]).map(([key, label, Icon]) => (
              <div key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer" onClick={() => toggleWidget(key)}>
                <Checkbox checked={widgets[key]} />
                <Icon className="h-4 w-4 text-primary" />
                <Label className="cursor-pointer flex-1">{label}</Label>
                {widgets[key] ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
