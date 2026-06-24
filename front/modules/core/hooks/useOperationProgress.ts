/**
 * Hook para gerir operações críticas com indicador de progresso.
 * Garante que o utilizador não saia da página durante operações.
 */
import { useState, useCallback } from 'react';

export interface OperationState {
  isInProgress: boolean;
  title: string;
  message: string;
  progress: {
    current: number;
    total: number;
  } | null;
}

export interface UseOperationProgressReturn {
  operationState: OperationState;
  startOperation: (title: string, message?: string, total?: number) => void;
  updateProgress: (current: number, message?: string) => void;
  endOperation: () => void;
  runWithProgress: <T>(
    title: string,
    operation: () => Promise<T>,
    message?: string
  ) => Promise<T>;
  runBatchWithProgress: <T>(
    title: string,
    items: T[],
    operation: (item: T, index: number) => Promise<void>,
    getMessage?: (item: T, index: number) => string
  ) => Promise<{ success: number; failed: number; errors: string[] }>;
}

const initialState: OperationState = {
  isInProgress: false,
  title: '',
  message: '',
  progress: null
};

export function useOperationProgress(): UseOperationProgressReturn {
  const [operationState, setOperationState] = useState<OperationState>(initialState);

  const startOperation = useCallback((title: string, message = 'A processar...', total?: number) => {
    setOperationState({
      isInProgress: true,
      title,
      message,
      progress: total ? { current: 0, total } : null
    });
  }, []);

  const updateProgress = useCallback((current: number, message?: string) => {
    setOperationState(prev => ({
      ...prev,
      message: message || prev.message,
      progress: prev.progress ? { ...prev.progress, current } : null
    }));
  }, []);

  const endOperation = useCallback(() => {
    setOperationState(initialState);
  }, []);

  // Executar operação única com overlay
  const runWithProgress = useCallback(async <T,>(
    title: string,
    operation: () => Promise<T>,
    message = 'A processar...'
  ): Promise<T> => {
    startOperation(title, message);
    try {
      const result = await operation();
      return result;
    } finally {
      endOperation();
    }
  }, [startOperation, endOperation]);

  // Executar operações em batch com progresso
  const runBatchWithProgress = useCallback(async <T,>(
    title: string,
    items: T[],
    operation: (item: T, index: number) => Promise<void>,
    getMessage?: (item: T, index: number) => string
  ): Promise<{ success: number; failed: number; errors: string[] }> => {
    const total = items.length;
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    startOperation(title, getMessage?.(items[0], 0) || `A processar item 1 de ${total}...`, total);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const message = getMessage?.(item, i) || `A processar item ${i + 1} de ${total}...`;
      updateProgress(i, message);

      try {
        await operation(item, i);
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`Item ${i + 1}: ${error.message || 'Erro desconhecido'}`);
      }
    }

    // Mostrar conclusão brevemente
    updateProgress(total, `Concluído: ${success} sucesso, ${failed} falhas`);
    
    // Pequeno delay para mostrar resultado
    await new Promise(resolve => setTimeout(resolve, 500));
    
    endOperation();

    return { success, failed, errors };
  }, [startOperation, updateProgress, endOperation]);

  return {
    operationState,
    startOperation,
    updateProgress,
    endOperation,
    runWithProgress,
    runBatchWithProgress
  };
}

export default useOperationProgress;
