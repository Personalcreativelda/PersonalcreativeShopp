import React from 'react';
import { Leaf, Heart, Award, Users, Sprout, Shield } from 'lucide-react';
import { PageHeroBanner } from '../components/PageHeroBanner';

const SobreNos: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-base">

      <PageHeroBanner
        pageKey="sobre"
        defaultTitle="Sobre a Naturerva"
        defaultSubtitle="Somos uma empresa moçambicana dedicada a levar produtos naturais e saudáveis até à sua casa, com qualidade, confiança e cuidado."
        defaultIcon={<Leaf className="w-7 h-7" />}
        defaultBgColor="#14532d"
      />

      {/* Nossa história */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-bold text-content-primary mb-4">A Nossa História</h2>
              <p className="text-content-muted leading-relaxed mb-4">
                A Naturerva nasceu do desejo de oferecer alternativas naturais e saudáveis aos moçambicanos. Acreditamos que a natureza tem respostas para o nosso bem-estar e que todos merecem acesso a produtos de qualidade.
              </p>
              <p className="text-content-muted leading-relaxed">
                Ao longo do nosso percurso, temos trabalhado em estreita colaboração com fornecedores de confiança para garantir que cada produto que chega até si é seguro, eficaz e produzido com respeito pelo ambiente.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: <Heart className="w-6 h-6" />, label: 'Feito com amor', color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
                { icon: <Shield className="w-6 h-6" />, label: 'Produtos seguros', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
                { icon: <Sprout className="w-6 h-6" />, label: '100% Natural', color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
                { icon: <Award className="w-6 h-6" />, label: 'Alta qualidade', color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-surface-base dark:bg-white/[0.04] text-center">
                  <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.color}`}>{item.icon}</span>
                  <span className="text-sm font-medium text-content-secondary">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Missão, Visão, Valores */}
      <section className="py-16 px-6 bg-surface-base">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-content-primary text-center mb-10">Os Nossos Princípios</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Missão',
                text: 'Proporcionar acesso a produtos naturais de qualidade, contribuindo para o bem-estar e saúde das famílias moçambicanas.',
                color: 'border-green-400',
              },
              {
                title: 'Visão',
                text: 'Ser a referência de confiança em produtos naturais e saudáveis em Moçambique, reconhecidos pela qualidade e excelência no atendimento.',
                color: 'border-blue-400',
              },
              {
                title: 'Valores',
                text: 'Transparência, qualidade, respeito pelo cliente, responsabilidade ambiental e comprometimento com o bem-estar natural.',
                color: 'border-emerald-400',
              },
            ].map((item, i) => (
              <div key={i} className={`bg-surface-raised rounded-2xl p-6 border-t-4 ${item.color} shadow-sm`}>
                <h3 className="font-bold text-content-primary mb-3">{item.title}</h3>
                <p className="text-sm text-content-muted leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Equipa */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-xl mb-4">
            <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-content-primary mb-4">A Nossa Equipa</h2>
          <p className="text-content-muted max-w-2xl mx-auto leading-relaxed">
            A Naturerva é formada por pessoas apaixonadas por saúde natural, comprometidas em oferecer o melhor serviço e os melhores produtos. Estamos sempre disponíveis para ajudar e aconselhar os nossos clientes.
          </p>
        </div>
      </section>

    </div>
  );
};

export default SobreNos;
