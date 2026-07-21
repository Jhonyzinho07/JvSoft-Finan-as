import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import logoEmpresa from '../assets/logo.png';

export default function Login() {
  const toast = useToast()
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Registro de novo usuário
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        toast.success('Conta criada! Verifique seu email para confirmar.');
        setIsSignUp(false);
      } else {
        // Login de usuário existente
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        navigate('/dashboard');
      }
    } catch (err) {
      // TRADUÇÃO DE ERROS DO SUPABASE PARA PORTUGUÊS
      if (err.message === 'Invalid login credentials') {
        setError('E-mail ou senha incorretos. Tente novamente.');
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
    } catch (err) {
      setError('Erro ao fazer login com o Google.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
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
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              JvSoft Finanças
            </h1>
            <p className="text-slate-600">
              {isSignUp ? 'Crie sua conta gratuita' : 'Bem-vindo de volta!'}
            </p>
          </div>

          {/* Card do Formulário */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 text-slate-800 placeholder-slate-400"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 text-slate-800 placeholder-slate-400"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* Botão Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Processando...
                  </span>
                ) : isSignUp ? (
                  'Criar Conta'
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            {/* Divisor */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">ou continue com</span>
              </div>
            </div>

            {/* Google Login */}
            <button
              onClick={handleGoogleLogin}
              className="w-full py-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 flex items-center justify-center gap-3"
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

            {/* Toggle Sign Up / Login */}
            <div className="mt-6 text-center">
              <p className="text-slate-600">
                {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                >
                  {isSignUp ? 'Fazer Login' : 'Criar Conta'}
                </button>
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-500 text-sm mt-8">
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
    </div>
  );
}