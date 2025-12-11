# 🚀 Guia Passo a Passo: Deploy no Railway

Este guia vai te ajudar a fazer o deploy do sistema de gestão financeira no Railway **sem precisar programar nada**.

---

## 📋 Antes de Começar

Você vai precisar de:

1. ✅ Conta no **GitHub** (gratuito) - [criar conta](https://github.com/signup)
2. ✅ Conta no **Railway** (gratuito) - [criar conta](https://railway.app)
3. ✅ Chave da **OpenAI API** (para categorização IA) - [obter chave](https://platform.openai.com/api-keys)

**Tempo estimado:** 15-20 minutos

---

## 🎯 Passo 1: Criar Repositório no GitHub

### 1.1 Fazer Login no GitHub
- Acesse [github.com](https://github.com)
- Faça login com sua conta

### 1.2 Criar Novo Repositório
1. Clique no botão **"+"** no canto superior direito
2. Selecione **"New repository"**
3. Preencha:
   - **Repository name**: `gestao-financeira`
   - **Description**: `Sistema de Gestão Financeira Pessoal e Empresarial`
   - Marque **"Private"** (recomendado)
4. Clique em **"Create repository"**

### 1.3 Fazer Upload do Código
1. Na página do repositório criado, clique em **"uploading an existing file"**
2. Arraste todos os arquivos do projeto para a área de upload
3. Ou use o comando Git (se souber):
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/gestao-financeira.git
   git push -u origin main
   ```
4. Clique em **"Commit changes"**

✅ **Pronto!** Seu código está no GitHub.

---

## 🚂 Passo 2: Criar Projeto no Railway

### 2.1 Fazer Login no Railway
- Acesse [railway.app](https://railway.app)
- Clique em **"Login"**
- Faça login com sua conta GitHub (recomendado)

### 2.2 Criar Novo Projeto
1. No dashboard do Railway, clique em **"New Project"**
2. Selecione **"Deploy from GitHub repo"**
3. Autorize o Railway a acessar seus repositórios (se solicitado)
4. Selecione o repositório **`gestao-financeira`**
5. Railway começará a detectar o projeto automaticamente

✅ **Aguarde 1-2 minutos** enquanto Railway configura o projeto.

---

## 🗄️ Passo 3: Adicionar Banco de Dados MySQL

### 3.1 Adicionar MySQL ao Projeto
1. No projeto Railway, clique em **"New"** (botão roxo no canto superior direito)
2. Selecione **"Database"**
3. Escolha **"Add MySQL"**
4. Railway criará automaticamente o banco de dados

### 3.2 Verificar Conexão
1. Clique no serviço **"MySQL"** no dashboard
2. Vá na aba **"Variables"**
3. Você verá `DATABASE_URL` já configurada automaticamente
4. ✅ **Não precisa copiar nada!** Railway conecta automaticamente.

---

## ⚙️ Passo 4: Configurar Variáveis de Ambiente

### 4.1 Acessar Configurações do Serviço
1. No dashboard Railway, clique no serviço **principal** (não o MySQL)
2. Vá na aba **"Variables"**

### 4.2 Adicionar Variáveis Obrigatórias

Clique em **"New Variable"** e adicione **uma por vez**:

#### 1. JWT_SECRET
- **Nome**: `JWT_SECRET`
- **Valor**: Gere um valor aleatório seguro
  - Opção 1: Use [este gerador](https://generate-secret.vercel.app/32)
  - Opção 2: Digite qualquer texto longo e aleatório (mínimo 32 caracteres)
  - Exemplo: `minha-chave-super-secreta-12345-abcde-fghij-67890`

#### 2. OPENAI_API_KEY
- **Nome**: `OPENAI_API_KEY`
- **Valor**: Sua chave da OpenAI
  - Obtenha em: https://platform.openai.com/api-keys
  - Formato: `sk-proj-...` (começa com `sk-`)

#### 3. NODE_ENV
- **Nome**: `NODE_ENV`
- **Valor**: `production`

#### 4. PORT
- **Nome**: `PORT`
- **Valor**: `3000`

### 4.3 Verificar Variáveis
Você deve ter no mínimo estas variáveis:
- ✅ `DATABASE_URL` (criada automaticamente pelo MySQL)
- ✅ `JWT_SECRET`
- ✅ `OPENAI_API_KEY`
- ✅ `NODE_ENV`
- ✅ `PORT`

---

## 🚀 Passo 5: Fazer Deploy

### 5.1 Iniciar Deploy
1. Railway detectará as mudanças automaticamente
2. Ou clique em **"Deploy"** no canto superior direito
3. Aguarde 3-5 minutos enquanto Railway:
   - Instala dependências
   - Cria o banco de dados
   - Faz build do projeto
   - Inicia o servidor

### 5.2 Acompanhar o Deploy
1. Clique na aba **"Deployments"**
2. Clique no deploy mais recente
3. Vá em **"View Logs"**
4. Aguarde até ver a mensagem: `Server running on http://0.0.0.0:3000`

✅ **Deploy concluído!**

---

## 🌐 Passo 6: Acessar o Sistema

### 6.1 Obter URL Pública
1. No dashboard Railway, clique no serviço principal
2. Vá na aba **"Settings"**
3. Role até **"Networking"**
4. Clique em **"Generate Domain"**
5. Railway criará uma URL como: `https://gestao-financeira-production.up.railway.app`

### 6.2 Acessar no Navegador
1. Copie a URL gerada
2. Cole no navegador
3. ✅ **Você verá a tela inicial do sistema!**

---

## 📊 Passo 7: Popular o Banco de Dados

### 7.1 Executar Script de Seed

**Opção A: Via Railway CLI (Recomendado)**
1. Instale Railway CLI:
   - Windows: Baixe em https://railway.app/cli
   - Mac: `brew install railway`
   - Linux: `curl -fsSL https://railway.app/install.sh | sh`
2. Faça login: `railway login`
3. Conecte ao projeto: `railway link`
4. Execute o seed: `railway run pnpm seed`

**Opção B: Via Interface do Railway**
1. No dashboard, clique no serviço principal
2. Vá em **"Settings"** → **"Deploy Triggers"**
3. Adicione um comando personalizado: `pnpm seed`
4. Clique em **"Deploy"**

### 7.2 Verificar Dados
Após executar o seed, o banco terá:
- ✅ 74 categorias (empresariais e pessoais)
- ✅ 7 contas bancárias
- ✅ 5 regras de categorização default

---

## ✅ Passo 8: Começar a Usar!

### 8.1 Primeiro Acesso
1. Acesse a URL do seu sistema
2. Faça login (se configurou autenticação)
3. Explore as funcionalidades:
   - **Categorização**: Gerenciar regras e padrões
   - **Importar**: Upload de arquivos OFX/CSV
   - **Transações**: Visualizar e editar lançamentos
   - **DRE**: Demonstração do Resultado do Exercício

### 8.2 Importar Primeiro Arquivo
1. Vá em **"Importar"**
2. Selecione a conta bancária
3. Faça upload do arquivo OFX ou CSV
4. Aguarde o processamento
5. ✅ Transações importadas e categorizadas automaticamente!

---

## 💰 Custos

### Railway
- **Tier Gratuito**: $5 de crédito/mês
- **Tier Hobby**: $5/mês (500 horas de execução)
- **Tier Pro**: $20/mês (ilimitado)

### OpenAI
- **Categorização IA**: ~$1-5/mês para 1.000 transações
- Uso otimizado: apenas para casos novos

**Total estimado: $5-15/mês**

---

## 🆘 Problemas Comuns

### ❌ "Build Failed"
**Solução:**
1. Verifique os logs em **"Deployments"** → **"View Logs"**
2. Certifique-se que `DATABASE_URL` está configurada
3. Tente fazer deploy novamente

### ❌ "Cannot connect to database"
**Solução:**
1. Verifique se o serviço MySQL está rodando
2. Vá em **"Variables"** e confirme que `DATABASE_URL` existe
3. Reinicie o deploy

### ❌ "OpenAI API Error"
**Solução:**
1. Verifique se `OPENAI_API_KEY` está correta
2. Confirme que tem créditos na conta OpenAI
3. Teste a chave em: https://platform.openai.com/playground

### ❌ "Página não carrega"
**Solução:**
1. Aguarde 5 minutos após o deploy
2. Verifique se o domínio foi gerado corretamente
3. Limpe o cache do navegador (Ctrl+Shift+R)

---

## 📞 Suporte

Se precisar de ajuda:
1. ✅ Consulte a [documentação do Railway](https://docs.railway.app)
2. ✅ Verifique os logs no Railway
3. ✅ Abra uma issue no repositório GitHub

---

## 🎉 Parabéns!

Você configurou com sucesso seu sistema de gestão financeira! 🚀

**Próximos passos:**
- Importar seus arquivos bancários
- Criar regras de categorização personalizadas
- Gerar sua primeira DRE
- Analisar seus gastos

---

**Desenvolvido com ❤️ para gestão financeira inteligente**
