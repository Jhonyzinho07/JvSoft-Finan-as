# 🔒 Guia de Segurança - JvSoft Controle Financeiro

## ✅ Medidas de Segurança Implementadas

### 1. **Variáveis de Ambiente (.env)**
As credenciais do Supabase foram removidas do código fonte e agora estão protegidas em um arquivo `.env`:

```env
VITE_SUPABASE_URL=sua_url_do_projeto_aqui
VITE_SUPABASE_ANON_KEY=sua_chave_anon_publica_aqui
```

**⚠️ IMPORTANTE:** Nunca compartilhe ou faça commit deste arquivo!

### 2. **Row Level Security (RLS)**
O banco de dados agora possui políticas rigorosas que garantem:
- Cada usuário vê **APENAS** seus próprios dados
- Usuários não podem acessar, modificar ou excluir dados de outros usuários
- O isolamento é feito no nível do banco de dados, não apenas no frontend

### 3. **Como Configurar**

#### Passo 1: Atualizar .env
Edite o arquivo `.env` na raiz do projeto com suas credenciais reais:

```bash
# Obtenha estas informações em:
# Supabase Dashboard > Project Settings > API

VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Passo 2: Executar Script SQL no Supabase
1. Acesse seu projeto no [Supabase](https://supabase.com)
2. Vá até **SQL Editor** (menu lateral esquerdo)
3. Clique em **+ New Query**
4. Copie todo o conteúdo do arquivo `supabase-schema-security.sql`
5. Cole no editor SQL
6. Clique em **Run** (ou Ctrl+Enter)

O script irá automaticamente:
- ✅ Adicionar coluna `user_id` em todas as tabelas (se não existir)
- ✅ Habilitar Row Level Security (RLS) em todas as tabelas
- ✅ Criar políticas de segurança para isolar dados por usuário
- ✅ Criar triggers para preencher `user_id` automaticamente ao criar registros
- ✅ Criar índices para performance das consultas

#### Passo 3: Reiniciar o Servidor de Desenvolvimento
Após configurar o `.env`, reinicie o servidor:

```bash
npm run dev
```

### 4. **Como Funciona a Segurança**

#### No Banco de Dados (RLS):
```sql
-- Política aplicada em TODAS as tabelas
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())
```

Isso significa que:
- **SELECT**: Só retorna linhas onde `user_id` == usuário logado
- **INSERT**: Automaticamente define `user_id` do usuário logado
- **UPDATE/DELETE**: Só permite operar em linhas do usuário logado

#### No Frontend:
```javascript
// As credenciais são carregadas de forma segura
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
```

### 5. **Verificação de Segurança**

Para testar se o RLS está funcionando:

1. Crie dois usuários diferentes no app
2. Faça login com o **Usuário A** e crie algumas transações
3. Faça logout e login com o **Usuário B**
4. O Usuário B **NÃO** verá nenhuma transação do Usuário A

Se você tentar acessar dados de outro usuário via API direta, o Supabase bloqueará a requisição com erro 403 (Forbidden).

### 6. **Boas Práticas Mantidas**

✅ Chave `anon` (publishable) usada no frontend (segura por design)  
❌ Chave `service_role` NUNCA exposta no frontend  
✅ RLS ativado em todas as tabelas  
✅ user_id preenchido automaticamente via trigger  
✅ ON DELETE CASCADE para limpar dados ao remover usuário  
✅ Índices criados para performance  
✅ Validação de variáveis de ambiente no código  

### 7. **Arquivos Criados/Modificados**

| Arquivo | Descrição |
|---------|-----------|
| `.env` | Variáveis de ambiente (não fazer commit!) |
| `src/supabaseClient.js` | Agora usa variáveis de ambiente |
| `supabase-schema-security.sql` | Script completo de segurança RLS |
| `SEGURANCA.md` | Este guia de configuração |

### 8. **Próximos Passos Recomendados**

1. **Adicione `.env` ao .gitignore** (já deve estar, mas verifique):
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Regenerar chaves** (opcional, mas recomendado):
   - Vá em Supabase Dashboard > Project Settings > API
   - Clique em "Reset" na chave anon
   - Atualize o arquivo `.env`

3. **Habilitar MFA** (Multi-Factor Authentication):
   - Supabase > Authentication > Policies
   - Ative MFA para maior segurança dos usuários

4. **Configurar limites de rate limiting**:
   - Supabase > Project Settings > API
   - Ajuste conforme necessidade

---

## 🎉 Seu App Está Seguro!

Agora cada usuário acessa **somente seus próprios dados**, mesmo que tente manipular o frontend ou fazer requisições diretas à API. A segurança está garantida no nível mais baixo possível: o banco de dados.
