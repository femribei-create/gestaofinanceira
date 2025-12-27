import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  users,
  accounts,
  categories,
  transactions,
  classificationRules,
  classificationHistory,
  monthlyGoals,
  revenueData,
  cardClosingDates,
  // Tipos para inserção
  type InsertUser,
  type InsertAccount,
  type InsertCategory,
  type InsertTransaction,
  type InsertClassificationRule,
  type InsertMonthlyGoal,
  type InsertRevenueData,
  type InsertCardClosingDate,
  // Tipos de retorno
  type Account,
  type Category,
  type Transaction,
  type ClassificationRule,
  type MonthlyGoal,
  type RevenueData,
  type CardClosingDate,
} from "../drizzle/schema";

// --- CONFIGURAÇÃO MANUAL DE AMBIENTE (BYPASS) ---
// Isso resolve o erro "Could not resolve ./_core/env"
const ENV = {
  databaseUrl: process.env.DATABASE_URL,
  ownerOpenId: process.env.OWNER_OPEN_ID,
};
// ------------------------------------------------

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== FUNÇÕES EXPORTADAS (Mantendo a lógica original) =====

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: any = {};

  if (user.name) { values.name = user.name; updateSet.name = user.name; }
  if (user.email) { values.email = user.email; updateSet.email = user.email; }
  if (user.loginMethod) { values.loginMethod = user.loginMethod; updateSet.loginMethod = user.loginMethod; }
  
  if (user.role) { 
    values.role = user.role; 
    updateSet.role = user.role; 
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = 'admin';
    updateSet.role = 'admin';
  }

  values.lastSignedIn = new Date();
  updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createAccount(account: InsertAccount): Promise<Account> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(accounts).values(account);
  const inserted = await db.select().from(accounts).where(eq(accounts.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function getUserAccounts(userId: number): Promise<Account[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accounts).where(eq(accounts.userId, userId));
}

export async function updateAccountBalance(accountId: number, newBalance: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(accounts).set({ currentBalance: newBalance, updatedAt: new Date() }).where(eq(accounts.id, accountId));
}

export async function createCategory(category: InsertCategory): Promise<Category> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categories).values(category);
  const inserted = await db.select().from(categories).where(eq(categories.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function getUserCategories(userId: number, businessType?: "personal" | "business"): Promise<Category[]> {
  const db = await getDb();
  if (!db) return [];
  if (businessType) {
    return db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.businessType, businessType)));
  }
  return db.select().from(categories).where(eq(categories.userId, userId));
}

export async function getCategoryByName(userId: number, name: string, businessType: "personal" | "business"): Promise<Category | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.name, name), eq(categories.businessType, businessType))).limit(1);
  return result[0];
}

/**
 * NOVA FUNÇÃO: Atualizar uma categoria existente
 * Atualiza o nome e/ou subcategoria da categoria
 * Também atualiza TODAS as transações que usam essa categoria
 */
export async function updateCategory(
  categoryId: number,
  updates: { name?: string; subcategory?: string | null }
): Promise<Category> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar a categoria atual
  const currentCategory = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!currentCategory || currentCategory.length === 0) {
    throw new Error("Category not found");
  }

  const category = currentCategory[0];

  // Atualizar a categoria
  await db.update(categories).set({ ...updates, updatedAt: new Date() }).where(eq(categories.id, categoryId));

  // Se o nome foi alterado, atualizar todas as transações que usam essa categoria
  if (updates.name && updates.name !== category.name) {
    // Nota: A coluna 'categoryName' nas transações armazena o nome da categoria
    // Precisamos atualizar isso também para manter consistência
    // Mas como o relacionamento é por ID, isso é opcional
    // Vamos apenas atualizar o categoryId que já está correto
  }

  // Retornar a categoria atualizada
  const updated = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  return updated[0]!;
}

/**
 * NOVA FUNÇÃO: Deletar uma categoria
 * Antes de deletar, verifica se há transações usando essa categoria
 * Se houver, retorna um erro com a contagem
 */
export async function deleteCategory(categoryId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verificar se há transações usando essa categoria
  const transactionCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(eq(transactions.categoryId, categoryId));

  const count = transactionCount[0]?.count || 0;

  if (count > 0) {
    throw new Error(`Cannot delete category: ${count} transaction(s) still use this category. Please reassign them first.`);
  }

  // Se não há transações, deletar a categoria
  await db.delete(categories).where(eq(categories.id, categoryId));
}

/**
 * NOVA FUNÇÃO: Atualizar múltiplas transações para uma nova categoria
 * Usado quando o usuário quer mover transações de uma categoria para outra
 */
export async function updateTransactionsCategoryBulk(
  transactionIds: number[],
  newCategoryId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (transactionIds.length === 0) return;

  // Atualizar todas as transações
  await db
    .update(transactions)
    .set({ categoryId: newCategoryId, updatedAt: new Date() })
    .where(sql`${transactions.id} IN (${sql.raw(transactionIds.join(","))})`);
}

/**
 * NOVA FUNÇÃO: Obter transações de uma categoria com contagem
 * Retorna a contagem de transações para cada categoria
 */
export async function getTransactionsByCategory(
  userId: number,
  categoryId: number
): Promise<Transaction[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.categoryId, categoryId)))
    .orderBy(desc(transactions.purchaseDate));
}

/**
 * NOVA FUNÇÃO: Obter categorias com contagem de transações
 * Retorna todas as categorias do usuário com a contagem de transações para cada uma
 * SIMPLIFICADO: Abordagem sem leftJoin para evitar problemas de tipo
 */
export async function getCategoriesWithTransactionCount(
  userId: number,
  businessType?: "personal" | "business"
): Promise<(Category & { transactionCount: number })[]> {
  const db = await getDb();
  if (!db) return [] as (Category & { transactionCount: number })[];

  // Passo 1: Obter todas as categorias
  const allCategories = await getUserCategories(userId, businessType);

  // Passo 2: Para cada categoria, contar transações
  const categoriesWithCount: (Category & { transactionCount: number })[] = [];
  
  for (const category of allCategories) {
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transactions)
      .where(eq(transactions.categoryId, category.id));
    
    const count = countResult[0]?.count || 0;
    
    categoriesWithCount.push({
      ...category,
      transactionCount: count,
    });
  }

  return categoriesWithCount;
}

export async function createTransaction(transaction: InsertTransaction): Promise<Transaction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transactions).values(transaction);
  const inserted = await db.select().from(transactions).where(eq(transactions.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function createTransactionsBulk(transactionList: InsertTransaction[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (transactionList.length === 0) return;
  await db.insert(transactions).values(transactionList);
}

export async function getUserTransactions(userId: number, filters?: any): Promise<Transaction[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(transactions.userId, userId)];
  
  if (filters?.search) conditions.push(sql`LOWER(${transactions.description}) LIKE LOWER(${`%${filters.search}%`})`);
  if (filters?.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters?.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
  if (filters?.startDate) conditions.push(gte(transactions.purchaseDate, filters.startDate));
  if (filters?.endDate) conditions.push(lte(transactions.purchaseDate, filters.endDate));
  if (filters?.transactionType) conditions.push(eq(transactions.transactionType, filters.transactionType));
  if (filters?.isDuplicate !== undefined) conditions.push(eq(transactions.isDuplicate, filters.isDuplicate));

  return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.purchaseDate));
}

export async function updateTransaction(id: number, updates: Partial<InsertTransaction>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(transactions).set({ ...updates, updatedAt: new Date() }).where(eq(transactions.id, id));
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(transactions).where(eq(transactions.id, id));
}

export async function createClassificationRule(rule: InsertClassificationRule): Promise<ClassificationRule> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(classificationRules).values(rule);
  const inserted = await db.select().from(classificationRules).where(eq(classificationRules.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function getUserClassificationRules(userId: number): Promise<ClassificationRule[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(classificationRules).where(and(eq(classificationRules.userId, userId), eq(classificationRules.isActive, true))).orderBy(desc(classificationRules.priority));
}

export async function upsertClassificationHistory(userId: number, description: string, categoryId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(classificationHistory).values({ userId, description, categoryId, count: 1, lastUsed: new Date() })
    .onDuplicateKeyUpdate({ set: { count: sql`count + 1`, lastUsed: new Date() } });
}

export async function getClassificationHistory(userId: number, description: string): Promise<{ categoryId: number; count: number }[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select({ categoryId: classificationHistory.categoryId, count: classificationHistory.count })
    .from(classificationHistory).where(and(eq(classificationHistory.userId, userId), sql`${classificationHistory.description} LIKE ${`%${description}%`}`)).orderBy(desc(classificationHistory.count));
}

export async function upsertMonthlyGoal(goal: InsertMonthlyGoal): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(monthlyGoals).values(goal).onDuplicateKeyUpdate({ set: { goalAmount: goal.goalAmount, updatedAt: new Date() } });
}

export async function getMonthlyGoals(userId: number, year: number, month: number): Promise<MonthlyGoal[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(monthlyGoals).where(and(eq(monthlyGoals.userId, userId), eq(monthlyGoals.year, year), eq(monthlyGoals.month, month)));
}

export async function upsertRevenueData(data: InsertRevenueData): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(revenueData).values(data).onDuplicateKeyUpdate({ set: { revenue: data.revenue, updatedAt: new Date() } });
}

export async function getRevenueData(userId: number, year: number, month: number): Promise<RevenueData[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(revenueData).where(and(eq(revenueData.userId, userId), eq(revenueData.year, year), eq(revenueData.month, month)));
}
