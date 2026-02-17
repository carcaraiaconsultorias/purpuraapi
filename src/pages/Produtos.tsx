import { useState, useEffect } from "react";
import { Briefcase, TrendingUp, TrendingDown, Search, Filter, Plus, Pencil, Trash2, Upload, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Servico {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  status: string;
  contratos: number;
  tendencia: string;
  descricao: string | null;
  arquivo_url: string | null;
}

const defaultServicos: Omit<Servico, "id">[] = [
  { nome: "Social Media Mensal", categoria: "Social Media", preco: 2500, status: "Ativo", contratos: 18, tendencia: "up", descricao: null, arquivo_url: null },
  { nome: "Social Media + Audiovisual", categoria: "Social Media", preco: 4500, status: "Ativo", contratos: 12, tendencia: "up", descricao: null, arquivo_url: null },
  { nome: "Consultoria de Marketing", categoria: "Consultoria", preco: 3000, status: "Ativo", contratos: 9, tendencia: "up", descricao: null, arquivo_url: null },
  { nome: "Gestão de Tráfego Pago", categoria: "Tráfego", preco: 1800, status: "Ativo", contratos: 15, tendencia: "up", descricao: null, arquivo_url: null },
  { nome: "Produção Audiovisual Avulsa", categoria: "Audiovisual", preco: 3500, status: "Ativo", contratos: 7, tendencia: "stable", descricao: null, arquivo_url: null },
  { nome: "Branding Completo", categoria: "Consultoria", preco: 8000, status: "Ativo", contratos: 4, tendencia: "stable", descricao: null, arquivo_url: null },
];

const emptyForm = { nome: "", categoria: "", preco: 0, status: "Ativo", contratos: 0, tendencia: "stable", descricao: "", arquivo_url: "" };

export default function Produtos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchServicos = async () => {
    const { data, error } = await supabase.from("servicos").select("*").order("contratos", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setServicos((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchServicos(); }, []);

  const categorias = ["todas", ...Array.from(new Set(servicos.map(s => s.categoria)))];
  const filtered = servicos.filter(s => {
    const matchSearch = s.nome.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoria === "todas" || s.categoria === categoria;
    return matchSearch && matchCat;
  });

  const emAlta = servicos.filter(s => s.tendencia === "up").slice(0, 4);
  const emQueda = servicos.filter(s => s.tendencia === "down").slice(0, 4);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (s: Servico) => {
    setEditingId(s.id);
    setForm({ nome: s.nome, categoria: s.categoria, preco: s.preco, status: s.status, contratos: s.contratos, tendencia: s.tendencia, descricao: s.descricao || "", arquivo_url: s.arquivo_url || "" });
    setDialogOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `servicos/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) { toast({ variant: "destructive", title: "Erro no upload", description: error.message }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
    setForm(f => ({ ...f, arquivo_url: urlData.publicUrl }));
    setUploading(false);
    toast({ title: "Arquivo enviado!" });
  };

  const handleSave = async () => {
    if (!form.nome || !form.categoria) { toast({ variant: "destructive", title: "Preencha nome e categoria" }); return; }
    setSaving(true);
    const payload = { nome: form.nome, categoria: form.categoria, preco: form.preco, status: form.status, contratos: form.contratos, tendencia: form.tendencia, descricao: form.descricao || null, arquivo_url: form.arquivo_url || null };

    if (editingId) {
      const { error } = await supabase.from("servicos").update(payload as any).eq("id", editingId);
      if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); setSaving(false); return; }
      toast({ title: "Serviço atualizado!" });
    } else {
      const { error } = await supabase.from("servicos").insert(payload as any);
      if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); setSaving(false); return; }
      toast({ title: "Serviço criado!" });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchServicos();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("servicos").delete().eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); return; }
    toast({ title: "Serviço removido" });
    fetchServicos();
  };

  if (loading) return <div className="p-6 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Serviços</h1>
          <p className="text-sm md:text-base text-muted-foreground">Portfólio e desempenho dos serviços da agência</p>
        </div>
        <Button onClick={openNew} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Novo Serviço
        </Button>
      </div>

      {/* Em Alta / Em Queda */}
      {(emAlta.length > 0 || emQueda.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          {emAlta.length > 0 && (
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-primary text-base md:text-lg">
                  <TrendingUp className="h-5 w-5" /> Serviços em Alta
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-2">
                {emAlta.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0"><p className="font-medium text-sm truncate">{s.nome}</p><p className="text-xs text-muted-foreground">{s.categoria}</p></div>
                    </div>
                    <div className="text-right shrink-0"><p className="font-semibold text-primary">{s.contratos}</p><p className="text-xs text-muted-foreground">contratos</p></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {emQueda.length > 0 && (
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-destructive text-base md:text-lg">
                  <TrendingDown className="h-5 w-5" /> Serviços em Queda
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-2">
                {emQueda.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
                      <div className="min-w-0"><p className="font-medium text-sm truncate">{s.nome}</p><p className="text-xs text-muted-foreground">{s.categoria}</p></div>
                    </div>
                    <div className="text-right shrink-0"><p className="font-semibold text-destructive">{s.contratos}</p><p className="text-xs text-muted-foreground">contratos</p></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Catálogo */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col gap-4">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Briefcase className="h-5 w-5 text-primary" /> Catálogo de Serviços
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar serviço..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="w-full sm:w-40"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
                <SelectContent>{categorias.map(c => <SelectItem key={c} value={c}>{c === "todas" ? "Todas" : c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b">
                <th className="text-left py-3 px-2 text-sm font-medium">Serviço</th>
                <th className="text-left py-3 px-2 text-sm font-medium">Categoria</th>
                <th className="text-right py-3 px-2 text-sm font-medium">Preço</th>
                <th className="text-center py-3 px-2 text-sm font-medium">Status</th>
                <th className="text-right py-3 px-2 text-sm font-medium">Contratos</th>
                <th className="text-center py-3 px-2 text-sm font-medium">Tendência</th>
                <th className="text-center py-3 px-2 text-sm font-medium">Ações</th>
              </tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">{s.nome}</td>
                    <td className="py-3 px-2 text-muted-foreground">{s.categoria}</td>
                    <td className="py-3 px-2 text-right">R$ {Number(s.preco).toFixed(2)}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${s.status === "Ativo" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{s.status}</span>
                    </td>
                    <td className="py-3 px-2 text-right font-semibold">{s.contratos}</td>
                    <td className="py-3 px-2 text-center">
                      {s.tendencia === "up" && <TrendingUp className="h-4 w-4 text-primary inline" />}
                      {s.tendencia === "down" && <TrendingDown className="h-4 w-4 text-destructive inline" />}
                      {s.tendencia === "stable" && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {filtered.map(s => (
              <div key={s.id} className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{s.nome}</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.categoria}</span>
                  <span className="font-semibold">R$ {Number(s.preco).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${s.status === "Ativo" ? "bg-primary/20 text-primary" : "bg-background text-muted-foreground"}`}>{s.status}</span>
                  <span className="text-sm text-muted-foreground">{s.contratos} contratos</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Nome</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex: Social Media" /></div>
              <div><Label>Preço (R$)</Label><Input type="number" value={form.preco} onChange={e => setForm(f => ({ ...f, preco: parseFloat(e.target.value) || 0 }))} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                    <SelectItem value="Baixa demanda">Baixa demanda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tendência</Label>
                <Select value={form.tendencia} onValueChange={v => setForm(f => ({ ...f, tendencia: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up">Em alta</SelectItem>
                    <SelectItem value="stable">Estável</SelectItem>
                    <SelectItem value="down">Em queda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Contratos</Label><Input type="number" value={form.contratos} onChange={e => setForm(f => ({ ...f, contratos: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} /></div>
            <div>
              <Label>Arquivo/Documento</Label>
              <div className="flex items-center gap-2 mt-1">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-muted transition-colors">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Enviando..." : "Upload"}
                  <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" />
                </label>
                {form.arquivo_url && <a href={form.arquivo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline truncate max-w-[200px]">Ver arquivo</a>}
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? "Salvar Alterações" : "Criar Serviço"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
