import { useState } from "react";
import { Plus, Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUpload } from "@/contexts/UploadContext";
import { toast } from "sonner";

export function UploadModal() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [textContent, setTextContent] = useState("");
  const { addUpload } = useUpload();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
    }
  };

  const handleSubmitFile = () => {
    if (fileName) {
      addUpload(fileName, "pdf");
      toast.success("Informação recebida. O agente vai considerar esse conteúdo nas próximas análises.");
      setFileName("");
      setOpen(false);
    }
  };

  const handleSubmitText = () => {
    if (textContent.trim()) {
      const name = `Texto_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}`;
      addUpload(name, "text");
      toast.success("Informação recebida. O agente vai considerar esse conteúdo nas próximas análises.");
      setTextContent("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Cadastrar Informação
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Informação</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="pdf" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pdf" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload PDF
            </TabsTrigger>
            <TabsTrigger value="text" className="gap-2">
              <FileText className="h-4 w-4" />
              Texto
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pdf" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="file">Selecione um arquivo PDF</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
              />
              {fileName && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm flex-1">{fileName}</span>
                  <button onClick={() => setFileName("")}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <Button onClick={handleSubmitFile} disabled={!fileName} className="w-full">
              Enviar PDF
            </Button>
          </TabsContent>
          <TabsContent value="text" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="content">Cole ou digite o conteúdo</Label>
              <Textarea
                id="content"
                placeholder="Informações sobre produtos, processos, manuais..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
              />
            </div>
            <Button onClick={handleSubmitText} disabled={!textContent.trim()} className="w-full">
              Enviar Texto
            </Button>
          </TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground text-center mt-2">
          O conteúdo enviado será usado como base de conhecimento para o Agente de Negócios.
        </p>
      </DialogContent>
    </Dialog>
  );
}
