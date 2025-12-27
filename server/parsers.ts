/**
 * Parsers para importacao de arquivos OFX e CSV
 * Suporta multiplos formatos de bancos e cartoes
 */

export interface ParsedTransaction {
  description: string;
  amount: number; // Em centavos
  transactionType: "income" | "expense";
  purchaseDate: Date;
  paymentDate: Date;
  isInstallment: boolean;
  installmentNumber?: number;
  installmentTotal?: number;
  originalPurchaseDate?: Date;
  fitId?: string; // ID unico do OFX
  source: "ofx" | "csv";
  sourceFile: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  errors: string[];
  accountInfo?: {
    bankId?: string;
    accountId?: string;
    accountType?: string;
  };
}

// ===== HELPER FUNCTIONS =====

/**
 * Detecta parcelas na descricao
 * Padroes suportados: (3/6), 3/6, 3 DE 6, PARC 3/6
 */
function detectInstallment(description: string): {
  isInstallment: boolean;
  current?: number;
  total?: number;
  cleanDescription: string;
} {
  const patterns = [
    /\((\d{1,2})\/(\d{1,2})\)/,
    /(\d{1,2})\/(\d{1,2})/,
    /(\d{1,2})\s*DE\s*(\d{1,2})/i,
    /PARC\s*(\d{1,2})\/(\d{1,2})/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      const current = parseInt(match[1]!);
      const total = parseInt(match[2]!);
      if (current > 0 && total > 0 && current <= total) {
        return {
          isInstallment: true,
          current,
          total,
          cleanDescription: description.replace(pattern, '').trim(),
        };
      }
    }
  }

  return {
    isInstallment: false,
    cleanDescription: description,
  };
}

/**
 * Calcula a data de pagamento para parcelas
 * Mantem o dia da compra original mas muda o mes para refletir a fatura
 * Ex: Compra 16/08/25, parcela 1/3 -> 16/08/25, parcela 2/3 -> 16/09/25, parcela 3/3 -> 16/10/25
 */
function calculateInstallmentPaymentDate(originalDate: Date, currentInstallment: number): Date {
  const paymentDate = new Date(originalDate);
  // Adiciona meses baseado no numero da parcela (parcela 1 = mes original, parcela 2 = +1 mes, etc)
  paymentDate.setMonth(paymentDate.getMonth() + (currentInstallment - 1));
  return paymentDate;
}

/**
 * Calcula a data de compra original para parcelas
 * Retorna a data da primeira parcela
 */
function calculateOriginalPurchaseDate(paymentDate: Date, currentInstallment: number): Date {
  const originalDate = new Date(paymentDate);
  // Subtrai meses para voltar a data da primeira parcela
  originalDate.setMonth(originalDate.getMonth() - (currentInstallment - 1));
  return originalDate;
}

/**
 * Converte valor string para centavos
 * Suporta: "1.234,56", "1234.56", "-1234,56"
 */
function parseCurrencyToCents(value: string): number {
  let clean = value.trim().replace(/[^\d,.-]/g, '');
  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');
  
  if (hasComma && hasDot) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    clean = clean.replace(',', '.');
  }
  
  const float = parseFloat(clean);
  return Math.round(float * 100);
}

/**
 * Parse de data em multiplos formatos
 * Suporta: DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, YYYYMMDD
 */
function parseDate(dateStr: string): Date {
  const ddmmyyyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return new Date(parseInt(ddmmyyyy[3]!), parseInt(ddmmyyyy[2]!) - 1, parseInt(ddmmyyyy[1]!));
  
  const ddmmyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (ddmmyy) return new Date(2000 + parseInt(ddmmyy[3]!), parseInt(ddmmyy[2]!) - 1, parseInt(ddmmyy[1]!));
  
  const yyyymmdd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) return new Date(parseInt(yyyymmdd[1]!), parseInt(yyyymmdd[2]!) - 1, parseInt(yyyymmdd[3]!));
  
  const compact = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return new Date(parseInt(compact[1]!), parseInt(compact[2]!) - 1, parseInt(compact[3]!));
  
  throw new Error(`Invalid date format: ${dateStr}`);
}

// ===== OFX PARSER =====

/**
 * Parser para arquivos OFX
 * Suporta multiplos bancos: Itau, Nubank, Inter, etc.
 */
export function parseOFX(content: string, fileName: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  
  try {
    const bankIdMatch = content.match(/<BANKID>(\d+)/);
    const acctIdMatch = content.match(/<ACCTID>([^<]+)/);
    const acctTypeMatch = content.match(/<ACCTTYPE>([^<]+)/);
    
    const accountInfo = {
      bankId: bankIdMatch?.[1],
      accountId: acctIdMatch?.[1],
      accountType: acctTypeMatch?.[1],
    };
    
    const stmtTrnPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let match;
    
    while ((match = stmtTrnPattern.exec(content)) !== null) {
      try {
        const trnContent = match[1]!;
        const trnTypeMatch = trnContent.match(/<TRNTYPE>([^<]+)/);
        const dtPostedMatch = trnContent.match(/<DTPOSTED>(\d{8})/);
        const trnAmtMatch = trnContent.match(/<TRNAMT>([^<]+)/);
        const fitIdMatch = trnContent.match(/<FITID>([^<]+)/);
        const memoMatch = trnContent.match(/<MEMO>([^<]+)/);
        
        if (!dtPostedMatch || !trnAmtMatch || !memoMatch) continue;
        
        const dateStr = dtPostedMatch[1]!;
        const amount = parseFloat(trnAmtMatch[1]!);
        const description = memoMatch[1]!.trim();
        const fitId = fitIdMatch?.[1]?.trim();
        
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const transactionDate = new Date(year, month, day);
        
        const installmentInfo = detectInstallment(description);
        let purchaseDate = transactionDate;
        let paymentDate = transactionDate;
        let originalPurchaseDate: Date | undefined;
        
        // Se for parcela, calcular as datas corretamente
        if (installmentInfo.isInstallment && installmentInfo.current) {
          originalPurchaseDate = calculateOriginalPurchaseDate(transactionDate, installmentInfo.current);
          paymentDate = calculateInstallmentPaymentDate(originalPurchaseDate, installmentInfo.current);
          purchaseDate = originalPurchaseDate;
        }
        
        const transactionType = amount >= 0 ? "income" : "expense";
        
        transactions.push({
          description: installmentInfo.cleanDescription,
          amount: Math.abs(Math.round(amount * 100)),
          transactionType,
          purchaseDate,
          paymentDate,
          isInstallment: installmentInfo.isInstallment,
          installmentNumber: installmentInfo.current,
          installmentTotal: installmentInfo.total,
          originalPurchaseDate,
          fitId,
          source: "ofx",
          sourceFile: fileName,
        });
      } catch (e) { 
        errors.push(`Error parsing transaction: ${e}`); 
      }
    }
    return { transactions, errors, accountInfo };
  } catch (e) {
    return { transactions: [], errors: [`Failed to parse OFX: ${e}`] };
  }
}

// ===== CSV PARSERS =====

/**
 * Parser de linha CSV com suporte a aspas
 */
function parseCSVLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') inQuotes = !inQuotes;
    else if (char === separator && !inQuotes) { fields.push(current.trim()); current = ''; }
    else current += char;
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parser para CSV de cartao de credito
 * Formato: Data;Descricao;Valor
 */
export function parseCardCSV(content: string, fileName: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  try {
    const lines = content.split('\n').filter(line => line.trim());
    let startIndex = 0;
    if (lines.length > 0 && lines[0]!.toLowerCase().includes('data')) startIndex = 1;
    
    for (let i = startIndex; i < lines.length; i++) {
      try {
        const fields = parseCSVLine(lines[i]!, ';');
        if (fields.length < 3) continue;
        const [dateStr, description, valueStr] = fields;
        if (!dateStr || !description || !valueStr) continue;
        
        const purchaseDate = parseDate(dateStr);
        const amount = parseCurrencyToCents(valueStr);
        const installmentInfo = detectInstallment(description);
        let finalPurchaseDate = purchaseDate;
        let finalPaymentDate = purchaseDate;
        let originalPurchaseDate: Date | undefined;
        
        // Se for parcela, calcular as datas corretamente
        if (installmentInfo.isInstallment && installmentInfo.current) {
          originalPurchaseDate = calculateOriginalPurchaseDate(purchaseDate, installmentInfo.current);
          finalPaymentDate = calculateInstallmentPaymentDate(originalPurchaseDate, installmentInfo.current);
          finalPurchaseDate = originalPurchaseDate;
        }
        
        const transactionType = amount >= 0 ? "income" : "expense";
        
        transactions.push({
          description: installmentInfo.cleanDescription,
          amount: Math.abs(amount),
          transactionType,
          purchaseDate: finalPurchaseDate,
          paymentDate: finalPaymentDate,
          isInstallment: installmentInfo.isInstallment,
          installmentNumber: installmentInfo.current,
          installmentTotal: installmentInfo.total,
          originalPurchaseDate,
          source: "csv",
          sourceFile: fileName,
        });
      } catch (e) { 
        errors.push(`Error parsing line ${i}: ${e}`); 
      }
    }
    return { transactions, errors };
  } catch (e) {
    return { transactions: [], errors: [`Failed to parse CSV: ${e}`] };
  }
}

/**
 * Parser para CSV do Sangria (controle interno)
 * Formato: Numeracao,Data,NOME,VALOR,Credito/Debito,Tipo conta (pode ter campos extras no cabeçalho)
 */
export function parseSangriaCSV(content: string, fileName: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  try {
    const lines = content.split('\n').filter(line => line.trim());
    let startIndex = 0;
    
    // Detecta e pula o cabeçalho (com ou sem acentos)
    if (lines.length > 0) {
      const firstLine = lines[0]!.toLowerCase();
      if (firstLine.includes('numeracao') || firstLine.includes('numeração')) {
        startIndex = 1;
      }
    }
    
    for (let i = startIndex; i < lines.length; i++) {
      try {
        const fields = parseCSVLine(lines[i]!, ',');
        if (fields.length < 5) {
          continue; // Linha com poucos campos
        }
        
        // Índices: 0=Numeracao, 1=Data, 2=NOME, 3=VALOR, 4=Credito/Debito, 5=Tipo conta
        const [, dateStr, description, valueStr, creditDebit] = fields;
        
        // Pular linhas com dados incompletos
        if (!dateStr || !description || !valueStr) {
          continue;
        }
        
        // Pular linhas com campos vazios (trim para remover espaços)
        if (description.trim() === '' || valueStr.trim() === '') {
          continue;
        }
        
        const purchaseDate = parseDate(dateStr);
        const amount = parseCurrencyToCents(valueStr);
        const isExpense = creditDebit?.toUpperCase().includes('DEBITO') || 
                         creditDebit?.toUpperCase().includes('DÉBITO');
        const transactionType = isExpense ? "expense" : "income";
        
        transactions.push({
          description: description.trim(),
          amount: Math.abs(amount),
          transactionType,
          purchaseDate,
          paymentDate: purchaseDate,
          isInstallment: false,
          source: "csv",
          sourceFile: fileName,
        });
      } catch (e) { 
        // Apenas adiciona erro se não for uma linha vazia
        const line = lines[i]!.trim();
        if (line && !line.split(',').every(f => !f || f.trim() === '')) {
          errors.push(`Erro na linha ${i + 1}: ${e}`);
        }
      }
    }
    return { transactions, errors };
  } catch (e) {
    return { transactions: [], errors: [`Falha ao processar CSV do Sangria: ${e}`] };
  }
}

/**
 * Parser para CSV do Inter
 * Formato: Data,Descricao,Valor
 */
export function parseInterCSV(content: string, fileName: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  try {
    const lines = content.split('\n').filter(line => line.trim());
    let startIndex = 0;
    if (lines.length > 0 && lines[0]!.toLowerCase().includes('data')) startIndex = 1;
    
    for (let i = startIndex; i < lines.length; i++) {
      try {
        const fields = parseCSVLine(lines[i]!, ',');
        if (fields.length < 3) continue;
        const [dateStr, description, valueStr] = fields;
        if (!dateStr || !description || !valueStr) continue;
        
        const purchaseDate = parseDate(dateStr);
        const amount = parseCurrencyToCents(valueStr);
        const transactionType = amount >= 0 ? "income" : "expense";
        
        transactions.push({
          description,
          amount: Math.abs(amount),
          transactionType,
          purchaseDate,
          paymentDate: purchaseDate,
          isInstallment: false,
          source: "csv",
          sourceFile: fileName,
        });
      } catch (e) { 
        errors.push(`Error parsing line ${i}: ${e}`); 
      }
    }
    return { transactions, errors };
  } catch (e) {
    return { transactions: [], errors: [`Failed to parse Inter CSV: ${e}`] };
  }
}

/**
 * Parser para CSV de Faturamento (Receita Bruta)
 */
export function parseRevenueCSV(content: string): { data: any[]; errors: string[] } {
  const data: any[] = [];
  const errors: string[] = [];
  
  try {
    const lines = content.split('\n').filter(line => line.trim());
    let startIndex = 0;
    if (lines.length > 0 && lines[0]!.toLowerCase().includes('mes')) startIndex = 1;
    
    for (let i = startIndex; i < lines.length; i++) {
      try {
        const fields = parseCSVLine(lines[i]!, ',');
        if (fields.length < 8) continue;
        
        const [mes, creditCash, credit2x, credit3x, credit4x, credit5x, credit6x, debit, cash, pix, giraCredit] = fields;
        
        // Aceitar tanto DD/MM/YYYY quanto MM/YYYY
        let month: number;
        let year: number;
        const parts = mes.split('/');
        
        if (parts.length === 3) {
          // Formato DD/MM/YYYY - pegar MM e YYYY
          month = parseInt(parts[1]);
          year = parseInt(parts[2]);
        } else if (parts.length === 2) {
          // Formato MM/YYYY
          month = parseInt(parts[0]);
          year = parseInt(parts[1]);
        } else {
          continue;
        }
        
        if (!month || !year || month < 1 || month > 12 || year < 2000) continue;
        
        data.push({
          month,
          year,
          creditCash: parseCurrencyToCents(creditCash) / 100,
          credit2x: parseCurrencyToCents(credit2x) / 100,
          credit3x: parseCurrencyToCents(credit3x) / 100,
          credit4x: parseCurrencyToCents(credit4x) / 100,
          credit5x: parseCurrencyToCents(credit5x) / 100,
          credit6x: parseCurrencyToCents(credit6x) / 100,
          debit: parseCurrencyToCents(debit) / 100,
          cash: cash ? parseCurrencyToCents(cash) / 100 : 0,
          pix: pix ? parseCurrencyToCents(pix) / 100 : 0,
          giraCredit: giraCredit ? parseCurrencyToCents(giraCredit) / 100 : 0,
        });
      } catch (e) { 
        errors.push(`Error parsing revenue line ${i}: ${e}`); 
      }
    }
    
    return { data, errors };
  } catch (e) {
    return { data: [], errors: [`Failed to parse revenue CSV: ${e}`] };
  }
}

/**
 * Detecta o formato do arquivo e chama o parser apropriado
 */
export function parseFile(content: string, fileName: string): ParseResult {
  const lowerFileName = fileName.toLowerCase();
  
  // Detectar OFX
  if (lowerFileName.endsWith('.ofx') || content.includes('<OFX>') || content.includes('<STMTTRN>')) {
    return parseOFX(content, fileName);
  }
  
  // Detectar CSV
  if (lowerFileName.endsWith('.csv')) {
    // Sangria
    if (lowerFileName.includes('sangria') || content.includes('TIPO CONTA')) {
      return parseSangriaCSV(content, fileName);
    }
    
    // Inter
    if (lowerFileName.includes('inter')) {
      return parseInterCSV(content, fileName);
    }
    
    // Cartao (padrao)
    return parseCardCSV(content, fileName);
  }
  
  return { transactions: [], errors: ['Unknown file format'] };
}
