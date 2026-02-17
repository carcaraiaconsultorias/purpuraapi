import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle, Circle, MessageSquare, Loader2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type ClienteRow = {
  id: string;
  nome: string;
  cnpj: string;
  endereco: string;
  colaborador_responsavel: string;
  valor_mensal: number;
  onboarding_status: string | null;
  onboarding_status_at: string | null;
  drive_folder_url: string | null;
  drive_folder_id: string | null;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  tracking_token: string;
  current_status: "new" | "started" | "in_progress" | "awaiting_client" | "completed" | "failed";
  status_updated_at: string;
  created_at: string;
  last_message_at: string | null;
};

type MessageRow = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  event_timestamp: string;
  provider_message_id: string;
  payload: Record<string, unknown>;
};

const statusOrder: Record<string, number> = {
  new: 0,
  started: 1,
  in_progress: 2,
  awaiting_client: 3,
  completed: 4,
  failed: 0,
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR");
}

function directionLabel(direction: MessageRow["direction"]) {
  if (direction === "inbound") return "WhatsApp recebido";
  if (direction === "outbound") return "Envio sistema";
  return "Atualizacao interna";
}

export default function PainelCliente() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<ClienteRow | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: clientesData, error: clientesError } = await supabase
          .from("clientes")
          .select(
            "id,nome,cnpj,endereco,colaborador_responsavel,valor_mensal,onboarding_status,onboarding_status_at,drive_folder_url,drive_folder_id,created_at,updated_at",
          )
          .order("onboarding_status_at", { ascending: false });

        if (clientesError) throw new Error(clientesError.message);
        const selectedCliente = (clientesData || [])[0] as ClienteRow | undefined;
        if (!selectedCliente) {
          setCliente(null);
          setSession(null);
          setMessages([]);
          return;
        }

        setCliente(selectedCliente);

        const { data: sessionsData, error: sessionsError } = await supabase
          .from("onboarding_sessions")
          .select("id,tracking_token,current_status,status_updated_at,created_at,last_message_at,cliente_id")
          .eq("cliente_id", selectedCliente.id)
          .order("status_updated_at", { ascending: false });

        if (sessionsError) throw new Error(sessionsError.message);
        const selectedSession = (sessionsData || [])[0] as SessionRow | undefined;
        setSession(selectedSession || null);

        if (!selectedSession?.id) {
          setMessages([]);
          return;
        }

        const { data: messagesData, error: messagesError } = await supabase
          .from("onboarding_messages")
          .select("id,direction,event_timestamp,provider_message_id,payload,session_id")
          .eq("session_id", selectedSession.id)
          .order("event_timestamp", { ascending: false });

        if (messagesError) throw new Error(messagesError.message);
        setMessages(((messagesData || []) as MessageRow[]).slice(0, 5));
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar painel do cliente",
          description: error instanceof Error ? error.message : "Erro desconhecido",
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const checklist = useMemo(() => {
    const currentStatus = session?.current_status || cliente?.onboarding_status || "new";
    const currentOrder = statusOrder[currentStatus] ?? 0;
    return [
      { titulo: "Recebimento dos dados via WhatsApp", completo: currentOrder >= 1 },
      { titulo: "Qualificacao e validacao operacional", completo: currentOrder >= 2 },
      { titulo: "Criacao da pasta no Google Drive", completo: Boolean(cliente?.drive_folder_id) },
      { titulo: "Aguardando aprovacao final", completo: currentOrder >= 3 },
      { titulo: "Onboarding concluido", completo: currentOrder >= 4 },
    ];
  }, [cliente?.drive_folder_id, cliente?.onboarding_status, session?.current_status]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Nenhum cliente encontrado para exibir no painel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedCount = checklist.filter((item) => item.completo).length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Painel do Cliente</h1>
        <p className="text-sm md:text-base text-muted-foreground">Dados reais de onboarding e historico de interacoes</p>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Dados da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Nome</p>
              <p className="font-semibold text-sm md:text-base">{cliente.nome}</p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">CNPJ</p>
              <p className="font-semibold text-sm md:text-base">{cliente.cnpj || "-"}</p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Endereco</p>
              <p className="font-semibold text-sm md:text-base">{cliente.endereco || "-"}</p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Plano</p>
              <p className="font-semibold text-sm md:text-base text-primary">Carcara Business</p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Cliente desde</p>
              <p className="font-semibold text-sm md:text-base">{formatDate(cliente.created_at)}</p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Responsavel</p>
              <p className="font-semibold text-sm md:text-base">
                {cliente.colaborador_responsavel || user?.name || "Time Purpura"}
              </p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Status onboarding</p>
              <p className="font-semibold text-sm md:text-base">{session?.current_status || cliente.onboarding_status || "new"}</p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Atualizado em</p>
              <p className="font-semibold text-sm md:text-base">{formatDate(session?.status_updated_at || cliente.updated_at)}</p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Pasta Drive</p>
              {cliente.drive_folder_url ? (
                <a href={cliente.drive_folder_url} target="_blank" rel="noreferrer" className="font-semibold text-sm md:text-base text-primary hover:underline">
                  Abrir pasta
                </a>
              ) : (
                <p className="font-semibold text-sm md:text-base">Nao criada</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">Checklist de Onboarding</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {completedCount} de {checklist.length} etapas concluidas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="space-y-3">
              {checklist.map((item) => (
                <div key={item.titulo} className="flex items-center gap-3">
                  {item.completo ? <CheckCircle className="h-5 w-5 text-primary shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <span className={`text-sm ${item.completo ? "" : "text-muted-foreground"}`}>{item.titulo}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${(completedCount / checklist.length) * 100}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              Historico de Mensagens
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">Eventos reais do fluxo WhatsApp e atualizacoes de onboarding</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="space-y-3 mb-4">
              {messages.length === 0 && <p className="text-sm text-muted-foreground">Sem eventos registrados para esta sessao.</p>}
              {messages.map((message) => (
                <div key={message.id} className="flex items-center justify-between p-3 bg-muted rounded-lg gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{directionLabel(message.direction)}</p>
                    <p className="text-xs text-muted-foreground truncate">{message.provider_message_id}</p>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground shrink-0 inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(message.event_timestamp)}
                  </p>
                </div>
              ))}
            </div>
            <Button className="w-full text-sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              Solicitar ajuda do especialista
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
