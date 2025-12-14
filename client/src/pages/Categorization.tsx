import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle, Settings, Zap, DollarSign, ArrowRight, MousePointerClick } from "lucide-react";
import { toast } from "sonner";

export default function Categorization() {
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");
  
  // Estado para nova regra
  const [newRule, setNewRule] = useState({
    pattern: "",
    matchType: "contains" as const,
    categoryId: 0,
    transactionType: "expense" as const,
    priority: 0,
    exactAmount: "" as string, // NOVO: Valor Exato
    minAmount: "" as string,
    maxAmount: "" as string,
  });

  const { data: categories } = trpc.setup.listCategories.useQuery({});
  const { data: rules, refetch: refetchRules } = trpc.categorization.listRules.useQuery();
  const { data: history, refetch: refetchHistory } = trpc.categorization.listLearningHistory.useQuery();

  const createRuleMutation = trpc.categorization.createRule.useMutation({
    onSuccess: () => {
      toast.success("Regra criada com sucesso!");
      setNewRule({ 
        pattern: "", 
        matchType: "contains", 
        categoryId: 0, 
        transactionType: "expense", 
        priority: 0,
        exactAmount: "",
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
      toast.success("Regra deletada!");
      refetchRules();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deleteHistoryMutation = trpc.categorization.deleteHistoryPattern.useMutation({
    onSuccess: () => {
      toast.success("Padrão deletado!");
      refetchHistory();
    },
  });

  const handleCreateRule = () => {
    if (!newRule.pattern || !newRule.categoryId) {
      toast.error("Preencha o padrão de texto e a categoria");
      return;
    }

    let minFinal: number | undefined = undefined;
    let maxFinal: number | undefined = undefined;

    // Lógica do Valor Exato vs Faixa
    if (newRule.exactAmount) {
      const val = parseFloat(newRule.exactAmount.replace(",", "."));
      if (!isNaN(val)) {
        minFinal = Math.round(val * 100);
        maxFinal = Math.round(val * 100);
      }
    } else {
      if (newRule.minAmount) {
        const val = parseFloat(newRule.minAmount.replace(",", "."));
        if (!isNaN(val)) minFinal = Math.round(val * 100);
      }
      if (newRule.maxAmount) {
        const val = parseFloat(newRule.maxAmount.replace(",", "."));
        if (!isNaN(val)) maxFinal = Math.round(val * 100);
      }
    }

    createRuleMutation.mutate({
      pattern: newRule.pattern,
      matchType: newRule.matchType,
      categoryId: newRule.categoryId,
      transactionType: newRule.transactionType,
      priority: newRule.priority,
      minAmount: minFinal,
      maxAmount: maxFinal,
    });
  };

  const formatCurrency = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) return null;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 py-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Categorização Inteligente</h1>
          <p className="text-gray-600 mt-2">
            Automatize seus lançamentos com regras personalizadas
          </p>
        </div>

        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("rules")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "rules" ? "border-blue-600 text-blue-600" : "text-gray-600"
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Regras ({rules?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "history" ? "border-blue-600 text-blue-600" : "text-gray-600"
            }`}
          >
            <Zap className="w-4 h-4 inline mr-2" />
            Histórico ({history?.length || 0})
          </button>
        </div>

        {activeTab === "rules" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Nova Regra</CardTitle>
                <CardDescription>Critérios para classificação automática</CardDescription>
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
                      placeholder="Ex: UBER;99;CABIFY"
                      className="w-2/3 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <p className="text-xs text-blue-600">
                    Dica: Use <strong>;</strong> para separar várias palavras (Ex: UBER;99POP)
                  </p>
                </div>

                {/* Filtro de Valor */}
                <div className="bg-gray-50 p-3 rounded-md border border-gray-200 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <DollarSign className="w-4 h-4" />
                    Condição de Valor (Opcional)
                  </div>
                  
                  {/* Abas de Valor: Exato ou Faixa */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 font-bold mb-1 block">VALOR EXATO</label>
                      <input
                        type="number"
                        value={newRule.exactAmount}
                        onChange={(e) => setNewRule({ ...newRule, exactAmount: e.target.value, minAmount: "", maxAmount: "" })}
                        placeholder="Ex: 127,00"
                        className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm focus:border-blue-500"
                      />
                    </div>
                    
                    <div className="relative flex items-center py-1">
                      <div className="flex-grow border-t border-gray-200"></div>
                      <span className="flex-shrink-0 mx-2 text-xs text-gray-400">OU FAIXA DE VALOR</span>
                      <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 opacity-90">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Mínimo</label>
                        <input
                          type="number"
                          value={newRule.minAmount}
                          disabled={!!newRule.exactAmount}
                          onChange={(e) => setNewRule({ ...newRule, minAmount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Máximo</label>
                        <input
                          type="number"
                          value={newRule.maxAmount}
                          disabled={!!newRule.exactAmount}
                          onChange={(e) => setNewRule({ ...newRule, maxAmount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Classificar como:</label>
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

                <Button onClick={handleCreateRule} disabled={createRuleMutation.isPending} className="w-full">
                  {createRuleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Regra"}
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Regras Ativas</CardTitle>
                  <CardDescription>O sistema verifica na ordem de prioridade</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {rules?.map((rule: any) => (
                    <div key={rule.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold bg-gray-200 px-2 py-0.5 rounded text-gray-700">SE</span>
                            <span className="text-sm text-gray-900 font-medium">
                              {rule.matchType === "contains" ? "Contém" : rule.matchType === "starts_with" ? "Começa com" : "Igual a"}:
                              <span className="ml-1 bg-yellow-50 px-1 border border-yellow-200 rounded text-yellow-800">
                                {rule.pattern.includes(";") ? rule.pattern.split(";").join(" OU ") : rule.pattern}
                              </span>
                            </span>
                          </div>

                          {(rule.minAmount || rule.maxAmount) && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold bg-green-100 px-2 py-0.5 rounded text-green-800">E VALOR</span>
                              <span className="text-sm text-gray-700 font-mono">
                                {rule.minAmount === rule.maxAmount 
                                  ? `EXATO: ${formatCurrency(rule.minAmount)}` 
                                  : `${rule.minAmount ? `> ${formatCurrency(rule.minAmount)}` : ""} ${rule.maxAmount ? `< ${formatCurrency(rule.maxAmount)}` : ""}`
                                }
                              </span>
                            </div>
                          )}
                        </div>
                        <ArrowRight className="text-gray-300 w-5 h-5 flex-shrink-0" />
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-sm font-medium text-gray-900">{rule.categoryName}</p>
                          <p className="text-xs text-gray-500">Prioridade: {rule.priority}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteRuleMutation.mutate({ ruleId: rule.id })} className="text-red-500 hover:bg-red-50">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "history" && (
           <Card>
             <CardHeader>
               <CardTitle>Histórico de Aprendizado</CardTitle>
             </CardHeader>
             <CardContent>
               <p className="text-gray-500 text-center py-8">Histórico de aprendizado da IA e correções manuais.</p>
             </CardContent>
           </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
