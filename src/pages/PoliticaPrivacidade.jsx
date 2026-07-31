import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function PoliticaPrivacidade() {
  const goBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-8"
        >
          <ArrowLeft size={20} />
          Voltar
        </button>

        <h1 className="text-3xl font-bold mb-6 text-slate-900 dark:text-white">Política de Privacidade</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="space-y-6 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">1. Introdução</h2>
            <p>
              A sua privacidade é fundamental para nós. Esta Política de Privacidade explica como o <strong>Jv Soft Finanças</strong> coleta, usa, compartilha e protege as suas informações pessoais, em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">2. Dados que Coletamos</h2>
            <p>Coletamos apenas os dados essenciais para o funcionamento do aplicativo:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li><strong>Dados de Cadastro:</strong> Nome completo e endereço de e-mail.</li>
              <li><strong>Dados Financeiros:</strong> Informações que você insere voluntariamente no aplicativo (transações, contas, metas, cartões), as quais são armazenadas de forma segura e não são compartilhadas com terceiros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">3. Como Usamos Seus Dados</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Para criar e gerenciar sua conta de usuário.</li>
              <li>Para fornecer, operar e manter os recursos de gestão financeira do aplicativo.</li>
              <li>Para comunicação relacionada a atualizações do aplicativo, suporte técnico e segurança.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">4. Serviços de Terceiros e Compartilhamento</h2>
            <p>
              O <strong>Jv Soft Finanças</strong> utiliza exclusivamente os serviços do <strong>Supabase</strong> para banco de dados e autenticação de usuários.
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Os dados são armazenados na infraestrutura do Supabase, que possui rigorosos padrões de segurança internacional.</li>
              <li><strong>Não vendemos, alugamos ou compartilhamos</strong> seus dados pessoais ou financeiros com anunciantes, agências de marketing ou outros serviços de terceiros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">5. Segurança dos Dados</h2>
            <p>
              Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais contra acesso, alteração, divulgação ou destruição não autorizada. O acesso aos seus dados financeiros é estritamente controlado através de políticas de segurança em nível de linha (RLS - Row Level Security), garantindo que apenas você tenha acesso aos seus registros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">6. Seus Direitos (LGPD)</h2>
            <p>Como titular dos dados, você tem o direito de:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Acessar, corrigir ou atualizar seus dados a qualquer momento.</li>
              <li>Solicitar a exclusão completa da sua conta e de todos os dados associados.</li>
              <li>Solicitar a portabilidade dos seus dados financeiros (exportação de relatórios).</li>
              <li>Revogar o consentimento para o tratamento dos dados, o que implicará no encerramento da conta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">7. Exclusão de Dados</h2>
            <p>
              Você pode solicitar a exclusão da sua conta através das configurações do aplicativo. Ao fazer isso, todos os seus dados pessoais e financeiros serão permanentemente apagados dos nossos servidores.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">8. Atualizações desta Política</h2>
            <p>
              Esta Política de Privacidade pode ser atualizada periodicamente. Recomendamos que você revise esta página regularmente para estar ciente de quaisquer alterações.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">9. Contato</h2>
            <p>
              Para exercer seus direitos relativos à LGPD ou esclarecer dúvidas sobre esta Política de Privacidade, entre em contato através dos canais de suporte disponíveis no aplicativo.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
