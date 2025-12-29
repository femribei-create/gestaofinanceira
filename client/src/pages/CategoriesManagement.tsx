import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Trash2, X, Save, Edit2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export default function CategoriesManagement() {
  // Estados para UI
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [businessTypeFilter, setBusinessTypeFilter] = useState<"all" | "personal" | "business">("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  // Estado para o formulário de criar/editar
  const [formData, setFormData] = useState({
    name: "",
    subcategory: "",
    businessType: "personal" as "personal" | "business",
  });

  // Estado para mover transações
  const [moveState, setMoveState] = useState<{
    categoryId: number | null;
    selectedTransactionIds: number[];
    targetCategoryId: number | null;
  }>({
    categoryId: null,
    selectedTransactionIds: [],
    targetCategoryId: null,
  });

  // Queries - Usando endpoints do setup.ts
  const { data: categoriesData, refetch: refetchCategories, isLoading: isLoadingCategories } =
    trpc.setup.getCategoriesWithCount.useQuery({
      businessType: businessTypeFilter === "all" ? undefined : businessTypeFilter,
    });

  const { data: transactionsData } = trpc.setup.getCategoryTransactions.useQuery(
    { categoryId: selectedCategoryId || 0 },
    { enabled: selectedCategoryId !== null }
  );

  // Mutations - Usando endpoints do setup.ts
  const createCategoryMutation = trpc.setup.createNewCategory.useMutation({
    onSuccess: () => {
      toast.success("Categoria criada com sucesso!");
      resetForm();
      refetchCategories();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const updateCategoryMutation = trpc.setup.updateExistingCategory.useMutation({
    onSuccess: () => {
      toast.success("Categoria atualizada com sucesso!");
      resetForm();
      refetchCategories();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const deleteCategoryMutation = trpc.setup.deleteExistingCategory.useMutation({
    onSuccess: () => {
      toast.success("Categoria deletada com sucesso!");
      refetchCategories();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const moveTransactionsMutation = trpc.setup.moveTransactionsToCategory.useMutation({
    onSuccess: () => {
      toast.success("Transações movidas com sucesso!");
      setMoveState({ categoryId: null, selectedTransactionIds: [], targetCategoryId: null });
      refetchCategories();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Funções auxiliares
  const resetForm = () => {
    setFormData({
      name: "",
      subcategory: "",
      businessType: "personal",
    });
    setEditingId(null);
  };

  const handleEditClick = (category: any) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      subcategory: category.subcategory || "",
      businessType: category.businessType,
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    if (editingId) {
      await updateCategoryMutation.mutateAsync({
        categoryId: editingId,
        name: formData.name,
        subcategory: formData.subcategory || undefined,
      });
    } else {
      await createCategoryMutation.mutateAsync({
        name: formData.name,
        subcategory: formData.subcategory || undefined,
        businessType: formData.businessType,
      });
    }
  };

  const handleDelete = async (categoryId: number) => {
    if (confirm("Tem certeza que deseja deletar esta categoria?")) {
      await deleteCategoryMutation.mutateAsync({ categoryId });
    }
  };

  const handleMoveTransactions = async () => {
    if (moveState.selectedTransactionIds.length === 0 || !moveState.targetCategoryId) {
      toast.error("Selecione transações e uma categoria de destino");
      return;
    }

    await moveTransactionsMutation.mutateAsync({
      transactionIds: moveState.selectedTransactionIds,
      newCategoryId: moveState.targetCategoryId,
    });
  };

  // Filtrar categorias
  const filteredCategories =
    categoriesData?.filter((cat) => {
      if (businessTypeFilter === "all") return true;
      return cat.businessType === businessTypeFilter;
    }) || [];

  const filteredTransactions = (transactionsData || []).filter((transaction) => {
    const date = new Date(transaction.purchaseDate);
    if (startDateFilter) {
      const start = new Date(startDateFilter);
      if (date < start) return false;
    }
    if (endDateFilter) {
      const end = new Date(endDateFilter);
      if (date > end) return false;
    }
    return true;
  });

  // Seleciona automaticamente a primeira categoria disponível ao trocar filtros
  useEffect(() => {
    if (filteredCategories.length === 0) {
      setSelectedCategoryId(null);
      return;
    }

    const exists = filteredCategories.some((c) => c.id === selectedCategoryId);
    if (!exists) {
      setSelectedCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, selectedCategoryId]);

  // Limpa seleção de transações ao trocar de categoria
  useEffect(() => {
    setMoveState({ categoryId: selectedCategoryId, selectedTransactionIds: [], targetCategoryId: null });
  }, [selectedCategoryId, startDateFilter, endDateFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Categorias</h1>
          <p className="text-gray-600 mt-2">Crie, edite e organize suas categorias de transações</p>
        </div>

        {/* Layout em duas colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna esquerda (form) */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <Card className="border-2 border-blue-200 shadow-lg">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="text-blue-900">
                    {editingId ? "✏️ Editar Categoria" : "➕ Nova Categoria"}
                  </CardTitle>
                  {editingId && (
                    <CardDescription className="text-blue-700">Editando categoria existente</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium">Nome da Categoria</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                      placeholder="Ex: SAÚDE, ALIMENTAÇÃO"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Subcategoria (opcional)</label>
                    <input
                      type="text"
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg mt-1"
                      placeholder="Ex: MÉDICOS, REMÉDIOS"
                    />
                  </div>

                  {!editingId && (
                    <div>
                      <label className="text-sm font-medium">Tipo</label>
                      <select
                        value={formData.businessType}
                        onChange={(e) =>
                          setFormData({ ...formData, businessType: e.target.value as "personal" | "business" })
                        }
                        className="w-full px-3 py-2 border rounded-lg mt-1"
                      >
                        <option value="personal">Pessoal</option>
                        <option value="business">Empresarial</option>
                      </select>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleSave}
                      disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                      className="gap-2 w-full"
                    >
                      {createCategoryMutation.isPending || updateCategoryMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {editingId ? "Atualizar" : "Criar"}
                    </Button>
                    {editingId && (
                      <Button onClick={resetForm} variant="outline" className="gap-2 w-full">
                        <X className="w-4 h-4" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Coluna direita (seleção e lista única) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col gap-4">
              {/* Filtros */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={businessTypeFilter === "all" ? "default" : "outline"}
                  onClick={() => setBusinessTypeFilter("all")}
                  size="sm"
                >
                  Todas
                </Button>
                <Button
                  variant={businessTypeFilter === "personal" ? "default" : "outline"}
                  onClick={() => setBusinessTypeFilter("personal")}
                  size="sm"
                >
                  Pessoais
                </Button>
                <Button
                  variant={businessTypeFilter === "business" ? "default" : "outline"}
                  onClick={() => setBusinessTypeFilter("business")}
                  size="sm"
                >
                  Empresariais
                </Button>
              </div>

              {/* Selecionar categoria */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Selecione a categoria</label>
                  <select
                    value={selectedCategoryId ?? ""}
                    onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Escolha uma categoria</option>
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.subcategory ? ` > ${c.subcategory}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Data inicial</label>
                    <input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Data final</label>
                    <input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Conteúdo da categoria selecionada */}
            {isLoadingCategories ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : !selectedCategoryId ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  Escolha uma categoria para visualizar os lançamentos.
                </CardContent>
              </Card>
            ) : (
              (() => {
                const category = filteredCategories.find((c) => c.id === selectedCategoryId);
                if (!category) {
                  return (
                    <Card>
                      <CardContent className="py-8 text-center text-gray-500">
                        Categoria não encontrada no filtro atual.
                      </CardContent>
                    </Card>
                  );
                }
                const isEditing = editingId === category.id;
                return (
                  <Card className={isEditing ? "ring-2 ring-blue-400 shadow-lg" : ""}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-semibold flex items-center gap-2">
                            {category.name}
                            {isEditing && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">✏️ Editando</span>
                            )}
                          </h3>
                          {category.subcategory && <p className="text-sm text-gray-500">{category.subcategory}</p>}
                          <p className="text-xs text-gray-400 mt-1">{category.transactionCount} transações</p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={isEditing ? "default" : "ghost"}
                            onClick={() => handleEditClick(category)}
                          >
                            <Edit2 className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(category.id)}
                            disabled={deleteCategoryMutation.isPending}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                            Deletar
                          </Button>
                        </div>
                      </div>

                      {transactionsData && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-semibold mb-2">Transações</h4>
                          {filteredTransactions.length === 0 ? (
                            <p className="text-sm text-gray-500">Nenhuma transação nesta categoria para o período selecionado</p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {filteredTransactions.map((transaction) => (
                                <div
                                  key={transaction.id}
                                  className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={moveState.selectedTransactionIds.includes(transaction.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setMoveState({
                                          ...moveState,
                                          categoryId: category.id,
                                          selectedTransactionIds: [...moveState.selectedTransactionIds, transaction.id],
                                        });
                                      } else {
                                        setMoveState({
                                          ...moveState,
                                          selectedTransactionIds: moveState.selectedTransactionIds.filter((id) => id !== transaction.id),
                                        });
                                      }
                                    }}
                                  />
                                  <div className="flex-1">
                                    <p className="font-medium">{transaction.description}</p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(transaction.purchaseDate).toLocaleDateString("pt-BR")}
                                    </p>
                                  </div>
                                  <p className="font-semibold">R$ {(transaction.amount / 100).toFixed(2)}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {moveState.selectedTransactionIds.length > 0 && (
                            <div className="mt-4 p-3 bg-blue-50 rounded">
                              <p className="text-sm mb-2">
                                {moveState.selectedTransactionIds.length} transação(ões) selecionada(s)
                              </p>
                              <select
                                value={moveState.targetCategoryId || ""}
                                onChange={(e) =>
                                  setMoveState({
                                    ...moveState,
                                    targetCategoryId: Number(e.target.value),
                                  })
                                }
                                className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                              >
                                <option value="">Selecione categoria de destino</option>
                                {filteredCategories
                                  .filter((c) => c.id !== category.id)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                      {c.subcategory && ` > ${c.subcategory}`}
                                    </option>
                                  ))}
                              </select>
                              <Button
                                size="sm"
                                onClick={handleMoveTransactions}
                                disabled={moveTransactionsMutation.isPending}
                                className="w-full"
                              >
                                {moveTransactionsMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "Mover Transações"
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
