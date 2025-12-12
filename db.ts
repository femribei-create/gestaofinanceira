import { eq, and, gte, lte, desc, sql, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  accounts,
  categories,
  transactions,
  classificationRules,
  classificationHistory,
  monthlyGoals,
  revenueData,
  cardClosingDates,
  type Account,
  type Category,
  type Transaction,
  type ClassificationRule,
  type MonthlyGoal,
  type RevenueData,
  type CardClosingDate,
  type InsertAccount,
  type InsertCategory,
  type InsertTransaction,
  type InsertClassificationRule,
  type InsertClassificationHistory,
  type InsertMonthlyGoal,
  type InsertRevenueData,
  type InsertCardClosingDate,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== USER FUNCTIONS =====

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== ACCOUNT FUNCTIONS =====

export async function createAccount(account: InsertAccount): Promise<Account> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(accounts).values(account);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(accounts).where(eq(accounts.id, insertedId)).limit(1);
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

  await db.update(accounts)
    .set({ currentBalance: newBalance, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));
}

// ===== CATEGORY FUNCTIONS =====

export async function createCategory(category: InsertCategory): Promise<Category> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(categories).values(category);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(categories).where(eq(categories.id, insertedId)).limit(1);
  return inserted[0]!;
}

export async function getUserCategories(userId: number, businessType?: "personal" | "business"): Promise<Category[]> {
  const db = await getDb();
  if (!db) return [];

  if (businessType) {
    return db.select().from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.businessType, businessType)));
  }

  return db.select().from(categories).where(eq(categories.userId, userId));
}

export async function getCategoryByName(userId: number, name: string, businessType: "personal" | "business"): Promise<Category | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(categories)
    .where(and(
      eq(categories.userId, userId),
      eq(categories.name, name),
      eq(categories.businessType, businessType)
    ))
    .limit(1);

  return result[0];
}

// ===== TRANSACTION FUNCTIONS =====

export async function createTransaction(transaction: InsertTransaction): Promise<Transaction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(transactions).values(transaction);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(transactions).where(eq(transactions.id, insertedId)).limit(1);
  return inserted[0]!;
}

export async function createTransactionsBulk(transactionList: InsertTransaction[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (transactionList.length === 0) return;

  await db.insert(transactions).values(transactionList);
}

export async function getUserTransactions(
  userId: number,
  filters?: {
    search?: string;
    accountId?: number;
    categoryId?: number;
    startDate?: Date;
    endDate?: Date;
    transactionType?: "income" | "expense";
    isDuplicate?: boolean;
  }
): Promise<Transaction[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(transactions.userId, userId)];

  if (filters?.search) {
    conditions.push(sql`LOWER(${transactions.description}) LIKE LOWER(${`%${filters.search}%`})`);
  }
  if (filters?.accountId) {
    conditions.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters?.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters?.startDate) {
    conditions.push(gte(transactions.purchaseDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(transactions.purchaseDate, filters.endDate));
  }
  if (filters?.transactionType) {
    conditions.push(eq(transactions.transactionType, filters.transactionType));
  }
  if (filters?.isDuplicate !== undefined) {
    conditions.push(eq(transactions.isDuplicate, filters.isDuplicate));
  }

  return db.select().from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.purchaseDate));
}

export async function updateTransaction(id: number, updates: Partial<InsertTransaction>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(transactions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(transactions.id, id));
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(transactions).where(eq(transactions.id, id));
}

// ===== CLASSIFICATION RULE FUNCTIONS =====

export async function createClassificationRule(rule: InsertClassificationRule): Promise<ClassificationRule> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(classificationRules).values(rule);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(classificationRules).where(eq(classificationRules.id, insertedId)).limit(1);
  return inserted[0]!;
}

export async function getUserClassificationRules(userId: number): Promise<ClassificationRule[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(classificationRules)
    .where(and(eq(classificationRules.userId, userId), eq(classificationRules.isActive, true)))
    .orderBy(desc(classificationRules.priority));
}

// ===== CLASSIFICATION HISTORY FUNCTIONS =====

export async function upsertClassificationHistory(userId: number, description: string, categoryId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(classificationHistory).values({
    userId,
    description,
    categoryId,
    count: 1,
    lastUsed: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      count: sql`count + 1`,
      lastUsed: new Date(),
    },
  });
}

export async function getClassificationHistory(userId: number, description: string): Promise<{ categoryId: number; count: number }[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    categoryId: classificationHistory.categoryId,
    count: classificationHistory.count,
  })
    .from(classificationHistory)
    .where(and(
      eq(classificationHistory.userId, userId),
      sql`${classificationHistory.description} LIKE ${`%${description}%`}`
    ))
    .orderBy(desc(classificationHistory.count));

  return result;
}

// ===== MONTHLY GOAL FUNCTIONS =====

export async function upsertMonthlyGoal(goal: InsertMonthlyGoal): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(monthlyGoals).values(goal).onDuplicateKeyUpdate({
    set: {
      goalAmount: goal.goalAmount,
      updatedAt: new Date(),
    },
  });
}

export async function getMonthlyGoals(userId: number, year: number, month: number): Promise<MonthlyGoal[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(monthlyGoals)
    .where(and(
      eq(monthlyGoals.userId, userId),
      eq(monthlyGoals.year, year),
      eq(monthlyGoals.month, month)
    ));
}

// ===== REVENUE DATA FUNCTIONS =====

export async function upsertRevenueData(revenue: InsertRevenueData): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(revenueData).values(revenue).onDuplicateKeyUpdate({
    set: {
      creditCash: revenue.creditCash,
      credit2x: revenue.credit2x,
      credit3x: revenue.credit3x,
      credit4x: revenue.credit4x,
      credit5x: revenue.credit5x,
      credit6x: revenue.credit6x,
      debit: revenue.debit,
      cash: revenue.cash,
      pix: revenue.pix,
      giraCredit: revenue.giraCredit,
      updatedAt: new Date(),
    },
  });
}

export async function getRevenueData(userId: number, year: number, month: number): Promise<RevenueData | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(revenueData)
    .where(and(
      eq(revenueData.userId, userId),
      eq(revenueData.year, year),
      eq(revenueData.month, month)
    ))
    .limit(1);

  return result[0];
}

// ===== CARD CLOSING DATE FUNCTIONS =====

export async function upsertCardClosingDate(closing: InsertCardClosingDate): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(cardClosingDates).values(closing).onDuplicateKeyUpdate({
    set: {
      closingDate: closing.closingDate,
    },
  });
}

export async function getCardClosingDate(accountId: number, year: number, month: number): Promise<CardClosingDate | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(cardClosingDates)
    .where(and(
      eq(cardClosingDates.accountId, accountId),
      eq(cardClosingDates.year, year),
      eq(cardClosingDates.month, month)
    ))
    .limit(1);

  return result[0];
}
