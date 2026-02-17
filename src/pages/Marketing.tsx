import { useState, useEffect } from "react";
import { Instagram, Facebook, Youtube, Users, Heart, Calendar, Globe, Plus, Pencil, Trash2, Loader2, Search as SearchIcon, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

function TikTokIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>;
}

interface Rede { id: string; plataforma: string; seguidores: number; engajamento: number; posts_semana: number; crescimento: number; username: string; }
interface CronogramaItem { id: string; dia: string; tipo: string; descricao: string; rede: string; }

const defaultCronograma = [
  { dia: "Seg 03", tipo: "Story", descricao: "Produto em destaque", rede: "Instagram" },
  { dia: "Ter 04", tipo: "Post", descricao: "Depoimento cliente", rede: "Facebook" },
  { dia: "Qua 05", tipo: "Vídeo", descricao: "Bastidores produção", rede: "TikTok" },
  { dia: "Qui 06", tipo: "Live", descricao: "Q&A com especialista", rede: "Instagram" },
  { dia: "Sex 07", tipo: "Reels", descricao: "Dica de estilo", rede: "Instagram" },
  { dia: "Sáb 08", tipo: "Story", descricao: "Promo fim de semana", rede: "Instagram" },
  { dia: "Dom 09", tipo: "Post", descricao: "Inspiração domingo", rede: "TikTok" },
];

const defaultRedes = [
  { plataforma: "TikTok", seguidores: 45200, engajamento: 8.4, posts_semana: 5, crescimento: 12.5, username: "" },
  { plataforma: "Instagram", seguidores: 32800, engajamento: 4.2, posts_semana: 7, crescimento: 8.3, username: "" },
  { plataforma: "Facebook", seguidores: 18500, engajamento: 2.1, posts_semana: 3, crescimento: 1.2, username: "" },
  { plataforma: "YouTube", seguidores: 8900, engajamento: 6.8, posts_semana: 2, crescimento: 15.1, username: "" },
];

const platformIcons: Record<string, any> = { TikTok: TikTokIcon, Instagram, Facebook, YouTube: Youtube };
const platformColors: Record<string, string> = { TikTok: "bg-black", Instagram: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500", Facebook: "bg-blue-600", YouTube: "bg-red-600" };

export default function Marketing() {
  const [redes, setRedes] = useState<Rede[]>([]);
  const [cronograma, setCronograma] = useState<CronogramaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Rede form
  const [redeDialogOpen, setRedeDialogOpen] = useState(false);
  const [editingRedeId, setEditingRedeId] = useState<string | null>(null);
  const [redeForm, setRedeForm] = useState({ plataforma: "Instagram", seguidores: 0, engajamento: 0, posts_semana: 0, crescimento: 0, username: "" });
  const [fetchingStats, setFetchingStats] = useState(false);

  // Cronograma form
  const [cronoDialogOpen, setCronoDialogOpen] = useState(false);
  const [editingCronoId, setEditingCronoId] = useState<string | null>(null);
  const [cronoForm, setCronoForm] = useState({ dia: "", tipo: "Post", descricao: "", rede: "Instagram" });

  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [{ data: redesData }, { data: cronoData }] = await Promise.all([
      supabase.from("marketing_redes").select("*").order("seguidores", { ascending: false }),
      supabase.from("cronograma_conteudo").select("*").order("created_at"),
    ]);
    setRedes((redesData as any) || []);
    setCronograma((cronoData as any) || []);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Rede CRUD
  const openNewRede = () => { setEditingRedeId(null); setRedeForm({ plataforma: "Instagram", seguidores: 0, engajamento: 0, posts_semana: 0, crescimento: 0, username: "" }); setRedeDialogOpen(true); };
  const openEditRede = (r: Rede) => { setEditingRedeId(r.id); setRedeForm({ plataforma: r.plataforma, seguidores: r.seguidores, engajamento: r.engajamento, posts_semana: r.posts_semana, crescimento: r.crescimento, username: r.username || "" }); setRedeDialogOpen(true); };
  const saveRede = async () => {
    setSaving(true);
    if (editingRedeId) {
      await supabase.from("marketing_redes").update(redeForm as any).eq("id", editingRedeId);
      toast({ title: "Rede atualizada!" });
    } else {
      await supabase.from("marketing_redes").insert(redeForm as any);
      toast({ title: "Rede adicionada!" });
    }
    setSaving(false); setRedeDialogOpen(false); fetchData();
  };
  const deleteRede = async (id: string) => { await supabase.from("marketing_redes").delete().eq("id", id); toast({ title: "Rede removida" }); fetchData(); };

  // Fetch social stats via API
  const fetchSocialStats = async () => {
    if (!redeForm.username.trim()) {
      toast({ variant: "destructive", title: "Informe o @ do perfil" });
      return;
    }
    setFetchingStats(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-social-stats", {
        body: { platform: redeForm.plataforma, username: redeForm.username },
      });
      if (error) throw error;
      if (data?.success && data.data) {
        const stats = data.data;
        setRedeForm(f => ({
          ...f,
          seguidores: stats.seguidores || f.seguidores,
          engajamento: stats.engajamento || f.engajamento,
          posts_semana: stats.posts_semana || f.posts_semana,
        }));
        toast({ title: "Dados obtidos!", description: `${stats.seguidores.toLocaleString()} seguidores encontrados` });
      } else {
        toast({ variant: "destructive", title: "Não foi possível obter dados", description: data?.error || "Tente novamente" });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao buscar dados", description: err.message });
    }
    setFetchingStats(false);
  };

  // Cronograma CRUD
  const openNewCrono = () => { setEditingCronoId(null); setCronoForm({ dia: "", tipo: "Post", descricao: "", rede: "Instagram" }); setCronoDialogOpen(true); };
  const openEditCrono = (item: CronogramaItem) => { setEditingCronoId(item.id); setCronoForm({ dia: item.dia, tipo: item.tipo, descricao: item.descricao, rede: item.rede }); setCronoDialogOpen(true); };
  const saveCrono = async () => {
    if (!cronoForm.dia || !cronoForm.descricao) { toast({ variant: "destructive", title: "Preencha dia e descrição" }); return; }
    setSaving(true);
    if (editingCronoId) {
      await supabase.from("cronograma_conteudo").update(cronoForm as any).eq("id", editingCronoId);
      toast({ title: "Item atualizado!" });
    } else {
      await supabase.from("cronograma_conteudo").insert(cronoForm as any);
      toast({ title: "Item adicionado!" });
    }
    setSaving(false); setCronoDialogOpen(false); fetchData();
  };
  const deleteCrono = async (id: string) => { await supabase.from("cronograma_conteudo").delete().eq("id", id); toast({ title: "Item removido" }); fetchData(); };

  if (loading) return <div className="p-6 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Marketing</h1>
        <p className="text-sm md:text-base text-muted-foreground">Redes sociais e cronograma de conteúdo</p>
      </div>

      {/* Redes Sociais */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-semibold flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> Redes Sociais</h2>
          <Button size="sm" onClick={openNewRede} className="gap-1"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova Rede</span></Button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {redes.map(rede => {
            const Icon = platformIcons[rede.plataforma] || Globe;
            const cor = platformColors[rede.plataforma] || "bg-primary";
            return (
              <Card key={rede.id} className="relative group">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                  <Button variant="secondary" size="icon" className="h-6 w-6" onClick={() => openEditRede(rede)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="secondary" size="icon" className="h-6 w-6" onClick={() => deleteRede(rede.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
                <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-lg ${cor} flex items-center justify-center shrink-0`}><Icon className="h-4 w-4 text-white" /></div>
                    <div>
                      <CardTitle className="text-sm md:text-lg">{rede.plataforma}</CardTitle>
                      {rede.username && <p className="text-xs text-muted-foreground">@{rede.username.replace(/^@/, '')}</p>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                    <div>
                      <p className="text-lg md:text-2xl font-bold">{rede.seguidores >= 1000 ? `${(rede.seguidores / 1000).toFixed(1)}K` : rede.seguidores}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Seguidores</p>
                    </div>
                    <div className="md:text-right">
                      <p className="text-base md:text-lg font-semibold text-primary">{Number(rede.engajamento).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 md:justify-end"><Heart className="h-3 w-3" /> Engajamento</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cronograma de Conteúdo */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg"><Calendar className="h-5 w-5 text-primary" /> Cronograma de Conteúdo</CardTitle>
            <Button size="sm" onClick={openNewCrono} className="gap-1"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo Item</span></Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="hidden md:grid grid-cols-7 gap-2">
            {cronograma.map(item => (
              <div key={item.id} className="p-3 bg-muted rounded-lg text-center relative group cursor-pointer" onClick={() => openEditCrono(item)}>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); deleteCrono(item.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
                <p className="text-xs font-semibold text-primary">{item.dia}</p>
                <p className="text-sm font-medium mt-1">{item.tipo}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descricao}</p>
                <p className="text-xs mt-2 px-2 py-0.5 bg-background rounded-full inline-block">{item.rede}</p>
              </div>
            ))}
          </div>
          <div className="md:hidden space-y-2">
            {cronograma.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer" onClick={() => openEditCrono(item)}>
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[50px]"><p className="text-xs font-semibold text-primary">{item.dia}</p></div>
                  <div><p className="text-sm font-medium">{item.tipo}</p><p className="text-xs text-muted-foreground">{item.descricao}</p></div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-0.5 bg-background rounded-full">{item.rede}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteCrono(item.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rede Dialog */}
      <Dialog open={redeDialogOpen} onOpenChange={setRedeDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-md">
          <DialogHeader><DialogTitle>{editingRedeId ? "Editar Rede" : "Nova Rede Social"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Plataforma</Label>
              <Select value={redeForm.plataforma} onValueChange={v => setRedeForm(f => ({ ...f, plataforma: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Instagram">Instagram</SelectItem><SelectItem value="TikTok">TikTok</SelectItem><SelectItem value="Facebook">Facebook</SelectItem><SelectItem value="YouTube">YouTube</SelectItem><SelectItem value="LinkedIn">LinkedIn</SelectItem></SelectContent></Select>
            </div>
            <div>
              <Label>@ do Perfil</Label>
              <div className="flex gap-2 mt-1">
                <Input placeholder="usuario" value={redeForm.username} onChange={e => setRedeForm(f => ({ ...f, username: e.target.value }))} />
                <Button variant="outline" size="icon" onClick={fetchSocialStats} disabled={fetchingStats} title="Buscar dados automaticamente">
                  {fetchingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Informe o @ e clique na lupa para buscar dados automaticamente</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Seguidores</Label><Input type="number" value={redeForm.seguidores} onChange={e => setRedeForm(f => ({ ...f, seguidores: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Engajamento (%)</Label><Input type="number" step="0.1" value={redeForm.engajamento} onChange={e => setRedeForm(f => ({ ...f, engajamento: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Posts/semana</Label><Input type="number" value={redeForm.posts_semana} onChange={e => setRedeForm(f => ({ ...f, posts_semana: parseInt(e.target.value) || 0 }))} /></div>
              <div><Label>Crescimento (%)</Label><Input type="number" step="0.1" value={redeForm.crescimento} onChange={e => setRedeForm(f => ({ ...f, crescimento: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <Button onClick={saveRede} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}{editingRedeId ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cronograma Dialog */}
      <Dialog open={cronoDialogOpen} onOpenChange={setCronoDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-md">
          <DialogHeader><DialogTitle>{editingCronoId ? "Editar Item" : "Novo Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Dia</Label><Input placeholder="Ex: Seg 03" value={cronoForm.dia} onChange={e => setCronoForm(f => ({ ...f, dia: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipo</Label>
                <Select value={cronoForm.tipo} onValueChange={v => setCronoForm(f => ({ ...f, tipo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Post">Post</SelectItem><SelectItem value="Story">Story</SelectItem><SelectItem value="Reels">Reels</SelectItem><SelectItem value="Vídeo">Vídeo</SelectItem><SelectItem value="Live">Live</SelectItem><SelectItem value="Carrossel">Carrossel</SelectItem></SelectContent></Select>
              </div>
              <div><Label>Rede</Label>
                <Select value={cronoForm.rede} onValueChange={v => setCronoForm(f => ({ ...f, rede: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Instagram">Instagram</SelectItem><SelectItem value="TikTok">TikTok</SelectItem><SelectItem value="Facebook">Facebook</SelectItem><SelectItem value="YouTube">YouTube</SelectItem><SelectItem value="LinkedIn">LinkedIn</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div><Label>Descrição</Label><Input placeholder="Descrição do conteúdo" value={cronoForm.descricao} onChange={e => setCronoForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <Button onClick={saveCrono} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}{editingCronoId ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
