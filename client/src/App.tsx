import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Categorization from "./pages/Categorization";
import Transactions from "./pages/Transactions";
import DRE from "./pages/DRE";
import Import from "./pages/Import";
import Setup from "./pages/Setup";
import { trpc } from "./lib/trpc";
import { useEffect } from "react";

function Router() {
  const [location, setLocation] = useLocation();
  const { data: setupStatus, isLoading } = trpc.setup.checkSetupStatus.useQuery();

  // Redirecionar para setup se não inicializado
  useEffect(() => {
    if (isLoading) return;
    if (!setupStatus) return;
    
    // Se não está inicializado e não está na página de setup, redirecionar
    if (!setupStatus.isInitialized && location !== "/setup") {
      setLocation("/setup");
    }
    
    // Se está inicializado e está na página de setup, redirecionar para home
    if (setupStatus.isInitialized && location === "/setup") {
      setLocation("/");
    }
  }, [setupStatus, isLoading, location, setLocation]);

  // Mostrar loading enquanto verifica status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path={"/setup"} component={Setup} />
      <Route path={"/"} component={Home} />
      <Route path={"/categorization"} component={Categorization} />
      <Route path={"/transactions"} component={Transactions} />
      <Route path={"/dre"} component={DRE} />
      <Route path={"/import"} component={Import} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
