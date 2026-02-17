import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Contact, Search, Plus, Trash2, Save, Building2, CreditCard, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Cliente {
  id: string;
  nome: string;
  cnpj: string;
  endereco: string;
  colaborador_responsavel: string;
  valor_mensal: number;
  dados_pagamento: string;
  email: string;
  telefone: string;
}

interface Servico {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  status: string;
}

interface ClienteServico {
  servico_id: string;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [editCliente, setEditCliente] = useState<Partial<Cliente>>({});
  const [clienteServicos, setClienteServicos] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [novoCliente, setNovoCliente] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchClientes = async () => {
    const { data } = await supabase
      .from("clientes")
      .select("id, nome, cnpj, endereco, colaborador_responsavel, valor_mensal, dados_pagamento, email, telefone")
      .order("nome");
    if (data) setClientes(data);
    setLoading(false);
  };

  const fetchServicos = async () => {
    const { data } = await supabase.from("servicos").select("id, nome, categoria, preco, status");
    if (data) setServicos(data);
  };

  useEffect(() => {
    fetchClientes();
    fetchServicos();
  }, []);

  const openClienteDetail = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setEditCliente({ ...cliente });
    const { data } = await supabase
      .from("cliente_servicos")
      .select("servico_id")
      .eq("cliente_id", cliente.id);
    setClienteServicos((data || []).map((cs: ClienteServico) => cs.servico_id));
    setDialogOpen(true);
  };

  const toggleServico = async (servicoId: string) => {
    if (!selectedCliente) return;
    const isLinked = clienteServicos.includes(servicoId);
    if (isLinked) {
      await supabase.from("cliente_servicos").delete().eq("cliente_id", selectedCliente.id).eq("servico_id", servicoId);
      setClienteServicos((prev) => prev.filter((id) => id !== servicoId));
    } else {
      await supabase.from("cliente_servicos").insert({ cliente_id: selectedCliente.id, servico_id: servicoId });
      setClienteServicos((prev) => [...prev, servicoId]);
    }
  };

  const saveCliente = async () => {
    if (!selectedCliente) return;
    setSaving(true);
    const { error } = await supabase
      .from("clientes")
      .update({
        cnpj: editCliente.cnpj || "",
        endereco: editCliente.endereco || "",
        colaborador_responsavel: editCliente.colaborador_responsavel || "",
        valor_mensal: editCliente.valor_mensal || 0,
        dados_pagamento: editCliente.dados_pagamento || "",
        email: editCliente.email || "",
        telefone: editCliente.telefone || "",
      })
      .eq("id", selectedCliente.id);
    setSaving(false);
    if (!error) {
      toast({ title: "Dados salvos com sucesso" });
      fetchClientes();
    }
  };

  const addCliente = async () => {
    if (!novoCliente.trim()) return;
    const { error } = await supabase.from("clientes").insert({ nome: novoCliente.trim() });
    if (!error) {
      toast({ title: "Cliente adicionado" });
      setNovoCliente("");
      setAddDialogOpen(false);
      fetchClientes();
    }
  };

  const deleteCliente = async (id: string) => {
    await supabase.from("clientes").delete().eq("id", id);
    toast({ title: "Cliente removido" });
    fetchClientes();
  };

  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  const linkedServicos = servicos.filter((s) => clienteServicos.includes(s.id));
  const totalServicos = linkedServicos.reduce((sum, s) => sum + s.preco, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Contact className="h-6 w-6 text-primary" />
            Clientes
          </h1>
          <p className="text-sm text-muted-foreground">{clientes.length} clientes cadastrados</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((cliente) => (
            <Card key={cliente.id} className="cursor-pointer hover:border-primary/50 transition-colors group" onClick={() => openClienteDetail(cliente)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{cliente.nome}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); deleteCliente(cliente.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                {cliente.colaborador_responsavel && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">Resp: {cliente.colaborador_responsavel}</p>
                )}
                {cliente.valor_mensal > 0 && (
                  <Badge variant="secondary" className="mt-2 text-xs">R$ {cliente.valor_mensal.toLocaleString("pt-BR")}/mês</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Painel completo do cliente */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedCliente?.nome}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="dados" className="flex items-center gap-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5" /> Dados
              </TabsTrigger>
              <TabsTrigger value="pagamento" className="flex items-center gap-1.5 text-xs">
                <CreditCard className="h-3.5 w-3.5" /> Pagamento
              </TabsTrigger>
              <TabsTrigger value="servicos" className="flex items-center gap-1.5 text-xs">
                <Package className="h-3.5 w-3.5" /> Serviços
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">CNPJ</Label>
                  <Input placeholder="00.000.000/0000-00" value={editCliente.cnpj || ""} onChange={(e) => setEditCliente({ ...editCliente, cnpj: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Colaborador Responsável</Label>
                  <Input placeholder="Nome do responsável" value={editCliente.colaborador_responsavel || ""} onChange={(e) => setEditCliente({ ...editCliente, colaborador_responsavel: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail</Label>
                  <Input placeholder="email@exemplo.com" value={editCliente.email || ""} onChange={(e) => setEditCliente({ ...editCliente, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input placeholder="(00) 00000-0000" value={editCliente.telefone || ""} onChange={(e) => setEditCliente({ ...editCliente, telefone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Endereço</Label>
                <Input placeholder="Endereço completo" value={editCliente.endereco || ""} onChange={(e) => setEditCliente({ ...editCliente, endereco: e.target.value })} />
              </div>
              <Button onClick={saveCliente} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar Dados"}
              </Button>
            </TabsContent>

            <TabsContent value="pagamento" className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor Mensal (R$)</Label>
                  <Input type="number" placeholder="0,00" value={editCliente.valor_mensal || ""} onChange={(e) => setEditCliente({ ...editCliente, valor_mensal: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dados de Pagamento</Label>
                  <Input placeholder="PIX, boleto, cartão..." value={editCliente.dados_pagamento || ""} onChange={(e) => setEditCliente({ ...editCliente, dados_pagamento: e.target.value })} />
                </div>
              </div>
              {totalServicos > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">Total em serviços vinculados</p>
                  <p className="text-lg font-bold text-primary">R$ {totalServicos.toLocaleString("pt-BR")}</p>
                </div>
              )}
              <Button onClick={saveCliente} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar Pagamento"}
              </Button>
            </TabsContent>

            <TabsContent value="servicos" className="space-y-3 mt-4">
              {servicos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>
              ) : (
                servicos.map((servico) => {
                  const isLinked = clienteServicos.includes(servico.id);
                  return (
                    <div key={servico.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => toggleServico(servico.id)}>
                      <Checkbox checked={isLinked} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{servico.nome}</p>
                        <p className="text-xs text-muted-foreground">{servico.categoria}</p>
                      </div>
                      <Badge variant={isLinked ? "default" : "secondary"}>R$ {servico.preco.toLocaleString("pt-BR")}</Badge>
                    </div>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialog adicionar cliente */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <Input placeholder="Nome do cliente" value={novoCliente} onChange={(e) => setNovoCliente(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCliente()} />
          <DialogFooter>
            <Button onClick={addCliente}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
