    import { useState, useMemo } from "react";
    import DashboardLayout from "@/components/DashboardLayout";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
    import { Button } from "@/components/ui/button";
    import { Input } from "@/components/ui/input";
    import { trpc } from "@/lib/trpc";
    import { 
    Wallet, 
    TrendingDown, 
    Calendar, 
    ChevronDown, 
    ChevronUp,
    CreditCard,
    DollarSign,
    BarChart3,
    PieChart,
    Loader2
    } from "lucide-react";
    import { toast } from "sonner";
    import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar
    } from "recharts";

    export default function PersonalDashboard() {
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date.toISOString().split("T")[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());

    // Buscar transações pessoais do período
    const { data: transactions, isLoading } = trpc.transactions.list.useQuery({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
    });

    // Buscar categorias
    const { data: categories } = trpc.setup.listCategories.useQuery({});

    // Buscar contas
    const { data: accounts } = trpc.setup.listAccounts.useQuery();

    // Filtrar apenas transações pessoais (despesas)
    // Para cartões de crédito, os valores vêm com sinal invertido do banco
    const personalTransactions = useMemo(() => {
        if (!transactions || !accounts) return [] as any[];
        
        const personalAccounts = accounts.filter((acc: any) => acc.businessType === "personal");
        const personalAccountIds = personalAccounts.map((acc: any) => acc.id);
        const creditCardAccountIds = personalAccounts
        .filter((acc: any) => acc.accountType === "credit_card")
        .map((acc: any) => acc.id);
        
        return transactions
        .filter((t: any) => 
            t.transactionType === "expense" && 
            personalAccountIds.includes(t.accountId) &&
            !t.isIgnored
        )
        .map((t: any) => {
            // Se for cartão de crédito, inverter o sinal do valor
            // (cartões são salvos com sinal invertido no banco)
            if (creditCardAccountIds.includes(t.accountId)) {
            return {
                ...t,
                amount: -t.amount // Inverte o sinal
            };
            }
            return t;
        });
    }, [transactions, accounts]);

    // Calcular totais
    const totalSpent = useMemo(() => {
        return personalTransactions.reduce((sum: number, t: any) => sum + Math.abs(t.amount) / 100, 0);
    }, [personalTransactions]);

    // Total por conta
    const spentByAccount = useMemo(() => {
        const byAccount = new Map<number, number>();
        personalTransactions.forEach((t: any) => {
        const current = byAccount.get(t.accountId) || 0;
        byAccount.set(t.accountId, current + Math.abs(t.amount) / 100);
        });
        
        return Array.from(byAccount.entries())
        .map(([accountId, total]) => ({
            account: accounts?.find(a => a.id === accountId),
            total
        }))
        .filter(item => item.account)
        .sort((a, b) => b.total - a.total);
    }, [personalTransactions, accounts]);

    // Total por categoria
    const spentByCategory = useMemo(() => {
        const byCategory = new Map<number, { name: string; total: number; transactions: any[] }>();
        
        personalTransactions.forEach((t: any) => {
        if (!t.categoryId) return;
        
        const category = categories?.find(c => c.id === t.categoryId);
        if (!category) return;
        
        const categoryName = category.subcategory 
            ? `${category.name} > ${category.subcategory}` 
            : category.name;
        
        const current = byCategory.get(t.categoryId) || { 
            name: categoryName, 
            total: 0, 
            transactions: [] 
        };
        
        current.total += Math.abs(t.amount) / 100;
        current.transactions.push(t);
        
        byCategory.set(t.categoryId, current);
        });
        
        return Array.from(byCategory.entries())
        .map(([categoryId, data]) => ({ categoryId, ...data }))
        .sort((a, b) => b.total - a.total);
    }, [personalTransactions, categories]);

    // Top 5 categorias
    const top5Categories = useMemo(() => {
        return spentByCategory.slice(0, 5);
    }, [spentByCategory]);

    // Gastos por dia
    const spentByDay = useMemo(() => {
        const byDay = new Map<string, number>();
        
        const filteredTransactions = selectedCategoryId
        ? personalTransactions.filter((t: any) => t.categoryId === selectedCategoryId)
        : personalTransactions;
        
        filteredTransactions.forEach((t: any) => {
        const date = new Date(t.purchaseDate);
        const dateStr = date.toISOString().split("T")[0];
        
        const current = byDay.get(dateStr) || 0;
        byDay.set(dateStr, current + Math.abs(t.amount) / 100);
        });
        
        return Array.from(byDay.entries())
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }, [personalTransactions, selectedCategoryId]);

    // Formatar moeda
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        }).format(value);
    };

    // Formatar data
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    };

    // Toggle categoria expandida
    const toggleCategory = (categoryId: number) => {
        const newSet = new Set(expandedCategories);
        if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
        } else {
        newSet.add(categoryId);
        }
        setExpandedCategories(newSet);
    };

    return (
        <DashboardLayout>
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold">Dashboard de Gastos Pessoais</h1>
                <p className="text-gray-600 mt-2">
                Acompanhe seus gastos pessoais e tendências
                </p>
            </div>
            </div>

            {/* Filtro de Período */}
            <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5" />
                Período
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Data Inicial</label>
                    <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Data Final</label>
                    <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
                <Button
                    onClick={() => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - 1);
                    setStartDate(date.toISOString().split("T")[0]);
                    setEndDate(new Date().toISOString().split("T")[0]);
                    }}
                    variant="outline"
                >
                    Último Mês
                </Button>
                </div>
            </CardContent>
            </Card>

            {isLoading ? (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
            ) : (
            <>
                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Gasto */}
                <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                    <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        Total Gasto
                    </CardTitle>
                    </CardHeader>
                    <CardContent>
                    <p className="text-3xl font-bold">{formatCurrency(totalSpent)}</p>
                    <p className="text-sm opacity-80 mt-1">
                        {personalTransactions.length} transações
                    </p>
                    </CardContent>
                </Card>

                {/* Gastos por Conta */}
                {spentByAccount.slice(0, 3).map(({ account, total }) => (
                    <Card key={account!.id}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        {account!.name}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{formatCurrency(total)}</p>
                        <p className="text-sm text-gray-500 mt-1">
                        {Math.round((total / totalSpent) * 100)}% do total
                        </p>
                    </CardContent>
                    </Card>
                ))}
                </div>

                {/* Top 5 Categorias */}
                <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Top 5 Categorias de Gastos
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                    {top5Categories.map(({ categoryId, name, total }, index) => (
                        <div key={categoryId} className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-sm">
                            {index + 1}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-sm">{name}</span>
                            <span className="font-bold">{formatCurrency(total)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${(total / totalSpent) * 100}%` }}
                            />
                            </div>
                        </div>
                        <span className="text-sm text-gray-500">
                            {Math.round((total / totalSpent) * 100)}%
                        </span>
                        </div>
                    ))}
                    </div>
                </CardContent>
                </Card>

                {/* Gráfico de Evolução */}
                <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Evolução dos Gastos por Dia
                    </CardTitle>
                    <CardDescription>
                    {selectedCategoryId 
                        ? `Categoria: ${spentByCategory.find(c => c.categoryId === selectedCategoryId)?.name}`
                        : "Todos os gastos"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={spentByDay}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                        dataKey="date" 
                        tickFormatter={formatDate}
                        style={{ fontSize: 12 }}
                        />
                        <YAxis 
                        tickFormatter={(value) => formatCurrency(value)}
                        style={{ fontSize: 12 }}
                        />
                        <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => formatDate(label)}
                        />
                        <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#3b82f6"
                        fill="#93c5fd"
                        name="Gastos"
                        />
                    </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
                </Card>

                {/* Filtro por Categorias */}
                <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Gastos por Categoria
                    </CardTitle>
                    <CardDescription>
                    Clique para expandir e ver as transações
                    </CardDescription>
                </CardHeader>
                <CardContent className="max-h-96 overflow-y-auto">
                    {spentByCategory.map(({ categoryId, name, total, transactions: catTransactions }) => (
                    <div key={categoryId} className="border-b last:border-0 py-3">
                        <button
                        onClick={() => toggleCategory(categoryId)}
                        className="w-full flex items-center justify-between hover:bg-gray-50 p-2 rounded transition-colors"
                        >
                        <div className="flex items-center gap-3 flex-1">
                            {expandedCategories.has(categoryId) ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="font-medium text-left">{name}</span>
                        </div>
                        <div className="text-right">
                            <p className="font-bold">{formatCurrency(total)}</p>
                            <p className="text-xs text-gray-500">
                            {catTransactions.length} transações
                            </p>
                        </div>
                        </button>

                        {/* Transações Expandidas */}
                        {expandedCategories.has(categoryId) && (
                        <div className="ml-9 mt-2 space-y-2 bg-gray-50 p-3 rounded">
                            {catTransactions.map((t) => {
                            const account = accounts?.find(a => a.id === t.accountId);
                            return (
                                <div
                                key={t.id}
                                className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                                >
                                <div className="flex-1">
                                    <p className="font-medium">{t.description}</p>
                                    <p className="text-xs text-gray-500">
                                    {new Date(t.purchaseDate).toLocaleDateString("pt-BR")} • {account?.name}
                                    </p>
                                </div>
                                <span className="font-bold text-red-600">
                                    {formatCurrency(Math.abs(t.amount) / 100)}
                                </span>
                                </div>
                            );
                            })}
                        </div>
                        )}
                    </div>
                    ))}
                </CardContent>
                </Card>
            </>
            )}
        </div>
        </DashboardLayout>
    );
    }

