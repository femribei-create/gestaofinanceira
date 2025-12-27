import { eq, and, gte, lt } from "drizzle-orm";
// Caminhos relativos seguros
import { transactions, categories, revenueData } from "../drizzle/schema";
import { getDb } from "./db";

export interface DRELineItem {
  name: string;
  amount: number;
  percentage?: number;
}

export interface DREMonth {
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

export interface DREComparative {
  currentMonth: DREMonth;
  previousMonths: DREMonth[];
}

// ============================================================
// CATEGORIAS REAIS DO USUÁRIO - CLASSIFICADAS POR TIPO
// ============================================================

// RECEITAS (Transações de entrada)
const REVENUE_CATEGORIES = [
  "PIX RECEBIDO CLIENTE",
  "CRÉDITO",
  "DÉBITO",
];

// CUSTO DOS PRODUTOS VENDIDOS (Despesas diretas de produção/venda)
const COGS_CATEGORIES = [
  "FORNECEDOR",
  "FRETE",
  "INSUMOS",
];

// DESPESAS OPERACIONAIS (Custo para manter o negócio funcionando)
const OPERATING_EXPENSE_CATEGORIES = [
  // Imóvel e Utilidades
  "ALUGUEL COMERCIAL",
  "ENERGIA",
  "INTERNET",
  
  // Pessoal
  "PAGTO FUNCIONÁRIO",
  "PAGTO FUNCIONÁRIO GERENTE",
  "PAGTO FUNCIONÁRIO CLT",
  "PAGTO FUNCIONÁRIO ESTÁGIO",
  "PAGTO FUNCIONÁRIO SUPER ESTÁGIO",
  "PAGTO FUNCIONÁRIO RESCISÃO",
  "PAGTO FUNCIONÁRIO FÉRIAS/13°",
  "PAGTO FUNCIONÁRIO TESTE CONTRATAÇÃO",
  "PAGTO FUNCIONÁRIO VALE-TRANSPORTE",
  "PAGTO FUNCIONÁRIO BONIFICAÇÃO VENDA",
  
  // Operacional
  "SISTEMAS",
  "MANUTENÇÃO",
  "LIMPEZA",
  "SEGURANÇA",
  "MATERIAL ESCRITÓRIO",
  "PREPRAÇÃO DE EVENTOS",
  
  // Marketing e Comunicação
  "PROPAGANDA - OUTROS",
  "FUNDO PROPAGANDA",
  
  // Profissionais
  "CONTADOR / BUROCRACIA",
  "ADVOGADOS",
  
  // Outros
  "SEGURO LOJA",
  "ROYALTIES",
];

// OUTRAS DESPESAS (Impostos, taxas, juros)
const OTHER_EXPENSE_CATEGORIES = [
  "IMPOSTO SIMPLES - DAS",
  "IMPOSTO ICMS - DARF",
  "IMPOSTO FGTS - DARF",
  "IMPOSTO FGTS RESCISÓRIO - DARF",
  "IMPOSTO SIMPLES - PARCELADO",
  "IMPOSTO INSS - DARF",
  "IMPOSTO OUTROS IMPOSTOS E TAXAS",
  "BANCOS", // Taxas bancárias
];

// CATEGORIAS A IGNORAR (Não devem aparecer na DRE)
// Transferências internas, despesas pessoais, etc.
const IGNORE_CATEGORIES = [
  "TRANSF INTERNA",
  "TROCO",
  "SANGRIA",
  "EMPRÉSTIMO",
  "PRÓ-LABORE",
  "PAGTO CARTÃO",
  "PESSOAL - ASSINATURAS + CELULAR",
  "PESSOAL - CASA (ALUGUEL+LUZ+AGUA+INTERNET)",
  "PESSOAL - CASA (COMPRAS E MANUTENÇÃO)",
  "PESSOAL - CARRO / UBER + GAS",
  "PESSOAL - PESSOAL",
  "PESSOAL - COMPRAS PESSOAIS",
  "PESSOAL - DESENV PESSOAL (SPORT + ESTUDO/LEITURA)",
  "PESSOAL - SAÚDE",
  "PESSOAL - SAÚDE_CONVÊNIO",
  "PESSOAL - SAÚDE_MÉDICOS",
  "PESSOAL - SAÚDE_REMÉDIO",
  "PESSOAL - SAÚDE_OUTROS",
  "PESSOAL - LAZER",
  "PESSOAL - DELIVERY",
  "PESSOAL - ALIMENTAÇÃO",
  "PESSOAL - SUPER",
  "PESSOAL - VIAGENS",
  "PESSOAL - PRESENTES",
  "PESSOAL - JACAREÍ",
  "PESSOAL - ADVOGADOS",
  "PESSOAL - NOVO TRABALHO",
  "PESSOAL - BANCOS",
  "PESSOAL - INVESTIMENTO",
  "PESSOAL - OUTROS",
  "PESSOAL - EMPRÉSTIMO",
  "OUTROS",
];

async function getTransactionsByMonth(
  userId: number,
  year: number,
  month: number
): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  // Usar leftJoin para incluir transações sem categoria
  return db
    .select()
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.isIgnored, false), // Excluir transações marcadas como ignoradas
        gte(transactions.paymentDate, startDate),
        lt(transactions.paymentDate, endDate)
      )
    );
}

function categorizeTransaction(
  categoryName: string | null,
  transactionType: string
): "revenue" | "cogs" | "operating" | "other" | "ignore" {
  // Se não tem categoria, ignora
  if (!categoryName) {
    return "ignore";
  }

  // Se está na lista de ignorar, ignora
  if (IGNORE_CATEGORIES.includes(categoryName)) {
    return "ignore";
  }

  // Se é receita (income), classifica como receita
  if (transactionType === "income") {
    return "revenue";
  }

  // Se é despesa (expense), verifica a categoria
  if (COGS_CATEGORIES.includes(categoryName)) {
    return "cogs";
  }

  if (OPERATING_EXPENSE_CATEGORIES.includes(categoryName)) {
    return "operating";
  }

  if (OTHER_EXPENSE_CATEGORIES.includes(categoryName)) {
    return "other";
  }

  // Se não se encaixa em nenhuma categoria, ignora
  return "ignore";
}

async function calculateDREMonth(
  userId: number,
  year: number,
  month: number
): Promise<DREMonth> {
  const transactionsData = await getTransactionsByMonth(userId, year, month);

  const revenues: Map<string, number> = new Map();
  const cogs: Map<string, number> = new Map();
  const operating: Map<string, number> = new Map();
  const other: Map<string, number> = new Map();

  for (const row of transactionsData) {
    const transaction = row.transactions;
    const category = row.categories;
    
    // Pegar o nome da categoria (pode ser null)
    const categoryName = category?.name || null;
    
    const categoryType = categorizeTransaction(
      categoryName,
      transaction.transactionType
    );
    const amount = Math.abs(transaction.amount);

    // Ignorar transações que devem ser ignoradas
    if (categoryType === "ignore") {
      continue;
    }

    if (categoryType === "revenue") {
      revenues.set(
        categoryName || "Sem Categoria",
        (revenues.get(categoryName || "Sem Categoria") || 0) + amount
      );
    } else if (categoryType === "cogs") {
      cogs.set(
        categoryName || "Sem Categoria",
        (cogs.get(categoryName || "Sem Categoria") || 0) + amount
      );
    } else if (categoryType === "operating") {
      operating.set(
        categoryName || "Sem Categoria",
        (operating.get(categoryName || "Sem Categoria") || 0) + amount
      );
    } else if (categoryType === "other") {
      other.set(
        categoryName || "Sem Categoria",
        (other.get(categoryName || "Sem Categoria") || 0) + amount
      );
    }
  }

  const revenueItems: DRELineItem[] = Array.from(revenues.entries()).map(
    ([name, amount]) => ({
      name,
      amount,
    })
  );
  const totalRevenues = Array.from(revenues.values()).reduce((a, b) => a + b, 0);

  const cogsItems: DRELineItem[] = Array.from(cogs.entries()).map(
    ([name, amount]) => ({
      name,
      amount,
    })
  );
  const totalCogs = Array.from(cogs.values()).reduce((a, b) => a + b, 0);

  const grossProfit = totalRevenues - totalCogs;
  const grossProfitMargin =
    totalRevenues > 0 ? (grossProfit / totalRevenues) * 100 : 0;

  const operatingItems: DRELineItem[] = Array.from(operating.entries()).map(
    ([name, amount]) => ({
      name,
      amount,
    })
  );
  const totalOperating = Array.from(operating.values()).reduce((a, b) => a + b, 0);

  const operatingProfit = grossProfit - totalOperating;
  const operatingProfitMargin =
    totalRevenues > 0 ? (operatingProfit / totalRevenues) * 100 : 0;

  const otherItems: DRELineItem[] = Array.from(other.entries()).map(
    ([name, amount]) => ({
      name,
      amount,
    })
  );
  const totalOther = Array.from(other.values()).reduce((a, b) => a + b, 0);

  const netProfit = operatingProfit - totalOther;
  const netProfitMargin =
    totalRevenues > 0 ? (netProfit / totalRevenues) * 100 : 0;

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  return {
    month: monthNames[month - 1],
    year,
    revenues: revenueItems,
    totalRevenues,
    costOfGoods: cogsItems,
    totalCostOfGoods: totalCogs,
    grossProfit,
    grossProfitMargin,
    operatingExpenses: operatingItems,
    totalOperatingExpenses: totalOperating,
    operatingProfit,
    operatingProfitMargin,
    otherExpenses: otherItems,
    totalOtherExpenses: totalOther,
    netProfit,
    netProfitMargin,
  };
}

export async function getDREComparative(
  userId: number,
  monthsToShow: number = 3
): Promise<DREComparative> {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const currentMonthDRE = await calculateDREMonth(
    userId,
    currentYear,
    currentMonth
  );

  const previousMonths: DREMonth[] = [];

  for (let i = 1; i < monthsToShow; i++) {
    let month = currentMonth - i;
    let year = currentYear;

    if (month <= 0) {
      month += 12;
      year -= 1;
    }

    const monthDRE = await calculateDREMonth(userId, year, month);
    previousMonths.push(monthDRE);
  }

  return {
    currentMonth: currentMonthDRE,
    previousMonths,
  };
}

/**
 * Buscar receitas de um ano específico
 */
export async function getRevenues(userId: number, year: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  console.log('[DRE GetRevenues] Buscando receitas - userId:', userId, 'year:', year);
  
  const revenues = await db
    .select()
    .from(revenueData)
    .where(and(eq(revenueData.userId, userId), eq(revenueData.year, year)));
  
  console.log('[DRE GetRevenues] Receitas encontradas:', revenues.length);
  console.log('[DRE GetRevenues] Dados:', revenues);
  
  return revenues.map(rev => ({
    id: rev.id,
    month: rev.month,
    year: rev.year,
    creditoVista: rev.creditCash / 100,
    credito2x: rev.credit2x / 100,
    credito3x: rev.credit3x / 100,
    credito4x: rev.credit4x / 100,
    credito5x: rev.credit5x / 100,
    credito6x: rev.credit6x / 100,
    debito: rev.debit / 100,
    dinheiro: rev.cash / 100,
    pix: rev.pix / 100,
    giraCredito: rev.giraCredit / 100,
  }));
}

/**
 * Inserir/atualizar múltiplas receitas
 */
export async function upsertRevenuesBatch(userId: number, data: any[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const revenue of data) {
    const existing = await db
      .select()
      .from(revenueData)
      .where(
        and(
          eq(revenueData.userId, userId),
          eq(revenueData.month, revenue.month),
          eq(revenueData.year, revenue.year)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update
      await db
        .update(revenueData)
        .set({
          creditCash: Math.round((revenue.creditCash || 0) * 100),
          credit2x: Math.round((revenue.credit2x || 0) * 100),
          credit3x: Math.round((revenue.credit3x || 0) * 100),
          credit4x: Math.round((revenue.credit4x || 0) * 100),
          credit5x: Math.round((revenue.credit5x || 0) * 100),
          credit6x: Math.round((revenue.credit6x || 0) * 100),
          debit: Math.round((revenue.debit || 0) * 100),
          cash: Math.round((revenue.cash || 0) * 100),
          pix: Math.round((revenue.pix || 0) * 100),
          giraCredit: Math.round((revenue.giraCredit || 0) * 100),
          updatedAt: new Date(),
        })
        .where(eq(revenueData.id, existing[0].id));
    } else {
      // Insert
      await db.insert(revenueData).values({
        userId,
        month: revenue.month,
        year: revenue.year,
        creditCash: Math.round((revenue.creditCash || 0) * 100),
        credit2x: Math.round((revenue.credit2x || 0) * 100),
        credit3x: Math.round((revenue.credit3x || 0) * 100),
        credit4x: Math.round((revenue.credit4x || 0) * 100),
        credit5x: Math.round((revenue.credit5x || 0) * 100),
        credit6x: Math.round((revenue.credit6x || 0) * 100),
        debit: Math.round((revenue.debit || 0) * 100),
        cash: Math.round((revenue.cash || 0) * 100),
        pix: Math.round((revenue.pix || 0) * 100),
        giraCredit: Math.round((revenue.giraCredit || 0) * 100),
      });
    }
  }
}
