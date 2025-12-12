/**
 * tRPC Router para setup inicial (categorias, contas, regras)
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getUserCategories,
  createCategory,
  getUserAccounts,
  createAccount,
  createClassificationRule,
  getUserClassificationRules,
} from "../db";
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
        const category = await createCategory({
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
          await createCategory({
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
          await createCategory({
            userId,
            name: "PAGTO FUNCIONÁRIO",
            subcategory: sub,
            businessType: "business",
          });
        }
      }
      
      // Criar categorias pessoais
      for (const name of personalCategories) {
        const category = await createCategory({
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
          await createCategory({
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
          await createCategory({
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
});
