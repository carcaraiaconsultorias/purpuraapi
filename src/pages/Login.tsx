import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Lock } from "lucide-react";
import carcaraLogo from "@/assets/carcara-logo.png";
import purpuraLogo from "@/assets/purpura-logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, isLocked, lockoutEndTime } = useAuth();
  const navigate = useNavigate();
  const [lockoutRemaining, setLockoutRemaining] = useState<string>("");

  useEffect(() => {
    if (!lockoutEndTime) {
      setLockoutRemaining("");
      return;
    }
    const updateTimer = () => {
      const remaining = lockoutEndTime - Date.now();
      if (remaining <= 0) {
        setLockoutRemaining("");
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setLockoutRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockoutEndTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const result = await login(email, password);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error || "Erro ao fazer login.");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-6">
          <div className="flex justify-center">
            <img src={purpuraLogo} alt="Púrpura Estratégias Digitais" className="h-40 object-contain" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Bem vinda, Agência Púrpura.</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLocked && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
              <Lock className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Conta temporariamente bloqueada</p>
                <p className="text-xs text-muted-foreground">
                  Tente novamente em {lockoutRemaining || "alguns minutos"}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLocked}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLocked}
                autoComplete="current-password"
              />
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <p>{error}</p>
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={isLocked || submitting}>
              {isLocked ? "Aguarde..." : submitting ? "Entrando..." : "Entrar"}
            </Button>
            
            <button type="button" className="w-full text-sm text-muted-foreground hover:underline">
              Esqueci minha senha
            </button>
          </form>
          

          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" />
              Conexão segura • Sessão expira em 24h
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center">
            <img src={carcaraLogo} alt="Carcará AI" className="h-16 object-contain" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
