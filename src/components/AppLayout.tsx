import { useState } from "react";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Megaphone, 
  Briefcase, 
  Users, 
  Store,
  Shield,
  LogOut,
  Menu,
  X,
  UserPlus,
  Cog,
  Contact
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import purpuraLogo from "@/assets/purpura-logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UploadModal } from "@/components/UploadModal";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { title: "Resumo", url: "/", icon: LayoutDashboard },
  { title: "Comercial", url: "/comercial", icon: ShoppingCart },
  { title: "Marketing", url: "/marketing", icon: Megaphone },
  { title: "Serviços", url: "/produtos", icon: Briefcase },
  { title: "Clientes", url: "/clientes", icon: Contact },
  { title: "Agente Onboarding", url: "/superagente-onboarding", icon: UserPlus },
  { title: "Agente Operacional", url: "/superagente-operacional", icon: Cog },
  { title: "Painel do Cliente", url: "/cliente", icon: Users },
  { title: "Licenciamento", url: "/licenciamento", icon: Shield, purple: true },
  { title: "Marketplace", url: "/marketplace", icon: Store },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Logo */}
      <div className="p-4 md:p-6 border-b border-sidebar-border">
        <img src={purpuraLogo} alt="Púrpura" className="h-24 md:h-36 object-contain" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? (item as any).purple 
                    ? "bg-purple-600 text-white" 
                    : "bg-sidebar-primary text-sidebar-primary-foreground"
                  : (item as any).purple
                    ? "text-purple-400 hover:bg-purple-600/10"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.title}
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-primary">
              {user?.name?.charAt(0) || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.company}</p>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            onNavigate?.();
          }}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex w-64 h-screen bg-sidebar border-r border-sidebar-border flex-col shrink-0">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72 bg-sidebar">
        <div className="flex flex-col h-full">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppHeader() {
  const { user } = useAuth();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <MobileSidebar />
        <h2 className="font-semibold text-sm md:text-base truncate">{user?.company}</h2>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <UploadModal />
        <ThemeToggle />
      </div>
    </header>
  );
}
