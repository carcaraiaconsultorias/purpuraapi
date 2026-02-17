import { useEffect, useState } from "react";
import { Store, Clock, Sparkles, MessageSquare, GraduationCap, Briefcase, ChevronRight, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface WizardFormData {
  nome: string;
  email: string;
  whatsapp: string;
  empresa: string;
  cargo: string;
  site: string;
  segmento: string;
  porte: string;
  canais: string[];
  regiao: string;
  objetivos: string[];
  observacoes: string;
  aceiteTermos: boolean;
}

interface OnboardingIntakeResponse {
  ok: boolean;
  session_id?: string;
  cliente_id?: string | null;
  tracking_token?: string;
  status?: string;
  status_updated_at?: string;
  duplicate?: boolean;
  drive_folder_status?: string;
  drive_folder_id?: string | null;
  drive_folder_url?: string | null;
  error?: string;
}

interface OnboardingStatusResponse {
  ok: boolean;
  session_id?: string;
  status?: string;
  status_updated_at?: string;
  error?: string;
}

const defaultFormData: WizardFormData = {
  nome: "",
  email: "",
  whatsapp: "",
  empresa: "",
  cargo: "",
  site: "",
  segmento: "",
  porte: "",
  canais: [],
  regiao: "",
  objetivos: [],
  observacoes: "",
  aceiteTermos: false,
};

const objetivoOptions = [
  "Atendimento 24h",
  "Qualificacao de leads",
  "Onboarding automatizado de clientes",
  "Operacoes internas com IA (processos, tarefas, rotinas)",
  "Producao de conteudo com IA",
  "Consultoria comercial",
  "Treinamento de time interno em IA",
];

const canalOptions = ["WhatsApp", "Instagram", "E-mail", "Telefone", "Outros"];

function MarketplaceWizard({ serviceName, onClose }: { serviceName: string; onClose?: () => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<WizardFormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [statusUpdatedAt, setStatusUpdatedAt] = useState<string | null>(null);
  const [driveFolderStatus, setDriveFolderStatus] = useState<string | null>(null);
  const [driveFolderUrl, setDriveFolderUrl] = useState<string | null>(null);

  const toggleArray = (field: "canais" | "objetivos", value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  useEffect(() => {
    if (!trackingToken) return;

    const intervalId = window.setInterval(async () => {
      const { data, error } = await supabase.functions.invoke("onboarding-status", {
        body: { tracking_token: trackingToken },
      });

      if (error) return;
      const statusPayload = data as OnboardingStatusResponse;
      if (!statusPayload?.ok) return;

      setOnboardingStatus(statusPayload.status ?? null);
      setStatusUpdatedAt(statusPayload.status_updated_at ?? null);
    }, 7000);

    return () => window.clearInterval(intervalId);
  }, [trackingToken]);

  const handleFinish = async () => {
    if (isSubmitting || trackingToken) return;

    if (!formData.nome.trim() || !formData.whatsapp.trim()) {
      toast({
        variant: "destructive",
        title: "Dados obrigatorios",
        description: "Preencha ao menos nome e WhatsApp para iniciar o onboarding.",
      });
      return;
    }

    if (!formData.aceiteTermos) {
      toast({
        variant: "destructive",
        title: "Aceite os termos",
        description: "Voce precisa aceitar os termos para concluir.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("onboarding-intake", {
        body: {
          service_name: serviceName,
          ...formData,
        },
      });

      if (error) throw new Error(error.message);

      const intake = data as OnboardingIntakeResponse;
      if (!intake?.ok) throw new Error(intake?.error || "Falha ao iniciar onboarding");
      if (!intake.tracking_token) throw new Error("Tracking token nao retornado");

      setTrackingToken(intake.tracking_token);
      setOnboardingStatus(intake.status || "started");
      setStatusUpdatedAt(intake.status_updated_at || new Date().toISOString());
      setDriveFolderStatus(intake.drive_folder_status || null);
      setDriveFolderUrl(intake.drive_folder_url || null);

      toast({
        title: "Onboarding iniciado",
        description: "Dados persistidos com sucesso no PostgreSQL.",
      });

      onClose?.();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao iniciar onboarding",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-1 md:gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`h-7 w-7 md:h-8 md:w-8 rounded-full flex items-center justify-center text-xs md:text-sm font-semibold ${
                step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 4 && <div className={`w-6 md:w-12 h-1 ${step > s ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm md:text-base">1. Dados do Contato</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Nome</Label>
              <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">E-mail</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">WhatsApp</Label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label className="text-sm">Empresa</Label>
              <Input value={formData.empresa} onChange={(e) => setFormData({ ...formData, empresa: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">Cargo</Label>
              <Input value={formData.cargo} onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">Site / Instagram</Label>
              <Input
                value={formData.site}
                onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                placeholder="@perfil ou site.com"
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm md:text-base">2. Dados do Negocio</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Segmento</Label>
              <Select value={formData.segmento} onValueChange={(v) => setFormData({ ...formData, segmento: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {["Varejo", "Servicos", "Industria", "Saude", "Educacao", "Gastronomia", "Outro"].map((s) => (
                    <SelectItem key={s} value={s.toLowerCase()}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Porte</Label>
              <Select value={formData.porte} onValueChange={(v) => setFormData({ ...formData, porte: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="micro">Micro</SelectItem>
                  <SelectItem value="pme">PME</SelectItem>
                  <SelectItem value="grande">Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Principais canais</Label>
              <div className="flex flex-wrap gap-3 mt-2">
                {canalOptions.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <Checkbox checked={formData.canais.includes(c)} onCheckedChange={() => toggleArray("canais", c)} />
                    <Label className="text-sm">{c}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm">Regiao de atuacao</Label>
              <Input
                value={formData.regiao}
                onChange={(e) => setFormData({ ...formData, regiao: e.target.value })}
                placeholder="Ex: Sao Paulo - SP"
              />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm md:text-base">3. Objetivos do Servico</h3>
          <div className="space-y-3">
            {objetivoOptions.map((obj) => (
              <div key={obj} className="flex items-center gap-2">
                <Checkbox checked={formData.objetivos.includes(obj)} onCheckedChange={() => toggleArray("objetivos", obj)} />
                <Label className="text-sm">{obj}</Label>
              </div>
            ))}
          </div>
          <div>
            <Label className="text-sm">Observacoes adicionais</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Descreva detalhes especificos..."
            />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm md:text-base">4. Resumo e Termos</h3>
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <p>
              <strong>Servico:</strong> {serviceName}
            </p>
            <p>
              <strong>Nome:</strong> {formData.nome}
            </p>
            <p>
              <strong>Empresa:</strong> {formData.empresa}
            </p>
            <p>
              <strong>E-mail:</strong> {formData.email}
            </p>
            <p>
              <strong>WhatsApp:</strong> {formData.whatsapp}
            </p>
            <p>
              <strong>Segmento:</strong> {formData.segmento}
            </p>
            <p>
              <strong>Porte:</strong> {formData.porte}
            </p>
            <p>
              <strong>Canais:</strong> {formData.canais.join(", ") || "-"}
            </p>
            <p>
              <strong>Regiao:</strong> {formData.regiao}
            </p>
            <p>
              <strong>Objetivos:</strong> {formData.objetivos.join(", ") || "-"}
            </p>
            {formData.observacoes && (
              <p>
                <strong>Observacoes:</strong> {formData.observacoes}
              </p>
            )}
          </div>
          <div className="flex items-start gap-2">
            <Checkbox checked={formData.aceiteTermos} onCheckedChange={(c) => setFormData({ ...formData, aceiteTermos: !!c })} />
            <Label className="text-xs text-muted-foreground leading-relaxed">
              Declaro que li e aceito os termos do programa de licenciamento, uso de IA, integracoes com plataformas de
              terceiros e possibilidade de ajustes finos apos implantacao.
            </Label>
          </div>

          {trackingToken && (
            <div className="rounded-lg border p-3 bg-muted/40 space-y-1 text-xs">
              <p>
                <strong>Tracking:</strong> {trackingToken}
              </p>
              <p>
                <strong>Status:</strong> {onboardingStatus || "in_progress"}
              </p>
              <p>
                <strong>Atualizado em:</strong> {statusUpdatedAt ? new Date(statusUpdatedAt).toLocaleString("pt-BR") : "-"}
              </p>
              <p>
                <strong>Pasta Drive:</strong> {driveFolderStatus || "-"}
              </p>
              {driveFolderUrl && (
                <p className="truncate">
                  <strong>Link:</strong> {driveFolderUrl}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
          Voltar
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)}>
            Proximo <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleFinish}
            disabled={!formData.aceiteTermos || isSubmitting || !!trackingToken}
            className="text-xs md:text-sm"
          >
            {isSubmitting ? "Salvando..." : trackingToken ? "Onboarding iniciado" : "Concluir onboarding"}
          </Button>
        )}
      </div>
    </div>
  );
}

const agentes = [
  {
    nome: "Secretaria 24h",
    descricao:
      "Atendimento automatizado via WhatsApp, e-mail e chat, com agendamentos, triagem de leads e respostas a duvidas frequentes, 24h por dia, integrado ao agente de IA flutuante.",
    icon: Clock,
    botao: "Configurar / Comprar",
  },
  {
    nome: "Agente Personalizado de IA",
    descricao:
      "Agente de IA desenvolvido sob medida para o negocio do cliente, integrando CRM, ERP, fluxos comerciais, marketing, operacoes e o que for definido em contrato.",
    icon: Sparkles,
    botao: "Falar com Especialista",
  },
  {
    nome: "Criador de Conteudo com IA",
    descricao:
      "Geracao assistida por IA de conteudos para redes sociais (posts, stories, reels), e-mails, roteiros, textos e pecas de campanha alinhadas a estrategia do cliente.",
    icon: MessageSquare,
    botao: "Configurar / Comprar",
  },
  {
    nome: "Consultoria Comercial com Fernanda Mumic",
    descricao:
      "Consultoria estrategica conduzida por Fernanda Mumic, com foco em estruturacao de processos comerciais, funil de vendas, playbook comercial e uso de IA para prospeccao, follow-up e analise de resultados.",
    icon: Briefcase,
    botao: "Agendar Consultoria",
  },
  {
    nome: "Treinamento de Time Interno em IA",
    descricao:
      "Programa de treinamento para equipes internas, ensinando o uso pratico de IA nos processos da empresa, melhoria de produtividade, cultura de inovacao e adocao segura de tecnologia.",
    icon: GraduationCap,
    botao: "Solicitar Proposta",
  },
];

export default function Marketplace() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Marketplace de Agentes</h1>
        <p className="text-sm md:text-base text-muted-foreground">Solucoes de IA para automatizar seu negocio</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {agentes.map((agente) => (
          <Card key={agente.nome} className="flex flex-col">
            <CardHeader className="p-4 md:p-6">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <agente.icon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <CardTitle className="text-base md:text-lg">{agente.nome}</CardTitle>
              <CardDescription className="text-xs md:text-sm">{agente.descricao}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end p-4 md:p-6 pt-0">
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full text-xs md:text-sm">{agente.botao}</Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] md:max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
                      <agente.icon className="h-5 w-5 text-primary" />
                      {agente.nome}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="mt-4">
                    <MarketplaceWizard serviceName={agente.nome} />
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="py-4 px-4 md:px-6">
          <div className="flex items-start gap-3">
            <Store className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs md:text-sm text-muted-foreground">
              Todos os agentes e servicos sao configurados pela equipe da agencia e comecam a funcionar em ate 48h uteis
              apos a contratacao.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
