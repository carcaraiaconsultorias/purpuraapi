import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar, AppHeader } from "@/components/AppLayout";
import { FloatingAgentButton, FloatingAgentChat } from "@/components/FloatingAgent";

export default function DashboardLayout() {
  const [isAgentOpen, setIsAgentOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main className="flex-1 overflow-auto bg-background">
          <Outlet />
        </main>
      </div>
      
      {/* Floating Agent */}
      <FloatingAgentButton onClick={() => setIsAgentOpen(true)} />
      <FloatingAgentChat isOpen={isAgentOpen} onClose={() => setIsAgentOpen(false)} />
    </div>
  );
}
