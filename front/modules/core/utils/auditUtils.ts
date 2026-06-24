/**
 * Utilitários para Auditoria
 * 
 * Funções auxiliares para o sistema de auditoria.
 */

/**
 * Obter IP do cliente (melhor esforço)
 * Nota: Em produção, considere usar um serviço backend para obter o IP real
 */
export const getClientIP = async (): Promise<string> => {
    try {
        // Em produção, isso deve vir do backend
        // Por enquanto, retornamos um placeholder
        return 'client-ip';
    } catch (error) {
        return 'unknown';
    }
};

/**
 * Obter User Agent do navegador
 */
export const getUserAgent = (): string => {
    return navigator.userAgent || 'unknown';
};

/**
 * Sanitizar dados sensíveis antes de logar
 * Remove campos como senhas, tokens, etc.
 */
export const sanitizeData = (data: any): any => {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const sensitiveFields = [
        'password',
        'senha',
        'token',
        'access_token',
        'refresh_token',
        'api_key',
        'secret',
        'credit_card',
        'cvv',
        'ssn',
    ];

    const sanitized = { ...data };

    for (const key in sanitized) {
        const lowerKey = key.toLowerCase();

        // Remover campos sensíveis
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
            sanitized[key] = '***REDACTED***';
        }

        // Recursivamente sanitizar objetos aninhados
        else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeData(sanitized[key]);
        }
    }

    return sanitized;
};

/**
 * Formatar diferenças entre dois objetos
 * Retorna apenas os campos que foram alterados
 */
export const formatDiff = (oldData: any, newData: any): {
    changed: Record<string, { old: any; new: any }>;
    added: Record<string, any>;
    removed: Record<string, any>;
} => {
    const changed: Record<string, { old: any; new: any }> = {};
    const added: Record<string, any> = {};
    const removed: Record<string, any> = {};

    // Campos alterados
    for (const key in newData) {
        if (oldData && key in oldData) {
            if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                changed[key] = { old: oldData[key], new: newData[key] };
            }
        } else {
            added[key] = newData[key];
        }
    }

    // Campos removidos
    if (oldData) {
        for (const key in oldData) {
            if (!(key in newData)) {
                removed[key] = oldData[key];
            }
        }
    }

    return { changed, added, removed };
};

/**
 * Obter label amigável para ações
 */
export const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
        create: 'Criado',
        update: 'Atualizado',
        delete: 'Apagado',
        login: 'Login',
        logout: 'Logout',
        login_failed: 'Tentativa de Login Falhada',
        password_change: 'Senha Alterada',
        role_assigned: 'Role Atribuído',
        role_removed: 'Role Removido',
        approval_requested: 'Aprovação Solicitada',
        approval_approved: 'Aprovação Concedida',
        approval_rejected: 'Aprovação Rejeitada',
        stock_adjusted: 'Stock Ajustado',
        export: 'Exportado',
        import: 'Importado',
        settings_changed: 'Configurações Alteradas',
    };

    return labels[action] || action;
};

/**
 * Obter label amigável para tipos de entidade
 */
export const getEntityTypeLabel = (entityType: string): string => {
    const labels: Record<string, string> = {
        product: 'Produto',
        sale: 'Venda',
        purchase: 'Compra',
        customer: 'Cliente',
        supplier: 'Fornecedor',
        stock_movement: 'Movimento de Stock',
        user: 'Utilizador',
        role: 'Role',
        approval: 'Aprovação',
        setting: 'Configuração',
    };

    return labels[entityType] || entityType;
};

/**
 * Obter cor para tipo de ação (para UI)
 */
export const getActionColor = (action: string): string => {
    const colors: Record<string, string> = {
        create: 'text-green-600',
        update: 'text-blue-600',
        delete: 'text-red-600',
        login: 'text-purple-600',
        logout: 'text-gray-600',
        login_failed: 'text-red-600',
        approval_approved: 'text-green-600',
        approval_rejected: 'text-red-600',
    };

    return colors[action] || 'text-gray-600';
};

/**
 * Obter ícone para tipo de ação
 */
export const getActionIcon = (action: string): string => {
    const icons: Record<string, string> = {
        create: '➕',
        update: '✏️',
        delete: '🗑️',
        login: '🔓',
        logout: '🔒',
        login_failed: '❌',
        password_change: '🔑',
        role_assigned: '👤',
        role_removed: '👥',
        approval_requested: '📝',
        approval_approved: '✅',
        approval_rejected: '❌',
        stock_adjusted: '📦',
        export: '📤',
        import: '📥',
        settings_changed: '⚙️',
    };

    return icons[action] || '📄';
};
