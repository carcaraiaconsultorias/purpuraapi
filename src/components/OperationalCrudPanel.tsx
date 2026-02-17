import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type OperationalTipo = "task" | "briefing" | "follow_up";
type OperationalStatus = "open" | "in_progress" | "done" | "blocked";
type OperationalPrioridade = "low" | "medium" | "high" | "urgent";

type OperationalItem = {
  id: string;
  tipo: OperationalTipo;
  titulo: string;
  descricao: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  responsavel: string;
  prioridade: OperationalPrioridade;
  status: OperationalStatus;
  prazo_at: string | null;
  detalhes: Record<string, unknown>;
  trello_card_id: string | null;
  trello_card_url: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id: string | null;
  tipo: OperationalTipo;
  titulo: string;
  descricao: string;
  cliente_id: string;
  responsavel: string;
  prioridade: OperationalPrioridade;
  status: OperationalStatus;
  prazo_at: string;
  detalhes_text: string;
  sync_trello: boolean;
};

const tipoOptions: Array<{ value: OperationalTipo; label: string }> = [
  { value: "task", label: "Tarefa" },
  { value: "briefing", label: "Briefing" },
  { value: "follow_up", label: "Acompanhamento" },
];

const statusOptions: Array<{ value: OperationalStatus; label: string }> = [
  { value: "open", label: "Aberto" },
  { value: "in_progress", label: "Em andamento" },
  { value: "done", label: "Concluido" },
  { value: "blocked", label: "Bloqueado" },
];

const prioridadeOptions: Array<{ value: OperationalPrioridade; label: string }> = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const defaultFormState: FormState = {
  id: null,
  tipo: "task",
  titulo: "",
  descricao: "",
  cliente_id: "",
  responsavel: "",
  prioridade: "medium",
  status: "open",
  prazo_at: "",
  detalhes_text: "{}",
  sync_trello: true,
};

function localDateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isoToLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - timezoneOffsetMs);
  return local.toISOString().slice(0, 16);
}

function parseDetailsText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function statusVariant(status: OperationalStatus): "secondary" | "default" | "outline" | "destructive" {
  if (status === "done") return "default";
  if (status === "in_progress") return "secondary";
  if (status === "blocked") return "destructive";
  return "outline";
}

export default function OperationalCrudPanel() {
  const [items, setItems] = useState<OperationalItem[]>([]);
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterTipo, setFilterTipo] = useState<string>("all");

  const filteredItems = useMemo(() => {
    if (filterTipo === "all") return items;
    return items.filter((item) => item.tipo === filterTipo);
  }, [filterTipo, items]);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const body = {
        limit: 30,
        ...(filterTipo === "all" ? {} : { tipo: filterTipo }),
      };
      const { data, error } = await supabase.functions.invoke("operational-list", { body });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "Falha ao carregar itens operacionais");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Falha ao carregar operacional",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsLoading(false);
    }
  }, [filterTipo]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const onEdit = (item: OperationalItem) => {
    setForm({
      id: item.id,
      tipo: item.tipo,
      titulo: item.titulo,
      descricao: item.descricao || "",
      cliente_id: item.cliente_id || "",
      responsavel: item.responsavel || "",
      prioridade: item.prioridade,
      status: item.status,
      prazo_at: isoToLocalDateTime(item.prazo_at),
      detalhes_text: JSON.stringify(item.detalhes || {}, null, 2),
      sync_trello: true,
    });
  };

  const onReset = () => setForm(defaultFormState);

  const onDelete = async (itemId: string) => {
    const confirmed = window.confirm("Remover este item operacional?");
    if (!confirmed) return;

    try {
      const { data, error } = await supabase.functions.invoke("operational-delete", {
        body: { id: itemId },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "Falha ao remover");
      toast({ title: "Item removido", description: "Registro operacional removido com sucesso." });
      await loadItems();
      if (form.id === itemId) onReset();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao remover",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const detalhes = parseDetailsText(form.detalhes_text);
    if (!detalhes) {
      toast({
        variant: "destructive",
        title: "JSON invalido",
        description: "O campo detalhes precisa ser um objeto JSON valido.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        tipo: form.tipo,
        titulo: form.titulo,
        descricao: form.descricao,
        cliente_id: form.cliente_id || null,
        responsavel: form.responsavel,
        prioridade: form.prioridade,
        status: form.status,
        prazo_at: localDateTimeToIso(form.prazo_at),
        detalhes,
        sync_trello: form.sync_trello,
      };

      const { data, error } = await supabase.functions.invoke("operational-upsert", {
        body: payload,
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "Falha ao salvar");

      const trelloStatus = data?.trello?.status;
      toast({
        title: form.id ? "Item atualizado" : "Item criado",
        description: `Status Trello: ${trelloStatus || "not_requested"}`,
      });

      onReset();
      await loadItems();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{form.id ? "Atualizar Item Operacional" : "Novo Item Operacional"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(value) => setForm((prev) => ({ ...prev, tipo: value as OperationalTipo }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as OperationalStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Titulo</Label>
              <Input
                value={form.titulo}
                onChange={(event) => setForm((prev) => ({ ...prev, titulo: event.target.value }))}
                placeholder="Ex: Revisar briefing Cliente X"
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Descricao</Label>
              <Textarea
                value={form.descricao}
                onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
                placeholder="Detalhes operacionais"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, prioridade: value as OperationalPrioridade }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {prioridadeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prazo</Label>
                <Input
                  type="datetime-local"
                  value={form.prazo_at}
                  onChange={(event) => setForm((prev) => ({ ...prev, prazo_at: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Responsavel</Label>
                <Input
                  value={form.responsavel}
                  onChange={(event) => setForm((prev) => ({ ...prev, responsavel: event.target.value }))}
                  placeholder="Nome do responsavel"
                />
              </div>
              <div className="space-y-1">
                <Label>Cliente ID</Label>
                <Input
                  value={form.cliente_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, cliente_id: event.target.value }))}
                  placeholder="UUID do cliente (opcional)"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Detalhes (JSON)</Label>
              <Textarea
                value={form.detalhes_text}
                onChange={(event) => setForm((prev) => ({ ...prev, detalhes_text: event.target.value }))}
                rows={6}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="sync_trello"
                type="checkbox"
                checked={form.sync_trello}
                onChange={(event) => setForm((prev) => ({ ...prev, sync_trello: event.target.checked }))}
              />
              <Label htmlFor="sync_trello">Sincronizar com Trello</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : form.id ? "Atualizar" : "Criar"}
              </Button>
              {form.id && (
                <Button type="button" variant="outline" onClick={onReset}>
                  Cancelar edicao
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Itens Operacionais</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tipoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" onClick={() => void loadItems()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[620px] overflow-y-auto">
          {filteredItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item operacional encontrado.</p>}
          {filteredItems.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{item.titulo}</p>
                  <p className="text-xs text-muted-foreground">{item.tipo}</p>
                </div>
                <div className="flex gap-1">
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  <Badge variant="outline">{item.prioridade}</Badge>
                </div>
              </div>
              {item.descricao && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{item.descricao}</p>}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Atualizado: {new Date(item.updated_at).toLocaleString("pt-BR")}</p>
                {item.cliente_nome && <p>Cliente: {item.cliente_nome}</p>}
                {item.trello_card_url && (
                  <a
                    href={item.trello_card_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Abrir card Trello <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" onClick={() => onEdit(item)}>
                  Editar
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => void onDelete(item.id)}>
                  <Trash2 className="h-3 w-3 mr-1" />
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
