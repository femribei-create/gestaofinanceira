import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Trash2, BookOpen } from "lucide-react";

interface LearningHistoryTableProps {
  data: Array<{
    id: number;
    description: string;
    categoryName: string | null;
    categoryId: number;
    count: number;
    lastUsed: Date;
  }>;
  onEdit: (id: number, description: string, categoryId: number) => void;
  onDelete: (id: number) => void;
  isLoading?: boolean;
}

export function LearningHistoryTable({ data, onEdit, onDelete, isLoading }: LearningHistoryTableProps) {
  // Loading state
  if (isLoading) {
    return (
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
            {[...Array(5)].map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-4 w-[250px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-[100px] rounded-full" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-4 w-8 mx-auto" />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton className="h-4 w-[100px]" />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="rounded-md border p-12">
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <BookOpen className="h-16 w-16 text-muted-foreground opacity-20" />
          <div>
            <p className="text-lg font-medium text-muted-foreground">
              Nenhum padrão encontrado
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Os padrões são criados automaticamente ao categorizar transações
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Table with data
  return (
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
          {data.map((pattern) => (
            <TableRow 
              key={pattern.id}
              className="group hover:bg-muted/50 transition-colors"
            >
              <TableCell className="font-medium max-w-xs">
                <div className="truncate" title={pattern.description}>
                  {pattern.description}
                </div>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  {pattern.categoryName || 'Sem categoria'}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <span className="inline-flex items-center justify-center font-semibold text-sm">
                  {pattern.count}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {new Date(pattern.lastUsed).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(pattern.id, pattern.description, pattern.categoryId)}
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 hover:text-blue-600"
                    title="Editar padrão"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(pattern.id)}
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
                    title="Deletar padrão"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
