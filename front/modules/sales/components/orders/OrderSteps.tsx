import React from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

interface OrderStepsProps {
 currentStep: number;
 totalSteps: number;
 onStepChange: (step: number) => void;
 /** Step 1 (Cliente) preenchido */
 step1Valid: boolean;
 /** Step 2 (Produtos) preenchido - pelo menos um item */
 step2Valid?: boolean;
 canGoNext: boolean;
 onNext: () => void;
 onPrevious: () => void;
 onSave?: () => void;
 isSaving?: boolean;
 /** Mostra o botão Salvar em todos os steps (útil ao editar pedido existente) */
 showSaveOnAllSteps?: boolean;
}

export const OrderSteps: React.FC<OrderStepsProps> = ({
 currentStep,
 totalSteps,
 onStepChange,
 step1Valid,
 step2Valid = false,
 canGoNext,
 onNext,
 onPrevious,
 onSave,
 isSaving = false,
 showSaveOnAllSteps = false
}) => {
 const steps = [
 { number: 1, label: 'Cliente', key: 'step1' },
 { number: 2, label: 'Produtos', key: 'step2' },
 { number: 3, label: 'Entrega', key: 'step3' },
 { number: 4, label: 'Pagamento', key: 'step4' }
 ].slice(0, totalSteps);

 const isStepClickable = (stepNumber: number) => {
 if (stepNumber === 1) return true;
 if (stepNumber === 2) return step1Valid;
 if (stepNumber === 3) return step1Valid && step2Valid;
 if (stepNumber === 4) return step1Valid && step2Valid;
 return false;
 };

 return (
 <div className="mb-3">
 {/* Linha única: steps compactos + navegação */}
 <div className="flex items-center justify-between gap-3">
 {/* Steps minimalistas: só números e conetores */}
 <div className="flex items-center flex-1 min-w-0">
 {steps.map((step, index) => {
 const isActive = currentStep === step.number;
 const isCompleted = currentStep > step.number;
 const isClickable = isStepClickable(step.number);

 return (
 <React.Fragment key={step.key}>
 <button
 type="button"
 onClick={() => isClickable && onStepChange(step.number)}
 disabled={!isClickable}
 title={step.label}
 className={`flex-shrink-0 flex items-center justify-center rounded-full w-7 h-7 text-xs font-semibold transition-all ${
 isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
 } ${
 isActive
 ? 'bg-brand-600 text-white ring-2 ring-brand-300 dark:ring-brand-800'
 : isCompleted
 ? 'bg-green-500 text-white'
 : 'bg-surface-base text-content-secondary'
 }`}
 >
 {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.number}
 </button>
 {index < steps.length - 1 && (
 <div
 className={`flex-1 min-w-[8px] h-0.5 mx-1 transition-colors ${
 isCompleted ? 'bg-green-500' : 'bg-surface-base'
 }`}
 />
 )}
 </React.Fragment>
 );
 })}
 </div>

 {/* Navegação compacta */}
 <div className="flex items-center gap-2 flex-shrink-0">
 <button
 onClick={onPrevious}
 disabled={currentStep === 1}
 className={`p-1.5 rounded-md transition-colors ${
 currentStep === 1
 ? 'text-content-muted cursor-not-allowed'
 : 'text-content-secondary hover:bg-surface-base'
 }`}
 title="Anterior"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 <span className="text-xs text-content-muted tabular-nums w-14 text-center">
 {currentStep}/{totalSteps}
 </span>
 {currentStep < totalSteps ? (
 <>
 {showSaveOnAllSteps && onSave && (
 <button
 onClick={onSave}
 disabled={isSaving}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isSaving ? (
 <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
 ) : (
 <CheckCircle2 className="w-3.5 h-3.5" />
 )}
 <span>Salvar</span>
 </button>
 )}
 <button
 onClick={onNext}
 disabled={!canGoNext}
 className={`p-1.5 rounded-md transition-colors ${
 canGoNext
 ? 'text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20'
 : 'text-content-muted cursor-not-allowed'
 }`}
 title="Próximo"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </>
 ) : (
 <button
 onClick={onSave}
 disabled={isSaving}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isSaving ? (
 <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
 ) : (
 <CheckCircle2 className="w-3.5 h-3.5" />
 )}
 <span>Salvar</span>
 </button>
 )}
 </div>
 </div>
 </div>
 );
};


