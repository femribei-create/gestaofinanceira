import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

export default function AddTransaction() {
  const [, setLocation] = useLocation();

  // --- Estados do Formulário ---
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    transactionType: "expense" as "income" | "expense",
    purchaseDate: new Date().toISOString().split("T")[0],
    paymentDate: new Date().toISOString().split("T")[0],
    accountId: "",
    categoryId: "", // Vazio significa "sem categoria"
    isInstallment: false,
    installmentNumber: "1",
    installmentTotal: "1",
  });

  // --- Carregamento de Dados ---
  const { data: accounts } = trpc.setup.listAccounts.useQuery();
  const { data: categories } = trpc.setup.listCategories.useQuery({});

  // --- Mutação para Criar Transação ---
  const createTransactionMutation = trpc.transactions.create.useMutation({
    onSuccess: () => {
      toast.success("Transação criada com sucesso!");
      // Redirecionar para a página de transações após 1 segundo
      setTimeout(() => {
        setLocation("/transactions");
      }, 1000);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // --- Handlers ---
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações básicas
    if (!formData.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    if (!formData.accountId) {
      toast.error("Selecione uma conta");
      return;
    }

    if (formData.isInstallment) {
      const installNum = parseInt(formData.installmentNumber);
      const installTotal = parseInt(formData.installmentTotal);

      if (installNum < 1 || installTotal < 1 || installNum > installTotal) {
        toast.error("Número de parcelas inválido");
        return;
      }
    }

    // Preparar dados para envio
    const payload = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      transactionType: formData.transactionType,
      purchaseDate: new Date(formData.purchaseDate),
      paymentDate: new Date(formData.paymentDate),
      accountId: parseInt(formData.accountId),
      categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
      isInstallment: formData.isInstallment,
      installmentNumber: formData.isInstallment ? parseInt(formData.installmentNumber) : undefined,
      installmentTotal: formData.isInstallment ? parseInt(formData.installmentTotal) : undefined,
    };

    createTransactionMutation.mutate(payload);
  };

  // --- Renderização ---
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation("/transactions")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Adicionar Transação</h1>
            <p className="text-gray-600">Crie uma nova transação manualmente</p>
          </div>
        </div>

        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Transação</CardTitle>
            <CardDescription>
              Preencha os campos abaixo para adicionar uma nova transação
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Linha 1: Descrição e Valor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <Input
                    id="description"
                    placeholder="Ex: Compra no supermercado"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Valor (R$) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => handleInputChange("amount", e.target.value)}
                  />
                </div>
              </div>

              {/* Linha 2: Tipo e Datas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transactionType">Tipo *</Label>
                  <Select
                    value={formData.transactionType}
                    onValueChange={(value) =>
                      handleInputChange("transactionType", value as "income" | "expense")
                    }
                  >
                    <SelectTrigger id="transactionType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Despesa</SelectItem>
                      <SelectItem value="income">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purchaseDate">Data da Compra *</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => handleInputChange("purchaseDate", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentDate">Data do Pagamento</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => handleInputChange("paymentDate", e.target.value)}
                  />
                </div>
              </div>

              {/* Linha 3: Conta e Categoria */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountId">Conta Bancária *</Label>
                  <Select
                    value={formData.accountId}
                    onValueChange={(value) => handleInputChange("accountId", value)}
                  >
                    <SelectTrigger id="accountId">
                      <SelectValue placeholder="Selecione uma conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryId">Categoria</Label>
                  <Select
                    value={formData.categoryId || "none"}
                    onValueChange={(value) => 
                      handleInputChange("categoryId", value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger id="categoryId">
                      <SelectValue placeholder="Selecione uma categoria (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                          {category.subcategory && ` - ${category.subcategory}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Seção de Parcelas */}
              <div className="border-t pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="isInstallment"
                    checked={formData.isInstallment}
                    onChange={(e) => handleInputChange("isInstallment", e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isInstallment" className="cursor-pointer">
                    Esta é uma compra parcelada?
                  </Label>
                </div>

                {formData.isInstallment && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="installmentNumber">Número da Parcela *</Label>
                      <Input
                        id="installmentNumber"
                        type="number"
                        min="1"
                        value={formData.installmentNumber}
                        onChange={(e) => handleInputChange("installmentNumber", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="installmentTotal">Total de Parcelas *</Label>
                      <Input
                        id="installmentTotal"
                        type="number"
                        min="1"
                        value={formData.installmentTotal}
                        onChange={(e) => handleInputChange("installmentTotal", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 justify-end pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/transactions")}
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={createTransactionMutation.isPending}
                >
                  {createTransactionMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {createTransactionMutation.isPending ? "Criando..." : "Criar Transação"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Dicas */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">💡 Dicas</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800 space-y-2">
            <p>• A data de compra é quando a transação foi realizada</p>
            <p>• A data de pagamento é quando o dinheiro será debitado (para cartão de crédito)</p>
            <p>• Se não selecionar uma categoria, você poderá categorizar depois na lista de transações</p>
            <p>• Para compras parceladas, crie uma entrada para cada parcela com o número correspondente</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
