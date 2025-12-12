import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, Rocket } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Setup() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"welcome" | "initializing" | "complete">("welcome");
  const [progress, setProgress] = useState({
    categories: false,
    accounts: false,
    rules: false,
  });

  const initCategories = trpc.setup.initializeCategories.useMutation();
  const initAccounts = trpc.setup.initializeAccounts.useMutation();
  const initRules = trpc.setup.initializeRules.useMutation();

  const handleInitialize = async () => {
    setStep("initializing");

    try {
      // 1. Criar categorias
      await initCategories.mutateAsync();
      setProgress(prev => ({ ...prev, categories: true }));

      // 2. Criar contas
      await initAccounts.mutateAsync();
      setProgress(prev => ({ ...prev, accounts: true }));

      // 3. Criar regras
      await initRules.mutateAsync();
      setProgress(prev => ({ ...prev, rules: true }));

      setStep("complete");

      // Redirecionar após 2 segundos
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    } catch (error) {
      console.error("Erro ao inicializar:", error);
      alert("Erro ao inicializar o sistema. Tente novamente.");
      setStep("welcome");
      setProgress({ categories: false, accounts: false, rules: false });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
            <Rocket className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold">
            Bem-vindo ao Sistema de Gestão Financeira
          </CardTitle>
          <CardDescription className="text-base">
            Configure seu sistema em poucos segundos
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === "welcome" && (
            <>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    O que será criado:
                  </h3>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span><strong>74 categorias</strong> (39 empresariais + 35 pessoais)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span><strong>7 contas bancárias</strong> pré-configuradas</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span><strong>Regras de categorização</strong> automática</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Nota:</strong> Este processo leva apenas alguns segundos e
                    você poderá personalizar tudo depois.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleInitialize}
                size="lg"
                className="w-full text-lg h-14"
              >
                <Rocket className="w-5 h-5 mr-2" />
                Inicializar Sistema
              </Button>
            </>
          )}

          {step === "initializing" && (
            <div className="space-y-6 py-8">
              <div className="flex justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              </div>

              <div className="space-y-4">
                <ProgressItem
                  label="Criando categorias..."
                  completed={progress.categories}
                />
                <ProgressItem
                  label="Criando contas bancárias..."
                  completed={progress.accounts}
                />
                <ProgressItem
                  label="Configurando regras..."
                  completed={progress.rules}
                />
              </div>
            </div>
          )}

          {step === "complete" && (
            <div className="space-y-6 py-8 text-center">
              <div className="flex justify-center">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              </div>

              <div>
                <h3 className="text-2xl font-bold text-green-900 mb-2">
                  Sistema Inicializado!
                </h3>
                <p className="text-gray-600">
                  Redirecionando para o dashboard...
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressItem({
  label,
  completed,
}: {
  label: string;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {completed ? (
        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
      ) : (
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
      )}
      <span className={completed ? "text-green-700" : "text-gray-600"}>
        {label}
      </span>
    </div>
  );
}
