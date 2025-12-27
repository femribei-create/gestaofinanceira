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
  
  // Função auxiliar para converter data para ISO string
  const convertToISOString = (date: any): string => {
    if (typeof date === 'string') {
      return date;
    }
    if (date instanceof Date) {
      return date.toISOString();
    }
    // Tentar converter como string
    try {
      return new Date(date).toISOString();
    } catch {
      return new Date().toISOString();
    }
  };
  
  const handleConfirmImport = () => {
    if (!uploadResult || !selectedAccountId || !selectedFile) return;
    
    // Detectar formato do arquivo (OFX ou CSV)
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    const source = fileExtension === 'ofx' ? 'ofx' : 'csv';
    
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
        description: t.description || '',
        amount: typeof t.amount === 'number' ? Math.round(t.amount) : 0,
        transactionType: t.transactionType || 'expense',
        purchaseDate: convertToISOString(t.purchaseDate),
        paymentDate: convertToISOString(t.paymentDate),
        isInstallment: t.isInstallment === true,
        installmentNumber: t.installmentNumber ? parseInt(t.installmentNumber) : undefined,
        installmentTotal: t.installmentTotal ? parseInt(t.installmentTotal) : undefined,
        originalPurchaseDate: t.originalPurchaseDate ? convertToISOString(t.originalPurchaseDate) : undefined,
        fitId: t.fitId || undefined,
        source: source as 'ofx' | 'csv',
        sourceFile: selectedFile.name,
        categoryId: t.classification?.categoryId || null,
        suggestedCategoryId: t.classification?.suggestedCategoryId || undefined,
        classificationMethod: t.classification?.method || 'manual',
      }));
    
    if (transactionsToImport.length === 0) {
      toast.error('Nenhuma transação para importar');
      return;
    }
    
    confirmImport.mutate({
      transactions: transactionsToImport,
      accountId: parseInt(selectedAccountId),
    });
  };
  
  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importar Transações</h1>
          <p className="text-muted-foreground mt-2">
            Importe seus extratos bancários em formato OFX ou CSV
          </p>
        </div>

        {/* Upload Section */}
        {!uploadResult && (
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Arquivo</CardTitle>
              <CardDescription>
                Escolha um arquivo OFX ou CSV do seu banco
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Arquivo</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ofx,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {selectedFile ? selectedFile.name : "Selecionar arquivo"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Conta Bancária</label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedAccountId || uploadFile.isPending}
                className="w-full"
              >
                {uploadFile.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Processar Arquivo
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {uploadResult && (
          <div className="space-y-4">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo da Importação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {uploadResult.transactions?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Transações encontradas</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {uploadResult.duplicateStats?.total || 0}
                    </div>
                    <div className="text-sm text-gray-600">Possíveis duplicatas</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {(uploadResult.transactions?.length || 0) - (uploadResult.duplicateStats?.total || 0)}
                    </div>
                    <div className="text-sm text-gray-600">Prontas para importar</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transactions List */}
            <Card>
              <CardHeader>
                <CardTitle>Transações</CardTitle>
                <CardDescription>
                  Revise as transações antes de confirmar a importação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {uploadResult.transactions?.map((transaction: any, index: number) => (
                  <div
                    key={index}
                    className={`p-3 border rounded-lg ${
                      transaction.isDuplicate ? "bg-yellow-50 border-yellow-200" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{transaction.description}</div>
                        <div className="text-sm text-gray-600">
                          {format(new Date(transaction.purchaseDate), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        {transaction.isInstallment && (
                          <div className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded inline-block mt-1">
                            Parcela {transaction.installmentNumber}/{transaction.installmentTotal}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${
                          transaction.transactionType === "income" ? "text-green-600" : "text-red-600"
                        }`}>
                          {transaction.transactionType === "income" ? "+" : "-"}
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(transaction.amount / 100)}
                        </div>
                      </div>
                      {transaction.isDuplicate && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={duplicateActions[index] === 'approve' ? "default" : "outline"}
                            onClick={() => handleDuplicateAction(index, 'approve')}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={duplicateActions[index] === 'reject' ? "destructive" : "outline"}
                            onClick={() => handleDuplicateAction(index, 'reject')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadResult(null);
                  setSelectedFile(null);
                  setDuplicateActions({});
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={confirmImport.isPending}
                className="flex-1"
              >
                {confirmImport.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar Importação
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
