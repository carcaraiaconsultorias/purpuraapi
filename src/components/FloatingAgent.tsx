import { useState, useRef, useEffect } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import carcaraIconBlue from "@/assets/carcara-icon-blue.png";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "Qual o status das implantações?",
  "Como está meu funil neste mês?",
  "Crie uma pauta de conteúdo para a semana",
  "Quais clientes estão em onboarding?",
];

const DEMO_RESPONSES: Record<string, string> = {
  onboarding: "Atualmente você tem 2 clientes em processo de onboarding: Farmácia Vida Nova (ajustes finos nos prompts) e Restaurante Sabor Real (em configuração inicial). Posso criar as pastas no Drive e os cards no Trello para o Restaurante Sabor Real assim que as credenciais forem configuradas.",
  funil: "Seu funil está saudável! 45 leads, 28 qualificados, 15 propostas abertas e 8 negócios fechados este mês. A taxa de conversão está em 17,7%, acima da média do setor. Sugiro priorizar as propostas que vencem nos próximos 3 dias.",
  implantacao: "Status das implantações:\n• Casa Bella Decor — Superagente de Onboarding: ✅ Ativo\n• Studio Fitness Pro — Superagente Operacional: ✅ Ativo\n• Farmácia Vida Nova — Onboarding: ⚙️ Ajustes finos\n• Restaurante Sabor Real — Operacional: 🔧 Em Configuração\n• AutoPeças Express — Onboarding: ⏸️ Pausado",
  pauta: "Sugestão de pauta semanal:\n• Seg: Post educativo sobre IA nos negócios\n• Ter: Story com bastidores da equipe\n• Qua: Reels com dica rápida de produtividade\n• Qui: Carrossel com case de sucesso\n• Sex: Post institucional + CTA para consultoria\n\nPosso gerar as legendas e roteiros para cada peça.",
  operacional: "Como Superagente Operacional, posso: gerar pautas e briefings, criar tarefas no Trello, consultar documentos no Drive, responder dúvidas recorrentes do time e alimentar o dashboard de gestão. Lembre-se que algumas ações dependem das credenciais e permissões das plataformas integradas.",
  default: "Entendi sua pergunta! Como agente de IA da Carcará, posso ajudar com onboarding de clientes, operações internas, geração de conteúdo, consulta de métricas e gestão de implantações. Algumas funcionalidades dependem de integrações ativas (Google Drive, Trello, WhatsApp). Em que posso ajudar?",
};

function getResponse(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("onboarding") || q.includes("cliente") || q.includes("entrada")) return DEMO_RESPONSES.onboarding;
  if (q.includes("funil") || q.includes("vendas") || q.includes("conversão")) return DEMO_RESPONSES.funil;
  if (q.includes("status") || q.includes("implantação") || q.includes("implantac")) return DEMO_RESPONSES.implantacao;
  if (q.includes("pauta") || q.includes("conteúdo") || q.includes("conteudo") || q.includes("post")) return DEMO_RESPONSES.pauta;
  if (q.includes("operacional") || q.includes("tarefa") || q.includes("briefing") || q.includes("drive")) return DEMO_RESPONSES.operacional;
  return DEMO_RESPONSES.default;
}

interface FloatingAgentProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FloatingAgentChat({ isOpen, onClose }: FloatingAgentProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Olá! Sou o Agente de IA Carcará. Posso ajudar com onboarding de clientes, operações internas, conteúdo, métricas e gestão de implantações. O que você precisa?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
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
    }, 1000);
  };

  const handleSuggestion = (question: string) => {
    setInput(question);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      
      <div className="fixed bottom-0 right-0 md:bottom-20 md:right-4 w-full md:w-96 h-[85vh] md:h-[500px] bg-card border md:rounded-lg shadow-2xl flex flex-col z-50">
        <div className="flex items-center gap-3 p-4 border-b bg-carcara-dark-blue md:rounded-t-lg">
          <img src={carcaraIconBlue} alt="Carcará" className="h-10 w-10 rounded-full object-cover" />
          <div className="flex-1">
            <h3 className="font-semibold text-primary-foreground text-sm md:text-base">Agente de IA Carcará</h3>
            <p className="text-xs text-primary-foreground/70">Onboarding · Operacional · Suporte</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-primary-foreground hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] md:max-w-[80%] rounded-lg px-4 py-2 ${
                  message.isUser ? "chat-bubble-user" : "chat-bubble-agent"
                }`}>
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="px-4 py-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Sugestões:</p>
          <div className="flex flex-wrap gap-1">
            {SUGGESTED_QUESTIONS.slice(0, 2).map((q) => (
              <button key={q} onClick={() => handleSuggestion(q)} className="text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded-full transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite sua pergunta..." className="flex-1" />
            <Button type="submit" size="icon" className="shrink-0"><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </div>
    </>
  );
}

export function FloatingAgentButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 h-16 w-16 md:h-18 md:w-18 rounded-full shadow-lg hover:scale-105 transition-all flex items-center justify-center z-50 overflow-hidden p-0 border-0"
    >
      <img src={carcaraIconBlue} alt="Agente" className="h-full w-full object-cover rounded-full" />
    </button>
  );
}
