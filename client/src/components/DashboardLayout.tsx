import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, PanelLeft, FileText, Upload, Settings, TrendingUp, Plus, Calendar, Layers, Wallet } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Plus, label: "Adicionar Transação", path: "/add-transaction" },
  { icon: Upload, label: "Importar Arquivos", path: "/import" },
  { icon: FileText, label: "Transações", path: "/transactions" },
  { icon: Layers, label: "Gerenciar Categorias", path: "/categories" },
  { icon: Settings, label: "Categorização", path: "/categorization" },
  { icon: Calendar, label: "Datas de Fechamento", path: "/card-closing-dates" },
  { icon: Wallet, label: "Gastos Pessoais", path: "/personal-dashboard" },
  { icon: TrendingUp, label: "DRE Mensal", path: "/dre" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <div className="flex h-screen w-full">
      <Sidebar ref={sidebarRef} className="border-r">
        <SidebarHeader className="border-b px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">GF</span>
            </div>
            {!isCollapsed && <span className="font-semibold text-sm">Gestão Financeira</span>}
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-4">
          <SidebarMenu>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenuItem?.path === item.path;

              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => setLocation(item.path)}
                    className={`w-full justify-start gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-100 text-blue-600 font-semibold"
                        : "hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span className="text-sm">{item.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t px-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Usuário</p>
                <p className="text-xs text-gray-500 truncate">user@example.com</p>
              </div>
            )}
          </div>
        </SidebarFooter>

        {!isCollapsed && (
          <div
            onMouseDown={() => setIsResizing(true)}
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
          />
        )}
      </Sidebar>

      <SidebarInset className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b px-4 py-3 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="mr-2" />
            {activeMenuItem && (
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{activeMenuItem.label}</h1>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
