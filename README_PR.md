## Atualizações na Página de Login

Foi implementada uma série de melhorias e correções na página `Login.jsx` de acordo com a solicitação do usuário. Abaixo os detalhes:

- **Campo Nome no Cadastro**: Foi adicionado o campo "Nome que quer ser chamado" apenas na tela de SignUp (cadastro). O nome preenchido está sendo enviado para a propriedade `options.data.nome` do Supabase via função `signUp`.
- **Esqueci a Senha**: Foi criado o botão "Esqueci a senha?" para exibir apenas o campo de E-mail. Também implementada a função `handleForgotPassword` que chama o método de redefinição de email da auth do Supabase. O botão "Entrar com Google" foi omitido da visualização de recuperação de senha.
- **Ajustes de UI e UX**:
  - Correção do input da senha de `minLength={6}` para `minLength={8}` conforme validação existente.
  - Ajustados os inputs e labels para funcionarem com `id` e `htmlFor` buscando melhorias de acessibilidade.
  - Links de Termos de Uso e LGPD que antes recarregavam a página com `href="#"` agora estão com `e.preventDefault()`.
- **Timer Visual de Bloqueio**: Em caso de erros sucessivos (3x) o timer de bloqueio agora decresce visualmente exibindo "Aguarde X segundos" e é limpo adequadamente, resetando os `loginAttempts` após o termino da penalização do timer, em vez de bloquear o usuário permanentemente por qualquer novo erro.
- **Tradução de Erros**: Se um erro 'User already registered' for pego no log do sistema de SignUp, ele traduzirá para "Este e-mail já está em uso.".
