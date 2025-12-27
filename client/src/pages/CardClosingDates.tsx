import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CardClosingDates() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [closingDate, setClosingDate] = useState<string>("");

  // Buscar contas
  const { data: accounts, isLoading: accountsLoading } = trpc.setup.listAccounts.useQuery();

  // Buscar datas de fechamento configuradas
  const { data: closingDates, refetch: refetchClosingDates } = trpc.setup.listCardClosingDates.useQuery({
    accountId: selectedAccountId || undefined,
    year: selectedYear,
  });

  // Buscar data de fechamento específica
  const { data: currentClosingDate } = trpc.setup.getCardClosingDate.useQuery(
    {
      accountId: selectedAccountId || 0,
      year: selectedYear,
      month: selectedMonth,
    },
    {
      enabled: selectedAccountId !== null,
    }
  );

  // Mutations
  const setClosingDateMutation = trpc.setup.setCardClosingDate.useMutation({
    onSuccess: () => {
      toast.success("Data de fechamento salva com sucesso!");
      setClosingDate("");
      refetchClosingDates();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Atualizar campo de data quando a data atual mudar
  const handleAccountChange = (accountId: number) => {
    setSelectedAccountId(accountId);
    setClosingDate("");
  };

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    setClosingDate("");
  };

  const handleSaveClosingDate = () => {
    if (!selectedAccountId || !closingDate) {
      toast.error("Selecione a conta e a data de fechamento");
      return;
    }

    const [year, month, day] = closingDate.split("-");
    const closingDateTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    setClosingDateMutation.mutate({
      accountId: selectedAccountId,
      year: selectedYear,
      month: selectedMonth,
      closingDate: closingDateTime,
    });
  };

  // Filtrar apenas contas de cartão de crédito
  const creditCardAccounts = accounts?.filter((acc) => acc.accountType === "credit_card") || [];

  // Meses do ano
  const months = [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" },
  ];

  // Formatar data para exibição
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Datas de Fechamento do Cartão</h1>
          <p className="text-gray-600 mt-2">
            Configure a data de fechamento mensal de cada cartão de crédito
          </p>
        </div>

        {/* Formulário de Configuração */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Configurar Data de Fechamento
            </CardTitle>
            <CardDescription>
              Selecione o cartão, mês e a data de fechamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Seleção de Cartão */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Cartão de Crédito</label>
              {accountsLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando contas...
                </div>
              ) : (
                <select
                  value={selectedAccountId || ""}
                  onChange={(e) => handleAccountChange(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione um cartão...</option>
                  {creditCardAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Seleção de Mês */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Mês</label>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label} ({selectedYear})
                  </option>
                ))}
              </select>
            </div>

            {/* Data de Fechamento */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Data de Fechamento</label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="flex-1"
                  min={`${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`}
                  max={`${selectedYear}-${String(selectedMonth).padStart(2, "0")}-31`}
                />
                <Button
                  onClick={handleSaveClosingDate}
                  disabled={setClosingDateMutation.isPending || !selectedAccountId || !closingDate}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {setClosingDateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
              {currentClosingDate && (
                <p className="text-sm text-gray-600">
                  Data atual: <strong>{formatDate(currentClosingDate.closingDate)}</strong>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Histórico de Datas Configuradas */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Configurações</CardTitle>
            <CardDescription>
              Todas as datas de fechamento configuradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {closingDates && closingDates.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {closingDates.map((item) => {
                  const account = accounts?.find((a) => a.id === item.accountId);
                  const month = months.find((m) => m.value === item.month);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-sm">
                          {account?.name} - {month?.label} {item.year}
                        </p>
                        <p className="text-xs text-gray-600">
                          Fechamento: {formatDate(item.closingDate)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Deletar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Nenhuma data de fechamento configurada ainda.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Informações Úteis */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">ℹ️ Como Funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>1. Configure a data de fechamento:</strong> Informe o dia em que seu cartão fecha cada mês.
            </p>
            <p>
              <strong>2. Parcelas automáticas:</strong> Quando você importar transações com parcelas, o sistema usará essa data para calcular a data de pagamento.
            </p>
            <p>
              <strong>3. Exemplo:</strong> Se seu Cartão Visa fecha em 25/09, uma parcela 2/8 em 09/09 terá data de pagamento em 25/09.
            </p>
            <p>
              <strong>4. Atualize mensalmente:</strong> Se a data de fechamento variar, configure novamente para o próximo mês.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
