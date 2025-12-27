import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Settings, Zap, DollarSign, ArrowRight, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";

export default function Categorization() {
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Estado para o formulário (Nova Regra ou Edição)
  const [formData, setFormData] = useState({
    pattern: "",
    matchType: "contains" as const,
    categoryId: 0,
    transactionType: "expense" as const,
    priority: 0,
    exactAmount: "" as string,
    minAmount: "" as string,
    maxAmount: "" as string,
    accountId: "" as string, // Novo campo para banco
  });

  const { data: categories } = trpc.setup.listCategories.useQuery({});
  const { data: accounts } = trpc.setup.listAccounts.useQuery(); // Novo: carregar contas
  const { data: rules, refetch: refetchRules } = trpc.categorization.listRules.useQuery();
  const { data: history, refetch: refetchHistory } = trpc.categorization.listLearningHistory.useQuery();

  const resetForm = () => {
    setFormData({ 
      pattern: "", 
      matchType: "contains", 
      categoryId: 0, 
      transactionType: "expense", 
      priority: 0,
      exactAmount: "",
      minAmount: "",
      maxAmount: "",
      accountId: "" // Reset do novo campo
    });
    setEditingId(null);
  };

  const createRuleMutation = trpc.categorization.createRule.useMutation({
    onSuccess: () => {
      toast.success("Regra criada com sucesso!");
      resetForm();
      refetchRules();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const updateRuleMutation = trpc.categorization.updateRule.useMutation({
    onSuccess: () => {
      toast.success("Regra atualizada com sucesso!");
      resetForm();
      refetchRules();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const deleteRuleMutation = trpc.categorization.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("Regra deletada!");
      refetchRules();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const deleteHistoryMutation = trpc.categorization.deleteHistoryPattern.useMutation({
    onSuccess: () => {
      toast.success("Padrão deletado!");
      refetchHistory();
    },
  });

  const handleEditClick = (rule: any) => {
    setEditingId(rule.id);
    
    // Converter centavos para reais (string)
    const formatValue = (cents: number | null) => 
      cents ? (cents / 100).toFixed(2).replace(".", ",") : "";

    // Verificar se é valor exato (min == max)
    let exact = "";
    let min = "";
    let max = "";

    if (rule.minAmount && rule.maxAmount && rule.minAmount === rule.maxAmount) {
      exact = formatValue(rule.minAmount);
    } else {
      min = formatValue(rule.minAmount);
      max = formatValue(rule.maxAmount);
    }

    setFormData({
      pattern: rule.pattern,
      matchType: rule.matchType,
      categoryId: rule.categoryId,
      transactionType: rule.transactionType,
      priority: rule.priority,
      exactAmount: exact,
      minAmount: min,
      maxAmount: max,
      accountId: rule.accountId ? rule.accountId.toString() : "", // Novo campo
    });

    // Rolar a página para o topo para ver o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = () => {
    if (!formData.pattern || !formData.categoryId) {
      toast.error("Preencha o padrão de texto e a categoria");
      return;
    }

    let minFinal: number | undefined = undefined;
    let maxFinal: number | undefined = undefined;

    // Lógica do Valor Exato vs Faixa
    if (formData.exactAmount) {
      const val = parseFloat(formData.exactAmount.replace(",", "."));
      if (!isNaN(val)) {
        minFinal = Math.round(val * 100);
        maxFinal = Math.round(val * 100);
      }
    } else {
      if (formData.minAmount) {
        const val = parseFloat(formData.minAmount.replace(",", "."));
        if (!isNaN(val)) minFinal = Math.round(val * 100);
      }
      if (formData.maxAmount) {
        const val = parseFloat(formData.maxAmount.replace(",", "."));
        if (!isNaN(val)) maxFinal = Math.round(val * 100);
      }
    }

    const payload = {
      pattern: formData.pattern,
      matchType: formData.matchType,
      categoryId: formData.categoryId,
      transactionType: formData.transactionType,
      priority: formData.priority,
      minAmount: minFinal,
      maxAmount: maxFinal,
      accountId: formData.accountId ? parseInt(formData.accountId) : undefined, // Novo campo
    };

    if (editingId) {
      updateRuleMutation.mutate({ ruleId: editingId, ...payload });
    } else {
      createRuleMutation.mutate(payload);
    }
  };

  const formatCurrency = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) return null;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  };

  const isPending = createRuleMutation.isPending || updateRuleMutation.isPending;

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
            <Card className={`h-fit transition-all ${editingId ? 'border-blue-400 ring-2 ring-blue-100' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>{editingId ? "Editar Regra" : "Nova Regra"}</CardTitle>
                  <CardDescription>
                    {editingId ? "Alterando regra existente" : "Critérios para classificação automática"}
                  </CardDescription>
                </div>
                {editingId && (
                  <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Padrão de Texto */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Se a descrição...</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.matchType}
                      onChange={(e) => setFormData({ ...formData, matchType: e.target.value as any })}
                      className="w-1/3 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="contains">Contém</option>
                      <option value="starts_with">Começa com</option>
                      <option value="exact">É igual a</option>
                    </select>
                    <input
                      type="text"
                      value={formData.pattern}
                      onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                      placeholder="Ex: UBER;99;CABIFY"
                      className="w-2/3 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <p className="text-xs text-blue-600">
                    Use <strong>;</strong> para separar várias palavras (Ex: UBER;99POP)
                  </p>
                </div>

                {/* Filtro de Valor */}
                <div className="bg-gray-50 p-3 rounded-md border border-gray-200 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <DollarSign className="w-4 h-4" />
                    Condição de Valor (Opcional)
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 font-bold mb-1 block">VALOR EXATO</label>
                      <input
                        type="number"
                        value={formData.exactAmount}
                        onChange={(e) => setFormData({ ...formData, exactAmount: e.target.value, minAmount: "", maxAmount: "" })}
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
                          value={formData.minAmount}
                          disabled={!!formData.exactAmount}
                          onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Máximo</label>
                        <input
                          type="number"
                          value={formData.maxAmount}
                          disabled={!!formData.exactAmount}
                          onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Novo: Filtro de Banco */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Banco (Opcional)</label>
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Todos os bancos</option>
                    {accounts?.map((account: any) => (
                      <option key={account.id} value={account.id.toString()}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">Deixe em branco para aplicar a regra em todos os bancos</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Classificar como:</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: parseInt(e.target.value) })}
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
                      value={formData.transactionType}
                      onChange={(e) => setFormData({ ...formData, transactionType: e.target.value as any })}
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
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={isPending} className="flex-1">
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? "Salvar Alterações" : "Criar Regra")}
                  </Button>
                  {editingId && (
                    <Button variant="outline" onClick={resetForm}>
                      Cancelar
                    </Button>
                  )}
                </div>
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
                    <div key={rule.id} className={`border rounded-lg p-4 transition-colors ${editingId === rule.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'}`}>
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

                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEditClick(rule)} 
                            className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                            title="Editar Regra"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => deleteRuleMutation.mutate({ ruleId: rule.id })} 
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                            title="Deletar Regra"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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
              <CardDescription>Padrões aprendidos pela IA e correções manuais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {history && history.length > 0 ? (
                history.map((item: any) => (
                  <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50 border-gray-200 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold bg-purple-100 px-2 py-0.5 rounded text-purple-800">PADRÃO</span>
                          <span className="text-sm text-gray-900 font-medium bg-purple-50 px-2 py-1 rounded border border-purple-200">
                            {item.pattern}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="font-semibold">Categoria:</span>
                          <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{item.categoryName}</span>
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-600 italic">
                            <span className="font-semibold">Descrição:</span> {item.description}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteHistoryMutation.mutate({ patternId: item.id })}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                        title="Deletar padrão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">Nenhum padrão aprendido ainda.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
