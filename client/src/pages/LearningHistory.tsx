import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Trash2, BookOpen, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface HistoryPattern {
  id: number;
  description: string;
  categoryId: number;
  categoryName: string | null;
  count: number;
  lastUsed: Date;
}

export default function LearningHistory() {
  const [history, setHistory] = useState<HistoryPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal de edição
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<HistoryPattern | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Queries e Mutations
  const { data: historyData, refetch: refetchHistory } = trpc.categorization.listLearningHistory.useQuery();
  const { data: categories } = trpc.setup.listCategories.useQuery({});
  const deletePatternMutation = trpc.categorization.deleteHistoryPattern.useMutation();
  const updatePatternMutation = trpc.categorization.updateHistoryPattern.useMutation();

  useEffect(() => {
    if (historyData) {
      setHistory(historyData as HistoryPattern[]);
      setLoading(false);
    }
  }, [historyData]);

  const handleDelete = async (patternId: number) => {
    if (!confirm("Tem certeza que deseja deletar este padrão?")) return;

    try {
      await deletePatternMutation.mutateAsync({ patternId });
      toast.success("Padrão deletado", {
        description: "O padrão foi removido com sucesso.",
      });
      refetchHistory();
    } catch (error) {
      toast.error("Erro ao deletar", {
        description: "Não foi possível deletar o padrão.",
      });
    }
  };

  const openEditModal = (pattern: HistoryPattern) => {
    setEditingPattern(pattern);
    setEditDescription(pattern.description);
    setEditCategoryId(pattern.categoryId);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPattern || !editDescription.trim() || !editCategoryId) {
      toast.error("Campos obrigatórios", {
        description: "Preencha a descrição e selecione uma categoria.",
      });
      return;
    }

    setSavingEdit(true);
    try {
      await updatePatternMutation.mutateAsync({
        patternId: editingPattern.id,
        newDescription: editDescription.trim(),
        newCategoryId: editCategoryId,
      });

      toast.success("Padrão atualizado", {
        description: "As alterações foram salvas com sucesso.",
      });
      
      setEditModalOpen(false);
      setEditingPattern(null);
      refetchHistory();
    } catch (error) {
      toast.error("Erro ao salvar", {
        description: "Não foi possível atualizar o padrão.",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredHistory = history.filter((pattern) =>
    pattern.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pattern.categoryName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPatterns = history.length;
  const totalUses = history.reduce((sum, p) => sum + p.count, 0);
  const lastUpdate = history.length > 0 
    ? new Date(Math.max(...history.map(p => new Date(p.lastUsed).getTime())))
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            Histórico de Aprendizado
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os padrões aprendidos pela categorização automática
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total de Padrões</CardDescription>
            <CardTitle className="text-3xl">{totalPatterns}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Usos Totais</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-500" />
              {totalUses}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Última Atualização</CardDescription>
            <CardTitle className="text-xl">
              {lastUpdate ? lastUpdate.toLocaleDateString('pt-BR') : '-'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filtro */}
      <Card>
        <CardHeader>
          <CardTitle>Padrões Aprendidos</CardTitle>
          <CardDescription>
            Busque e edite os padrões usados na categorização automática
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar por descrição ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />

          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? (
                <p>Nenhum padrão encontrado para "{searchTerm}"</p>
              ) : (
                <div className="space-y-2">
                  <BookOpen className="h-16 w-16 mx-auto opacity-20" />
                  <p className="text-lg font-medium">Nenhum padrão aprendido ainda</p>
                  <p className="text-sm">
                    Os padrões são criados automaticamente quando você categoriza transações
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-center">Vezes</TableHead>
                    <TableHead className="hidden md:table-cell">Último Uso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((pattern) => (
                    <TableRow key={pattern.id}>
                      <TableCell className="font-medium max-w-xs truncate">
                        {pattern.description}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                          {pattern.categoryName || 'Sem categoria'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold">{pattern.count}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {new Date(pattern.lastUsed).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(pattern)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(pattern.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Padrão de Aprendizado</DialogTitle>
            <DialogDescription>
              Altere a descrição ou categoria deste padrão
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Ex: SUPERMERCADO EXTRA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Categoria</Label>
              <Select
                value={editCategoryId?.toString()}
                onValueChange={(value) => setEditCategoryId(parseInt(value))}
              >
                <SelectTrigger id="edit-category">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                      {cat.subcategory && ` - ${cat.subcategory}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              disabled={savingEdit}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
