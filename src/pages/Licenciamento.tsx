import { useEffect, useMemo, useState } from "react";
import { Shield, Users, Zap, Award, AlertTriangle, Settings, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type ClienteRow = {
  id: string;
  nome: string;
  valor_mensal: number;
  onboarding_status: string | null;
  onboarding_status_at: string | null;
  updated_at: string;
};

type SessionRow = {
  id: string;
  cliente_id: string | null;
  current_status: "new" | "started" | "in_progress" | "awaiting_client" | "completed" | "failed";
  status_updated_at: string;
  created_at: string;
};

const COMMISSION_RATE = 0.12;
const AVAILABLE_AGENTS = 10;

function toCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function mapStatusLabel(rawStatus: string | null | undefined) {
  const status = String(rawStatus || "new");
  if (status === "completed") return "Ativo";
  if (status === "awaiting_client") return "Em Configuracao";
  if (status === "in_progress" || status === "started") return "Ajustes finos";
  if (status === "failed") return "Pausado";
  return "Pendente";
}

function statusBadgeClass(status: string) {
  const variants: Record<string, string> = {
    Ativo: "bg-purple-600 text-white",
    Pendente: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    Negociando: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "Ajustes finos": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "Em Configuracao": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Pausado: "bg-muted text-muted-foreground",
  };
  return variants[status] || "bg-muted text-muted-foreground";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

export default function Licenciamento() {
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [clientesRes, sessionsRes] = await Promise.all([
          supabase
            .from("clientes")
            .select("id,nome,valor_mensal,onboarding_status,onboarding_status_at,updated_at")
            .order("updated_at", { ascending: false }),
          supabase
            .from("onboarding_sessions")
            .select("id,cliente_id,current_status,status_updated_at,created_at")
            .order("status_updated_at", { ascending: false }),
        ]);

        if (clientesRes.error) throw new Error(clientesRes.error.message);
        if (sessionsRes.error) throw new Error(sessionsRes.error.message);

        setClientes((clientesRes.data || []) as ClienteRow[]);
        setSessions((sessionsRes.data || []) as SessionRow[]);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar licenciamento",
          description: error instanceof Error ? error.message : "Erro desconhecido",
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const clienteById = useMemo(() => {
    const map = new Map<string, ClienteRow>();
    for (const cliente of clientes) {
      map.set(cliente.id, cliente);
    }
    return map;
  }, [clientes]);

  const activeClients = useMemo(
    () =>
      clientes.filter((cliente) =>
        ["completed", "awaiting_client", "in_progress", "started"].includes(String(cliente.onboarding_status || "")),
      ),
    [clientes],
  );

  const monthCommission = useMemo(
    () => activeClients.reduce((sum, cliente) => sum + Number(cliente.valor_mensal || 0) * COMMISSION_RATE, 0),
    [activeClients],
  );

  const yearCommission = monthCommission * 12;

  const activeSessions = useMemo(
    () =>
      sessions.filter((session) => ["started", "in_progress", "awaiting_client", "completed"].includes(session.current_status))
        .length,
    [sessions],
  );

  const clientesLicenciados = useMemo(
    () =>
      clientes.slice(0, 20).map((cliente) => {
        const status = mapStatusLabel(cliente.onboarding_status);
        const valorMensal = Number(cliente.valor_mensal || 0);
        const comissao = valorMensal > 0 ? toCurrency(valorMensal * COMMISSION_RATE) : "-";
        return {
          cliente: cliente.nome,
          produto: "Superagente de Onboarding",
          valor: valorMensal > 0 ? `${toCurrency(valorMensal)}/mes` : "-",
          status,
          comissao,
        };
      }),
    [clientes],
  );

  const controleOperacional = useMemo(
    () =>
      sessions.slice(0, 30).map((session) => ({
        cliente: session.cliente_id ? clienteById.get(session.cliente_id)?.nome || "Cliente sem nome" : "Lead sem cliente",
        solucao: "Superagente de Onboarding",
        status: mapStatusLabel(session.current_status),
        data: formatDate(session.status_updated_at || session.created_at),
      })),
    [clienteById, sessions],
  );

  const licenseKpis = [
    { title: "Agentes Disponiveis", value: String(AVAILABLE_AGENTS), icon: Zap },
    { title: "Agentes Ativos", value: String(activeSessions), icon: CheckCircle2 },
    { title: "Plano", value: "Enterprise", icon: Award },
    { title: "Taxa Base", value: "12%", icon: Shield },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-purple-400">Licenciamento Tecnologico</h1>
        <p className="text-sm md:text-base text-muted-foreground">Gestao de agentes, comissoes e status de implantacao</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {licenseKpis.map((kpi) => (
          <Card key={kpi.title} className="border-purple-600/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <div className="text-lg md:text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-purple-600/20">
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-400" />
              Comissao do Mes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl md:text-3xl font-bold text-purple-400">{toCurrency(monthCommission)}</div>
            <p className="text-xs text-muted-foreground mt-1">Base: 12% sobre contratos ativos</p>
          </CardContent>
        </Card>
        <Card className="border-purple-600/20">
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-400" />
              Acumulado no Ano
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl md:text-3xl font-bold text-purple-400">{toCurrency(yearCommission)}</div>
            <p className="text-xs text-muted-foreground mt-1">Estimativa anual com base no mes atual</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-400" />
            Clientes Licenciados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="hidden md:table-cell">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Comissao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesLicenciados.map((cliente) => (
                  <TableRow key={cliente.cliente}>
                    <TableCell className="font-medium text-sm">{cliente.cliente}</TableCell>
                    <TableCell className="text-sm">{cliente.produto}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{cliente.valor}</TableCell>
                    <TableCell>
                      <Badge className={statusBadgeClass(cliente.status)}>{cliente.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{cliente.comissao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-purple-950/20 border-purple-600/20">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-purple-400" />
            Regras de Licenciamento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-2 shrink-0" />
              A solucao envolve automacao e IA e pode demandar ajustes finos apos implantacao.
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-2 shrink-0" />
              Integracoes com WhatsApp, Drive, Trello e outros servicos dependem de credenciais validas da contratante.
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-2 shrink-0" />
              Existem limitacoes tecnicas das plataformas de terceiros que podem impactar funcionalidades especificas.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-400" />
            Controle Operacional de Solucoes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Solucao</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Ativacao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {controleOperacional.map((item) => (
                  <TableRow key={`${item.cliente}-${item.solucao}-${item.data}`}>
                    <TableCell className="font-medium text-sm">{item.cliente}</TableCell>
                    <TableCell className="text-sm">{item.solucao}</TableCell>
                    <TableCell>
                      <Badge className={statusBadgeClass(item.status)}>{item.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{item.data}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
