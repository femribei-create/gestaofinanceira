# 💰 Sistema de Gestão Financeira Pessoal e Empresarial

Sistema completo de gestão financeira com categorização automática via IA, importação de arquivos bancários (OFX/CSV), DRE mensal e dashboards analíticos.

## 🚀 Deploy no Railway (Recomendado)

### Pré-requisitos
- Conta no [Railway.app](https://railway.app) (gratuito para começar)
- Conta no GitHub/GitLab para hospedar o código

### Passo 1: Preparar o Repositório

1. Faça fork ou clone este repositório
2. Push para seu GitHub/GitLab

### Passo 2: Deploy no Railway

1. Acesse [railway.app](https://railway.app) e faça login
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Escolha este repositório
5. Railway detectará automaticamente o projeto Node.js

### Passo 3: Adicionar Banco de Dados MySQL

1. No projeto Railway, clique em "New"
2. Selecione "Database" → "MySQL"
3. Railway criará automaticamente a variável `DATABASE_URL`

### Passo 4: Configurar Variáveis de Ambiente

No Railway, vá em "Variables" e adicione:

**Obrigatórias:**
```
DATABASE_URL=<já configurado automaticamente pelo Railway>
JWT_SECRET=<gere um valor aleatório seguro, ex: openssl rand -base64 32>
OPENAI_API_KEY=sk-<sua-chave-openai>
NODE_ENV=production
PORT=3000
```

**Opcionais (para autenticação Manus):**
```
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=<seu-app-id>
OWNER_OPEN_ID=<seu-owner-open-id>
OWNER_NAME=<seu-nome>
```

### Passo 5: Deploy Automático

1. Railway fará build e deploy automaticamente
2. Aguarde 2-3 minutos
3. Clique em "View Logs" para acompanhar
4. Quando aparecer "Server running on...", está pronto!

### Passo 6: Popular Banco de Dados

Após o primeiro deploy, execute o seed:

1. No Railway, vá em "Settings" → "Deploy Triggers"
2. Ou conecte via Railway CLI:
```bash
railway run tsx scripts/seed.ts
```

Isso criará:
- 74 categorias (empresariais e pessoais)
- 7 contas bancárias
- 5 regras de categorização default

### Passo 7: Acessar o Sistema

1. No Railway, copie a URL pública (ex: `https://seu-app.railway.app`)
2. Acesse no navegador
3. Faça login e comece a usar!

---

## 📊 Funcionalidades

### ✅ Gestão de Contas
- 7 contas bancárias pré-configuradas
- Itaú, Nubank PJ/PF, Inter, Sangria, Cartões

### ✅ Importação de Arquivos
- Suporte a OFX e CSV
- Normalização automática de sinais por banco
- Detecção de duplicatas

### ✅ Categorização Automática (3 Camadas)
1. **Regras Manuais** - Prioridade máxima, 100% preciso
2. **Histórico Aprendido** - Baseado em correções anteriores
3. **IA (GPT-4)** - Para casos novos, 95%+ preciso

### ✅ DRE Mensal
- Demonstração do Resultado do Exercício
- Histórico comparativo de meses anteriores
- Exportação para CSV

### ✅ Gestão de Transações
- Filtros avançados por período, categoria, conta
- Edição de categorias
- Aprendizado automático com correções

---

## 💰 Custos Estimados

### Railway
- **Tier Gratuito**: $5 de crédito/mês
- **Tier Pago**: ~$5-10/mês (fixo)

### OpenAI API
- **Categorização IA**: ~$1-5/mês para 1.000 transações
- Uso otimizado: apenas para casos novos

**Total estimado: $5-15/mês**

---

## 🛠️ Desenvolvimento Local

```bash
# Instalar dependências
pnpm install

# Configurar .env
cp .env.example .env
# Edite .env com suas credenciais

# Rodar migrations
pnpm db:push

# Popular banco de dados
tsx scripts/seed.ts

# Iniciar servidor de desenvolvimento
pnpm dev
```

Acesse: `http://localhost:3000`

---

## 📁 Estrutura do Projeto

```
├── client/                 # Frontend React
│   ├── src/
│   │   ├── pages/         # Páginas (Home, Categorization, Transactions, DRE)
│   │   ├── components/    # Componentes reutilizáveis
│   │   └── lib/           # tRPC client
├── server/                # Backend Node.js
│   ├── routers/           # Rotas tRPC
│   ├── db.ts              # Helpers de banco de dados
│   ├── categorization.engine.ts  # Engine de categorização
│   └── parsers.ts         # Parsers OFX/CSV
├── drizzle/               # Schema do banco de dados
│   └── schema.ts
├── scripts/               # Scripts utilitários
│   └── seed.ts            # Seed do banco de dados
└── railway.json           # Configuração Railway
```

---

## 🔧 Tecnologias

- **Frontend**: React 19 + TypeScript + TailwindCSS
- **Backend**: Node.js + Express + tRPC
- **Banco de Dados**: MySQL (via Railway)
- **ORM**: Drizzle
- **IA**: OpenAI GPT-4
- **Deploy**: Railway.app

---

## 📝 Licença

MIT

---

## 🆘 Suporte

Para dúvidas ou problemas:
1. Verifique os logs no Railway
2. Consulte a documentação do Railway
3. Abra uma issue no repositório

---

**Desenvolvido com ❤️ para gestão financeira inteligente**
