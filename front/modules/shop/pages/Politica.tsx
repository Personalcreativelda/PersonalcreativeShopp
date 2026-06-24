import React from 'react';
import { Shield, RefreshCw, Truck, Lock, AlertCircle } from 'lucide-react';
import { PageHeroBanner } from '../components/PageHeroBanner';

const sections = [
  {
    icon: <Truck className="w-5 h-5" />,
    title: 'Política de Entrega',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    items: [
      'As entregas são realizadas nas zonas cobertas pela Naturerva em Maputo e arredores.',
      'O prazo de entrega é de 1 a 3 dias úteis após confirmação do pagamento.',
      'A taxa de entrega varia conforme a zona e é indicada no momento do checkout.',
      'Entregas gratuitas poderão estar disponíveis mediante promoções ou valor mínimo de encomenda.',
      'O cliente será contactado para confirmação do endereço antes da entrega.',
    ],
  },
  {
    icon: <RefreshCw className="w-5 h-5" />,
    title: 'Política de Devolução e Reembolso',
    color: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    items: [
      'Aceitamos devoluções no prazo de 7 dias após a receção do produto.',
      'O produto deve estar em perfeito estado, na embalagem original e sem sinais de uso.',
      'Produtos com defeito ou danificados durante o transporte são substituídos sem custo adicional.',
      'Para iniciar um processo de devolução, contacte-nos através dos nossos canais de atendimento.',
      'O reembolso é processado no prazo de 5 a 10 dias úteis após aprovação.',
    ],
  },
  {
    icon: <Lock className="w-5 h-5" />,
    title: 'Política de Privacidade',
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
    items: [
      'Os seus dados pessoais são recolhidos apenas para processar as suas encomendas e melhorar a sua experiência.',
      'Não partilhamos os seus dados com terceiros sem o seu consentimento, exceto quando necessário para a entrega.',
      'Os seus dados são armazenados de forma segura e protegida.',
      'Pode solicitar a eliminação dos seus dados pessoais a qualquer momento através do nosso email.',
      'Utilizamos cookies para melhorar a navegação no nosso site.',
    ],
  },
  {
    icon: <AlertCircle className="w-5 h-5" />,
    title: 'Termos Gerais',
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
    items: [
      'Os preços apresentados no site estão em Meticais (MT) e incluem todos os impostos aplicáveis.',
      'A Naturerva reserva-se o direito de alterar os preços sem aviso prévio.',
      'As imagens dos produtos são meramente ilustrativas e podem diferir ligeiramente do produto real.',
      'A Naturerva não se responsabiliza por atrasos causados por fatores externos ao nosso controlo.',
      'Para qualquer dúvida ou reclamação, entre em contacto connosco.',
    ],
  },
];

const Politica: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-base">

      <PageHeroBanner
        pageKey="politica"
        defaultTitle="Nossa Política"
        defaultSubtitle="Transparência e confiança em cada compra. Conheça os nossos compromissos consigo."
        defaultIcon={<Shield className="w-7 h-7" />}
        defaultBgColor="#1d4ed8"
      />

      {/* Sections */}
      <section className="py-14 px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {sections.map((section, i) => (
            <div key={i} className="bg-surface-base rounded-2xl p-6 border border-border-default">
              <div className="flex items-center gap-3 mb-5">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${section.color}`}>
                  {section.icon}
                </span>
                <h2 className="text-lg font-bold text-content-primary">{section.title}</h2>
              </div>
              <ul className="space-y-3">
                {section.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-content-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};

export default Politica;
