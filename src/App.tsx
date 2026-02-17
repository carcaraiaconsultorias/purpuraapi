// Purpura Carcara - Dashboard v2
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UploadProvider } from "@/contexts/UploadContext";

import Login from "./pages/Login";
import DashboardLayout from "./layouts/DashboardLayout";
import Resumo from "./pages/Resumo";
import Comercial from "./pages/Comercial";
import Marketing from "./pages/Marketing";
import Produtos from "./pages/Produtos";
import PainelCliente from "./pages/PainelCliente";
import Licenciamento from "./pages/Licenciamento";
import Marketplace from "./pages/Marketplace";
import SuperagenteOnboarding from "./pages/SuperagenteOnboarding";
import SuperagenteOperacional from "./pages/SuperagenteOperacional";
import Clientes from "./pages/Clientes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();

  if (!authReady) return null;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, authReady } = useAuth();

  if (!authReady) return null;

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/" element={<Resumo />} />
        <Route path="/comercial" element={<Comercial />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/superagente-onboarding" element={<SuperagenteOnboarding />} />
        <Route path="/superagente-operacional" element={<SuperagenteOperacional />} />
        <Route path="/cliente" element={<PainelCliente />} />
        <Route path="/licenciamento" element={<Licenciamento />} />
        <Route path="/marketplace" element={<Marketplace />} />
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <UploadProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </UploadProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
