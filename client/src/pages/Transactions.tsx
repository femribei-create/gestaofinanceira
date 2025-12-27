import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpCircle, ArrowDownCircle, Loader2, Pencil, Search, Filter, X, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface Transaction {
  id: number;
  description: string;
  amount: number;
  transactionType: "income" | "expense";
  purchaseDate: string;
  paymentDate: string;
  isInstallment: boolean;
  installmentNumber: number | null;
  installmentTotal: number | null;
  categoryId: number | null;
  accountId: number;
  isIgnored: boolean;
}

export default function Transactions() {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  // --- Estados dos Filtros ---
  const [searchText, setSearchText] = useState("");
  const [filterAccountId, setFilterAccountId] = useState<string>("");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<"active" | "ignored" | "notCategorized" | "all">("active");
  const [showFilters, setShowFilters] = useState(false);

  // --- Construção do Objeto de Filtros para o Backend ---
  const filters: any = {
    status: filterStatus === "notCategorized" ? "active" : filterStatus,
  };

  // Só adiciona ao filtro se tiver valor preenchido
  if (searchText) filters.search = searchText;

  // Converte string para número antes de enviar
  if (filterAccountId && filterAccountId !== "all" && filterAccountId !== "") filters.accountId = parseInt(filterAccountId);
  if (filterCategoryId && filterCategoryId !== "all" && filterCategoryId !== "") filters.categoryId = parseInt(filterCategoryId);

  // Filtro de período
  if (filterStartDate) filters.startDate = new Date(filterStartDate);
  if (filterEndDate) {
    const endDate = new Date(filterEndDate);
    endDate.setHours(23, 59, 59, 999); // Incluir todo o dia final
    filters.endDate = endDate;
  }

  // Chamada ao Backend (TRPC)
  const { data: allTransactions, isLoading, refetch } = trpc.transactions.list.useQuery(filters);
  const { data: categories } = trpc.setup.listCategories.useQuery({});
  const { data: accounts } = trpc.setup.listAccounts.useQuery();

  // Filtrar transações não categorizadas se necessário
  const transactions = filterStatus === "notCategorized"
    ? allTransactions?.filter((t: any) => !t.categoryId)
    : allTransactions;

  // --- Mutações (Ações de alterar dados) ---
  const updateCategoryMutation = trpc.transactions.updateCategory.useMutation({
    onSuccess: () => {
      toast.success("Categoria atualizada!");
      refetch();
      setEditingTransaction(null);
      setSelectedCategoryId("");
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const toggleIgnoreMutation = trpc.transactions.toggleIgnore.useMutation({
    onSuccess: (data) => {
      toast.success(data.isIgnored ? "Transação ocultada" : "Transação restaurada");
      refetch();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const deleteTransactionMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      toast.success("Transação excluída permanentemente");
      refetch();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Funções Auxiliares de Exibição
  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "Sem categoria";
    const category = categories?.find((c) => c.id === categoryId);
    if (!category) return "Desconhecida";
    return category.subcategory ? `${category.name} > ${category.subcategory}` : category.name;
  };

  const getAccountName = (accountId: number) => {
    const account = accounts?.find((a) => a.id === accountId);
    return account?.name || "Desconhecida";
  };

  const formatCurrency = (cents: number) => {
    const value = Math.abs(cents) / 100;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Manipuladores de Eventos
  const handleEditCategory = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setSelectedCategoryId(transaction.categoryId?.toString() || "");
  };

  const handleSaveCategory = () => {
    if (!editingTransaction || !selectedCategoryId) return;

    updateCategoryMutation.mutate({
      id: editingTransaction.id,
      categoryId: parseInt(selectedCategoryId),
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta transação? Essa ação não pode ser desfeita.")) {
      deleteTransactionMutation.mutate({ id });
    }
  };

  const handleToggleIgnore = (id: number) => {
    toggleIgnoreMutation.mutate({ id });
  };

  const clearFilters = () => {
    setSearchText("");
    setFilterAccountId("");
    setFilterCategoryId("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterStatus("active");
  };

  const hasActiveFilters =
    searchText || filterAccountId || filterCategoryId || filterStartDate || filterEndDate || filterStatus !== "active";

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Transações</h1>
            <p className="text-muted-foreground">Visualize, filtre e edite suas transações</p>
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            {showFilters ? "Ocultar Filtros" : "Mostrar Filtros"}
          </Button>
        </div>

        {/* Filtros */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>Refine sua busca de transações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Busca por Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="search">Descrição</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Buscar por descrição..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* 2. Banco */}
                <div className="space-y-2">
                  <Label htmlFor="account">Banco</Label>
                  <Select value={filterAccountId || "all"} onValueChange={setFilterAccountId}>
                    <SelectTrigger id="account">
                      <SelectValue placeholder="Todos os bancos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os bancos</SelectItem>
                      {accounts?.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Categoria */}
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={filterCategoryId || "all"} onValueChange={setFilterCategoryId}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.subcategory ? `${category.name} > ${category.subcategory}` : category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* 4. Data Inicial */}
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Inicial</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                  />
                </div>

                {/* 5. Data Final */}
                <div className="space-y-2">
                  <Label htmlFor="endDate">Data Final</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                  />
                </div>

                {/* 6. Status */}
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="active">Ativas</SelectItem>
                      <SelectItem value="ignored">Ocultas</SelectItem>
                      <SelectItem value="notCategorized">Não Categorizadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-2 pt-4">
                <Button onClick={clearFilters} variant="outline" disabled={!hasActiveFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabela de Transações */}
        <Card>
          <CardHeader>
            <CardTitle>
              {transactions?.length || 0} transações encontradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isLoading && transactions && transactions.length > 0 ? (
              <div className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction: Transaction) => (
                      <TableRow
                        key={transaction.id}
                        className={transaction.isIgnored ? "opacity-50" : ""}
                      >
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(transaction.purchaseDate), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-medium text-xs truncate">{transaction.description}</p>
                            <div className="flex flex-wrap gap-1">
                              {transaction.isInstallment && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded whitespace-nowrap">
                                  {transaction.installmentNumber}/{transaction.installmentTotal}
                                </span>
                              )}
                              {transaction.isIgnored && (
                                <span className="text-xs bg-gray-200 text-gray-700 px-1 py-0.5 rounded whitespace-nowrap flex items-center gap-1">
                                  <EyeOff className="w-3 h-3" /> Oculta
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getAccountName(transaction.accountId)}</TableCell>
                        <TableCell>
                          <span className={!transaction.categoryId ? "text-muted-foreground italic" : ""}>
                            {getCategoryName(transaction.categoryId)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`${
                              transaction.transactionType === "income" ? "text-green-600" : "text-red-600"
                            } font-semibold ${transaction.isIgnored ? "text-gray-400" : ""}`}
                          >
                            {transaction.transactionType === "income" ? "+" : "-"}
                            {formatCurrency(transaction.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Editar Categoria */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditCategory(transaction)}
                              title="Editar Categoria"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>

                            {/* Ocultar/Mostrar */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleIgnore(transaction.id)}
                              title={transaction.isIgnored ? "Restaurar" : "Ocultar"}
                              className={transaction.isIgnored ? "text-gray-600 hover:text-gray-700" : "text-yellow-600 hover:text-yellow-700"}
                            >
                              {transaction.isIgnored ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <EyeOff className="w-4 h-4" />
                              )}
                            </Button>

                            {/* Deletar */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(transaction.id)}
                              title="Deletar"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada</div>
            )}
          </CardContent>
        </Card>

        {/* Dialog Modal para Editar Categoria */}
        <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
          <DialogContent className="sm:max-w-md !fixed !top-1/2 !left-1/2 !transform !-translate-x-1/2 !-translate-y-1/2 !z-50" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 9999 }}>
            <DialogHeader>
              <DialogTitle>Editar Categoria</DialogTitle>
              <DialogDescription>
                {editingTransaction?.description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-select">Selecione uma categoria</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger id="category-select">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.subcategory ? `${category.name} > ${category.subcategory}` : category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setEditingTransaction(null)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveCategory}
                  disabled={updateCategoryMutation.isPending}
                >
                  {updateCategoryMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
