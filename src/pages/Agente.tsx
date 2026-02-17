import { useState, useRef, useEffect } from "react";
import { Send, Target, TrendingUp, Megaphone, Clock, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import carcaraIconBlue from "@/assets/carcara-icon-blue.png";
import caueMagnani from "@/assets/caue-magnani.webp";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const DEMO_RESPONSES: Record<string, string> = {
  priorizar: "Analisando suas últimas vendas, recomendo focar nos 12 clientes que compraram há mais de 90 dias, mas já tiveram 2 ou mais pedidos. Eles têm alto potencial de recompra! Além disso, você tem 3 propostas que vencem amanhã - feche-as antes que esfriem.",
  funil: "Seu funil está saudável! Você tem 45 leads, 28 qualificados, 15 propostas abertas e fechou 8 negócios este mês. A taxa de conversão está em 17,7%, acima da média do setor (12%). O gargalo está na passagem de Qualificado para Proposta - pode melhorar o follow-up nessa etapa.",
  campanha: "Com base no seu histórico, sugiro uma campanha de reativação por WhatsApp para clientes inativos há 60+ dias. Você tem 34 clientes nesse perfil que gastaram em média R$ 450. Uma oferta de 10% de desconto deve trazer pelo menos 8 de volta.",
  produtos: "Esta semana, os produtos que mais venderam foram: Camiseta Premium (+23%), Calça Jeans Slim (+18%) e Kit Acessórios (+15%). O Kit está em alta devido ao combo promocional. Sugiro aumentar o estoque do Kit e criar um story destacando-o.",
  meta: "Você está em 85% da meta mensal com 12 dias restantes. No ritmo atual, deve atingir 102%. Para garantir, foque nas 15 propostas abertas - se fechar 5 delas, passa de 110%.",
  default: "Entendi sua pergunta! Analisando os dados do seu negócio... Com base nas informações disponíveis, posso ajudá-lo a tomar melhores decisões. Me conte mais detalhes sobre o que precisa.",
};

function getResponse(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("priorizar") || q.includes("hoje") || q.includes("fazer")) return DEMO_RESPONSES.priorizar;
  if (q.includes("funil") || q.includes("pipeline")) return DEMO_RESPONSES.funil;
  if (q.includes("campanha") || q.includes("marketing") || q.includes("ação")) return DEMO_RESPONSES.campanha;
  if (q.includes("produto") || q.includes("faturamento") || q.includes("vendeu")) return DEMO_RESPONSES.produtos;
  if (q.includes("meta") || q.includes("objetivo")) return DEMO_RESPONSES.meta;
  return DEMO_RESPONSES.default;
}

const kpis = [
  { title: "Meta do Mês", value: "85%", subtitle: "R$ 127k / R$ 150k", icon: Target },
  { title: "Oportunidades", value: "15", subtitle: "Propostas abertas", icon: TrendingUp },
  { title: "Campanhas Ativas", value: "3", subtitle: "E-mail, WhatsApp, Redes", icon: Megaphone },
];

export default function Agente() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Olá! Sou o Agente de Negócios Carcará, seu consultor virtual. Posso analisar seus dados de vendas, marketing e produtos para ajudá-lo a tomar decisões melhores. O que você gostaria de saber?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [kpisOpen, setKpisOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    setTimeout(() => {
      const response: Message = {
        id: (Date.now() + 1).toString(),
        text: getResponse(input),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, response]);
    }, 1200);
  };

  const suggestions = [
    "O que devo priorizar hoje?",
    "Como está meu funil?",
    "Que campanha posso rodar?",
    "Quais produtos mais venderam?",
    "Como está minha meta?",
  ];

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row gap-4 md:gap-6">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-card rounded-lg border min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 md:p-4 border-b bg-carcara-dark-blue rounded-t-lg">
          <img src={carcaraIconBlue} alt="Carcará" className="h-10 w-10 md:h-12 md:w-12 rounded-full object-cover" />
          <div className="flex-1">
            <h2 className="font-semibold text-primary-foreground text-sm md:text-base">Agente de Negócios Carcará</h2>
            <p className="text-xs text-primary-foreground/70">Seu consultor virtual de vendas e marketing</p>
          </div>
          <div className="flex items-center gap-2">
            <img src={caueMagnani} alt="Cauê Magnani" className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover border-2 border-primary/30" />
            <span className="hidden md:inline text-xs text-primary-foreground/70">Cauê M.</span>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] md:max-w-[80%] rounded-lg px-4 py-3 ${
                    message.isUser
                      ? "chat-bubble-user"
                      : "chat-bubble-agent"
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                  <p className="text-xs opacity-60 mt-1">
                    {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Suggestions */}
        <div className="px-4 py-3 border-t">
          <p className="text-xs text-muted-foreground mb-2">Sugestões de perguntas:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, window.innerWidth < 768 ? 3 : 5).map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-full transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua pergunta..."
              className="flex-1"
            />
            <Button type="submit" className="shrink-0">
              <Send className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Enviar</span>
            </Button>
          </form>
        </div>
      </div>

      {/* Sidebar KPIs - Collapsible on mobile */}
      <div className="lg:w-72 space-y-4">
        {/* Mobile collapsible */}
        <Collapsible open={kpisOpen} onOpenChange={setKpisOpen} className="lg:hidden">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="font-semibold">KPIs do Dia</span>
              {kpisOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3">
            <div className="grid grid-cols-3 gap-2">
              {kpis.map((kpi) => (
                <Card key={kpi.title} className="p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <kpi.icon className="h-3 w-3 text-primary" />
                    <p className="text-xs font-medium truncate">{kpi.title}</p>
                  </div>
                  <p className="text-lg font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground truncate">{kpi.subtitle}</p>
                </Card>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Desktop view */}
        <div className="hidden lg:block space-y-4">
          <h3 className="font-semibold">KPIs do Dia</h3>
          {kpis.map((kpi) => (
            <Card key={kpi.title}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <kpi.icon className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
              </CardContent>
            </Card>
          ))}

          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-primary mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Análises automáticas diárias, semanais e mensais enviadas por e-mail e WhatsApp.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
