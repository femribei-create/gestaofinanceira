/**
 * tRPC Router para setup inicial (categorias, contas, regras)
 * ATUALIZADO: Adicionados endpoints para gerenciamento de categorias
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
// Imports relativos seguros (../db aponta para server/db.ts)
import {
  getUserCategories,
  createCategory as dbCreateCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  getCategoriesWithTransactionCount,
  getTransactionsByCategory as dbGetTransactionsByCategory,
  updateTransactionsCategoryBulk,
  getUserAccounts,
  createAccount,
  createClassificationRule,
  getUserClassificationRules,
} from "../db";
import { cardClosingDates } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultRules } from "../classification";

export const setupRouter = router({
  /**
   * Verifica se o sistema já foi inicializado
   */
  checkSetupStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;
      
      const categories = await getUserCategories(userId);
      const accounts = await getUserAccounts(userId);
      const rules = await getUserClassificationRules(userId);
      
      return {
        isInitialized: categories.length > 0 || accounts.length > 0,
        categoriesCount: categories.length,
        accountsCount: accounts.length,
        rulesCount: rules.length,
      };
    }),

  /**
   * Inicializa categorias padrão do usuário
   */
  initializeCategories: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;
      
      // Categorias empresariais
      const businessCategories = [
        "FORNECEDOR", "FRETE", "INSUMOS", "PIX DESAPEGO",
        "PROPAGANDA - OUTROS", "ALUGUEL COMERCIAL", "SEGURO LOJA",
        "ENERGIA", "ROYALTIES", "FUNDO PROPAGANDA", "CONTADOR / BUROCRACIA",
        "IMPOSTO", "PAGTO FUNCIONÁRIO", "SISTEMAS", "INTERNET",
        "PREPARAÇÃO DE EVENTOS", "MATERIAL ESCRITÓRIO", "MANUTENÇÃO",
        "LIMPEZA", "SEGURANÇA", "BANCOS", "ADVOGADOS", "TROCO",
        "OUTROS", "PRÓ-LABORE", "EMPRÉSTIMO", "PIX RECEBIDO CLIENTE",
        "TRANSF INTERNA", "DÉBITO", "CRÉDITO", "PAGTO CARTÃO", "SANGRIA",
      ];
      
      // Subcategorias de imposto
      const impostoSubs = [
        "SIMPLES - DAS", "ICMS - DARF", "FGTS - DARF",
        "FGTS RESCISÓRIO - DARF", "SIMPLES - PARCELADO",
        "INSS - DARF", "OUTROS IMPOSTOS E TAXAS",
      ];
      
      // Subcategorias de funcionário
      const funcionarioSubs = [
        "GERENTE", "CLT", "ESTÁGIO", "SUPER ESTÁGIO",
        "RESCISÃO", "FÉRIAS/13°", "TESTE CONTRATAÇÃO",
        "VALE-TRANSPORTE", "BONIFICAÇÃO VENDA",
      ];
      
      // Categorias pessoais
      const personalCategories = [
        "ASSINATURAS + CELULAR", "CASA (ALUGUEL+LUZ+AGUA+INTERNET)",
        "CASA (COMPRAS E MANUTENÇÃO)", "CARRO / UBER + GAS",
        "CUIDADOS PESSOAIS E COMPRAS", "COMPRAS PESSOAIS",
        "DESENV PESSOAL (SPORT + ESTUDO/LEITURA)", "SAÚDE",
        "LAZER", "ALIMENTAÇÃO", "SUPER", "VIAGENS",
        "PRESENTES", "JACAREÍ", "ADVOGADOS", "NOVO TRABALHO",
        "BANCOS", "INVESTIMENTO", "OUTROS", "EMPRÉSTIMO",
      ];
      
      // Subcategorias de saúde
      const saudeSubs = ["CONVÊNIO", "MÉDICOS", "REMÉDIO", "OUTROS"];
      
      // Subcategorias de lazer
      const lazerSubs = ["DELIVERY", "SAÍDAS"];
      
      const categoryMap = new Map<string, number>();
      
      // Criar categorias empresariais
      for (const name of businessCategories) {
        const category = await dbCreateCategory({
          userId,
          name,
          businessType: "business",
        });
        categoryMap.set(name, category.id);
      }
      
      // Criar subcategorias de imposto
      const impostoId = categoryMap.get("IMPOSTO");
      if (impostoId) {
        for (const sub of impostoSubs) {
          await dbCreateCategory({
            userId,
            name: "IMPOSTO",
            subcategory: sub,
            businessType: "business",
          });
        }
      }
      
      // Criar subcategorias de funcionário
      const funcionarioId = categoryMap.get("PAGTO FUNCIONÁRIO");
      if (funcionarioId) {
        for (const sub of funcionarioSubs) {
          await dbCreateCategory({
            userId,
            name: "PAGTO FUNCIONÁRIO",
            subcategory: sub,
            businessType: "business",
          });
        }
      }
      
      // Criar categorias pessoais
      for (const name of personalCategories) {
        const category = await dbCreateCategory({
          userId,
          name,
          businessType: "personal",
        });
        categoryMap.set(name, category.id);
      }
      
      // Criar subcategorias de saúde
      const saudeId = categoryMap.get("SAÚDE");
      if (saudeId) {
        for (const sub of saudeSubs) {
          await dbCreateCategory({
            userId,
            name: "SAÚDE",
            subcategory: sub,
            businessType: "personal",
          });
        }
      }
      
      // Criar subcategorias de lazer
      const lazerId = categoryMap.get("LAZER");
      if (lazerId) {
        for (const sub of lazerSubs) {
          await dbCreateCategory({
            userId,
            name: "LAZER",
            subcategory: sub,
            businessType: "personal",
          });
        }
      }
      
      return {
        success: true,
        count: categoryMap.size,
      };
    }),
  
  /**
   * Inicializa regras de classificação padrão
   */
  initializeRules: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;
      
      // Buscar categorias
      const categories = await getUserCategories(userId);
      const categoryMap = new Map<string, number>();
      
      for (const cat of categories) {
        categoryMap.set(cat.name, cat.id);
      }
      
      // Criar regras padrão
      const defaultRules = getDefaultRules(userId, categoryMap);
      
      for (const rule of defaultRules) {
        await createClassificationRule(rule);
      }
      
      return {
        success: true,
        count: defaultRules.length,
      };
    }),
  
  /**
   * Inicializa contas bancárias padrão
   */
  initializeAccounts: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;
      
      const accounts = [
        { name: "Itaú Empresarial", accountType: "bank" as const, businessType: "business" as const },
        { name: "Nubank PJ", accountType: "bank" as const, businessType: "business" as const },
        { name: "Nubank Pessoal", accountType: "bank" as const, businessType: "personal" as const },
        { name: "Inter Empresarial", accountType: "bank" as const, businessType: "business" as const },
        { name: "Cartão Master", accountType: "credit_card" as const, businessType: "personal" as const },
        { name: "Cartão Visa", accountType: "credit_card" as const, businessType: "personal" as const },
        { name: "Sangria", accountType: "bank" as const, businessType: "business" as const },
      ];
      
      for (const acc of accounts) {
        await createAccount({
          userId,
          ...acc,
          initialBalance: 0,
          currentBalance: 0,
        });
      }
      
      return {
        success: true,
        count: accounts.length,
      };
    }),
  
  /**
   * Lista categorias do usuário
   */
  listCategories: protectedProcedure
    .input(z.object({
      businessType: z.enum(["personal", "business"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      return getUserCategories(userId, input.businessType);
    }),
  
  /**
   * Lista contas do usuário
   */
  listAccounts: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;
      return getUserAccounts(userId);
    }),
  
  /**
   * Lista regras de classificação
   */
  listRules: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;
      return getUserClassificationRules(userId);
    }),
    /**
   * Buscar datas de fechamento configuradas para um cartão em um mês específico
   */
  getCardClosingDate: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      year: z.number(),
      month: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      const result = await ctx.db
        .select()
        .from(cardClosingDates)
        .where(
          and(
            eq(cardClosingDates.userId, userId),
            eq(cardClosingDates.accountId, input.accountId),
            eq(cardClosingDates.year, input.year),
            eq(cardClosingDates.month, input.month)
          )
        )
        .limit(1);
      
      return result[0] || null;
    }),

  /**
   * Salvar ou atualizar data de fechamento do cartão
   */
  setCardClosingDate: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      year: z.number(),
      month: z.number(),
      closingDate: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      // Verificar se já existe
      const existing = await ctx.db
        .select()
        .from(cardClosingDates)
        .where(
          and(
            eq(cardClosingDates.userId, userId),
            eq(cardClosingDates.accountId, input.accountId),
            eq(cardClosingDates.year, input.year),
            eq(cardClosingDates.month, input.month)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        // Atualizar
        await ctx.db
          .update(cardClosingDates)
          .set({ closingDate: input.closingDate })
          .where(eq(cardClosingDates.id, existing[0].id));
      } else {
        // Inserir
        await ctx.db
          .insert(cardClosingDates)
          .values({
            userId,
            accountId: input.accountId,
            year: input.year,
            month: input.month,
            closingDate: input.closingDate,
          });
      }
      
      return { success: true };
    }),

  /**
   * Listar todas as datas de fechamento de um usuário
   */
  listCardClosingDates: protectedProcedure
    .input(z.object({
      accountId: z.number().optional(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .select()
        .from(cardClosingDates)
        .where(eq(cardClosingDates.userId, ctx.user.id));
      
      if (input.accountId) {
        query = query.where(eq(cardClosingDates.accountId, input.accountId));
      }
      
      if (input.year) {
        query = query.where(eq(cardClosingDates.year, input.year));
      }
      
      return await query;
    }),

  // ===== NOVOS ENDPOINTS PARA GERENCIAMENTO DE CATEGORIAS =====

  /**
   * Listar categorias com contagem de transações
   * Mostra quantas transações cada categoria tem
   */
  getCategoriesWithCount: protectedProcedure
    .input(
      z.object({
        businessType: z.enum(["personal", "business"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const businessType = input?.businessType;

      return await getCategoriesWithTransactionCount(userId, businessType);
    }),

  /**
   * Criar uma nova categoria
   */
  createNewCategory: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Category name is required"),
        subcategory: z.string().optional(),
        businessType: z.enum(["personal", "business"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const newCategory = await dbCreateCategory({
        userId,
        name: input.name,
        subcategory: input.subcategory || null,
        businessType: input.businessType,
      });

      return newCategory;
    }),

  /**
   * Editar uma categoria existente
   * Atualiza o nome e/ou subcategoria e todas as transações associadas
   */
  updateExistingCategory: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
        name: z.string().min(1).optional(),
        subcategory: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { categoryId, name, subcategory } = input;

      // Verificar se a categoria pertence ao usuário
      const categories = await getUserCategories(userId);
      const category = categories.find((c) => c.id === categoryId);

      if (!category) {
        throw new Error("Category not found or does not belong to this user");
      }

      // Preparar os updates
      const updates: { name?: string; subcategory?: string | null } = {};
      if (name) updates.name = name;
      if (subcategory !== undefined) updates.subcategory = subcategory || null;

      // Se não há nada para atualizar, retornar erro
      if (Object.keys(updates).length === 0) {
        throw new Error("No fields to update");
      }

      const updatedCategory = await dbUpdateCategory(categoryId, updates);

      return updatedCategory;
    }),

  /**
   * Deletar uma categoria
   * Impede deleção se houver transações usando essa categoria
   */
  deleteExistingCategory: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { categoryId } = input;

      // Verificar se a categoria pertence ao usuário
      const categories = await getUserCategories(userId);
      const category = categories.find((c) => c.id === categoryId);

      if (!category) {
        throw new Error("Category not found or does not belong to this user");
      }

      try {
        await dbDeleteCategory(categoryId);
        return { success: true, message: "Category deleted successfully" };
      } catch (error: any) {
        throw new Error(error.message);
      }
    }),

  /**
   * Obter transações de uma categoria
   * Retorna todas as transações que usam uma categoria específica
   */
  getCategoryTransactions: protectedProcedure
    .input(
      z.object({
        categoryId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { categoryId } = input;

      // Verificar se a categoria pertence ao usuário
      const categories = await getUserCategories(userId);
      const category = categories.find((c) => c.id === categoryId);

      if (!category) {
        throw new Error("Category not found or does not belong to this user");
      }

      return await dbGetTransactionsByCategory(userId, categoryId);
    }),

  /**
   * Mover múltiplas transações para uma nova categoria
   * Usado quando o usuário quer reatribuir transações
   */
  moveTransactionsToCategory: protectedProcedure
    .input(
      z.object({
        transactionIds: z.array(z.number()).min(1, "At least one transaction is required"),
        newCategoryId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { transactionIds, newCategoryId } = input;

      // Verificar se a nova categoria pertence ao usuário
      const categories = await getUserCategories(userId);
      const newCategory = categories.find((c) => c.id === newCategoryId);

      if (!newCategory) {
        throw new Error("Target category not found or does not belong to this user");
      }

      await updateTransactionsCategoryBulk(transactionIds, newCategoryId);

      return {
        success: true,
        message: `${transactionIds.length} transaction(s) moved successfully`,
      };
    }),

});
