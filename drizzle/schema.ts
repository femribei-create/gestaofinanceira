import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index, unique } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Contas bancárias (Itaú, Nubank PJ, Nubank Pessoal, Inter, Cartões)
 */
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(), // Ex: "Itaú Empresarial", "Nubank PJ"
  accountType: mysqlEnum("accountType", ["bank", "credit_card"]).notNull(),
  businessType: mysqlEnum("businessType", ["personal", "business"]).notNull(),
  initialBalance: int("initialBalance").default(0).notNull(), // Em centavos
  currentBalance: int("currentBalance").default(0).notNull(), // Em centavos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("accounts_userId_idx").on(table.userId),
}));

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

/**
 * Categorias de transações (Pessoal e Empresarial)
 */
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  subcategory: varchar("subcategory", { length: 255 }),
  businessType: mysqlEnum("businessType", ["personal", "business"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("categories_userId_idx").on(table.userId),
  nameIdx: index("categories_name_idx").on(table.name),
}));

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

/**
 * Transações financeiras
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: int("accountId").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: int("categoryId").references(() => categories.id, { onDelete: "set null" }),
  
  // Dados da transação
  description: text("description").notNull(),
  amount: int("amount").notNull(), // Em centavos (positivo = receita, negativo = despesa)
  transactionType: mysqlEnum("transactionType", ["income", "expense"]).notNull(),
  
  // Datas
  purchaseDate: timestamp("purchaseDate").notNull(), // Data da compra
  paymentDate: timestamp("paymentDate").notNull(), // Data do pagamento
  
  // Informações de parcela
  isInstallment: boolean("isInstallment").default(false).notNull(),
  installmentNumber: int("installmentNumber"), // Parcela atual (ex: 3)
  installmentTotal: int("installmentTotal"), // Total de parcelas (ex: 6)
  originalPurchaseDate: timestamp("originalPurchaseDate"), // Data original da compra (para parcelas)
  
  // Origem e classificação
  source: mysqlEnum("source", ["manual", "csv", "ofx"]).notNull(),
  sourceFile: varchar("sourceFile", { length: 255 }), // Nome do arquivo importado
  
  // Classificação automática
  suggestedCategoryId: int("suggestedCategoryId").references(() => categories.id, { onDelete: "set null" }),
  classificationMethod: mysqlEnum("classificationMethod", ["rule", "ai", "manual", "history"]),
  
  // Controle de duplicatas
  isDuplicate: boolean("isDuplicate").default(false).notNull(),
  duplicateStatus: mysqlEnum("duplicateStatus", ["pending", "approved", "rejected"]).default("pending"),
  
  // Identificadores únicos (para OFX)
  fitId: varchar("fitId", { length: 255 }), // ID único do OFX
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("transactions_userId_idx").on(table.userId),
  accountIdIdx: index("transactions_accountId_idx").on(table.accountId),
  categoryIdIdx: index("transactions_categoryId_idx").on(table.categoryId),
  purchaseDateIdx: index("transactions_purchaseDate_idx").on(table.purchaseDate),
  paymentDateIdx: index("transactions_paymentDate_idx").on(table.paymentDate),
  isDuplicateIdx: index("transactions_isDuplicate_idx").on(table.isDuplicate),
  fitIdIdx: index("transactions_fitId_idx").on(table.fitId),
}));

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Regras de classificação automática
 */
export const classificationRules = mysqlTable("classificationRules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Condições da regra
  pattern: text("pattern").notNull(), // Padrão a buscar na descrição
  matchType: mysqlEnum("matchType", ["contains", "starts_with", "ends_with", "exact"]).notNull(),
  accountId: int("accountId").references(() => accounts.id, { onDelete: "cascade" }), // Opcional: aplicar apenas a uma conta
  
  // Ação da regra
  categoryId: int("categoryId").notNull().references(() => categories.id, { onDelete: "cascade" }),
  transactionType: mysqlEnum("transactionType", ["income", "expense"]).notNull(),
  
  // Prioridade (maior = executa primeiro)
  priority: int("priority").default(0).notNull(),
  
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("classificationRules_userId_idx").on(table.userId),
  priorityIdx: index("classificationRules_priority_idx").on(table.priority),
}));

export type ClassificationRule = typeof classificationRules.$inferSelect;
export type InsertClassificationRule = typeof classificationRules.$inferInsert;

/**
 * Histórico de aprendizado de classificação (para IA)
 */
export const classificationHistory = mysqlTable("classificationHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  description: text("description").notNull(),
  categoryId: int("categoryId").notNull().references(() => categories.id, { onDelete: "cascade" }),
  
  // Contador de vezes que essa descrição foi classificada nessa categoria
  count: int("count").default(1).notNull(),
  
  lastUsed: timestamp("lastUsed").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("classificationHistory_userId_idx").on(table.userId),
}));

export type ClassificationHistory = typeof classificationHistory.$inferSelect;
export type InsertClassificationHistory = typeof classificationHistory.$inferInsert;

/**
 * Metas mensais por categoria
 */
export const monthlyGoals = mysqlTable("monthlyGoals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: int("categoryId").notNull().references(() => categories.id, { onDelete: "cascade" }),
  
  // Período da meta
  year: int("year").notNull(),
  month: int("month").notNull(), // 1-12
  
  // Valor da meta (em centavos)
  goalAmount: int("goalAmount").notNull(),
  
  // Alertas
  alertSent70: boolean("alertSent70").default(false).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("monthlyGoals_userId_idx").on(table.userId),
  yearMonthIdx: index("monthlyGoals_yearMonth_idx").on(table.year, table.month),
  uniqueGoal: unique("monthlyGoals_unique").on(table.userId, table.categoryId, table.year, table.month),
}));

export type MonthlyGoal = typeof monthlyGoals.$inferSelect;
export type InsertMonthlyGoal = typeof monthlyGoals.$inferInsert;

/**
 * Dados de faturamento (importados do CSV)
 */
export const revenueData = mysqlTable("revenueData", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Período
  year: int("year").notNull(),
  month: int("month").notNull(), // 1-12
  
  // Valores de faturamento (em centavos)
  creditCash: int("creditCash").default(0).notNull(),
  credit2x: int("credit2x").default(0).notNull(),
  credit3x: int("credit3x").default(0).notNull(),
  credit4x: int("credit4x").default(0).notNull(),
  credit5x: int("credit5x").default(0).notNull(),
  credit6x: int("credit6x").default(0).notNull(),
  debit: int("debit").default(0).notNull(),
  cash: int("cash").default(0).notNull(),
  pix: int("pix").default(0).notNull(),
  giraCredit: int("giraCredit").default(0).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("revenueData_userId_idx").on(table.userId),
  yearMonthIdx: index("revenueData_yearMonth_idx").on(table.year, table.month),
  uniqueRevenue: unique("revenueData_unique").on(table.userId, table.year, table.month),
}));

export type RevenueData = typeof revenueData.$inferSelect;
export type InsertRevenueData = typeof revenueData.$inferInsert;

/**
 * Configurações de fechamento de cartão
 */
export const cardClosingDates = mysqlTable("cardClosingDates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: int("accountId").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  
  // Período
  year: int("year").notNull(),
  month: int("month").notNull(), // 1-12
  
  // Data de fechamento
  closingDate: timestamp("closingDate").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("cardClosingDates_userId_idx").on(table.userId),
  accountIdIdx: index("cardClosingDates_accountId_idx").on(table.accountId),
  yearMonthIdx: index("cardClosingDates_yearMonth_idx").on(table.year, table.month),
  uniqueClosing: unique("cardClosingDates_unique").on(table.accountId, table.year, table.month),
}));

export type CardClosingDate = typeof cardClosingDates.$inferSelect;
export type InsertCardClosingDate = typeof cardClosingDates.$inferInsert;
