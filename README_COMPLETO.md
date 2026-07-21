# 💰 JvSoft - Controle de Finanças Pessoais

Um aplicativo completo e profissional para controle financeiro pessoal, desenvolvido com React, Vite, TailwindCSS e Supabase.

## 🚀 Funcionalidades

### Dashboard Principal
- Visão geral do saldo total
- Resumo de receitas e despesas do mês
- Gráficos de despesas por categoria
- Orçamentos por categoria com barras de progresso
- Cards de ação rápida para adicionar transações

### Gestão de Transações
- Adicionar receitas e despesas
- Categorização automática
- Vinculação a contas bancárias
- Histórico completo de transações
- Edição e exclusão de lançamentos

### Contas a Pagar
- Controle de contas fixas (água, luz, internet, etc.)
- Gestão de dívidas parceladas
- Marcar contas como pagas/pendentes
- Agrupamento por data de vencimento
- Visualização do total pago vs pendente

### Metas Financeiras
- Criar metas com valor alvo e prazo
- Acompanhamento de progresso em tempo real
- Prioridade (alta, média, baixa)
- Atualização de valor economizado
- Visualização em cards com barras de progresso

### Cartões de Crédito (Em implementação)
- Cadastro de múltiplos cartões
- Controle de limite disponível
- Gestão de faturas
- Dia de vencimento e fechamento

### Orçamento (Em implementação)
- Definir limites por categoria
- Alertas de ultrapassagem
- Acompanhamento mensal

### Relatórios (Em implementação)
- Gráficos detalhados
- Exportação de dados
- Análise por período

### Configurações (Em implementação)
- Personalização da experiência
- Gerenciamento de categorias
- Contas bancárias

## 🛠️ Tecnologias Utilizadas

- **Frontend:**
  - React 19+
  - Vite (Build tool ultrarrápida)
  - TailwindCSS (Estilização)
  - Lucide React (Ícones)
  - Recharts (Gráficos)

- **Backend/Banco de Dados:**
  - Supabase (PostgreSQL + Auth + Realtime)

- **Context API:**
  - Gerenciamento de estado global

## 📁 Estrutura do Projeto

```
/workspace
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   ├── Sidebar.jsx      # Menu lateral de navegação
│   │   └── ModalTransacao.jsx # Modal para adicionar/editar transações
│   ├── context/             # Contextos React
│   │   └── FinanceContext.jsx # Estado global das finanças
│   ├── pages/               # Páginas da aplicação
│   │   └── MetasFinanceiras.jsx # Página de metas
│   ├── utils/               # Funções utilitárias
│   │   └── helpers.js       # Formatadores e helpers
│   ├── assets/              # Imagens e recursos estáticos
│   ├── App.jsx              # Componente principal
│   ├── Dashboard.jsx        # Dashboard principal
│   ├── ContasPagar.jsx      # Página de contas a pagar
│   ├── supabaseClient.js    # Configuração do Supabase
│   ├── main.jsx             # Entry point
│   └── index.css            # Estilos globais
├── supabase-schema.sql      # Script de configuração do banco
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

## 🗄️ Banco de Dados (Supabase)

O projeto utiliza as seguintes tabelas:

1. **categorias** - Categorias de receitas e despesas
2. **contas_bancarias** - Contas, poupanças e investimentos
3. **credores** - Bancos, empresas e pessoas
4. **receitas** - Receitas fixas mensais
5. **dividas** - Dívidas parceladas
6. **contas** - Contas de consumo mensais
7. **transacoes** - Todas as transações financeiras
8. **cartoes_credito** - Cartões de crédito
9. **cartao_faturas** - Faturas dos cartões
10. **metas_financeiras** - Metas e objetivos
11. **orcamentos** - Limites orçamentários por categoria
12. **investimentos** - Carteira de investimentos

### Como Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Vá para o SQL Editor e execute o script `supabase-schema.sql`
4. Copie a URL e a chave pública (anon key) do seu projeto
5. Atualize o arquivo `src/supabaseClient.js` com suas credenciais:

```javascript
const supabaseUrl = 'SUA_URL_SUPABASE'
const supabaseKey = 'SUA_CHAVE_ANON'
```

## 🚀 Instalação e Execução

### Pré-requisitos
- Node.js 20+ (recomendado 22+)
- npm ou yarn
- Conta no Supabase

### Passos

1. **Clone ou acesse o diretório do projeto:**
```bash
cd /workspace
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure o Supabase:**
   - Execute o script SQL no Supabase
   - Atualize `src/supabaseClient.js`

4. **Execute em modo de desenvolvimento:**
```bash
npm run dev
```

5. **Acesse no navegador:**
```
http://localhost:5173
```

### Comandos Disponíveis

```bash
npm run dev      # Modo de desenvolvimento
npm run build    # Build para produção
npm run preview  # Preview da build
npm run lint     # Verificação de código
```

## 🎨 Design e UI

O aplicativo possui um design moderno e profissional com:

- **Paleta de cores:** Gradientes em azul e cyan
- **Responsividade:** Totalmente adaptável para mobile e desktop
- **Animações:** Transições suaves e efeitos hover
- **Sidebar:** Menu lateral com navegação intuitiva
- **Cards:** Design em cards com sombras e bordas arredondadas
- **Modais:** Interface limpa para formulários

## 📱 Recursos Mobile

- Menu hambúrguer para navegação mobile
- Layout responsivo adaptável
- Botões de ação acessíveis
- Touch-friendly interfaces

## 🔐 Segurança

- Row Level Security (RLS) habilitado em todas as tabelas
- Políticas de acesso configuráveis
- Chaves públicas seguras do Supabase

## 🚧 Em Desenvolvimento

As seguintes funcionalidades estão em implementação:

- [ ] Página completa de Transações
- [ ] Gestão de Cartões de Crédito
- [ ] Módulo de Orçamento completo
- [ ] Relatórios avançados com exportação
- [ ] Configurações personalizadas
- [ ] Autenticação de usuários
- [ ] Notificações e alertas
- [ ] Importação de OFX/CSV
- [ ] Integração com APIs bancárias
- [ ] Modo escuro (Dark Mode)

## 📊 Próximas Melhorias Sugeridas

1. **Autenticação:** Login com email, Google, GitHub
2. **Dashboard Avançado:** Mais gráficos e KPIs
3. **Recorrência:** Transações automáticas recorrentes
4. **Multi-moeda:** Suporte a diferentes moedas
5. **Colaborativo:** Contas compartilhadas para famílias
6. **API:** endpoints para integração com outros apps
7. **PWA:** Instalação como aplicativo nativo
8. **Backup:** Exportar/importar dados completos

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Reportar bugs
2. Sugerir novas funcionalidades
3. Enviar pull requests
4. Melhorar a documentação

## 📄 Licença

Este projeto é de uso livre para fins educacionais e pessoais.

## 👨‍💻 Desenvolvedor

Desenvolvido por **JvSoft** - Soluções em Tecnologia

---

**Dica:** Para melhor experiência, use o navegador Chrome ou Firefox atualizados.

## 🆘 Suporte

Em caso de dúvidas ou problemas:

1. Verifique se o Supabase está configurado corretamente
2. Consulte o console do navegador para erros
3. Verifique as políticas RLS no Supabase
4. Certifique-se de que todas as tabelas foram criadas

---

✨ **Gerencie suas finanças com inteligência e alcance seus objetivos!** ✨
