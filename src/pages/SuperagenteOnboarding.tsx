import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserPlus,
  FolderOpen,
  FileText,
  Link,
  ListChecks,
  Bell,
  ClipboardCheck,
  CheckCircle2,
  Loader2,
  RefreshCw,
  MessagesSquare,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SuperagenteChat from "@/components/SuperagenteChat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type OnboardingSession = {
  id: string;
  tracking_token: string;
  phone_e164: string;
  current_status: "new" | "started" | "in_progress" | "awaiting_client" | "completed" | "failed";
  status_updated_at: string;
  created_at: string;
  last_message_at: string | null;
  last_provider_message_id: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  cliente_onboarding_status: string | null;
  total_messages: number;
};

type DashboardStats = {
  total_sessions: number;
  completed_sessions: number;
  active_sessions: number;
  failed_sessions: number;
  completion_rate_pct: number;
  avg_completion_seconds: number;
  avg_completion_days: number;
  drive_folders_created: number;
};

type OnboardingDashboardResponse = {
  ok: boolean;
  stats?: DashboardStats;
  recent_sessions?: OnboardingSession[];
  error?: string;
};

const funcionalidades = [
  {
    icon: UserPlus,
    title: "Coleta de Informacoes",
    desc: "Recebimento de dados do cliente via WhatsApp com persistencia real no PostgreSQL.",
    status: "ativo",
  },
  {
    icon: FolderOpen,
    title: "Criacao de Pastas no Drive",
    desc: "Provisionamento automatico de pasta por cliente no Google Drive com controle de duplicidade.",
    status: "ativo",
  },
  {
    icon: FileText,
    title: "Organizacao de Arquivos",
    desc: "Estrutura padronizada de onboarding para facilitar operacao e auditoria.",
    status: "ativo",
  },
  {
    icon: Link,
    title: "Envio de Links",
    desc: "Exposicao do link da pasta para equipe interna sem etapas manuais extras.",
    status: "ativo",
  },
  {
    icon: ListChecks,
    title: "Tarefas no Trello",
    desc: "Sincronizacao operacional com cards de tarefa e acompanhamento.",
    status: "ativo",
  },
  {
    icon: Bell,
    title: "Lembretes Internos",
    desc: "Atualizacao de status com historico e registro de eventos operacionais.",
    status: "ativo",
  },
  {
    icon: ClipboardCheck,
    title: "Checklist de Onboarding",
    desc: "Validacao de progresso por status com acao rapida em um clique.",
    status: "ativo",
  },
];

const suggestions = [
  "Iniciar onboarding de novo cliente",
  "Listar clientes pendentes de validacao",
  "Concluir onboarding da sessao mais recente",
  "Mostrar status do fluxo WhatsApp para dashboard",
];

const statusLabel: Record<OnboardingSession["current_status"], string> = {
  new: "Novo",
  started: "Iniciado",
  in_progress: "Em andamento",
  awaiting_client: "Aguardando cliente",
  completed: "Concluido",
  failed: "Falhou",
};

function statusVariant(status: OnboardingSession["current_status"]): "default" | "secondary" | "outline" | "destructive" {
  if (status === "completed") return "default";
  if (status === "failed") return "destructive";
  if (status === "awaiting_client") return "outline";
  return "secondary";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR");
}

function shortToken(value: string | null | undefined) {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export default function SuperagenteOnboarding() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transitioningSessionId, setTransitioningSessionId] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    total_sessions: 0,
    completed_sessions: 0,
    active_sessions: 0,
    failed_sessions: 0,
    completion_rate_pct: 0,
    avg_completion_seconds: 0,
    avg_completion_days: 0,
    drive_folders_created: 0,
  });
  const [sessions, setSessions] = useState<OnboardingSession[]>([]);

  const emptyStats: DashboardStats = useMemo(
    () => ({
      total_sessions: 0,
      completed_sessions: 0,
      active_sessions: 0,
      failed_sessions: 0,
      completion_rate_pct: 0,
      avg_completion_seconds: 0,
      avg_completion_days: 0,
      drive_folders_created: 0,
    }),
    [],
  );

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("onboarding-dashboard", {
        body: { limit: 30 },
      });
      if (error) throw new Error(error.message);

      const payload = data as OnboardingDashboardResponse;
      if (!payload?.ok) throw new Error(payload?.error || "Falha ao carregar dashboard de onboarding");

      setStats(payload.stats || emptyStats);
      setSessions(Array.isArray(payload.recent_sessions) ? payload.recent_sessions : []);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar onboarding",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, [emptyStats]);

  useEffect(() => {
    void fetchDashboard();
    const intervalId = window.setInterval(() => {
      void fetchDashboard(true);
    }, 10_000);
    return () => window.clearInterval(intervalId);
  }, [fetchDashboard]);

  const pendingSessions = useMemo(
    () => sessions.filter((session) => session.current_status !== "completed" && session.current_status !== "failed"),
    [sessions],
  );

  const handleTransition = async (sessionId: string, status: OnboardingSession["current_status"]) => {
    if (transitioningSessionId) return;
    setTransitioningSessionId(sessionId);
    try {
      const { data, error } = await supabase.functions.invoke("onboarding-transition", {
        body: {
          session_id: sessionId,
          status,
          reason: "dashboard_quick_action",
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "Falha ao transicionar status");

      toast({
        title: "Status atualizado",
        description: `Sessao atualizada para ${statusLabel[status]}.`,
      });
      await fetchDashboard(true);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Falha ao atualizar status",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setTransitioningSessionId(null);
    }
  };

  const kpis = [
    { label: "Clientes onboardados", value: String(stats.completed_sessions), change: `${stats.total_sessions} sessoes no total` },
    { label: "Tempo medio de onboarding", value: `${stats.avg_completion_days.toFixed(2)} dias`, change: "Baseado em sessoes concluidas" },
    { label: "Checklist completo", value: `${stats.completion_rate_pct}%`, change: `${pendingSessions.length} pendentes` },
    { label: "Pastas criadas", value: String(stats.drive_folders_created), change: "Drive sincronizado" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" />
            Superagente de Onboarding
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Dashboard em tempo real do fluxo WhatsApp para onboarding operacional
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchDashboard()} disabled={refreshing || loading}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl md:text-2xl font-bold mt-1">{loading ? "-" : kpi.value}</p>
              <p className="text-xs text-primary mt-1">{kpi.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-primary" />
            Fila de Onboarding (acao rapida)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Carregando sessoes...</p>}
          {!loading && sessions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessao encontrada.</p>}
          {!loading &&
            sessions.map((session) => (
              <div key={session.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{session.cliente_nome || session.phone_e164}</p>
                    <p className="text-xs text-muted-foreground">Tracking: {shortToken(session.tracking_token)}</p>
                    <p className="text-xs text-muted-foreground">Mensagens: {session.total_messages}</p>
                  </div>
                  <Badge variant={statusVariant(session.current_status)}>{statusLabel[session.current_status]}</Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Atualizado em: {formatDateTime(session.status_updated_at)}
                  </span>
                  {session.drive_folder_url && (
                    <a href={session.drive_folder_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Abrir pasta Drive
                    </a>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(session.current_status === "started" || session.current_status === "in_progress") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={transitioningSessionId === session.id}
                      onClick={() => void handleTransition(session.id, "awaiting_client")}
                    >
                      Validar
                    </Button>
                  )}
                  {session.current_status !== "completed" && (
                    <Button
                      size="sm"
                      disabled={transitioningSessionId === session.id}
                      onClick={() => void handleTransition(session.id, "completed")}
                    >
                      Concluir
                    </Button>
                  )}
                  {session.current_status !== "failed" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={transitioningSessionId === session.id}
                      onClick={() => void handleTransition(session.id, "failed")}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Falhou
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Funcionalidades do Agente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-3">
            {funcionalidades.map((item) => (
              <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                <item.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{item.title}</p>
                    <Badge variant={item.status === "ativo" ? "default" : "secondary"} className="text-[10px]">
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="font-semibold text-base flex items-center gap-2">Chat com o Superagente</h3>
          <SuperagenteChat agentType="onboarding" suggestions={suggestions} />
        </div>
      </div>
    </div>
  );
}
