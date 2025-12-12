/**
 * Script de seed para popular o banco de dados com dados iniciais
 * Executa: tsx scripts/seed.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import { categories, accounts, classificationRules, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL não configurada");
    process.exit(1);
  }

  const db = drizzle(process.env.DATABASE_URL);

  console.log("🌱 Iniciando seed do banco de dados...");

  // Buscar o usuário padrão do Railway
  const DEFAULT_OPEN_ID = "railway-default-user";
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.openId, DEFAULT_OPEN_ID))
    .limit(1);

  if (existingUsers.length === 0) {
    console.error("❌ Usuário padrão não encontrado. O sistema deve criar automaticamente ao iniciar.");
    console.error("   Tente acessar o sistema primeiro para criar o usuário.");
    process.exit(1);
  }

  const OWNER_ID = existingUsers[0]!.id;
  console.log(`👤 Usando usuário padrão (ID: ${OWNER_ID})`);

  // 1. Inserir categorias empresariais
  const businessCategories = [
    "FORNECEDOR", "FRETE", "INSUMOS", "PIX DESAPEGO", "PROPAGANDA - OUTROS",
    "ALUGUEL COMERCIAL", "SEGURO LOJA", "ENERGIA", "ROYALTIES", "FUNDO PROPAGANDA",
    "CONTADOR / BUROCRACIA", "IMPOSTO SIMPLES - DAS", "IMPOSTO ICMS - DARF",
    "IMPOSTO FGTS - DARF", "IMPOSTO FGTS RESCISÓRIO - DARF", "IMPOSTO SIMPLES - PARCELADO",
    "IMPOSTO INSS - DARF", "IMPOSTO OUTROS IMPOSTOS E TAXAS", "PAGTO FUNCIONÁRIO",
    "PAGTO FUNCIONÁRIO GERENTE", "PAGTO FUNCIONÁRIO CLT", "PAGTO FUNCIONÁRIO ESTÁGIO",
    "PAGTO FUNCIONÁRIO SUPER ESTÁGIO", "PAGTO FUNCIONÁRIO RESCISÃO", "PAGTO FUNCIONÁRIO FÉRIAS/13°",
    "PAGTO FUNCIONÁRIO TESTE CONTRATAÇÃO", "PAGTO FUNCIONÁRIO VALE-TRANSPORTE",
    "PAGTO FUNCIONÁRIO BONIFICAÇÃO VENDA", "SISTEMAS", "INTERNET", "PREPRAÇÃO DE EVENTOS",
    "MATERIAL ESCRITÓRIO", "MANUTENÇÃO", "LIMPEZA", "SEGURANÇA", "BANCOS", "ADVOGADOS",
    "TROCO", "OUTROS", "PRÓ-LABORE", "EMPRÉSTIMO", "PIX RECEBIDO CLIENTE", "TRANSF INTERNA",
    "DÉBITO", "CRÉDITO", "PAGTO CARTÃO", "SANGRIA", "RECEBIMENTO EM DÉBITO", "RECEBIMENTO EM CRÉDITO"
  ];

  // 2. Inserir categorias pessoais
  const personalCategories = [
    "ASSINATURAS + CELULAR", "CASA (ALUGUEL+LUZ+AGUA+INTERNET)", "CASA (COMPRAS E MANUTENÇÃO)",
    "CARRO / UBER + GAS", "PESSOAL", "COMPRAS PESSOAIS", "DESENV PESSOAL (SPORT + ESTUDO/LEITURA)",
    "SAÚDE", "SAÚDE_CONVÊNIO", "SAÚDE_MÉDICOS", "SAÚDE_REMÉDIO", "SAÚDE_OUTROS",
    "LAZER", "DELIVERY", "ALIMENTAÇÃO", "SUPER", "VIAGENS", "PRESENTES", "JACAREÍ",
    "ADVOGADOS", "NOVO TRABALHO", "BANCOS", "INVESTIMENTO", "OUTROS", "EMPRÉSTIMO"
  ];

  console.log("📊 Inserindo categorias empresariais...");
  for (const cat of businessCategories) {
    await db.insert(categories).values({
      userId: OWNER_ID,
      name: cat,
      businessType: "business",
      createdAt: new Date(),
    });
  }

  console.log("👤 Inserindo categorias pessoais...");
  for (const cat of personalCategories) {
    await db.insert(categories).values({
      userId: OWNER_ID,
      name: cat,
      businessType: "personal",
      createdAt: new Date(),
    });
  }

  // 3. Inserir contas bancárias
  console.log("🏦 Inserindo contas bancárias...");
  const accountNames = [
    "Itaú Empresarial",
    "Nubank PJ",
    "Nubank Pessoal",
    "Inter Empresarial",
    "Cartão Master",
    "Cartão Visa",
    "Sangria"
  ];

  for (const name of accountNames) {
    await db.insert(accounts).values({
      userId: OWNER_ID,
      name,
      createdAt: new Date(),
    });
  }

  // 4. Buscar IDs das categorias para criar regras
  const allCategories = await db.select().from(categories).where(eq(categories.userId, OWNER_ID));
  
  const getCategory = (name: string) => allCategories.find(c => c.name === name);

  // 5. Inserir regras de categorização default
  console.log("⚡ Inserindo regras de categorização...");
  
  const rules = [
    {
      pattern: "DB",
      matchType: "contains" as const,
      categoryId: getCategory("RECEBIMENTO EM DÉBITO")?.id!,
      transactionType: "income" as const,
      priority: 100,
    },
    {
      pattern: "AT",
      matchType: "contains" as const,
      categoryId: getCategory("RECEBIMENTO EM CRÉDITO")?.id!,
      transactionType: "income" as const,
      priority: 99,
    },
    {
      pattern: "SANGRIA",
      matchType: "contains" as const,
      categoryId: getCategory("PIX DESAPEGO")?.id!,
      transactionType: "expense" as const,
      priority: 98,
    },
    {
      pattern: "wayou",
      matchType: "contains" as const,
      categoryId: getCategory("TRANSF INTERNA")?.id!,
      transactionType: "expense" as const,
      priority: 97,
    },
    {
      pattern: "cresci",
      matchType: "contains" as const,
      categoryId: getCategory("TRANSF INTERNA")?.id!,
      transactionType: "expense" as const,
      priority: 97,
    },
    {
      pattern: "perdi",
      matchType: "contains" as const,
      categoryId: getCategory("TRANSF INTERNA")?.id!,
      transactionType: "expense" as const,
      priority: 97,
    },
    {
      pattern: "Fábio Esidro",
      matchType: "contains" as const,
      categoryId: getCategory("TRANSF INTERNA")?.id!,
      transactionType: "expense" as const,
      priority: 97,
    },
  ];

  for (const rule of rules) {
    await db.insert(classificationRules).values({
      userId: OWNER_ID,
      ...rule,
      isActive: true,
      createdAt: new Date(),
    });
  }

  console.log("✅ Seed concluído com sucesso!");
  console.log(`   - ${businessCategories.length} categorias empresariais`);
  console.log(`   - ${personalCategories.length} categorias pessoais`);
  console.log(`   - ${accountNames.length} contas bancárias`);
  console.log(`   - ${rules.length} regras de categorização`);
  
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Erro no seed:", error);
  process.exit(1);
});
