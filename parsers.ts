/**
 * Parsers para importação de arquivos OFX e CSV
 * Suporta múltiplos formatos de bancos e cartões
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
  fitId?: string; // ID único do OFX
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
 * Detecta parcelas na descrição e extrai informações
 * Padrões suportados: (3/6), 3/6, 3 DE 6, 03/06
 */
function detectInstallment(description: string): {
  isInstallment: boolean;
  current?: number;
  total?: number;
  cleanDescription: string;
} {
  // Padrões de parcela
  const patterns = [
    /\((\d{1,2})\/(\d{1,2})\)/,  // (3/6)
    /(\d{1,2})\/(\d{1,2})/,      // 3/6
    /(\d{1,2})\s*DE\s*(\d{1,2})/i, // 3 DE 6
    /PARC\s*(\d{1,2})\/(\d{1,2})/i, // PARC 3/6
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      const current = parseInt(match[1]!);
      const total = parseInt(match[2]!);
      
      // Validar que faz sentido (current <= total e ambos > 0)
      if (current > 0 && total > 0 && current <= total) {
        // Remover o padrão da descrição
        const cleanDescription = description.replace(pattern, '').trim();
        
        return {
          isInstallment: true,
          current,
          total,
          cleanDescription,
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
 * Calcula a data atualizada para parcelas
 * Se é parcela 3/6, adiciona 2 meses à data original
 */
function calculateUpdatedDate(originalDate: Date, currentInstallment: number): Date {
  const updated = new Date(originalDate);
  updated.setMonth(updated.getMonth() + (currentInstallment - 1));
  return updated;
}

/**
 * Converte valor string para centavos
 * Suporta: "1.234,56", "1234.56", "-1234,56"
 */
function parseCurrencyToCents(value: string): number {
  // Remove espaços e caracteres especiais
  let clean = value.trim().replace(/[^\d,.-]/g, '');
  
  // Detecta se usa vírgula ou ponto como decimal
  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');
  
  if (hasComma && hasDot) {
    // Formato brasileiro: 1.234,56
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // Apenas vírgula: 1234,56
    clean = clean.replace(',', '.');
  }
  
  const float = parseFloat(clean);
  return Math.round(float * 100);
}

/**
 * Parse de data em múltiplos formatos
 * Suporta: DD/MM/YYYY, YYYY-MM-DD, YYYYMMDD
 */
function parseDate(dateStr: string): Date {
  // Formato DD/MM/YYYY
  const ddmmyyyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!));
  }
  
  // Formato DD/MM/YY (ano com 2 dígitos)
  const ddmmyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (ddmmyy) {
    const [, day, month, year] = ddmmyy;
    const fullYear = 2000 + parseInt(year!);
    return new Date(fullYear, parseInt(month!) - 1, parseInt(day!));
  }
  
  // Formato YYYY-MM-DD
  const yyyymmdd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!));
  }
  
  // Formato YYYYMMDD
  const compact = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const [, year, month, day] = compact;
    return new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!));
  }
  
  throw new Error(`Invalid date format: ${dateStr}`);
}

// ===== OFX PARSER =====

/**
 * Parse de arquivo OFX
 * Suporta: Itaú, Nubank PJ, Nubank Pessoal, Inter
 */
export function parseOFX(content: string, fileName: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  
  try {
    // Extrair informações da conta
    const bankIdMatch = content.match(/<BANKID>(\d+)/);
    const acctIdMatch = content.match(/<ACCTID>([^<]+)/);
    const acctTypeMatch = content.match(/<ACCTTYPE>([^<]+)/);
    
    const accountInfo = {
      bankId: bankIdMatch?.[1],
      accountId: acctIdMatch?.[1],
      accountType: acctTypeMatch?.[1],
    };
    
    // Extrair transações
    const stmtTrnPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let match;
    
    while ((match = stmtTrnPattern.exec(content)) !== null) {
      try {
        const trnContent = match[1]!;
        
        // Extrair campos
        const trnTypeMatch = trnContent.match(/<TRNTYPE>([^<]+)/);
        const dtPostedMatch = trnContent.match(/<DTPOSTED>(\d{8})/);
        const trnAmtMatch = trnContent.match(/<TRNAMT>([^<]+)/);
        const fitIdMatch = trnContent.match(/<FITID>([^<]+)/);
        const memoMatch = trnContent.match(/<MEMO>([^<]+)/);
        
        if (!dtPostedMatch || !trnAmtMatch || !memoMatch) {
          errors.push(`Transaction missing required fields in ${fileName}`);
          continue;
        }
        
        const dateStr = dtPostedMatch[1]!;
        const amount = parseFloat(trnAmtMatch[1]!);
        const description = memoMatch[1]!.trim();
        const fitId = fitIdMatch?.[1]?.trim();
        
        // Parse da data (formato YYYYMMDD)
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const transactionDate = new Date(year, month, day);
        
        // Detectar parcelas
        const installmentInfo = detectInstallment(description);
        
        // Calcular datas
        let purchaseDate = transactionDate;
        let originalPurchaseDate: Date | undefined;
        
        if (installmentInfo.isInstallment && installmentInfo.current) {
          // Para parcelas, calcular a data original
          originalPurchaseDate = new Date(transactionDate);
          originalPurchaseDate.setMonth(originalPurchaseDate.getMonth() - (installmentInfo.current - 1));
          purchaseDate = transactionDate; // Data atualizada
        }
        
        // Determinar tipo (receita ou despesa)
        const transactionType: "income" | "expense" = amount >= 0 ? "income" : "expense";
        
        transactions.push({
          description: installmentInfo.cleanDescription,
          amount: Math.abs(Math.round(amount * 100)), // Converter para centavos
          transactionType,
          purchaseDate,
          paymentDate: purchaseDate, // Para bancos, são iguais
          isInstallment: installmentInfo.isInstallment,
          installmentNumber: installmentInfo.current,
          installmentTotal: installmentInfo.total,
          originalPurchaseDate,
          fitId,
          source: "ofx",
          sourceFile: fileName,
        });
      } catch (error) {
        errors.push(`Error parsing transaction in ${fileName}: ${error}`);
      }
    }
    
    return { transactions, errors, accountInfo };
  } catch (error) {
    return {
      transactions: [],
      errors: [`Failed to parse OFX file ${fileName}: ${error}`],
    };
  }
}

// ===== CSV PARSERS =====

/**
 * Parse de CSV genérico
 */
function parseCSVLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  fields.push(current.trim());
  return fields;
}

/**
 * Parse de CSV de cartão (Master/Visa)
 * Formato: data;descrição;valor
 */
export function parseCardCSV(content: string, fileName: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  
  try {
    const lines = content.split('\n').filter(line => line.trim());
    
    // Detectar e pular cabeçalho se existir
    let startIndex = 0;
    if (lines.length > 0 && lines[0]!.toLowerCase().includes('data')) {
      startIndex = 1; // Pular primeira linha (cabeçalho)
    }
    
    for (let i = startIndex; i < lines.length; i++) {
      try {
        const fields = parseCSVLine(lines[i]!, ';');
        
        if (fields.length < 3) {
          errors.push(`Line ${i + 1 + startIndex}: Invalid format (expected 3 fields)`);
          continue;
        }
        
        const [dateStr, description, valueStr] = fields;
        
        if (!dateStr || !description || !valueStr) {
          errors.push(`Line ${i + 1 + startIndex}: Missing required fields`);
          continue;
        }
        
        // Parse data
        const purchaseDate = parseDate(dateStr);
        
        // Parse valor
        const amount = parseCurrencyToCents(valueStr);
        
        // Detectar parcelas
        const installmentInfo = detectInstallment(description);
        
        // Calcular datas
        let finalPurchaseDate = purchaseDate;
        let originalPurchaseDate: Date | undefined;
        
        if (installmentInfo.isInstallment && installmentInfo.current) {
          // Para cartões, a data no CSV é a data original
          // Precisamos calcular a data atualizada
          originalPurchaseDate = purchaseDate;
          finalPurchaseDate = calculateUpdatedDate(purchaseDate, installmentInfo.current);
        }
        
        transactions.push({
          description: installmentInfo.cleanDescription,
          amount: Math.abs(amount),
          transactionType: "expense", // Cartões são sempre despesas
          purchaseDate: finalPurchaseDate,
          paymentDate: finalPurchaseDate, // Será atualizado com data de fechamento
          isInstallment: installmentInfo.isInstallment,
          installmentNumber: installmentInfo.current,
          installmentTotal: installmentInfo.total,
          originalPurchaseDate,
          source: "csv",
          sourceFile: fileName,
        });
      } catch (error) {
        errors.push(`Line ${i + 1}: ${error}`);
      }
    }
    
    return { transactions, errors };
  } catch (error) {
    return {
      transactions: [],
      errors: [`Failed to parse CSV file ${fileName}: ${error}`],
    };
  }
}

/**
 * Parse de CSV Sangria
 * Formato: Numeração,Data,NOME,VALOR,Crédito/Débito,Tipo conta
 */
export function parseSangriaCSV(content: string, fileName: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  
  try {
    const lines = content.split('\n').filter(line => line.trim());
    
    // Pular cabeçalho
    for (let i = 1; i < lines.length; i++) {
      try {
        const fields = parseCSVLine(lines[i]!, ',');
        
        if (fields.length < 6) {
          errors.push(`Line ${i + 1}: Invalid format (expected at least 6 fields)`);
          continue;
        }
        
        const [, dateStr, name, valueStr] = fields;
        
        // Ignorar linhas vazias (sem nome ou valor)
        if (!name || !valueStr || name.trim() === '' || valueStr.trim() === '') {
          continue;
        }
        
        if (!dateStr) {
          errors.push(`Line ${i + 1}: Missing date`);
          continue;
        }
        
        // Parse data
        const purchaseDate = parseDate(dateStr);
        
        // Parse valor
        const amount = parseCurrencyToCents(valueStr);
        
        transactions.push({
          description: name,
          amount: Math.abs(amount),
          transactionType: "expense", // Sangria é sempre despesa
          purchaseDate,
          paymentDate: purchaseDate,
          isInstallment: false,
          source: "csv",
          sourceFile: fileName,
        });
      } catch (error) {
        errors.push(`Line ${i + 1}: ${error}`);
      }
    }
    
    return { transactions, errors };
  } catch (error) {
    return {
      transactions: [],
      errors: [`Failed to parse Sangria CSV file ${fileName}: ${error}`],
    };
  }
}

/**
 * Parse de CSV de faturamento
 * Formato: mês,Crédito à vista,Crédito 2x,...
 */
export interface ParsedRevenue {
  year: number;
  month: number;
  creditCash: number;
  credit2x: number;
  credit3x: number;
  credit4x: number;
  credit5x: number;
  credit6x: number;
  debit: number;
  cash: number;
  pix: number;
  giraCredit: number;
}

export function parseRevenueCSV(content: string): { data: ParsedRevenue[]; errors: string[] } {
  const data: ParsedRevenue[] = [];
  const errors: string[] = [];
  
  try {
    const lines = content.split('\n').filter(line => line.trim());
    
    // Pular cabeçalho
    for (let i = 1; i < lines.length; i++) {
      try {
        const fields = parseCSVLine(lines[i]!, ',');
        
        if (fields.length < 11) {
          errors.push(`Line ${i + 1}: Invalid format (expected 11 fields)`);
          continue;
        }
        
        const [dateStr, ...values] = fields;
        
        if (!dateStr) {
          errors.push(`Line ${i + 1}: Missing date`);
          continue;
        }
        
        // Parse data (formato DD/MM/YYYY)
        const date = parseDate(dateStr);
        
        data.push({
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          creditCash: parseCurrencyToCents(values[0] || '0'),
          credit2x: parseCurrencyToCents(values[1] || '0'),
          credit3x: parseCurrencyToCents(values[2] || '0'),
          credit4x: parseCurrencyToCents(values[3] || '0'),
          credit5x: parseCurrencyToCents(values[4] || '0'),
          credit6x: parseCurrencyToCents(values[5] || '0'),
          debit: parseCurrencyToCents(values[6] || '0'),
          cash: parseCurrencyToCents(values[7] || '0'),
          pix: parseCurrencyToCents(values[8] || '0'),
          giraCredit: parseCurrencyToCents(values[9] || '0'),
        });
      } catch (error) {
        errors.push(`Line ${i + 1}: ${error}`);
      }
    }
    
    return { data, errors };
  } catch (error) {
    return {
      data: [],
      errors: [`Failed to parse revenue CSV: ${error}`],
    };
  }
}

/**
 * Detecta o tipo de arquivo e chama o parser apropriado
 */
export function parseFile(content: string, fileName: string): ParseResult {
  // Detectar tipo de arquivo
  if (content.includes('OFXHEADER') || content.includes('<OFX>')) {
    return parseOFX(content, fileName);
  }
  
  // Detectar CSV por nome do arquivo
  if (fileName.toLowerCase().includes('sangria')) {
    return parseSangriaCSV(content, fileName);
  }
  
  if (fileName.toLowerCase().includes('cartao') || 
      fileName.toLowerCase().includes('master') || 
      fileName.toLowerCase().includes('visa')) {
    return parseCardCSV(content, fileName);
  }
  
  // Tentar detectar por conteúdo
  const firstLine = content.split('\n')[0]?.toLowerCase() || '';
  
  if (firstLine.includes('numeração') && firstLine.includes('sangria')) {
    return parseSangriaCSV(content, fileName);
  }
  
  if (firstLine.includes('data') && firstLine.includes('descrição')) {
    return parseCardCSV(content, fileName);
  }
  
  return {
    transactions: [],
    errors: [`Unable to detect file type for ${fileName}`],
  };
}
