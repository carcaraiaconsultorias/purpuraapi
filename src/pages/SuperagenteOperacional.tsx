import { useEffect, useMemo, useState } from "react";
import {
  Cog,
  MessageCircleQuestion,
  FileSearch,
  PenTool,
  ListChecks,
  Clock,
  BarChart3,
  Filter,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SuperagenteChat from "@/components/SuperagenteChat";
import OperationalCrudPanel from "@/components/OperationalCrudPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const funcionalidades = [
  {
    icon: MessageCircleQuestion,
    title: "FAQ Inteligente",
    desc: "Resposta automatica a duvidas recorrentes com base na base de conhecimento aprovada pela agencia.",
    status: "ativo",
  },
  {
    icon: FileSearch,
    title: "Consulta ao Google Drive",
    desc: "Consulta a documentos no Drive conforme permissoes e estrutura definida pela agencia.",
    status: "ativo",
  },
  {
    icon: PenTool,
    title: "Geracao de Conteudo",
    desc: "Pautas, briefings, revisoes, roteiros, legendas, textos e checklists automaticos.",
    status: "ativo",
  },
  {
    icon: ListChecks,
    title: "Tarefas no Trello",
    desc: "Criacao e atualizacao de cards operacionais sincronizados com o dashboard.",
    status: "ativo",
  },
  {
    icon: Clock,
    title: "Suporte 24/7",
    desc: "Suporte ao time interno em regime continuo, limitado as capacidades e integracoes ativas.",
    status: "ativo",
  },
  {
    icon: BarChart3,
    title: "Dashboard de Gestao",
    desc: "Painel centralizado com KPIs de onboarding, volume de demandas e metricas estrategicas.",
    status: "ativo",
  },
  {
    icon: Filter,
    title: "Filtro Inteligente",
    desc: "Direcionamento ao atendimento humano apenas quando necessario, conforme regras definidas.",
    status: "configuravel",
  },
];

const suggestions = [
  "Gerar briefing para cliente X",
  "Criar pauta de conteudo semanal",
  "Listar tarefas operacionais em aberto",
  "Ver metricas atuais do dashboard",
];

type KpiItem = {
  label: string;
  value: string;
  change: string;
};

type OnboardingDashboardResponse = {
  ok: boolean;
  stats?: {
    total_sessions: number;
    completed_sessions: number;
    active_sessions: number;
    failed_sessions: number;
    completion_rate_pct: number;
    avg_completion_days: number;
  };
  error?: string;
};

type OperationalListResponse = {
  ok: boolean;
  items?: Array<{ status: "open" | "in_progress" | "done" | "blocked" }>;
  error?: string;
};

export default function SuperagenteOperacional() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiItem[]>([
    { label: "Demandas atendidas", value: "-", change: "-" },
    { label: "Taxa de resolucao IA", value: "-", change: "-" },
    { label: "Tempo medio onboarding", value: "-", change: "-" },
    { label: "Escalacoes humanas", value: "-", change: "-" },
  ]);

  useEffect(() => {
    const fetchKpis = async () => {
      setLoading(true);
      try {
        const [operationalRes, onboardingRes] = await Promise.all([
          supabase.functions.invoke("operational-list", { body: { limit: 200 } }),
          supabase.functions.invoke("onboarding-dashboard", { body: { limit: 50 } }),
        ]);

        if (operationalRes.error) throw new Error(operationalRes.error.message);
        if (onboardingRes.error) throw new Error(onboardingRes.error.message);

        const operational = (operationalRes.data || {}) as OperationalListResponse;
        const onboarding = (onboardingRes.data || {}) as OnboardingDashboardResponse;

        if (!operational.ok) throw new Error(operational.error || "Falha no dashboard operacional");
        if (!onboarding.ok) throw new Error(onboarding.error || "Falha no dashboard de onboarding");

        const items = operational.items || [];
        const doneCount = items.filter((item) => item.status === "done").length;
        const blockedCount = items.filter((item) => item.status === "blocked").length;
        const totalItems = items.length;
        const resolveRate = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;
        const escalationRate = totalItems > 0 ? Math.round((blockedCount / totalItems) * 100) : 0;
        const avgOnboarding = Number(onboarding.stats?.avg_completion_days || 0).toFixed(2);
        const activeSessions = onboarding.stats?.active_sessions || 0;

        setKpis([
          {
            label: "Demandas atendidas",
            value: String(totalItems),
            change: `${activeSessions} onboarding ativos`,
          },
          {
            label: "Taxa de resolucao IA",
            value: `${resolveRate}%`,
            change: `${doneCount} tarefas concluidas`,
          },
          {
            label: "Tempo medio onboarding",
            value: `${avgOnboarding} dias`,
            change: "Baseado em sessoes concluidas",
          },
          {
            label: "Escalacoes humanas",
            value: `${escalationRate}%`,
            change: `${blockedCount} tarefas bloqueadas`,
          },
        ]);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar metricas operacionais",
          description: error instanceof Error ? error.message : "Erro desconhecido",
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchKpis();
  }, []);

  const kpiCards = useMemo(
    () =>
      kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-xl md:text-2xl font-bold mt-1">{loading ? "-" : kpi.value}</p>
            <p className="text-xs text-primary mt-1">{kpi.change}</p>
          </CardContent>
        </Card>
      )),
    [kpis, loading],
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Cog className="h-6 w-6 text-primary" />
          Superagente Operacional
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">Suporte inteligente 24/7 para o time interno da Agencia Purpura</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">{kpiCards}</div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Funcionalidades do Agente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-3">
            {funcionalidades.map((funcionalidade) => (
              <div key={funcionalidade.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                <funcionalidade.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{funcionalidade.title}</p>
                    <Badge variant={funcionalidade.status === "ativo" ? "default" : "secondary"} className="text-[10px]">
                      {funcionalidade.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{funcionalidade.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="font-semibold text-base flex items-center gap-2">Chat com o Superagente</h3>
          <SuperagenteChat agentType="operacional" suggestions={suggestions} />
        </div>
      </div>

      <OperationalCrudPanel />
    </div>
  );
}
