import { eq, and, gte, lt } from "drizzle-orm";
import { transactions, categories } from "../drizzle/schema";
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

// Categorias padrão para cada seção da DRE
const REVENUE_CATEGORIES = ["Vendas", "Salário", "Freelance", "Reembolso"];
const COGS_CATEGORIES = ["Estoque", "Embalagem", "Fornecedores"];
const OPERATING_EXPENSE_CATEGORIES = [
  "Aluguel",
  "Água/Energia",
  "Telefone/Internet",
  "Marketing",
  "Funcionários",
  "Manutenção",
  "Consultoria",
  "Viagens",
  "Combustível",
];
const OTHER_EXPENSE_CATEGORIES = ["Impostos", "Seguros", "Juros"];

async function getTransactionsByMonth(
  userId: number,
  year: number,
  month: number
): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  return db
    .select()
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.paymentDate, startDate),
        lt(transactions.paymentDate, endDate)
      )
    );
}

function categorizeTransaction(
  categoryName: string,
  transactionType: string
): "revenue" | "cogs" | "operating" | "other" | "unknown" {
  if (transactionType === "income") {
    return "revenue";
  }

  if (COGS_CATEGORIES.includes(categoryName)) {
    return "cogs";
  }

  if (OPERATING_EXPENSE_CATEGORIES.includes(categoryName)) {
    return "operating";
  }

  if (OTHER_EXPENSE_CATEGORIES.includes(categoryName)) {
    return "other";
  }

  return "unknown";
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
    const categoryType = categorizeTransaction(
      category.name,
      transaction.transactionType
    );
    // Converter centavos para reais
    const amount = Math.abs(transaction.amount) / 100;

    if (categoryType === "revenue") {
      revenues.set(
        category.name,
        (revenues.get(category.name) || 0) + amount
      );
    } else if (categoryType === "cogs") {
      cogs.set(category.name, (cogs.get(category.name) || 0) + amount);
    } else if (categoryType === "operating") {
      operating.set(
        category.name,
        (operating.get(category.name) || 0) + amount
      );
    } else if (categoryType === "other") {
      other.set(category.name, (other.get(category.name) || 0) + amount);
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
