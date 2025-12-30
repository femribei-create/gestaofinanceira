import { getDb } from "./db";
import { classificationRules, classificationHistory, transactions, categories, accounts } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { applyRules, classifyTransaction } from "./classification"; 

/**
 * Motor de Categorização
 * Gerencia a lógica de banco de dados para regras e aprendizado
 */

// 1. Criar ou Atualizar Regra
export async function createOrUpdateRule(
  userId: number,
  ruleId: number | null,
  pattern: string,
  matchType: "contains" | "starts_with" | "ends_with" | "exact",
  categoryId: number,
  transactionType: "income" | "expense",
  priority: number,
  minAmount?: number, 
  maxAmount?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const data = {
    userId,
    pattern,
    matchType,
    categoryId,
    transactionType,
    priority,
    minAmount: minAmount || null, 
    maxAmount: maxAmount || null,
    isActive: true,
  };

  if (ruleId) {
    await db
      .update(classificationRules)
      .set(data)
      .where(and(eq(classificationRules.id, ruleId), eq(classificationRules.userId, userId)));
  } else {
    await db.insert(classificationRules).values(data);
  }
}

// 2. Deletar Regra
export async function deleteRule(ruleId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(classificationRules).where(eq(classificationRules.id, ruleId));
}

// 3. Listar Regras
export async function getUserRules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const rules = await db
    .select({
      id: classificationRules.id,
      pattern: classificationRules.pattern,
      matchType: classificationRules.matchType,
      categoryId: classificationRules.categoryId,
      categoryName: categories.name,
      subcategoryName: categories.subcategory,
      transactionType: classificationRules.transactionType,
      priority: classificationRules.priority,
      minAmount: classificationRules.minAmount,
      maxAmount: classificationRules.maxAmount,
    })
    .from(classificationRules)
    .leftJoin(categories, eq(classificationRules.categoryId, categories.id))
    .where(eq(classificationRules.userId, userId))
    .orderBy(desc(classificationRules.priority));
    
  return rules;
}

// 4. Funções de Histórico e Aprendizado
export async function deleteHistoryPattern(patternId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(classificationHistory).where(eq(classificationHistory.id, patternId));
}

/**
 * Atualizar um padrão de aprendizado existente
 * Permite editar a descrição e a categoria associada a um padrão de histórico
 * 
 * @param userId - ID do usuário (validação de propriedade)
 * @param patternId - ID do padrão a ser atualizado
 * @param newDescription - Nova descrição do padrão
 * @param newCategoryId - Novo ID da categoria
 * @throws Error se o padrão não existir ou não pertencer ao usuário
 */
export async function updateHistoryPattern(
  userId: number,
  patternId: number,
  newDescription: string,
  newCategoryId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Validar que o padrão existe e pertence ao usuário
  const existingPattern = await db
    .select()
    .from(classificationHistory)
    .where(
      and(
        eq(classificationHistory.id, patternId),
        eq(classificationHistory.userId, userId)
      )
    )
    .limit(1);

  if (!existingPattern || existingPattern.length === 0) {
    throw new Error("History pattern not found or does not belong to user");
  }

  // Validar que a categoria existe e pertence ao usuário
  const categoryExists = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, newCategoryId),
        eq(categories.userId, userId)
      )
    )
    .limit(1);

  if (!categoryExists || categoryExists.length === 0) {
    throw new Error("Category not found or does not belong to user");
  }

  // Atualizar o padrão
  await db
    .update(classificationHistory)
    .set({
      description: newDescription,
      categoryId: newCategoryId,
      lastUsed: new Date(),
    })
    .where(eq(classificationHistory.id, patternId));
}

export async function getUserLearningHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const history = await db
    .select({
      id: classificationHistory.id,
      description: classificationHistory.description,
      categoryId: classificationHistory.categoryId,
      categoryName: categories.name,
      count: classificationHistory.count,
      lastUsed: classificationHistory.lastUsed,
    })
    .from(classificationHistory)
    .leftJoin(categories, eq(classificationHistory.categoryId, categories.id))
    .where(eq(classificationHistory.userId, userId))
    .orderBy(desc(classificationHistory.lastUsed));

  return history;
}

// 5. Helpers
export function normalizarSinal(amount: number, fileSource: string): number {
  return amount;
}

export async function categorizeTransaction(userId: number, description: string, amount: number, accountId?: number) {
    const db = await getDb();
    if (!db) throw new Error("DB Error");

    const userRules = await getUserRules(userId);
    const allCategories = await db.select().from(categories).where(eq(categories.userId, userId));

    return await classifyTransaction(
        userId, 
        { description, amount, date: new Date() } as any, 
        accountId || 0, 
        userRules as any, 
        allCategories
    );
}

export async function learnFromCorrection(userId: number, description: string, categoryId: number) {
    const db = await getDb();
    if(!db) return;
    
    const existing = await db.select().from(classificationHistory)
        .where(and(
            eq(classificationHistory.userId, userId),
            eq(classificationHistory.description, description),
            eq(classificationHistory.categoryId, categoryId)
        ));

    if(existing.length > 0) {
        await db.update(classificationHistory)
            .set({ 
                count: existing[0].count + 1,
                lastUsed: new Date()
            })
            .where(eq(classificationHistory.id, existing[0].id));
    } else {
        await db.insert(classificationHistory).values({
            userId,
            description,
            categoryId,
            count: 1
        });
    }
}
