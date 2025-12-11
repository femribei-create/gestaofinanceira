import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Download, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DRELineItem {
  name: string;
  amount: number;
  percentage?: number;
}

interface DREMonth {
  month: string;
  year: number;
  revenues: DRELineItem[];
  totalRevenues: number;
  costOfGoods: DRELineItem[];
  totalCostOfGoods: number;
  grossProfit: number;
  grossProfitMargin: number;
  operatingExpenses: DRELineItem[];
  totalOperatingExpenses: number;
  operatingProfit: number;
  operatingProfitMargin: number;
  otherExpenses: DRELineItem[];
  totalOtherExpenses: number;
  netProfit: number;
  netProfitMargin: number;
}

const formatCurrency = (cents: number) => {
  const value = cents / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(2)}%`;
};

interface DRETableProps {
  dreMonth: DREMonth;
  isCurrentMonth: boolean;
}

function DRETable({ dreMonth, isCurrentMonth }: DRETableProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold">
          {dreMonth.month} / {dreMonth.year}
          {isCurrentMonth && <span className="ml-2 text-sm text-blue-600 font-normal">(Mês Atual)</span>}
        </h3>
      </div>

      {/* Receitas */}
      <div className="space-y-3">
        <div className="font-semibold text-green-700">RECEITAS</div>
        {dreMonth.revenues.length > 0 ? (
          <>
            {dreMonth.revenues.map((item) => (
              <div key={item.name} className="flex justify-between text-sm pl-4">
                <span>{item.name}</span>
                <span className="text-green-600">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="text-sm text-gray-500 pl-4">Nenhuma receita</div>
        )}
        <div className="flex justify-between font-semibold border-t pt-2 pl-4">
          <span>Total de Receitas</span>
          <span className="text-green-700">{formatCurrency(dreMonth.totalRevenues)}</span>
        </div>
      </div>

      {/* Custo dos Produtos Vendidos */}
      <div className="space-y-3">
        <div className="font-semibold text-red-700">(-) CUSTO DOS PRODUTOS VENDIDOS</div>
        {dreMonth.costOfGoods.length > 0 ? (
          <>
            {dreMonth.costOfGoods.map((item) => (
              <div key={item.name} className="flex justify-between text-sm pl-4">
                <span>{item.name}</span>
                <span className="text-red-600">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="text-sm text-gray-500 pl-4">Nenhum custo</div>
        )}
        <div className="flex justify-between font-semibold border-t pt-2 pl-4">
          <span>Total de Custos</span>
          <span className="text-red-700">{formatCurrency(dreMonth.totalCostOfGoods)}</span>
        </div>
      </div>

      {/* Lucro Bruto */}
      <div className="bg-blue-50 p-4 rounded-lg space-y-2 border border-blue-200">
        <div className="flex justify-between font-semibold">
          <span>LUCRO BRUTO</span>
          <span className={dreMonth.grossProfit >= 0 ? "text-green-700" : "text-red-700"}>
            {formatCurrency(dreMonth.grossProfit)}
          </span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Margem Bruta</span>
          <span>{formatPercentage(dreMonth.grossProfitMargin)}</span>
        </div>
      </div>

      {/* Despesas Operacionais */}
      <div className="space-y-3">
        <div className="font-semibold text-red-700">(-) DESPESAS OPERACIONAIS</div>
        {dreMonth.operatingExpenses.length > 0 ? (
          <>
            {dreMonth.operatingExpenses.map((item) => (
              <div key={item.name} className="flex justify-between text-sm pl-4">
                <span>{item.name}</span>
                <span className="text-red-600">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="text-sm text-gray-500 pl-4">Nenhuma despesa operacional</div>
        )}
        <div className="flex justify-between font-semibold border-t pt-2 pl-4">
          <span>Total de Despesas Operacionais</span>
          <span className="text-red-700">{formatCurrency(dreMonth.totalOperatingExpenses)}</span>
        </div>
      </div>

      {/* Resultado Operacional */}
      <div className="bg-indigo-50 p-4 rounded-lg space-y-2 border border-indigo-200">
        <div className="flex justify-between font-semibold">
          <span>RESULTADO OPERACIONAL</span>
          <span className={dreMonth.operatingProfit >= 0 ? "text-green-700" : "text-red-700"}>
            {formatCurrency(dreMonth.operatingProfit)}
          </span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Margem Operacional</span>
          <span>{formatPercentage(dreMonth.operatingProfitMargin)}</span>
        </div>
      </div>

      {/* Outras Despesas */}
      <div className="space-y-3">
        <div className="font-semibold text-red-700">(-) OUTRAS DESPESAS</div>
        {dreMonth.otherExpenses.length > 0 ? (
          <>
            {dreMonth.otherExpenses.map((item) => (
              <div key={item.name} className="flex justify-between text-sm pl-4">
                <span>{item.name}</span>
                <span className="text-red-600">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="text-sm text-gray-500 pl-4">Nenhuma outra despesa</div>
        )}
        <div className="flex justify-between font-semibold border-t pt-2 pl-4">
          <span>Total de Outras Despesas</span>
          <span className="text-red-700">{formatCurrency(dreMonth.totalOtherExpenses)}</span>
        </div>
      </div>

      {/* Resultado Líquido */}
      <div className={`p-4 rounded-lg space-y-2 border-2 ${
        dreMonth.netProfit >= 0
          ? "bg-green-50 border-green-300"
          : "bg-red-50 border-red-300"
      }`}>
        <div className="flex justify-between font-bold text-lg">
          <span>RESULTADO LÍQUIDO</span>
          <span className={dreMonth.netProfit >= 0 ? "text-green-700" : "text-red-700"}>
            {formatCurrency(dreMonth.netProfit)}
          </span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span>Margem Líquida</span>
          <span className={dreMonth.netProfit >= 0 ? "text-green-700" : "text-red-700"}>
            {formatPercentage(dreMonth.netProfitMargin)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DRE() {
  const [monthsToShow] = useState(3);
  const { data: dreData, isLoading, error } = trpc.dre.getMonthlyDRE.useQuery({
    monthsToShow,
  });

  const handleExportCSV = () => {
    if (!dreData) return;

    let csv = "DRE - Demonstração do Resultado do Exercício\n\n";

    const exportMonth = (month: DREMonth) => {
      csv += `${month.month}/${month.year}\n`;
      csv += "RECEITAS\n";
      month.revenues.forEach((item) => {
        csv += `${item.name},${item.amount}\n`;
      });
      csv += `Total de Receitas,${month.totalRevenues}\n\n`;

      csv += "CUSTO DOS PRODUTOS VENDIDOS\n";
      month.costOfGoods.forEach((item) => {
        csv += `${item.name},${item.amount}\n`;
      });
      csv += `Total de Custos,${month.totalCostOfGoods}\n\n`;

      csv += `LUCRO BRUTO,${month.grossProfit}\n`;
      csv += `Margem Bruta,${month.grossProfitMargin}%\n\n`;

      csv += "DESPESAS OPERACIONAIS\n";
      month.operatingExpenses.forEach((item) => {
        csv += `${item.name},${item.amount}\n`;
      });
      csv += `Total de Despesas Operacionais,${month.totalOperatingExpenses}\n\n`;

      csv += `RESULTADO OPERACIONAL,${month.operatingProfit}\n`;
      csv += `Margem Operacional,${month.operatingProfitMargin}%\n\n`;

      csv += "OUTRAS DESPESAS\n";
      month.otherExpenses.forEach((item) => {
        csv += `${item.name},${item.amount}\n`;
      });
      csv += `Total de Outras Despesas,${month.totalOtherExpenses}\n\n`;

      csv += `RESULTADO LÍQUIDO,${month.netProfit}\n`;
      csv += `Margem Líquida,${month.netProfitMargin}%\n\n`;
      csv += "---\n\n";
    };

    exportMonth(dreData.currentMonth);
    dreData.previousMonths.forEach(exportMonth);

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/csv;charset=utf-8," + encodeURIComponent(csv)
    );
    element.setAttribute("download", `DRE-${new Date().toISOString().split("T")[0]}.csv`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast.success("DRE exportada com sucesso!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando DRE...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700">Erro ao carregar DRE</CardTitle>
              <CardDescription className="text-red-600">
                {error.message}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  if (!dreData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Nenhum dado disponível</CardTitle>
              <CardDescription>
                Importe transações para visualizar a DRE
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Demonstração do Resultado do Exercício (DRE)
            </h1>
            <p className="text-gray-600 mt-2">
              Análise mensal com histórico comparativo
            </p>
          </div>
          <Button onClick={handleExportCSV} variant="outline" size="lg">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Resumo Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Receita Total (Mês Atual)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(dreData.currentMonth.totalRevenues)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {dreData.currentMonth.month} / {dreData.currentMonth.year}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Despesas Totais (Mês Atual)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(
                  dreData.currentMonth.totalCostOfGoods +
                    dreData.currentMonth.totalOperatingExpenses +
                    dreData.currentMonth.totalOtherExpenses
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {dreData.currentMonth.month} / {dreData.currentMonth.year}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Resultado Líquido (Mês Atual)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  dreData.currentMonth.netProfit >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {formatCurrency(dreData.currentMonth.netProfit)}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {dreData.currentMonth.netProfit >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-600" />
                )}
                <span className="text-xs text-gray-500">
                  Margem: {formatPercentage(dreData.currentMonth.netProfitMargin)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DRE Mês Atual */}
        <Card>
          <CardHeader>
            <CardTitle>Mês Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <DRETable dreMonth={dreData.currentMonth} isCurrentMonth={true} />
          </CardContent>
        </Card>

        {/* DRE Meses Anteriores */}
        {dreData.previousMonths.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dreData.previousMonths.map((month) => (
              <Card key={`${month.month}-${month.year}`}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {month.month} / {month.year}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DRETable dreMonth={month} isCurrentMonth={false} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
