import { useState, useEffect } from "react";
import { Target, TrendingUp, AlertCircle, GraduationCap, BookOpen, CheckCircle, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Meta { id: string; vendedor: string; meta: number; realizado: number; canal: string; periodo: string; }
interface Oportunidade { id: string; cliente: string; valor: number; etapa: string; responsavel: string | null; dias_parado: number; observacao: string | null; }

const defaultMetas = [
  { vendedor: "Ana Paula", meta: 50000, realizado: 42500, canal: "Online", periodo: "Mensal" },
  { vendedor: "Carlos Silva", meta: 45000, realizado: 38700, canal: "Presencial", periodo: "Mensal" },
  { vendedor: "Mariana Costa", meta: 35000, realizado: 28000, canal: "Online", periodo: "Mensal" },
  { vendedor: "João Pedro", meta: 30000, realizado: 31200, canal: "Presencial", periodo: "Mensal" },
];

const defaultOps = [
  { cliente: "Tech Solutions Ltda", valor: 15000, dias_parado: 22, etapa: "Proposta", responsavel: "Ana Paula", observacao: null },
  { cliente: "Varejo Express", valor: 8500, dias_parado: 18, etapa: "Qualificado", responsavel: "Carlos Silva", observacao: null },
  { cliente: "Indústria ABC", valor: 25000, dias_parado: 15, etapa: "Proposta", responsavel: "Mariana Costa", observacao: null },
];

const funil = [
  { etapa: "Lead", cor: "bg-blue-500" },
  { etapa: "Qualificado", cor: "bg-yellow-500" },
  { etapa: "Proposta", cor: "bg-orange-500" },
  { etapa: "Fechado", cor: "bg-primary" },
];

const playbook = [
  { titulo: "Prospecção", descricao: "Identifique potenciais clientes através de redes sociais, indicações e eventos." },
  { titulo: "Qualificação", descricao: "Verifique se o lead tem orçamento, necessidade, autoridade e timing (BANT)." },
  { titulo: "Proposta", descricao: "Apresente uma solução personalizada focando nos benefícios para o cliente." },
  { titulo: "Negociação", descricao: "Trabalhe objeções com empatia e apresente casos de sucesso similares." },
  { titulo: "Fechamento", descricao: "Crie senso de urgência genuíno e facilite o processo de decisão." },
  { titulo: "Pós-venda", descricao: "Mantenha contato regular e busque indicações e upsell." },
];

export default function Comercial() {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [ops, setOps] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Meta form
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [metaForm, setMetaForm] = useState({ vendedor: "", meta: 0, realizado: 0, canal: "Online", periodo: "Mensal" });
  const [saving, setSaving] = useState(false);

  // Oportunidade form
  const [opDialogOpen, setOpDialogOpen] = useState(false);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [opForm, setOpForm] = useState({ cliente: "", valor: 0, etapa: "Lead", responsavel: "", dias_parado: 0, observacao: "" });

  const fetchData = async () => {
    const [{ data: metasData }, { data: opsData }] = await Promise.all([
      supabase.from("comercial_metas").select("*").order("meta", { ascending: false }),
      supabase.from("comercial_oportunidades").select("*").order("dias_parado", { ascending: false }),
    ]);
    setMetas((metasData as any) || []);
    setOps((opsData as any) || []);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Funil counts from oportunidades
  const funilCounts = funil.map(f => ({
    ...f,
    quantidade: ops.filter(o => o.etapa === f.etapa).length || (f.etapa === "Lead" ? 45 : f.etapa === "Qualificado" ? 28 : f.etapa === "Proposta" ? 15 : 8),
  }));
  const maxFunil = Math.max(...funilCounts.map(f => f.quantidade), 1);

  // Meta CRUD
  const openNewMeta = () => { setEditingMetaId(null); setMetaForm({ vendedor: "", meta: 0, realizado: 0, canal: "Online", periodo: "Mensal" }); setMetaDialogOpen(true); };
  const openEditMeta = (m: Meta) => { setEditingMetaId(m.id); setMetaForm({ vendedor: m.vendedor, meta: m.meta, realizado: m.realizado, canal: m.canal, periodo: m.periodo }); setMetaDialogOpen(true); };
  const saveMeta = async () => {
    if (!metaForm.vendedor) { toast({ variant: "destructive", title: "Preencha o vendedor" }); return; }
    setSaving(true);
    const payload = { ...metaForm };
    if (editingMetaId) {
      await supabase.from("comercial_metas").update(payload as any).eq("id", editingMetaId);
      toast({ title: "Meta atualizada!" });
    } else {
      await supabase.from("comercial_metas").insert(payload as any);
      toast({ title: "Meta criada!" });
    }
    setSaving(false); setMetaDialogOpen(false); fetchData();
  };
  const deleteMeta = async (id: string) => {
    await supabase.from("comercial_metas").delete().eq("id", id);
    toast({ title: "Meta removida" }); fetchData();
  };

  // Oportunidade CRUD
  const openNewOp = () => { setEditingOpId(null); setOpForm({ cliente: "", valor: 0, etapa: "Lead", responsavel: "", dias_parado: 0, observacao: "" }); setOpDialogOpen(true); };
  const openEditOp = (o: Oportunidade) => { setEditingOpId(o.id); setOpForm({ cliente: o.cliente, valor: o.valor, etapa: o.etapa, responsavel: o.responsavel || "", dias_parado: o.dias_parado, observacao: o.observacao || "" }); setOpDialogOpen(true); };
  const saveOp = async () => {
    if (!opForm.cliente) { toast({ variant: "destructive", title: "Preencha o cliente" }); return; }
    setSaving(true);
    const payload = { cliente: opForm.cliente, valor: opForm.valor, etapa: opForm.etapa, responsavel: opForm.responsavel || null, dias_parado: opForm.dias_parado, observacao: opForm.observacao || null };
    if (editingOpId) {
      await supabase.from("comercial_oportunidades").update(payload as any).eq("id", editingOpId);
      toast({ title: "Oportunidade atualizada!" });
    } else {
      await supabase.from("comercial_oportunidades").insert(payload as any);
      toast({ title: "Oportunidade criada!" });
    }
    setSaving(false); setOpDialogOpen(false); fetchData();
  };
  const deleteOp = async (id: string) => {
    await supabase.from("comercial_oportunidades").delete().eq("id", id);
    toast({ title: "Oportunidade removida" }); fetchData();
  };

  if (loading) return <div className="p-6 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Comercial</h1>
          <p className="text-sm md:text-base text-muted-foreground">Metas, funil e performance de vendas</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <GraduationCap className="h-4 w-4" /> Playbook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Playbook de Vendas</DialogTitle></DialogHeader>
            <Tabs defaultValue="playbook" className="mt-4">
              <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="playbook">Playbook</TabsTrigger><TabsTrigger value="manual">Manual</TabsTrigger></TabsList>
              <TabsContent value="playbook" className="space-y-4 mt-4">
                {playbook.map((item, i) => (
                  <div key={item.titulo} className="flex gap-3 p-3 bg-muted rounded-lg">
                    <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">{i + 1}</div>
                    <div><h4 className="font-semibold text-sm">{item.titulo}</h4><p className="text-xs text-muted-foreground">{item.descricao}</p></div>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="manual" className="mt-4">
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2 text-sm">Princípios Fundamentais</h4>
                  <ul className="space-y-2 text-xs">
                    <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Escute mais do que fale</li>
                    <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Venda soluções, não produtos</li>
                    <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Faça follow-up consistente</li>
                    <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Construa relacionamentos de longo prazo</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metas */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg"><Target className="h-5 w-5 text-primary" /> Metas por Vendedor</CardTitle>
            <Button size="sm" onClick={openNewMeta} className="gap-1"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova Meta</span></Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b">
                <th className="text-left py-3 px-2 text-sm font-medium">Vendedor</th>
                <th className="text-left py-3 px-2 text-sm font-medium">Canal</th>
                <th className="text-right py-3 px-2 text-sm font-medium">Meta</th>
                <th className="text-right py-3 px-2 text-sm font-medium">Realizado</th>
                <th className="text-right py-3 px-2 text-sm font-medium">%</th>
                <th className="py-3 px-2 text-sm font-medium w-32">Progresso</th>
                <th className="text-center py-3 px-2 text-sm font-medium">Ações</th>
              </tr></thead>
              <tbody>
                {metas.map(m => {
                  const pct = m.meta > 0 ? Math.round((Number(m.realizado) / Number(m.meta)) * 100) : 0;
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-3 px-2 font-medium">{m.vendedor}</td>
                      <td className="py-3 px-2"><span className={`text-xs px-2 py-1 rounded-full ${m.canal === "Online" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"}`}>{m.canal}</span></td>
                      <td className="py-3 px-2 text-right">R$ {Number(m.meta).toLocaleString()}</td>
                      <td className="py-3 px-2 text-right">R$ {Number(m.realizado).toLocaleString()}</td>
                      <td className={`py-3 px-2 text-right font-semibold ${pct >= 100 ? "text-primary" : ""}`}>{pct}%</td>
                      <td className="py-3 px-2"><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} /></div></td>
                      <td className="py-3 px-2 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditMeta(m)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMeta(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {metas.map(m => {
              const pct = m.meta > 0 ? Math.round((Number(m.realizado) / Number(m.meta)) * 100) : 0;
              return (
                <div key={m.id} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{m.vendedor}</p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMeta(m)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMeta(m.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Meta: R$ {Number(m.meta).toLocaleString()}</span>
                    <span className={`font-semibold ${pct >= 100 ? "text-primary" : ""}`}>{pct}%</span>
                  </div>
                  <div className="h-2 bg-background rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        {/* Funil */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg"><TrendingUp className="h-5 w-5 text-primary" /> Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-3">
            {funilCounts.map(etapa => (
              <div key={etapa.etapa} className="flex items-center gap-3">
                <div className="w-20 text-xs font-medium">{etapa.etapa}</div>
                <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                  <div className={`h-full ${etapa.cor} flex items-center justify-end pr-3 text-white font-semibold text-sm`} style={{ width: `${(etapa.quantidade / maxFunil) * 100}%` }}>{etapa.quantidade}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Oportunidades */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg"><AlertCircle className="h-5 w-5 text-destructive" /> Oportunidades</CardTitle>
              <Button size="sm" onClick={openNewOp} className="gap-1"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova</span></Button>
            </div>
            <CardDescription>Leads parados há mais de 10 dias</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-3">
            {ops.map(op => (
              <div key={op.id} className="flex items-center justify-between p-3 bg-muted rounded-lg gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{op.cliente}</p>
                  <p className="text-xs text-muted-foreground">{op.etapa}{op.responsavel ? ` • ${op.responsavel}` : ""}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="font-semibold text-sm">R$ {Number(op.valor).toLocaleString()}</p>
                    <p className="text-xs text-destructive">{op.dias_parado} dias</p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditOp(op)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteOp(op.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Meta Dialog */}
      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-md">
          <DialogHeader><DialogTitle>{editingMetaId ? "Editar Meta" : "Nova Meta"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Vendedor</Label><Input value={metaForm.vendedor} onChange={e => setMetaForm(f => ({ ...f, vendedor: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Meta (R$)</Label><Input type="number" value={metaForm.meta} onChange={e => setMetaForm(f => ({ ...f, meta: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Realizado (R$)</Label><Input type="number" value={metaForm.realizado} onChange={e => setMetaForm(f => ({ ...f, realizado: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Canal</Label>
                <Select value={metaForm.canal} onValueChange={v => setMetaForm(f => ({ ...f, canal: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Online">Online</SelectItem><SelectItem value="Presencial">Presencial</SelectItem></SelectContent></Select>
              </div>
              <div><Label>Período</Label>
                <Select value={metaForm.periodo} onValueChange={v => setMetaForm(f => ({ ...f, periodo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Mensal">Mensal</SelectItem><SelectItem value="Trimestral">Trimestral</SelectItem><SelectItem value="Anual">Anual</SelectItem></SelectContent></Select>
              </div>
            </div>
            <Button onClick={saveMeta} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editingMetaId ? "Salvar" : "Criar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Oportunidade Dialog */}
      <Dialog open={opDialogOpen} onOpenChange={setOpDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-md">
          <DialogHeader><DialogTitle>{editingOpId ? "Editar Oportunidade" : "Nova Oportunidade"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Cliente</Label><Input value={opForm.cliente} onChange={e => setOpForm(f => ({ ...f, cliente: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor (R$)</Label><Input type="number" value={opForm.valor} onChange={e => setOpForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Etapa</Label>
                <Select value={opForm.etapa} onValueChange={v => setOpForm(f => ({ ...f, etapa: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Lead">Lead</SelectItem><SelectItem value="Qualificado">Qualificado</SelectItem><SelectItem value="Proposta">Proposta</SelectItem><SelectItem value="Fechado">Fechado</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Responsável</Label><Input value={opForm.responsavel} onChange={e => setOpForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
              <div><Label>Dias parado</Label><Input type="number" value={opForm.dias_parado} onChange={e => setOpForm(f => ({ ...f, dias_parado: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div><Label>Observação</Label><Textarea value={opForm.observacao} onChange={e => setOpForm(f => ({ ...f, observacao: e.target.value }))} rows={2} /></div>
            <Button onClick={saveOp} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editingOpId ? "Salvar" : "Criar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
