import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, Check, X } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Import() {
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [duplicateActions, setDuplicateActions] = useState<Record<number, 'approve' | 'reject'>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: accounts, isLoading: loadingAccounts } = trpc.setup.listAccounts.useQuery();
  
  const uploadFile = trpc.import.uploadFile.useMutation({
    onSuccess: (data) => {
      setUploadResult(data);
      if (data.success) {
        toast.success(`Arquivo processado! ${data.transactions.length} transações encontradas`);
        if (data.duplicateStats && data.duplicateStats.total > 0) {
          toast.warning(`${data.duplicateStats.total} duplicatas detectadas - revise abaixo`);
        }
      } else {
        toast.error("Erro ao processar arquivo");
      }
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
  
  const confirmImport = trpc.import.confirmImport.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} transações importadas com sucesso!`);
      setLocation("/transactions");
    },
    onError: (error) => {
      toast.error(`Erro ao importar: ${error.message}`);
    },
  });
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
      setDuplicateActions({});
    }
  };
  
  const handleUpload = async () => {
    if (!selectedFile || !selectedAccountId) {
      toast.error("Selecione um arquivo e uma conta");
      return;
    }
    
    const content = await selectedFile.text();
    
    uploadFile.mutate({
      content,
      fileName: selectedFile.name,
      accountId: parseInt(selectedAccountId),
    });
  };
  
  const handleDuplicateAction = (transactionIndex: number, action: 'approve' | 'reject') => {
    setDuplicateActions(prev => ({
      ...prev,
      [transactionIndex]: action
    }));
  };
  
  const handleConfirmImport = () => {
    if (!uploadResult || !selectedAccountId) return;
    
    // Filtrar transações baseado nas ações do usuário
    const transactionsToImport = uploadResult.transactions
      .filter((t: any, index: number) => {
        // Se não é duplicata, importa
        if (!t.isDuplicate) return true;
        
        // Se é duplicata e foi aprovada, importa
        if (duplicateActions[index] === 'approve') return true;
        
        // Se é duplicata e foi rejeitada, não importa
        if (duplicateActions[index] === 'reject') return false;
        
        // Se é duplicata e não foi decidida, não importa (comportamento padrão)
        return false;
      })
      .map((t: any) => ({
        description: t.description,
        amount: t.amount,
        transactionType: t.transactionType,
        purchaseDate: new Date(t.purchaseDate).toISOString(),
        paymentDate: new Date(t.paymentDate).toISOString(),
        isInstallment: t.isInstallment,
        installmentNumber: t.installmentNumber,
        installmentTotal: t.installmentTotal,
        originalPurchaseDate: t.originalPurchaseDate ? new Date(t.originalPurchaseDate).toISOString() : undefined,
        fitId: t.fitId,
        source: t.source,
        sourceFile: t.sourceFile,
        categoryId: t.classification.categoryId,
        suggestedCategoryId: t.classification.suggestedCategoryId,
        classificationMethod: t.classification.method,
      }));
    
    confirmImport.mutate({
      accountId: parseInt(selectedAccountId),
      transactions: transactionsToImport,
    });
  };
  
  const handleReset = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setSelectedAccountId("");
    setDuplicateActions({});
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const formatCurrency = (cents: number) => {
    const value = Math.abs(cents) / 100;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };
  
  const duplicateTransactions = uploadResult?.transactions.filter((t: any) => t.isDuplicate) || [];
  const approvedDuplicates = Object.values(duplicateActions).filter(action => action === 'approve').length;
  const totalToImport = uploadResult?.transactions.filter((t: any) => !t.isDuplicate).length + approvedDuplicates;
  
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 py-6">
        <div>
          <h1 className="text-3xl font-bold">Importar Transações</h1>
          <p className="text-muted-foreground mt-1">
            Faça upload de arquivos OFX ou CSV para importar suas transações
          </p>
        </div>
        
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Selecionar Arquivo</CardTitle>
            <CardDescription>
              Arquivos suportados: OFX (bancos), CSV (cartões e sangria)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Conta Bancária</label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {loadingAccounts ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : accounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name} ({account.accountType === "bank" ? "Banco" : "Cartão"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Arquivo</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ofx,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="font-medium text-blue-600">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">Clique para selecionar arquivo</p>
                      <p className="text-sm text-muted-foreground">ou arraste e solte aqui</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedAccountId || uploadFile.isPending}
                className="flex-1"
              >
                {uploadFile.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Processar Arquivo
                  </>
                )}
              </Button>
              
              {uploadResult && (
                <Button onClick={handleReset} variant="outline">
                  Novo Arquivo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Upload Result */}
        {uploadResult && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Resultado do Processamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {uploadResult.success ? (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Total de Transações</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {uploadResult.transactions.length}
                        </p>
                      </div>
                      
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Novas Transações</p>
                        <p className="text-2xl font-bold text-green-600">
                          {uploadResult.transactions.filter((t: any) => !t.isDuplicate).length}
                        </p>
                      </div>
                      
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">Duplicatas</p>
                        <p className="text-2xl font-bold text-yellow-600">
                          {uploadResult.duplicateStats.total}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-900">Classificação Automática</p>
                        <p className="text-sm text-green-700 mt-1">
                          As transações foram classificadas automaticamente usando regras.
                          Você poderá revisar e corrigir as categorias depois.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="font-medium text-red-900">Erro ao Processar Arquivo</p>
                    <ul className="text-sm text-red-700 mt-2 space-y-1">
                      {uploadResult.errors.map((error: string, index: number) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Duplicates Section */}
            {duplicateTransactions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    Duplicatas Detectadas ({duplicateTransactions.length})
                  </CardTitle>
                  <CardDescription>
                    Revise cada duplicata e decida se deseja importar ou ignorar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {duplicateTransactions.map((transaction: any, index: number) => {
                    const originalIndex = uploadResult.transactions.indexOf(transaction);
                    const action = duplicateActions[originalIndex];
                    
                    return (
                      <div 
                        key={index} 
                        className={`border rounded-lg p-4 ${
                          action === 'approve' ? 'border-green-500 bg-green-50' : 
                          action === 'reject' ? 'border-red-500 bg-red-50' : 
                          'border-yellow-300 bg-yellow-50'
                        }`}
                      >
                        {/* Cabeçalho com tipo de duplicata */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                            <span className="font-semibold text-yellow-900">
                              {transaction.duplicateInfo?.type === 'exact' ? 'Duplicata Exata' : `Duplicata Similar (${Math.round((transaction.duplicateInfo?.similarity || 0) * 100)}% similar)`}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={action === 'approve' ? 'default' : 'outline'}
                              onClick={() => handleDuplicateAction(originalIndex, 'approve')}
                              className={action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Importar
                            </Button>
                            <Button
                              size="sm"
                              variant={action === 'reject' ? 'default' : 'outline'}
                              onClick={() => handleDuplicateAction(originalIndex, 'reject')}
                              className={action === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Ignorar
                            </Button>
                          </div>
                        </div>
                        
                        {/* Comparação lado a lado */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          {/* Transação Existente */}
                          {transaction.duplicateInfo?.existingTransaction && (
                            <div className="border-r pr-4">
                              <p className="text-xs font-semibold text-muted-foreground mb-2">← TRANSAÇÃO EXISTENTE (JÁ NO BANCO)</p>
                              <div className="space-y-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">Descrição:</p>
                                  <p className="font-medium text-sm">{transaction.duplicateInfo.existingTransaction.description}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Data:</p>
                                  <p className="text-sm">{format(new Date(transaction.duplicateInfo.existingTransaction.purchaseDate), "dd/MM/yyyy", { locale: ptBR })}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Valor:</p>
                                  <p className={`text-sm font-semibold ${
                                    transaction.duplicateInfo.existingTransaction.transactionType === "income" ? "text-green-600" : "text-red-600"
                                  }`}>
                                    {transaction.duplicateInfo.existingTransaction.transactionType === "income" ? "+" : "-"}{formatCurrency(transaction.duplicateInfo.existingTransaction.amount)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Transação Nova */}
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">NOVA TRANSAÇÃO (DUPLICATA) →</p>
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs text-muted-foreground">Descrição:</p>
                                <p className="font-medium text-sm">{transaction.description}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Data:</p>
                                <p className="text-sm">{format(new Date(transaction.purchaseDate), "dd/MM/yyyy", { locale: ptBR })}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Valor:</p>
                                <p className={`text-sm font-semibold ${
                                  transaction.transactionType === "income" ? "text-green-600" : "text-red-600"
                                }`}>
                                  {transaction.transactionType === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {action === 'approve' && (
                          <div className="text-sm text-green-700 bg-green-100 p-2 rounded">
                            ✓ Esta transação será importada mesmo sendo duplicata
                          </div>
                        )}
                        {action === 'reject' && (
                          <div className="text-sm text-red-700 bg-red-100 p-2 rounded">
                            ✗ Esta transação será ignorada
                          </div>
                        )}
                        {!action && (
                          <div className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded">
                            ⚠ Aguardando sua decisão (padrão: ignorar)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
            
            {/* Confirm Import Button */}
            {uploadResult.success && (
              <Card>
                <CardContent className="pt-6">
                  <Button
                    onClick={handleConfirmImport}
                    disabled={confirmImport.isPending}
                    className="w-full"
                    size="lg"
                  >
                    {confirmImport.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Confirmar Importação ({totalToImport} transações)
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
