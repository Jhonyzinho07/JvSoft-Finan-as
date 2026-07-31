import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import { Mail, Lock, Eye, EyeOff, LogIn, User } from 'lucide-react';
import logoEmpresa from '../assets/logo.png';
import ModalDocumento from '../components/ModalDocumento';
import { ConteudoTermosDeUso, ConteudoPoliticaPrivacidade } from '../components/DocumentosConteudo';

export default function Login() {
  const toast = useToast()
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [modalTermosOpen, setModalTermosOpen] = useState(false);
  const [modalPrivacidadeOpen, setModalPrivacidadeOpen] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [lockCountdown, setLockCountdown] = useState(0);


  useEffect(() => {
    let interval;
    if (lockedUntil) {
      interval = setInterval(() => {
        const now = new Date();
        const timeLeft = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
        if (timeLeft <= 0) {
          setLockedUntil(null);
          setLockCountdown(0);
          setLoginAttempts(0); // Reset attempts after lock expires
          setError('');
          clearInterval(interval);
        } else {
          setLockCountdown(timeLeft);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lockedUntil]);

  const isLocked = lockedUntil && new Date() < lockedUntil;

  const validatePassword = (pass) => {
    const minLength = 8;
    const hasNumber = /\d/;
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/;

    if (pass.length < minLength) return 'A senha deve ter pelo menos 8 caracteres.';
    if (!hasNumber.test(pass)) return 'A senha deve conter pelo menos um número.';
    if (!hasSpecialChar.test(pass)) return 'A senha deve conter pelo menos um caractere especial.';
    return null;
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, insira seu e-mail para recuperar a senha.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Se o e-mail existir em nossa base, você receberá um link para redefinir sua senha.');
      setIsForgotPassword(false);
    } catch (_err) {
      setError('Ocorreu um erro ao tentar recuperar a senha. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLocked) {
      setError('Muitas tentativas. Tente novamente mais tarde.');
      return;
    }

    setError('');
    setLoading(true);

    const sanitizedEmail = email.trim();

    try {
      if (isSignUp) {
        const passwordError = validatePassword(password);
        if (passwordError) {
          setError(passwordError);
          setLoading(false);
          return;
        }

        if (!termsAccepted) {
          setError('Você deve aceitar os Termos de Uso e a Política de Privacidade para criar uma conta.');
          setLoading(false);
          return;
        }

        if (!name.trim()) {
          setError('Por favor, informe como gostaria de ser chamado.');
          setLoading(false);
          return;
        }

        // Registro de novo usuário
        const { error } = await supabase.auth.signUp({
          email: sanitizedEmail,
          password,
          options: {
            data: {
              full_name: name.trim(), // Save the name in the user's metadata
            }
          }
        });

        if (error) throw error;

        toast.success('Conta criada! Verifique seu email para confirmar.');
        setIsSignUp(false);
      } else {
        // Login de usuário existente
        const { error } = await supabase.auth.signInWithPassword({
          email: sanitizedEmail,
          password,
        });

        if (error) throw error;

        navigate('/dashboard');
      }
    } catch (_err) {
      // TRADUÇÃO DE ERROS DO SUPABASE PARA PORTUGUÊS
      if (_err.message === 'User already registered') {
        setError('Este e-mail já está em uso.');
      } else if (_err.message === 'Invalid login credentials') {
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        if (newAttempts >= 3) {
          const lockTime = new Date(new Date().getTime() + 30 * 1000); // 30 segundos
          setLockedUntil(lockTime);
          setError('Muitas tentativas inválidas. Conta bloqueada por 30 segundos.');
        } else {
          setError('E-mail ou senha incorretos. Tente novamente.');
        }
      } else {
        setError('Ocorreu um erro ao tentar fazer login. Verifique sua conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (_err) {
      setError('Erro ao fazer login com o Google.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
        <div className="w-full max-w-md">
          {/* Logo da Empresa */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
              <img 
                src={logoEmpresa} 
                alt="Logo JvSoft" 
                className="w-full h-full object-contain drop-shadow-md" 
              />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2 dark:text-slate-100">
              JvSoft Finanças
            </h1>
            <p className="text-slate-600 dark:text-slate-300">
              {isForgotPassword ? 'Recupere sua conta' : isSignUp ? 'Crie sua conta gratuita' : 'Bem-vindo de volta!'}
            </p>
          </div>

          {/* Card do Formulário */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8 border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
            <form onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit} className="space-y-6">

              {/* Nome (Apenas Cadastro) */}
              {isSignUp && !isForgotPassword && (
                <div>
                  <label htmlFor="name-input" className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-200">
                    Nome que quer ser chamado
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="name-input"
                      type="text"
                      value={name}
                      autoComplete="name"
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 text-slate-800 placeholder-slate-400 dark:placeholder-slate-500 dark:border-slate-700 dark:text-slate-100"
                      placeholder="Seu nome ou apelido"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="email-input" className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-200">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="email-input"
                    type="email"
                    value={email}
                    autoComplete="email"
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 text-slate-800 placeholder-slate-400 dark:placeholder-slate-500 dark:border-slate-700 dark:text-slate-100"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              {/* Senha (Não mostra no Forgot Password) */}
              {!isForgotPassword && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password-input" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Senha
                    </label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 text-slate-800 placeholder-slate-400 dark:placeholder-slate-500 dark:border-slate-700 dark:text-slate-100"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* LGPD Checkbox */}
              {isSignUp && !isForgotPassword && (
                <div className="flex items-start gap-2 mt-4 mb-4">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 bg-transparent focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700"
                  />
                  <label htmlFor="terms" className="text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                    Eu concordo com os <button type="button" onClick={(e) => { e.preventDefault(); setModalTermosOpen(true); }} className="text-blue-600 hover:underline dark:text-blue-400">Termos de Uso</button> e a <button type="button" onClick={(e) => { e.preventDefault(); setModalPrivacidadeOpen(true); }} className="text-blue-600 hover:underline dark:text-blue-400">Política de Privacidade</button>.
                  </label>
                </div>
              )}

              {/* Erro e Bloqueio */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex flex-col gap-1">
                  <span>{error}</span>
                  {isLocked && lockCountdown > 0 && (
                    <span className="font-semibold text-xs opacity-80">
                      Aguarde {lockCountdown} segundos para tentar novamente.
                    </span>
                  )}
                </div>
              )}

              {/* Botão Submit */}
              <button
                type="submit"
                disabled={loading || isLocked}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Processando...
                  </span>
                ) : isForgotPassword ? (
                  'Recuperar Senha'
                ) : isSignUp ? (
                  'Criar Conta'
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            {/* Divisor */}
            {!isForgotPassword && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-400">ou continue com</span>
                  </div>
                </div>

                {/* Google Login */}
                <button
                  onClick={handleGoogleLogin}
                  className="w-full py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 flex items-center justify-center gap-3 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.766 12.2764c0-.8942-.0793-1.7553-.2238-2.5886H12v4.9097h6.6095c-.2874 1.5386-1.1581 2.8437-2.4689 3.7214v3.0392h3.9426c2.3043-2.1178 3.6828-5.2408 3.6828-9.0817z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24.0003c3.3086 0 6.0825-1.0938 8.0832-2.9392l-3.9426-3.0392c-1.0856.7308-2.4786 1.1668-4.1406 1.1668-3.1979 0-5.9063-2.1564-6.8719-5.0507H1.0847v3.1363C3.0968 21.2679 7.3086 24.0003 12 24.0003z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.1281 14.138c-.2424-.7263-.3795-1.5029-.3795-2.3069s.1371-1.5806.3795-2.3069V6.3878H1.0847C.3943 7.7686 0 9.3371 0 11.8311s.3943 4.0625 1.0847 5.4433l4.0434-3.1364z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.8116c1.8076 0 3.4286.6218 4.7035 1.8378l3.5308-3.5308C18.0932 1.1264 15.3086 0 12 0 7.3086 0 3.0968 2.7324 1.0847 6.3878l4.0434 3.1364c.9656-2.8943 3.674-5.0507 6.8719-5.0507z"
                    />
                  </svg>
                  Google
                </button>
              </>
            )}

            {/* Toggle Sign Up / Login */}
            <div className="mt-6 text-center">
              {isForgotPassword ? (
                <p className="text-slate-600 dark:text-slate-300">
                  Lembrou da senha?{' '}
                  <button
                    onClick={() => setIsForgotPassword(false)}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold transition-colors"
                  >
                    Voltar para o Login
                  </button>
                </p>
              ) : (
                <p className="text-slate-600 dark:text-slate-300">
                  {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
                  <button
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError('');
                    }}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold transition-colors"
                  >
                    {isSignUp ? 'Fazer Login' : 'Criar Conta'}
                  </button>
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-500 text-sm mt-8 dark:text-slate-400">
            © 2026 JvSoft. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Lado Direito - Imagem/Decorativo */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 relative overflow-hidden">
        {/* Círculos Decorativos */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl"></div>
        
        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
          <div className="max-w-md text-center">
            {/* Logo da Empresa no Lado Direito */}
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-3xl bg-white/20 backdrop-blur-sm mb-6 p-4 shadow-xl">
              <img 
                src={logoEmpresa} 
                alt="Logo JvSoft" 
                className="w-full h-full object-contain" 
              />
            </div>
            
            <h2 className="text-4xl font-bold mb-6">
              Controle suas finanças com profissionalismo
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed">
              Gerencie receitas, despesas, metas e orçamentos em uma única plataforma. 
              Tome decisões financeiras inteligentes com insights visuais.
            </p>

            {/* Features */}
            <div className="mt-12 space-y-4">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="w-10 h-10 rounded-lg bg-green-400/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <span className="font-medium">Acompanhe seu patrimônio em tempo real</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="w-10 h-10 rounded-lg bg-blue-400/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="font-medium">Gráficos e relatórios detalhados</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="w-10 h-10 rounded-lg bg-purple-400/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span className="font-medium">Segurança de dados com Supabase</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModalDocumento
        isOpen={modalTermosOpen}
        onClose={() => setModalTermosOpen(false)}
        titulo="Termos de Uso"
      >
        <ConteudoTermosDeUso />
      </ModalDocumento>

      <ModalDocumento
        isOpen={modalPrivacidadeOpen}
        onClose={() => setModalPrivacidadeOpen(false)}
        titulo="Política de Privacidade"
      >
        <ConteudoPoliticaPrivacidade />
      </ModalDocumento>
    </div>
  );
}