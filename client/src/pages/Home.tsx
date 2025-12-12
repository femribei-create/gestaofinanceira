import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Home() {
  // Buscar dados do dashboard
  const { data: accounts, isLoading: loadingAccounts } = trpc.setup.listAccounts.useQuery();
  const { data: dreData, isLoading: loadingDRE } = trpc.dre.getMonthlyDRE.useQuery({
    monthsToShow: 1
  });

  // Calcular saldo total (valores em centavos, converter para reais)
  const totalBalance = accounts?.reduce((sum, acc) => sum + (acc.currentBalance / 100), 0) || 0;

  // Dados do mês atual (valores já em reais no DRE)
  const monthlyIncome = dreData?.currentMonth?.totalRevenues || 0;
  const monthlyExpense = (dreData?.currentMonth?.totalCostOfGoods || 0) + 
                         (dreData?.currentMonth?.totalOperatingExpenses || 0) + 
                         (dreData?.currentMonth?.totalOtherExpenses || 0);
  const monthlyBalance = dreData?.currentMonth?.netProfit || 0;

  const isLoading = loadingAccounts || loadingDRE;

  // Formatar mês atual
  const currentMonthText = dreData?.currentMonth 
    ? `${dreData.currentMonth.month} de ${dreData.currentMonth.year}`
    : format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Financeiro</h1>
          <p className="text-muted-foreground mt-2">
            Visão geral das suas finanças pessoais e empresariais
          </p>
        </div>

        {/* Cards de Resumo */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Linha 1: Saldo Total */}
            <div className="grid gap-4 md:grid-cols-1">
              <Card className="border-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Saldo Total (Todas as Contas)
                  </CardTitle>
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(totalBalance)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {accounts?.length || 0} contas ativas
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Linha 2: Receitas, Despesas e Saldo do Mês */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Receitas do Mês
                  </CardTitle>
                  <ArrowUpCircle className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(monthlyIncome)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentMonthText}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Despesas do Mês
                  </CardTitle>
                  <ArrowDownCircle className="h-5 w-5 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(monthlyExpense)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentMonthText}
                  </p>
                </CardContent>
              </Card>

              <Card className={monthlyBalance >= 0 ? "border-green-200" : "border-red-200"}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Saldo do Mês
                  </CardTitle>
                  <DollarSign className={`h-5 w-5 ${monthlyBalance >= 0 ? "text-green-600" : "text-red-600"}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${monthlyBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(monthlyBalance)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Receitas - Despesas
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Contas Bancárias */}
            <Card>
              <CardHeader>
                <CardTitle>Contas Bancárias</CardTitle>
                <CardDescription>
                  Saldos atuais de todas as suas contas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {accounts?.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Wallet className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {account.accountType === "bank" && "Conta Bancária"}
                            {account.accountType === "credit_card" && "Cartão de Crédito"}
                            {" • "}
                            {account.businessType === "business" ? "Empresarial" : "Pessoal"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-semibold ${account.currentBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(account.currentBalance / 100)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
