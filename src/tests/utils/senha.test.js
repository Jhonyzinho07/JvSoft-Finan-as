import { describe, it, expect } from 'vitest'
import { validarSenha } from '../../../src/utils/senha'

describe('validarSenha', () => {
  it('aceita senha com 8+ caracteres, letra, número e símbolo', () => {
    expect(validarSenha('Financas#2026')).toBeNull()
    expect(validarSenha('senha-123')).toBeNull()
    expect(validarSenha('ação_2026')).toBeNull()
  })

  it('recusa senha curta', () => {
    expect(validarSenha('Ab1!')).toMatch(/8 caracteres/)
    expect(validarSenha('abc12!')).toMatch(/8 caracteres/) // 6 caracteres: antes aceito em Configurações
  })

  it('exige letra, número e caractere especial', () => {
    expect(validarSenha('12345678!')).toMatch(/letra/)
    expect(validarSenha('senhasemnumero!')).toMatch(/número/)
    expect(validarSenha('senha12345')).toMatch(/especial/)
  })

  it('espaço não conta como caractere especial', () => {
    expect(validarSenha('senha 12345')).toMatch(/especial/)
  })
})
