/**
 * Teste para validar criação automática do usuário padrão
 * Para Railway (sem autenticação Manus)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Default User Creation", () => {
  it("should create default user automatically", async () => {
    const db = await getDb();
    expect(db).toBeDefined();

    const DEFAULT_OPEN_ID = "railway-default-user";

    // Buscar usuário padrão
    const existingUsers = await db!
      .select()
      .from(users)
      .where(eq(users.openId, DEFAULT_OPEN_ID))
      .limit(1);

    // Deve existir ou ser criado
    expect(existingUsers.length).toBeGreaterThan(0);
    
    const user = existingUsers[0]!;
    expect(user.openId).toBe(DEFAULT_OPEN_ID);
    expect(user.name).toBe("Usuário Padrão");
    expect(user.email).toBe("usuario@railway.local");
    expect(user.role).toBe("admin");
  });

  it("should have consistent user ID for seed compatibility", async () => {
    const db = await getDb();
    expect(db).toBeDefined();

    const DEFAULT_OPEN_ID = "railway-default-user";

    const existingUsers = await db!
      .select()
      .from(users)
      .where(eq(users.openId, DEFAULT_OPEN_ID))
      .limit(1);

    expect(existingUsers.length).toBeGreaterThan(0);
    
    const user = existingUsers[0]!;
    // O usuário deve ter um ID válido
    // O script de seed usará este ID para criar categorias e contas
    expect(user.id).toBeGreaterThan(0);
    expect(typeof user.id).toBe("number");
  });
});
