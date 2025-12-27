import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  db: any | null;
};

/**
 * Cria ou retorna o usuário padrão do sistema
 * Para Railway (sem autenticação Manus)
 */
async function getOrCreateDefaultUser(): Promise<User> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const DEFAULT_OPEN_ID = "railway-default-user";
  
  // Tentar buscar usuário existente
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.openId, DEFAULT_OPEN_ID))
    .limit(1);

  if (existingUsers.length > 0) {
    return existingUsers[0]!;
  }

  // Criar novo usuário padrão
  const [newUser] = await db
    .insert(users)
    .values({
      openId: DEFAULT_OPEN_ID,
      name: "Usuário Padrão",
      email: "usuario@railway.local",
      loginMethod: "railway-default",
      role: "admin",
    })
    .$returningId();

  // Buscar o usuário recém-criado
  const createdUsers = await db
    .select()
    .from(users)
    .where(eq(users.id, newUser.id))
    .limit(1);

  return createdUsers[0]!;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Para Railway: sempre usar usuário padrão
  let user: User | null = null;
  let db = null;

  try {
    user = await getOrCreateDefaultUser();
    db = await getDb();
  } catch (error) {
    console.error("Failed to get/create default user or database:", error);
    user = null;
    db = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    db,
  };
}
