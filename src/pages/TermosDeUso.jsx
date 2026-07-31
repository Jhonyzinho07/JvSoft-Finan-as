import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function TermosDeUso() {
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

        <h1 className="text-3xl font-bold mb-6 text-slate-900 dark:text-white">Termos de Uso</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="space-y-6 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e usar o aplicativo <strong>Jv Soft Finanças</strong>, você concorda em cumprir e ficar vinculado aos seguintes Termos de Uso. Se você não concorda com qualquer parte destes termos, não deve usar nosso aplicativo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">2. Descrição do Serviço</h2>
            <p>
              O <strong>Jv Soft Finanças</strong> é um aplicativo de controle e gestão financeira pessoal. Nosso objetivo é ajudar os usuários a organizar suas finanças, registrar receitas, despesas e metas financeiras.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">3. Cadastro e Conta de Usuário</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Para utilizar todas as funcionalidades do aplicativo, é necessário criar uma conta fornecendo um nome e endereço de e-mail válido.</li>
              <li>Você é responsável por manter a confidencialidade de suas credenciais de login e por todas as atividades que ocorram sob sua conta.</li>
              <li>Você concorda em nos notificar imediatamente sobre qualquer uso não autorizado de sua conta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">4. Privacidade e Proteção de Dados</h2>
            <p>
              O tratamento dos seus dados pessoais é regulamentado pela nossa <a href="/privacidade" className="text-blue-600 dark:text-blue-400 hover:underline">Política de Privacidade</a>. Cumprimos rigorosamente a Lei Geral de Proteção de Dados (LGPD).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">5. Responsabilidades do Usuário</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Os dados inseridos no aplicativo são de sua inteira responsabilidade. O <strong>Jv Soft Finanças</strong> não se responsabiliza por decisões financeiras tomadas com base nas informações inseridas no aplicativo.</li>
              <li>Você concorda em não usar o aplicativo para qualquer fim ilegal ou não autorizado.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">6. Propriedade Intelectual</h2>
            <p>
              Todos os direitos, títulos e interesses relativos ao aplicativo, incluindo, mas não se limitando a, design, código-fonte, textos e logotipos, são de propriedade exclusiva do <strong>Jv Soft Finanças</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">7. Limitação de Responsabilidade</h2>
            <p>
              O aplicativo é fornecido "no estado em que se encontra". Não garantimos que o serviço será ininterrupto, livre de erros ou totalmente seguro. Em nenhuma circunstância o <strong>Jv Soft Finanças</strong> será responsável por quaisquer danos diretos, indiretos, incidentais ou consequenciais resultantes do uso ou da incapacidade de usar o aplicativo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">8. Modificações dos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. Notificaremos os usuários sobre mudanças significativas. O uso contínuo do aplicativo após tais modificações constitui sua aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">9. Contato</h2>
            <p>
              Se você tiver alguma dúvida sobre estes Termos de Uso, entre em contato conosco através dos canais de suporte disponíveis no aplicativo.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
