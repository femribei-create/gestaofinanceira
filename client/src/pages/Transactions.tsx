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
  DialogFooter,
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
  purchaseDate: string; // O TRPC serializa datas como string
  paymentDate: string;
  isInstallment: boolean;
  installmentNumber: number | null;
  installmentTotal: number | null;
  categoryId: number | null;
  accountId: number;
  isIgnored: boolean; // Novo campo
}

export default function Transactions() {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  
  // Filtros
  const [searchText, setSearchText] = useState("");
  const [filterAccountId, setFilterAccountId] = useState<string>("");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Construir objeto de filtros
  const filters: any = {};
  if (searchText) filters.search = searchText;
  if (filterAccountId) filters.accountId = parseInt(filterAccountId);
  if (filterCategoryId) filters.categoryId = parseInt(filterCategoryId);
  if (filterType) filters.transactionType = filterType;
  if (filterMonth) {
    const [year, month] = filterMonth.split("-");
    const startDate = new Date(parseInt(year!), parseInt(month!) - 1, 1);
    const endDate = new Date(parseInt(year!), parseInt(month!), 0, 23, 59, 59);
    filters.startDate = startDate.toISOString();
    filters.endDate = endDate.toISOString();
  }
  
  const { data: transactions, isLoading, refetch } = trpc.transactions.list.useQuery(filters);
  const { data: categories } = trpc.setup.listCategories.useQuery({});
  const { data: accounts } = trpc.setup.listAccounts.useQuery();
  
  // Mutações
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
      toast.success(data.isIgnored ? "Transação ignorada (não somará nos totais)" : "Transação restaurada");
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
  
  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "Sem categoria";
    const category = categories?.find(c => c.id === categoryId);
    if (!category) return "Desconhecida";
    return category.subcategory ? `${category.name} > ${category.subcategory}` : category.name;
  };
  
  const getAccountName = (accountId: number) => {
    const account = accounts?.find(a => a.id === accountId);
    return account?.name || "Desconhecida";
  };
  
  const formatCurrency = (cents: number) => {
    const value = Math.abs(cents) / 100;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };
  
  const handleEditCategory = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setSelectedCategoryId(transaction.categoryId?.toString() || "");
  };
  
  const handleSaveCategory = () => {
    if (!editingTransaction || !selectedCategoryId) return;
    
    updateCategoryMutation.mutate({
      transactionId: editingTransaction.id,
      categoryId: parseInt(selectedCategoryId),
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta transação? Essa ação não pode ser desfeita.")) {
      deleteTransactionMutation.mutate({ transactionId: id });
    }
  };

  const handleToggleIgnore = (id: number) => {
    toggleIgnoreMutation.mutate({ transactionId: id });
  };
  
  const clearFilters = () => {
    setSearchText("");
    setFilterAccountId("");
    setFilterCategoryId("");
    setFilterType("");
    setFilterMonth("");
  };
  
  const hasActiveFilters = searchText || filterAccountId || filterCategoryId || filterType || filterMonth;
  
  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Transações</h1>
            <p className="text-muted-foreground">
              Visualize, filtre e edite suas transações
            </p>
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
                <div className="space-y-2">
                  <Label htmlFor="search">Buscar por descrição</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Digite para buscar..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="account">Conta Bancária</Label>
                  <Select value={filterAccountId} onValueChange={setFilterAccountId}>
                    <SelectTrigger id="account">
                      <SelectValue placeholder="Todas as contas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas as contas</SelectItem>
                      {accounts?.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas as categorias</SelectItem>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.subcategory ? `${category.name} > ${category.subcategory}` : category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas os tipos</SelectItem>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="month">Mês</Label>
                  <Input
                    id="month"
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                  />
                </div>
              </div>
              
              {hasActiveFilters && (
                <div className="flex justify-end">
                  <Button variant="outline" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-2" />
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Lista de Transações */}
        <Card>
          <CardHeader>
            <CardTitle>
              {transactions?.length || 0} transações encontradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction: any) => (
                      <TableRow 
                        key={transaction.id} 
                        className={transaction.isIgnored ? "opacity-50 bg-gray-50 hover:bg-gray-100" : ""}
                      >
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(transaction.purchaseDate), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {transaction.transactionType === "income" ? (
                              <ArrowUpCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <ArrowDownCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                            )}
                            <span className={`max-w-md truncate ${transaction.isIgnored ? "line-through text-gray-500" : ""}`}>
                              {transaction.description}
                            </span>
                            {transaction.isInstallment && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded whitespace-nowrap">
                                {transaction.installmentNumber}/{transaction.installmentTotal}
                              </span>
                            )}
                            {transaction.isIgnored && (
                              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded whitespace-nowrap flex items-center gap-1">
                                <EyeOff className="w-3 h-3" /> Ignorada
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getAccountName(transaction.accountId)}</TableCell>
                        <TableCell>
                          <span className={!transaction.categoryId ? "text-muted-foreground italic" : ""}>
                            {getCategoryName(transaction.categoryId)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`${
                            transaction.transactionType === "income" ? "text-green-600" : "text-red-600"
                          } font-semibold ${transaction.isIgnored ? "text-gray-400" : ""}`}>
                            {transaction.transactionType === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
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

                            {/* Ignorar/Designorar */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleIgnore(transaction.id)}
                              title={transaction.isIgnored ? "Restaurar Transação" : "Ignorar Transação (não somar)"}
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            >
                              {transaction.isIgnored ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </Button>

                            {/* Excluir */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(transaction.id)}
                              title="Excluir Permanentemente"
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
              <div className="text-center py-8 text-muted-foreground">
                {hasActiveFilters ? "Nenhuma transação encontrada com os filtros aplicados" : "Nenhuma transação encontrada"}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Modal de Edição (Mantido igual) */}
        <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Categoria</DialogTitle>
              <DialogDescription>
                Altere a categoria desta transação
              </DialogDescription>
            </DialogHeader>
            {editingTransaction && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Transação:</p>
                  <p className="font-medium">{editingTransaction.description}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Nova Categoria</Label>
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger id="edit-category">
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
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTransaction(null)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveCategory}
                disabled={!selectedCategoryId || updateCategoryMutation.isPending}
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
