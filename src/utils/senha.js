// Regra única de senha do app (cadastro, redefinição e troca em Configurações).
// Compatível com o Supabase Auth configurado com "Minimum password length: 8" e
// "Password requirements: Letters and digits": tudo que passa aqui também passa lá.
export const REGRA_SENHA = 'Mínimo de 8 caracteres, com letra, número e caractere especial.'

export function validarSenha(senha = '') {
  if (senha.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/\p{L}/u.test(senha)) return 'A senha deve conter pelo menos uma letra.'
  if (!/\p{N}/u.test(senha)) return 'A senha deve conter pelo menos um número.'
  // Qualquer símbolo conta (antes só !@#$%^&*(),.?":{}|<>; "-", "_" e "+" eram recusados)
  if (!/[^\p{L}\p{N}\s]/u.test(senha)) return 'A senha deve conter pelo menos um caractere especial.'
  return null
}
