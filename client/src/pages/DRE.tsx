import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Upload } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface DREData {
  month: number;
  year: number;
  creditoVista: number;
  credito2x: number;
  credito3x: number;
  credito4x: number;
  credito5x: number;
  credito6x: number;
  debito: number;
  dinheiro: number;
  pix: number;
  giraCredito: number;
}

export default function DRE() {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Buscar receitas
  const { data: revenues } = trpc.dre.getRevenues.useQuery({
    year: currentYear,
  });
  
  // Debug: log das receitas
  console.log('Receitas carregadas:', revenues);
  console.log('Mês atual:', currentMonth, 'Ano atual:', currentYear);

  // Buscar categorias
  const { data: categories } = trpc.setup.listCategories.useQuery({});

  // Buscar transações do ano atual
  const { data: transactions } = trpc.transactions.list.useQuery({
    startDate: new Date(currentYear, 0, 1),
    endDate: new Date(currentYear, 11, 31),
  });

  // Upload CSV
  const utils = trpc.useUtils();
  const uploadMutation = trpc.dre.uploadRevenuesCSV.useMutation({
    onSuccess: (result) => {
      toast.success(`CSV importado com sucesso! ${result.count} registros salvos.`);
      console.log('Upload resultado:', result);
      // Invalidar cache para recarregar os dados
      utils.dre.getRevenues.invalidate();
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const text = await file.text();
    uploadMutation.mutate({ csvContent: text });
    setUploading(false);
  };

  // Função para obter valor de categoria
  // Retorna sempre valor ABSOLUTO pois a DRE trabalha com valores positivos
  // e faz as subtrações manualmente (Receita - Despesa)
  const getCategoryValue = (categoryName: string, month: number, year: number): number => {
    if (!transactions || !categories) return 0;
    return Math.abs(
      transactions
        .filter((t) => {
          const cat = categories.find((c) => c.id === t.categoryId);
          if (!cat) return false;
          
          // Verificar se corresponde ao nome da categoria ou subcategoria
          // Se a categoria tem subcategoria, compara com subcategory
          // Senão, compara com name
          const matchesCategory = cat.subcategory 
            ? cat.subcategory === categoryName 
            : cat.name === categoryName;
          
          if (!matchesCategory) return false;
          
          // Converter purchaseDate para Date se for string
          const date = typeof t.purchaseDate === 'string' 
            ? new Date(t.purchaseDate) 
            : t.purchaseDate;
          
          return (
            date.getMonth() + 1 === month &&
            date.getFullYear() === year
          );
        })
        .reduce((sum, t) => sum + (t.amount || 0) / 100, 0)
    );
  };

  // Função para obter receita
  const getRevenue = (month: number, year: number): DREData | null => {
    return (
      revenues?.find((r) => r.month === month && r.year === year) || null
    );
  };

  // Calcular meses
  const m = currentMonth;
  const m1 = m === 1 ? 12 : m - 1;
  const m2 = m1 === 1 ? 12 : m1 - 1;
  const yearM = currentYear;
  const yearM1 = m === 1 ? currentYear - 1 : currentYear;
  const yearM2 = m1 === 1 ? currentYear - 1 : currentYear;

  const revM = getRevenue(m, yearM) || {
    creditoVista: 0,
    credito2x: 0,
    credito3x: 0,
    credito4x: 0,
    credito5x: 0,
    credito6x: 0,
    debito: 0,
    dinheiro: 0,
    pix: 0,
    giraCredito: 0,
  };
  const revM1 = getRevenue(m1, yearM1) || {
    creditoVista: 0,
    credito2x: 0,
    credito3x: 0,
    credito4x: 0,
    credito5x: 0,
    credito6x: 0,
    debito: 0,
    dinheiro: 0,
    pix: 0,
    giraCredito: 0,
  };
  const revM2 = getRevenue(m2, yearM2) || {
    creditoVista: 0,
    credito2x: 0,
    credito3x: 0,
    credito4x: 0,
    credito5x: 0,
    credito6x: 0,
    debito: 0,
    dinheiro: 0,
    pix: 0,
    giraCredito: 0,
  };

  // Funções de cálculo
  const calcFatBruto = (rev: DREData) =>
    rev.creditoVista +
    rev.credito2x +
    rev.credito3x +
    rev.credito4x +
    rev.credito5x +
    rev.credito6x +
    rev.debito +
    rev.dinheiro +
    rev.pix;

  const calcTaxaCartao = (rev: DREData) =>
    (rev.creditoVista +
      rev.credito2x +
      rev.credito3x +
      rev.credito4x +
      rev.credito5x +
      rev.credito6x +
      rev.debito) *
    0.04;

  const calcFatLiquido = (rev: DREData) =>
    calcFatBruto(rev) - rev.giraCredito - calcTaxaCartao(rev);

  // RECEITAS
  const fatBrutoM = calcFatBruto(revM);
  const fatBrutoM1 = calcFatBruto(revM1);
  const fatBrutoM2 = calcFatBruto(revM2);

  const taxaM = calcTaxaCartao(revM);
  const taxaM1 = calcTaxaCartao(revM1);
  const taxaM2 = calcTaxaCartao(revM2);

  const fatLiquidoM = calcFatLiquido(revM);
  const fatLiquidoM1 = calcFatLiquido(revM1);
  const fatLiquidoM2 = calcFatLiquido(revM2);

  // COMPRA DE PRODUTOS
  const fornecedorM = getCategoryValue("FORNECEDOR", m, yearM);
  const fornecedorM1 = getCategoryValue("FORNECEDOR", m1, yearM1);
  const fornecedorM2 = getCategoryValue("FORNECEDOR", m2, yearM2);

  const freteM = getCategoryValue("FRETE", m, yearM);
  const freteM1 = getCategoryValue("FRETE", m1, yearM1);
  const freteM2 = getCategoryValue("FRETE", m2, yearM2);

  const insumosM = getCategoryValue("INSUMOS", m, yearM);
  const insumosM1 = getCategoryValue("INSUMOS", m1, yearM1);
  const insumosM2 = getCategoryValue("INSUMOS", m2, yearM2);

  const pixDesapegoM = getCategoryValue("PIX DESAPEGO", m, yearM);
  const pixDesapegoM1 = getCategoryValue("PIX DESAPEGO", m1, yearM1);
  const pixDesapegoM2 = getCategoryValue("PIX DESAPEGO", m2, yearM2);

  const compraM = fornecedorM + freteM + insumosM + pixDesapegoM;
  const compraM1 = fornecedorM1 + freteM1 + insumosM1 + pixDesapegoM1;
  const compraM2 = fornecedorM2 + freteM2 + insumosM2 + pixDesapegoM2;

  const lucroBrutoM = fatLiquidoM - compraM;
  const lucroBrutoM1 = fatLiquidoM1 - compraM1;
  const lucroBrutoM2 = fatLiquidoM2 - compraM2;

  // CUSTOS VARIÁVEIS
  const propagandaM = getCategoryValue("PROPAGANDA - OUTROS", m, yearM);
  const propagandaM1 = getCategoryValue("PROPAGANDA - OUTROS", m1, yearM1);
  const propagandaM2 = getCategoryValue("PROPAGANDA - OUTROS", m2, yearM2);

  const margemM = lucroBrutoM - propagandaM;
  const margemM1 = lucroBrutoM1 - propagandaM1;
  const margemM2 = lucroBrutoM2 - propagandaM2;

  // CUSTOS FIXOS - Primeiras linhas
  const aluguelM = getCategoryValue("ALUGUEL COMERCIAL", m, yearM);
  const aluguelM1 = getCategoryValue("ALUGUEL COMERCIAL", m1, yearM1);
  const aluguelM2 = getCategoryValue("ALUGUEL COMERCIAL", m2, yearM2);

  const seguroM = getCategoryValue("SEGURO LOJA", m, yearM);
  const seguroM1 = getCategoryValue("SEGURO LOJA", m1, yearM1);
  const seguroM2 = getCategoryValue("SEGURO LOJA", m2, yearM2);

  const energiaM = getCategoryValue("ENERGIA", m, yearM);
  const energiaM1 = getCategoryValue("ENERGIA", m1, yearM1);
  const energiaM2 = getCategoryValue("ENERGIA", m2, yearM2);

  const royaltiesM = getCategoryValue("ROYALTIES", m, yearM);
  const royaltiesM1 = getCategoryValue("ROYALTIES", m1, yearM1);
  const royaltiesM2 = getCategoryValue("ROYALTIES", m2, yearM2);

  const fundoPropagandaM = getCategoryValue("FUNDO PROPAGANDA", m, yearM);
  const fundoPropagandaM1 = getCategoryValue("FUNDO PROPAGANDA", m1, yearM1);
  const fundoPropagandaM2 = getCategoryValue("FUNDO PROPAGANDA", m2, yearM2);

  const contadorM = getCategoryValue("CONTADOR / BUROCRACIA", m, yearM);
  const contadorM1 = getCategoryValue("CONTADOR / BUROCRACIA", m1, yearM1);
  const contadorM2 = getCategoryValue("CONTADOR / BUROCRACIA", m2, yearM2);

  // IMPOSTOS
  const simplesDasM = getCategoryValue("SIMPLES - DAS", m, yearM);
  const simplesDasM1 = getCategoryValue("SIMPLES - DAS", m1, yearM1);
  const simplesDasM2 = getCategoryValue("SIMPLES - DAS", m2, yearM2);

  const icmsM = getCategoryValue("ICMS - DARF", m, yearM);
  const icmsM1 = getCategoryValue("ICMS - DARF", m1, yearM1);
  const icmsM2 = getCategoryValue("ICMS - DARF", m2, yearM2);

  const fgtsM = getCategoryValue("FGTS - DARF", m, yearM);
  const fgtsM1 = getCategoryValue("FGTS - DARF", m1, yearM1);
  const fgtsM2 = getCategoryValue("FGTS - DARF", m2, yearM2);

  const fgtsRescisM = getCategoryValue("FGTS RESCISÓRIO - DARF", m, yearM);
  const fgtsRescisM1 = getCategoryValue("FGTS RESCISÓRIO - DARF", m1, yearM1);
  const fgtsRescisM2 = getCategoryValue("FGTS RESCISÓRIO - DARF", m2, yearM2);

  const simplesParcelM = getCategoryValue("SIMPLES - PARCELADO", m, yearM);
  const simplesParcelM1 = getCategoryValue("SIMPLES - PARCELADO", m1, yearM1);
  const simplesParcelM2 = getCategoryValue("SIMPLES - PARCELADO", m2, yearM2);

  const inssM = getCategoryValue("INSS - DARF", m, yearM);
  const inssM1 = getCategoryValue("INSS - DARF", m1, yearM1);
  const inssM2 = getCategoryValue("INSS - DARF", m2, yearM2);

  const outrosImpostosM = getCategoryValue("OUTROS IMPOSTOS E TAXAS", m, yearM);
  const outrosImpostosM1 = getCategoryValue("OUTROS IMPOSTOS E TAXAS", m1, yearM1);
  const outrosImpostosM2 = getCategoryValue("OUTROS IMPOSTOS E TAXAS", m2, yearM2);

  const impostosM = simplesDasM + icmsM + fgtsM + fgtsRescisM + simplesParcelM + inssM + outrosImpostosM;
  const impostosM1 = simplesDasM1 + icmsM1 + fgtsM1 + fgtsRescisM1 + simplesParcelM1 + inssM1 + outrosImpostosM1;
  const impostosM2 = simplesDasM2 + icmsM2 + fgtsM2 + fgtsRescisM2 + simplesParcelM2 + inssM2 + outrosImpostosM2;

  // PAGTO FUNCIONÁRIO
  const gerenteM = getCategoryValue("GERENTE", m, yearM);
  const gerenteM1 = getCategoryValue("GERENTE", m1, yearM1);
  const gerenteM2 = getCategoryValue("GERENTE", m2, yearM2);

  const cltM = getCategoryValue("CLT", m, yearM);
  const cltM1 = getCategoryValue("CLT", m1, yearM1);
  const cltM2 = getCategoryValue("CLT", m2, yearM2);

  const estagioM = getCategoryValue("ESTÁGIO", m, yearM);
  const estagioM1 = getCategoryValue("ESTÁGIO", m1, yearM1);
  const estagioM2 = getCategoryValue("ESTÁGIO", m2, yearM2);

  const superEstagioM = getCategoryValue("SUPER ESTÁGIO", m, yearM);
  const superEstagioM1 = getCategoryValue("SUPER ESTÁGIO", m1, yearM1);
  const superEstagioM2 = getCategoryValue("SUPER ESTÁGIO", m2, yearM2);

  const rescisaoM = getCategoryValue("RESCISÃO", m, yearM);
  const rescisaoM1 = getCategoryValue("RESCISÃO", m1, yearM1);
  const rescisaoM2 = getCategoryValue("RESCISÃO", m2, yearM2);

  const feriasM = getCategoryValue("FÉRIAS/13°", m, yearM);
  const feriasM1 = getCategoryValue("FÉRIAS/13°", m1, yearM1);
  const feriasM2 = getCategoryValue("FÉRIAS/13°", m2, yearM2);

  const testeM = getCategoryValue("TESTE CONTRATAÇÃO", m, yearM);
  const testeM1 = getCategoryValue("TESTE CONTRATAÇÃO", m1, yearM1);
  const testeM2 = getCategoryValue("TESTE CONTRATAÇÃO", m2, yearM2);

  const valeM = getCategoryValue("VALE-TRANSPORTE", m, yearM);
  const valeM1 = getCategoryValue("VALE-TRANSPORTE", m1, yearM1);
  const valeM2 = getCategoryValue("VALE-TRANSPORTE", m2, yearM2);

  const bonificacaoM = getCategoryValue("BONIFICAÇÃO VENDA", m, yearM);
  const bonificacaoM1 = getCategoryValue("BONIFICAÇÃO VENDA", m1, yearM1);
  const bonificacaoM2 = getCategoryValue("BONIFICAÇÃO VENDA", m2, yearM2);

  const funcionariosM = gerenteM + cltM + estagioM + superEstagioM + rescisaoM + feriasM + testeM + valeM + bonificacaoM;
  const funcionariosM1 = gerenteM1 + cltM1 + estagioM1 + superEstagioM1 + rescisaoM1 + feriasM1 + testeM1 + valeM1 + bonificacaoM1;
  const funcionariosM2 = gerenteM2 + cltM2 + estagioM2 + superEstagioM2 + rescisaoM2 + feriasM2 + testeM2 + valeM2 + bonificacaoM2;

  // CUSTOS FIXOS - Restantes
  const sistemasM = getCategoryValue("SISTEMAS", m, yearM);
  const sistemasM1 = getCategoryValue("SISTEMAS", m1, yearM1);
  const sistemasM2 = getCategoryValue("SISTEMAS", m2, yearM2);

  const internetM = getCategoryValue("INTERNET", m, yearM);
  const internetM1 = getCategoryValue("INTERNET", m1, yearM1);
  const internetM2 = getCategoryValue("INTERNET", m2, yearM2);

  const preparacaoM = getCategoryValue("PREPRAÇÃO DE EVENTOS", m, yearM);
  const preparacaoM1 = getCategoryValue("PREPRAÇÃO DE EVENTOS", m1, yearM1);
  const preparacaoM2 = getCategoryValue("PREPRAÇÃO DE EVENTOS", m2, yearM2);

  const materialM = getCategoryValue("MATERIAL ESCRITÓRIO", m, yearM);
  const materialM1 = getCategoryValue("MATERIAL ESCRITÓRIO", m1, yearM1);
  const materialM2 = getCategoryValue("MATERIAL ESCRITÓRIO", m2, yearM2);

  const manutencaoM = getCategoryValue("MANUTENÇÃO", m, yearM);
  const manutencaoM1 = getCategoryValue("MANUTENÇÃO", m1, yearM1);
  const manutencaoM2 = getCategoryValue("MANUTENÇÃO", m2, yearM2);

  const limpezaM = getCategoryValue("LIMPEZA", m, yearM);
  const limpezaM1 = getCategoryValue("LIMPEZA", m1, yearM1);
  const limpezaM2 = getCategoryValue("LIMPEZA", m2, yearM2);

  const segurancaM = getCategoryValue("SEGURANÇA", m, yearM);
  const segurancaM1 = getCategoryValue("SEGURANÇA", m1, yearM1);
  const segurancaM2 = getCategoryValue("SEGURANÇA", m2, yearM2);

  const bancosM = getCategoryValue("BANCOS", m, yearM);
  const bancosM1 = getCategoryValue("BANCOS", m1, yearM1);
  const bancosM2 = getCategoryValue("BANCOS", m2, yearM2);

  const advogadosM = getCategoryValue("ADVOGADOS", m, yearM);
  const advogadosM1 = getCategoryValue("ADVOGADOS", m1, yearM1);
  const advogadosM2 = getCategoryValue("ADVOGADOS", m2, yearM2);

  const trocoM = getCategoryValue("TROCO", m, yearM);
  const trocoM1 = getCategoryValue("TROCO", m1, yearM1);
  const trocoM2 = getCategoryValue("TROCO", m2, yearM2);

  const outrosM = getCategoryValue("OUTROS", m, yearM);
  const outrosM1 = getCategoryValue("OUTROS", m1, yearM1);
  const outrosM2 = getCategoryValue("OUTROS", m2, yearM2);

  const proLaboreM = getCategoryValue("PRÓ-LABORE", m, yearM);
  const proLaboreM1 = getCategoryValue("PRÓ-LABORE", m1, yearM1);
  const proLaboreM2 = getCategoryValue("PRÓ-LABORE", m2, yearM2);

  const emprestimoM = getCategoryValue("EMPRÉSTIMO", m, yearM);
  const emprestimoM1 = getCategoryValue("EMPRÉSTIMO", m1, yearM1);
  const emprestimoM2 = getCategoryValue("EMPRÉSTIMO", m2, yearM2);

  const custosFixosM = aluguelM + seguroM + energiaM + royaltiesM + fundoPropagandaM + contadorM + impostosM + funcionariosM + sistemasM + internetM + preparacaoM + materialM + manutencaoM + limpezaM + segurancaM + bancosM + advogadosM + trocoM + outrosM + proLaboreM + emprestimoM;
  const custosFixosM1 = aluguelM1 + seguroM1 + energiaM1 + royaltiesM1 + fundoPropagandaM1 + contadorM1 + impostosM1 + funcionariosM1 + sistemasM1 + internetM1 + preparacaoM1 + materialM1 + manutencaoM1 + limpezaM1 + segurancaM1 + bancosM1 + advogadosM1 + trocoM1 + outrosM1 + proLaboreM1 + emprestimoM1;
  const custosFixosM2 = aluguelM2 + seguroM2 + energiaM2 + royaltiesM2 + fundoPropagandaM2 + contadorM2 + impostosM2 + funcionariosM2 + sistemasM2 + internetM2 + preparacaoM2 + materialM2 + manutencaoM2 + limpezaM2 + segurancaM2 + bancosM2 + advogadosM2 + trocoM2 + outrosM2 + proLaboreM2 + emprestimoM2;

  // RESULTADO
  const resultadoM = margemM - custosFixosM;
  const resultadoM1 = margemM1 - custosFixosM1;
  const resultadoM2 = margemM2 - custosFixosM2;

  // PESSOAL
  const pessoalM = getCategoryValue("PESSOAL", m, yearM);
  const pessoalM1 = getCategoryValue("PESSOAL", m1, yearM1);
  const pessoalM2 = getCategoryValue("PESSOAL", m2, yearM2);

  const resultadoComPessoalM = resultadoM - pessoalM;
  const resultadoComPessoalM1 = resultadoM1 - pessoalM1;
  const resultadoComPessoalM2 = resultadoM2 - pessoalM2;

  // Componente de linha
  const DRERow = ({ label, m, m1, m2, isBold, isTotal, isSubtotal }: { label: string; m: number; m1: number; m2: number; isBold?: boolean; isTotal?: boolean; isSubtotal?: boolean }) => (
    <div className={`grid grid-cols-4 gap-2 text-xs py-1 px-2 border-b ${isBold ? "font-bold" : ""} ${isTotal ? "bg-blue-100" : ""} ${isSubtotal ? "bg-gray-100 font-semibold" : ""}`}>
      <div className="col-span-1">{label}</div>
      <div className="text-right">{formatCurrency(m)}</div>
      <div className="text-right">{formatCurrency(m1)}</div>
      <div className="text-right">{formatCurrency(m2)}</div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">DRE Mensal</h1>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-blue-600 text-xs h-8"
          >
            <Upload className="w-3 h-3 mr-1" />
            {uploading ? "Enviando..." : "Upload CSV"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        <Card>
          <CardContent className="pt-4 space-y-2">
            {/* Cabeçalho */}
            <div className="grid grid-cols-4 gap-2 text-xs font-bold pb-2 border-b sticky top-0 bg-white">
              <div>Descrição</div>
              <div className="text-right">Mês Atual</div>
              <div className="text-right">Mês -1</div>
              <div className="text-right">Mês -2</div>
            </div>

            {/* FATURAMENTO */}
            <div className="text-xs font-bold text-green-700 mt-2">FATURAMENTO</div>
            <DRERow label="Crédito à Vista" m={revM.creditoVista} m1={revM1.creditoVista} m2={revM2.creditoVista} />
            <DRERow label="Crédito 2x" m={revM.credito2x} m1={revM1.credito2x} m2={revM2.credito2x} />
            <DRERow label="Crédito 3x" m={revM.credito3x} m1={revM1.credito3x} m2={revM2.credito3x} />
            <DRERow label="Crédito 4x" m={revM.credito4x} m1={revM1.credito4x} m2={revM2.credito4x} />
            <DRERow label="Crédito 5x" m={revM.credito5x} m1={revM1.credito5x} m2={revM2.credito5x} />
            <DRERow label="Crédito 6x" m={revM.credito6x} m1={revM1.credito6x} m2={revM2.credito6x} />
            <DRERow label="Débito" m={revM.debito} m1={revM1.debito} m2={revM2.debito} />
            <DRERow label="Dinheiro" m={revM.dinheiro} m1={revM1.dinheiro} m2={revM2.dinheiro} />
            <DRERow label="PIX" m={revM.pix} m1={revM1.pix} m2={revM2.pix} />
            <DRERow label="Faturamento Bruto" m={fatBrutoM} m1={fatBrutoM1} m2={fatBrutoM2} isBold isTotal />
            <DRERow label="(-) Gira Crédito" m={-revM.giraCredito} m1={-revM1.giraCredito} m2={-revM2.giraCredito} />
            <DRERow label="(-) Taxa Cartão" m={-taxaM} m1={-taxaM1} m2={-taxaM2} />
            <DRERow label="Faturamento Líquido" m={fatLiquidoM} m1={fatLiquidoM1} m2={fatLiquidoM2} isBold isTotal />

            {/* COMPRA DE PRODUTOS */}
            <div className="text-xs font-bold text-red-700 mt-2">COMPRA DE PRODUTOS</div>
            <DRERow label="Fornecedor" m={fornecedorM} m1={fornecedorM1} m2={fornecedorM2} />
            <DRERow label="Frete" m={freteM} m1={freteM1} m2={freteM2} />
            <DRERow label="Insumos" m={insumosM} m1={insumosM1} m2={insumosM2} />
            <DRERow label="PIX Desapego" m={pixDesapegoM} m1={pixDesapegoM1} m2={pixDesapegoM2} />
            <DRERow label="Total Compra de Produtos" m={compraM} m1={compraM1} m2={compraM2} isBold isTotal />

            {/* LUCRO BRUTO */}
            <DRERow label="Lucro Bruto" m={lucroBrutoM} m1={lucroBrutoM1} m2={lucroBrutoM2} isBold isTotal />

            {/* CUSTOS VARIÁVEIS */}
            <div className="text-xs font-bold text-purple-700 mt-2">CUSTOS VARIÁVEIS</div>
            <DRERow label="Propaganda" m={-propagandaM} m1={-propagandaM1} m2={-propagandaM2} />

            {/* MARGEM */}
            <DRERow label="Margem" m={margemM} m1={margemM1} m2={margemM2} isBold isTotal />

            {/* CUSTOS FIXOS */}
            <div className="text-xs font-bold text-orange-700 mt-2">CUSTOS FIXOS</div>
            <DRERow label="Aluguel Comercial" m={aluguelM} m1={aluguelM1} m2={aluguelM2} />
            <DRERow label="Seguro Loja" m={seguroM} m1={seguroM1} m2={seguroM2} />
            <DRERow label="Energia" m={energiaM} m1={energiaM1} m2={energiaM2} />
            <DRERow label="Royalties" m={royaltiesM} m1={royaltiesM1} m2={royaltiesM2} />
            <DRERow label="Fundo Propaganda" m={fundoPropagandaM} m1={fundoPropagandaM1} m2={fundoPropagandaM2} />
            <DRERow label="Contador / Burocracia" m={contadorM} m1={contadorM1} m2={contadorM2} />

            {/* IMPOSTOS */}
            <DRERow label="IMPOSTOS" m={impostosM} m1={impostosM1} m2={impostosM2} isSubtotal />
            <DRERow label="  Simples - DAS" m={simplesDasM} m1={simplesDasM1} m2={simplesDasM2} />
            <DRERow label="  ICMS - DARF" m={icmsM} m1={icmsM1} m2={icmsM2} />
            <DRERow label="  FGTS - DARF" m={fgtsM} m1={fgtsM1} m2={fgtsM2} />
            <DRERow label="  FGTS Rescisório - DARF" m={fgtsRescisM} m1={fgtsRescisM1} m2={fgtsRescisM2} />
            <DRERow label="  Simples - Parcelado" m={simplesParcelM} m1={simplesParcelM1} m2={simplesParcelM2} />
            <DRERow label="  INSS - DARF" m={inssM} m1={inssM1} m2={inssM2} />
            <DRERow label="  Outros Impostos e Taxas" m={outrosImpostosM} m1={outrosImpostosM1} m2={outrosImpostosM2} />

            {/* PAGTO FUNCIONÁRIO */}
            <DRERow label="PAGTO FUNCIONÁRIO" m={funcionariosM} m1={funcionariosM1} m2={funcionariosM2} isSubtotal />
            <DRERow label="  Gerente" m={gerenteM} m1={gerenteM1} m2={gerenteM2} />
            <DRERow label="  CLT" m={cltM} m1={cltM1} m2={cltM2} />
            <DRERow label="  Estágio" m={estagioM} m1={estagioM1} m2={estagioM2} />
            <DRERow label="  Super Estágio" m={superEstagioM} m1={superEstagioM1} m2={superEstagioM2} />
            <DRERow label="  Rescisão" m={rescisaoM} m1={rescisaoM1} m2={rescisaoM2} />
            <DRERow label="  Férias/13°" m={feriasM} m1={feriasM1} m2={feriasM2} />
            <DRERow label="  Teste Contratação" m={testeM} m1={testeM1} m2={testeM2} />
            <DRERow label="  Vale-Transporte" m={valeM} m1={valeM1} m2={valeM2} />
            <DRERow label="  Bonificação Venda" m={bonificacaoM} m1={bonificacaoM1} m2={bonificacaoM2} />

            {/* CUSTOS FIXOS RESTANTES */}
            <DRERow label="Sistemas" m={sistemasM} m1={sistemasM1} m2={sistemasM2} />
            <DRERow label="Internet" m={internetM} m1={internetM1} m2={internetM2} />
            <DRERow label="Preparação de Eventos" m={preparacaoM} m1={preparacaoM1} m2={preparacaoM2} />
            <DRERow label="Material Escritório" m={materialM} m1={materialM1} m2={materialM2} />
            <DRERow label="Manutenção" m={manutencaoM} m1={manutencaoM1} m2={manutencaoM2} />
            <DRERow label="Limpeza" m={limpezaM} m1={limpezaM1} m2={limpezaM2} />
            <DRERow label="Segurança" m={segurancaM} m1={segurancaM1} m2={segurancaM2} />
            <DRERow label="Bancos" m={bancosM} m1={bancosM1} m2={bancosM2} />
            <DRERow label="Advogados" m={advogadosM} m1={advogadosM1} m2={advogadosM2} />
            <DRERow label="Troco" m={trocoM} m1={trocoM1} m2={trocoM2} />
            <DRERow label="Outros" m={outrosM} m1={outrosM1} m2={outrosM2} />
            <DRERow label="Pró-Labore" m={proLaboreM} m1={proLaboreM1} m2={proLaboreM2} />
            <DRERow label="Empréstimo" m={emprestimoM} m1={emprestimoM1} m2={emprestimoM2} />

            <DRERow label="Total Custos Fixos" m={custosFixosM} m1={custosFixosM1} m2={custosFixosM2} isBold isTotal />

            {/* RESULTADO */}
            <DRERow label="RESULTADO" m={resultadoM} m1={resultadoM1} m2={resultadoM2} isBold isTotal />

            {/* RESULTADO COM PESSOAL */}
            <DRERow label="RESULTADO COM DESPESAS PESSOAIS" m={resultadoComPessoalM} m1={resultadoComPessoalM1} m2={resultadoComPessoalM2} isBold isTotal />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
