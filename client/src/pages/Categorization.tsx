import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle, Settings, Zap } from "lucide-react";
import { toast } from "sonner";

export default function Categorization() {
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");
  const [newRule, setNewRule] = useState({
    pattern: "",
    matchType: "contains" as const,
    categoryId: 0,
    transactionType: "expense" as const,
    priority: 0,
  });

  // Carregar categorias
  const { data: categories } = trpc.setup.listCategories.useQuery({});
  const { data: rules, refetch: refetchRules } = trpc.categorization.listRules.useQuery();
  const { data: history, refetch: refetchHistory } = trpc.categorization.listLearningHistory.useQuery();

  const createRuleMutation = trpc.categorization.createRule.useMutation({
    onSuccess: () => {
      toast.success("Regra criada com sucesso!");
      setNewRule({ pattern: "", matchType: "contains", categoryId: 0, transactionType: "expense", priority: 0 });
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
      toast.error("Preencha padrão e categoria");
      return;
    }

    createRuleMutation.mutate({
      pattern: newRule.pattern,
      matchType: newRule.matchType,
      categoryId: newRule.categoryId,
      transactionType: newRule.transactionType,
      priority: newRule.priority,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 py-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Categorização de Transações</h1>
          <p className="text-gray-600 mt-2">
            Gerencie regras de categorização e histórico de aprendizado
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
            {/* Criar Nova Regra */}
            <Card>
              <CardHeader>
                <CardTitle>Nova Regra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Padrão</label>
                  <input
                    type="text"
                    value={newRule.pattern}
                    onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                    placeholder="Ex: PIX DESAPEGO"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Tipo de Match</label>
                  <select
                    value={newRule.matchType}
                    onChange={(e) => setNewRule({ ...newRule, matchType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                  >
                    <option value="contains">Contém</option>
                    <option value="starts_with">Começa com</option>
                    <option value="ends_with">Termina com</option>
                    <option value="exact">Exato</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Categoria</label>
                  <select
                    value={newRule.categoryId}
                    onChange={(e) => setNewRule({ ...newRule, categoryId: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                  >
                    <option value="0">Selecione uma categoria</option>
                    {categories && categories.length > 0 ? (
                      categories.map((cat: any) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))
                    ) : (
                      <option disabled>Carregando categorias...</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Tipo de Transação</label>
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

                <Button
                  onClick={handleCreateRule}
                  disabled={createRuleMutation.isPending}
                  className="w-full"
                >
                  {createRuleMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Regra"
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Regras */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Regras Criadas</CardTitle>
                  <CardDescription>Clique em deletar para remover uma regra</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                  {rules && rules.length > 0 ? (
                    rules.map((rule) => (
                      <div key={rule.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {rule.matchType === "contains" && "Contém: "}
                              {rule.matchType === "starts_with" && "Começa com: "}
                              {rule.matchType === "ends_with" && "Termina com: "}
                              {rule.matchType === "exact" && "Exato: "}
                              <code className="bg-gray-100 px-1 rounded">{rule.pattern}</code>
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              → {rule.categoryName} ({rule.transactionType})
                            </p>
                            <p className="text-xs text-gray-500">Prioridade: {rule.priority}</p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteRuleMutation.mutate({ ruleId: rule.id })}
                            disabled={deleteRuleMutation.isPending}
                            className="flex-shrink-0"
                          >
                            Deletar
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma regra criada ainda</p>
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
                Padrões que o sistema aprendeu com suas correções
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history && history.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {history.map((pattern) => (
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
                                style={{ width: `${(pattern.count / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                              {pattern.count}x
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Última vez: {new Date(pattern.lastUsed).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteHistoryMutation.mutate({ patternId: pattern.id })}
                          disabled={deleteHistoryMutation.isPending}
                          className="flex-shrink-0"
                        >
                          Deletar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum padrão aprendido ainda</p>
                  <p className="text-xs mt-1">Corrija categorias para o sistema aprender</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
