import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle, Settings, Zap, DollarSign, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Categorization() {
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");
  
  // Estado para nova regra com campos de valor
  const [newRule, setNewRule] = useState({
    pattern: "",
    matchType: "contains" as const,
    categoryId: 0,
    transactionType: "expense" as const,
    priority: 0,
    minAmount: "" as string, // Usando string para facilitar digitação
    maxAmount: "" as string,
  });

  // Carregar dados
  const { data: categories } = trpc.setup.listCategories.useQuery({});
  const { data: rules, refetch: refetchRules } = trpc.categorization.listRules.useQuery();
  const { data: history, refetch: refetchHistory } = trpc.categorization.listLearningHistory.useQuery();

  const createRuleMutation = trpc.categorization.createRule.useMutation({
    onSuccess: () => {
      toast.success("Regra avançada criada com sucesso!");
      setNewRule({ 
        pattern: "", 
        matchType: "contains", 
        categoryId: 0, 
        transactionType: "expense", 
        priority: 0,
        minAmount: "",
        maxAmount: ""
      });
      refetchRules();
    },
    onError: (error) => {
      toast.error(`Erro ao criar regra: ${error.message}`);
    },
  });

  const deleteRuleMutation = trpc.categorization.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("Regra deletada com sucesso!");
      refetchRules();
    },
    onError: (error) => {
      toast.error(`Erro ao deletar: ${error.message}`);
    },
  });

  const deleteHistoryMutation = trpc.categorization.deleteHistoryPattern.useMutation({
    onSuccess: () => {
      toast.success("Padrão deletado com sucesso!");
      refetchHistory();
    },
    onError: (error) => {
      toast.error(`Erro ao deletar: ${error.message}`);
    },
  });

  const handleCreateRule = () => {
    if (!newRule.pattern || !newRule.categoryId) {
      toast.error("Preencha o padrão de texto e a categoria");
      return;
    }

    // Converter valores para número (se existirem)
    // O sistema espera centavos ou float? Vamos assumir que o backend trata isso,
    // mas aqui enviamos como number simples
    const minAmountNum = newRule.minAmount ? parseFloat(newRule.minAmount.replace(",", ".")) : undefined;
    const maxAmountNum = newRule.maxAmount ? parseFloat(newRule.maxAmount.replace(",", ".")) : undefined;

    createRuleMutation.mutate({
      pattern: newRule.pattern,
      matchType: newRule.matchType,
      categoryId: newRule.categoryId,
      transactionType: newRule.transactionType,
      priority: newRule.priority,
      // @ts-ignore - Campos opcionais que vamos adicionar ao backend depois
      minAmount: minAmountNum ? Math.round(minAmountNum * 100) : undefined, // Convertendo para centavos
      maxAmount: maxAmountNum ? Math.round(maxAmountNum * 100) : undefined,
    });
  };

  const formatCurrency = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) return null;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 py-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Categorização Inteligente</h1>
          <p className="text-gray-600 mt-2">
            Crie regras baseadas em texto e valor para automatizar seus lançamentos
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("rules")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "rules"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Regras ({rules?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <Zap className="w-4 h-4 inline mr-2" />
            Histórico ({history?.length || 0})
          </button>
        </div>

        {/* Rules Tab */}
        {activeTab === "rules" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form de Nova Regra */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Nova Regra</CardTitle>
                <CardDescription>Defina os critérios para aplicação automática</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Padrão de Texto */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Se a descrição...</label>
                  <div className="flex gap-2">
                    <select
                      value={newRule.matchType}
                      onChange={(e) => setNewRule({ ...newRule, matchType: e.target.value as any })}
                      className="w-1/3 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="contains">Contém</option>
                      <option value="starts_with">Começa com</option>
                      <option value="exact">É igual a</option>
                    </select>
                    <input
                      type="text"
                      value={newRule.pattern}
                      onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                      placeholder="Ex: Pix - Mayara"
                      className="w-2/3 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>

                {/* Filtro de Valor (Novo) */}
                <div className="bg-gray-50 p-3 rounded-md border border-gray-200 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <DollarSign className="w-4 h-4" />
                    Condição de Valor (Opcional)
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Mínimo (R$)</label>
                      <input
                        type="number"
                        value={newRule.minAmount}
                        onChange={(e) => setNewRule({ ...newRule, minAmount: e.target.value })}
                        placeholder="0,00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Máximo (R$)</label>
                      <input
                        type="number"
                        value={newRule.maxAmount}
                        onChange={(e) => setNewRule({ ...newRule, maxAmount: e.target.value })}
                        placeholder="Sem limite"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Deixe em branco para aceitar qualquer valor.
                  </p>
                </div>

                {/* Ação (Categoria) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Então classificar como:</label>
                  <select
                    value={newRule.categoryId}
                    onChange={(e) => setNewRule({ ...newRule, categoryId: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded-md text-sm font-medium"
                  >
                    <option value="0">Selecione a categoria...</option>
                    {categories?.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {cat.subcategory ? `> ${cat.subcategory}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Tipo</label>
                    <select
                      value={newRule.transactionType}
                      onChange={(e) => setNewRule({ ...newRule, transactionType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                    >
                      <option value="expense">Despesa</option>
                      <option value="income">Receita</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Prioridade</label>
                    <input
                      type="number"
                      value={newRule.priority}
                      onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCreateRule}
                  disabled={createRuleMutation.isPending}
                  className="w-full"
                >
                  {createRuleMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Criar Regra"
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Regras */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Regras Ativas</CardTitle>
                  <CardDescription>
                    O sistema verifica as regras por ordem de prioridade (maior primeiro)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {rules && rules.length > 0 ? (
                    rules.map((rule: any) => (
                      <div key={rule.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          {/* Lado Esquerdo: Condições */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold bg-gray-200 px-2 py-0.5 rounded text-gray-700">
                                SE
                              </span>
                              <span className="text-sm text-gray-900">
                                {rule.matchType === "contains" && "Contém"}
                                {rule.matchType === "starts_with" && "Começa com"}
                                {rule.matchType === "exact" && "Igual a"}
                                : <strong>"{rule.pattern}"</strong>
                              </span>
                            </div>

                            {/* Mostrar condição de valor se existir (simulado no frontend por enquanto) */}
                            {(rule.minAmount || rule.maxAmount) && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold bg-yellow-100 px-2 py-0.5 rounded text-yellow-800">
                                  E VALOR
                                </span>
                                <span className="text-sm text-gray-700 flex items-center gap-1">
                                  {rule.minAmount ? `> ${formatCurrency(rule.minAmount)}` : "Qualquer"}
                                  <ArrowRight className="w-3 h-3" />
                                  {rule.maxAmount ? `< ${formatCurrency(rule.maxAmount)}` : "Qualquer"}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Seta Indicativa */}
                          <ArrowRight className="text-gray-300 w-5 h-5 flex-shrink-0" />

                          {/* Lado Direito: Ação */}
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {rule.categoryName}
                              {rule.subcategoryName && <span className="text-gray-500 font-normal"> › {rule.subcategoryName}</span>}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Prioridade: {rule.priority} • {rule.transactionType === 'income' ? 'Receita' : 'Despesa'}
                            </p>
                          </div>

                          {/* Botão Deletar */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteRuleMutation.mutate({ ruleId: rule.id })}
                            disabled={deleteRuleMutation.isPending}
                            className="flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <span className="sr-only">Deletar</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-12 border-2 border-dashed border-gray-100 rounded-lg">
                      <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">Nenhuma regra criada</p>
                      <p className="text-sm mt-1">Crie regras para automatizar sua gestão</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Aprendizado</CardTitle>
              <CardDescription>
                Padrões que o sistema aprendeu com suas correções manuais
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history && history.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {history.map((pattern: any) => (
                    <div key={pattern.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            <code className="bg-gray-100 px-1 rounded text-xs">{pattern.description}</code>
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            → {pattern.categoryName}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-blue-600 h-1.5 rounded-full"
                                style={{ width: `${Math.min((pattern.count / 10) * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                              {pattern.count}x
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteHistoryMutation.mutate({ patternId: pattern.id })}
                          disabled={deleteHistoryMutation.isPending}
                          className="flex-shrink-0 text-red-500"
                        >
                          Deletar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum padrão aprendido ainda</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
