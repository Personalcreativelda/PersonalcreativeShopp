export type Language = 'pt' | 'en' | 'changana';

export interface Translations {
  // Common
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    filter: string;
    loading: string;
    error: string;
    success: string;
    confirm: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    actions: string;
    select: string;
    selectAll: string;
    deselectAll: string;
    noData: string;
    yes: string;
    no: string;
    view: string;
    download: string;
    upload: string;
    export: string;
    import: string;
    print: string;
  };

  // Navigation
  nav: {
    dashboard: string;
    orders: string;
    sales: string;
    stock: string;
    production: string;
    customers: string;
    products: string;
    finance: string;
    reports: string;
    settings: string;
    deliveries: string;
    purchases: string;
    gallery: string;
    users: string;
    statistics: string;
  };

  // Auth
  auth: {
    login: string;
    logout: string;
    email: string;
    password: string;
    rememberMe: string;
    enterSystem: string;
    loginError: string;
    unexpectedError: string;
  };

  // Settings
  settings: {
    title: string;
    language: string;
    languageDescription: string;
    theme: string;
    darkMode: string;
    lightMode: string;
    database: string;
    databaseConfig: string;
    devMode: string;
  };

  // Dashboard
  dashboard: {
    title: string;
    totalOrders: string;
    totalCustomers: string;
    totalSales: string;
    pendingOrders: string;
  };

  // Orders
  orders: {
    title: string;
    addOrder: string;
    editOrder: string;
    deleteOrder: string;
    orderStatus: string;
    customerName: string;
    totalAmount: string;
    createdAt: string;
    newOrder: string;
    orderNumber: string;
    orderDate: string;
    deliveryDate: string;
    items: string;
    subtotal: string;
    tax: string;
    discount: string;
    notes: string;
  };

  // General UI
  ui: {
    naturErva: string;
    crmManagement: string;
    systemTitle: string;
    admin: string;
    staff: string;
  };

  // Stock Management
  stock: {
    title: string;
    audit: string;
    auditTitle: string;
    startAudit: string;
    completeAudit: string;
    productName: string;
    systemQuantity: string;
    countedQuantity: string;
    difference: string;
    status: string;
    movements: string;
    adjustment: string;
    adjustmentReason: string;
    lowStockAlert: string;
    outOfStock: string;
    inStock: string;
    quantity: string;
    unit: string;
    location: string;
    lastUpdated: string;
    addMovement: string;
    movementType: string;
    movementDate: string;
    reference: string;
    exportPDF: string;
    auditCreatedSuccess: string;
    errorCreatingAudit: string;
    selectDateWarning: string;
    errorLoadingAudits: string;
    auditDeleted: string;
    errorDeletingAudit: string;
    adjustmentsTitle: string;
    adjustmentsDescription: string;
    newAdjustment: string;
    noAdjustments: string;
    deleteAdjustmentConfirm: string;
    adjustmentDeleted: string;
    errorDeletingAdjustment: string;
    deleteSelected: string;
    confirmDeleteAdjustments: string;
    adjustmentsBulkDeleted: string;
    adjustmentsBulkDeletePartial: string;
    selectedCount: string;
    filterByReason: string;
    filterByPeriod: string;
    filterByPeriodEnd: string;
    adjustmentsList: string;
    entries: string;
    exits: string;
    reasons: {
      damaged: string;
      loss: string;
      correction: string;
      expired: string;
      return: string;
      other: string;
    };
  };

  // Purchases
  purchases: {
    title: string;
    newPurchase: string;
    supplier: string;
    purchaseOrder: string;
    orderDate: string;
    deliveryDate: string;
    totalAmount: string;
    status: string;
    pending: string;
    received: string;
    cancelled: string;
    addSupplier: string;
    supplierName: string;
    supplierContact: string;
    supplierEmail: string;
    paymentTerms: string;
    paymentStatus: string;
    paid: string;
    unpaid: string;
    partiallyPaid: string;
  };

  // Media/Gallery
  media: {
    title: string;
    uploadImage: string;
    uploadVideo: string;
    gallery: string;
    myUploads: string;
    fileSize: string;
    uploadDate: string;
    delete: string;
    download: string;
    fileName: string;
    fileType: string;
    dimensions: string;
    selectFile: string;
    dragDropFile: string;
  };

  // Users
  users: {
    title: string;
    allUsers: string;
    staff: string;
    clients: string;
    newUser: string;
    editUser: string;
    deleteUser: string;
    userName: string;
    userEmail: string;
    userRole: string;
    userStatus: string;
    active: string;
    inactive: string;
    permissions: string;
    phone: string;
    address: string;
    createdAt: string;
    lastLogin: string;
  };

  // Products
  products: {
    title: string;
    addProduct: string;
    editProduct: string;
    deleteProduct: string;
    productName: string;
    productCode: string;
    category: string;
    price: string;
    cost: string;
    stock: string;
    description: string;
    image: string;
    active: string;
    inactive: string;
    categories: string;
    units: string;
    addCategory: string;
    addUnit: string;
  };

  // Forms & Validation
  forms: {
    required: string;
    optional: string;
    invalidEmail: string;
    invalidPhone: string;
    passwordTooShort: string;
    passwordMismatch: string;
    selectOption: string;
    uploadFile: string;
    dragDropFile: string;
    minLength: string;
    maxLength: string;
    invalidFormat: string;
    fieldRequired: string;
  };

  // Modals
  modals: {
    confirmDelete: string;
    confirmDeleteMessage: string;
    confirmCancel: string;
    confirmCancelMessage: string;
    unsavedChanges: string;
    unsavedChangesMessage: string;
    areYouSure: string;
    proceedAction: string;
    cancelAction: string;
  };

  // System Messages
  messages: {
    saveSuccess: string;
    saveError: string;
    deleteSuccess: string;
    deleteError: string;
    updateSuccess: string;
    updateError: string;
    loadError: string;
    networkError: string;
    permissionDenied: string;
    sessionExpired: string;
    operationSuccess: string;
    operationFailed: string;
    invalidData: string;
    duplicateEntry: string;
  };

  // Finance
  finance: {
    title: string;
    selectEntity: string;
    naturErvaLoja: string;
    naturErvaProducao: string;
    naturErvaSabores: string;
    workingCapital: string;
    accountStatement: string;
    balanceSheet: string;
    incomeStatement: string;
    trialBalance: string;
    period: string;
    fromDate: string;
    toDate: string;
    generateReport: string;
    exportReport: string;
    currentAssets: string;
    currentLiabilities: string;
    workingCapitalValue: string;
    liquidityRatio: string;
    openingBalance: string;
    closingBalance: string;
    totalDebit: string;
    totalCredit: string;
    balance: string;
    revenue: string;
    expenses: string;
    grossProfit: string;
    operatingProfit: string;
    netProfit: string;
    assets: string;
    liabilities: string;
    equity: string;
    total: string;
    sales: string;
    costOfGoodsSold: string;
    operatingExpenses: string;
    otherExpenses: string;
    otherRevenue: string;
  };

  // Reports
  reports: {
    title: string;
    selectCategory: string;
    selectReport: string;
    selectEntity: string;
    period: string;
    generateReport: string;
    exportReport: string;
    categories: {
      financial: string;
      sales: string;
      stock: string;
      production: string;
      customers: string;
      orders: string;
    };
    financial: {
      workingCapital: string;
      accountStatement: string;
      balanceSheet: string;
      incomeStatement: string;
      trialBalance: string;
    };
    sales: {
      salesSummary: string;
      salesByProduct: string;
      salesByPeriod: string;
      salesTrends: string;
      topProducts: string;
    };
    stock: {
      stockSummary: string;
      stockMovements: string;
      lowStock: string;
      stockValuation: string;
    };
    production: {
      productionSummary: string;
      productionByCategory: string;
      consumptionReport: string;
      animalMovements: string;
    };
    customers: {
      customersSummary: string;
      loyaltyReport: string;
      customerSegments: string;
      topCustomers: string;
    };
    orders: {
      ordersSummary: string;
      ordersByStatus: string;
      ordersByPeriod: string;
      pendingOrders: string;
    };
  };
}

export const translations: Record<Language, Translations> = {
  pt: {
    common: {
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Apagar',
      edit: 'Editar',
      add: 'Adicionar',
      search: 'Pesquisar',
      filter: 'Filtrar',
      loading: 'Carregando...',
      error: 'Erro',
      success: 'Sucesso',
      confirm: 'Confirmar',
      close: 'Fechar',
      back: 'Voltar',
      next: 'Próximo',
      previous: 'Anterior',
      actions: 'Ações',
      select: 'Selecionar',
      selectAll: 'Selecionar Tudo',
      deselectAll: 'Desselecionar Tudo',
      noData: 'Sem dados disponíveis',
      yes: 'Sim',
      no: 'Não',
      view: 'Ver',
      download: 'Baixar',
      upload: 'Carregar',
      export: 'Exportar',
      import: 'Importar',
      print: 'Imprimir',
      draft: 'Rascunho',
      applied: 'Aplicada',
      completed: 'Completa',
      total: 'Total',
      description: 'Descrição',
      scope: 'Âmbito',
      date: 'Data',
      createdAt: 'Criada em',
      all: 'Todos',
      selected: 'Selecionados',
      category: 'Categoria',
      apply: 'Aplicar',
      product: 'Produto',
      additionalNotes: 'Notas adicionais (opcional)',
      outOfStock: 'Sem stock',
      noImage: 'Sem Imagem',
    },
    nav: {
      dashboard: 'Dashboard',
      orders: 'Pedidos',
      sales: 'Vendas',
      stock: 'Stock',
      production: 'Produção',
      customers: 'Clientes',
      products: 'Produtos',
      finance: 'Finanças',
      reports: 'Relatórios',
      settings: 'Configurações',
      deliveries: 'Entregas',
      purchases: 'Compras',
      gallery: 'Galeria',
      users: 'Usuários',
      statistics: 'Estatísticas',
    },
    auth: {
      login: 'Entrar',
      logout: 'Sair',
      email: 'Email',
      password: 'Password',
      rememberMe: 'Lembrar-me',
      enterSystem: 'Entrar no Sistema',
      loginError: 'Erro ao entrar.',
      unexpectedError: 'Ocorreu um erro inesperado.',
    },
    settings: {
      title: 'Configurações do Sistema',
      language: 'Idioma',
      languageDescription: 'Escolha o idioma da interface',
      theme: 'Tema',
      darkMode: 'Modo Escuro',
      lightMode: 'Modo Claro',
      database: 'Banco de Dados',
      databaseConfig: 'Configurar Conexão (Supabase)',
      devMode: 'Modo Dev: Credenciais pré-preenchidas',
    },
    dashboard: {
      title: 'Dashboard',
      overview: 'Visão Geral',
      realtimeData: 'Dados em tempo real',
      customize: 'Personalizar',
      customizeDashboard: 'Personalizar Dashboard',

      // Períodos
      today: 'Hoje',
      yesterday: 'Ontem',
      thisWeek: 'Esta Semana',
      lastWeek: 'Semana Passada',
      thisMonth: 'Este Mês',
      lastMonth: 'Mês Passado',
      thisYear: 'Este Ano',
      customPeriod: 'Período Personalizado',

      // Métricas principais
      totalOrders: 'Total de Pedidos',
      totalCustomers: 'Total de Clientes',
      totalSales: 'Total de Vendas',
      totalPurchases: 'Compras do Período',
      pendingOrders: 'Pedidos Pendentes',
      activeOrders: 'Pedidos Ativos no Período',
      completedOrders: 'Pedidos Completados',
      customersInPeriod: 'Clientes no Período',
      newCustomers: 'Novos Clientes',
      avgTicket: 'Ticket Médio',
      completionRate: 'Taxa de Conclusão',

      // Gráficos e listas
      ordersChart: 'Gráfico de Pedidos',
      salesChart: 'Gráfico de Vendas',
      topProducts: 'Top Produtos',
      topCustomers: 'Top Clientes',
      productsSoldList: 'Lista de Produtos Vendidos',
      productsPurchasedList: 'Lista de Produtos Comprados',
      deliveryStats: 'Estatísticas de Entrega',
      paymentStatus: 'Status de Pagamento',

      // Detalhes
      orders: 'pedidos',
      revenue: 'receita',
      quantity: 'quantidade',
      profitMargin: 'Margem de Lucro',
      profit: 'Lucro',
      deliveryOrders: 'Pedidos com Entrega',
      deliveryRate: 'Taxa de Entrega',
      deliveryFees: 'Taxas de Entrega',
      unpaidOrders: 'Pedidos Não Pagos',
      unpaidAmount: 'Valor Não Pago',

      // Views
      fixedView: 'Fixos',
      variableView: 'Variáveis',
      byProduct: 'Por Produto',
      byVariant: 'Por Variante',
    },
    orders: {
      title: 'Pedidos',
      addOrder: 'Adicionar Pedido',
      editOrder: 'Editar Pedido',
      deleteOrder: 'Apagar Pedido',
      orderStatus: 'Status do Pedido',
      customerName: 'Nome do Cliente',
      totalAmount: 'Valor Total',
      createdAt: 'Data de Criação',
      newOrder: 'Novo Pedido',
      orderNumber: 'Número do Pedido',
      orderDate: 'Data do Pedido',
      deliveryDate: 'Data de Entrega',
      items: 'Itens',
      subtotal: 'Subtotal',
      tax: 'Imposto',
      discount: 'Desconto',
      notes: 'Observações',
    },
    ui: {
      naturErva: 'Natur Erva',
      crmManagement: 'CRM Management',
      systemTitle: 'Sistema Integrado de Gestão',
      admin: 'Administrador',
      staff: 'Staff',
    },
    stock: {
      title: 'Gestão de Stock',
      audit: 'Auditoria',
      auditTitle: 'Auditoria de Stock',
      startAudit: 'Iniciar Auditoria',
      completeAudit: 'Completar Auditoria',
      productName: 'Nome do Produto',
      systemQuantity: 'Quantidade no Sistema',
      countedQuantity: 'Quantidade Contada',
      difference: 'Diferença',
      unitCost: 'Custo Unitário',
      totalValue: 'Valor Total',
      financialTotal: 'Total Financeiro',
      status: 'Status',
      movements: 'Movimentos',
      adjustment: 'Ajuste',
      adjustmentReason: 'Motivo do Ajuste',
      lowStockAlert: 'Alerta de Stock Baixo',
      outOfStock: 'Sem Stock',
      inStock: 'Em Stock',
      quantity: 'Quantidade',
      unit: 'Unidade',
      location: 'Localização',
      lastUpdated: 'Última Atualização',
      addMovement: 'Adicionar Movimento',
      movementType: 'Tipo de Movimento',
      auditDescription: 'Registe contagens físicas e compare com o sistema',
      auditHistory: 'Histórico de Auditorias',
      noAudits: 'Nenhuma auditoria registada',
      createFirstAudit: 'Criar Primeira Auditoria',
      registerCounts: 'Registar contagens',
      viewReport: 'Ver relatório',
      newAudit: 'Nova Auditoria de Stock',
      auditDateLabel: 'Data da Auditoria',
      descriptionOptional: 'Descrição (opcional)',
      descriptionPlaceholder: 'Ex: Auditoria mensal de Janeiro 2026',
      auditScope: 'Âmbito da Auditoria',
      allProducts: 'Todos os Produtos',
      specificProducts: 'Produtos Específicos',
      byCategory: 'Por Categoria',
      selectProducts: 'Selecionar Produtos',
      productsSelected: 'selecionados',
      selectAll: 'Selecionar Todos',
      clear: 'Limpar',
      creationNote: 'A auditoria será criada com o stock existente na data da auditoria como base. Depois poderá registar as contagens físicas e comparar com o sistema.',
      creatingAudit: 'A criar...',
      createAudit: 'Criar Auditoria',
      auditCreatedSuccess: 'Auditoria criada com sucesso',
      errorCreatingAudit: 'Erro ao criar auditoria',
      selectDateWarning: 'Selecione a data da auditoria',
      selectProductWarning: 'Selecione pelo menos um produto',
      selectCategoryWarning: 'Selecione uma categoria',
      selectCategoryPlaceholder: 'Selecione uma categoria',
      errorLoadingAudits: 'Erro ao carregar auditorias',
      onlyDraftCanDelete: 'Apenas auditorias em rascunho podem ser eliminadas',
      confirmDeleteAudit: 'Deseja eliminar a auditoria de',
      auditDeleted: 'Auditoria eliminada',
      errorDeletingAudit: 'Erro ao eliminar auditoria',
      movementDate: 'Data do Movimento',
      reference: 'Referência',
      reviewAndApprove: 'Revise e aprove os ajustes',
      reviewInstructions: 'Selecione os itens que deseja ajustar e especifique o motivo da discrepância para cada um.',
      auditReportApplyAllInstruction: 'Clique em Ajustar stock para aplicar todas as discrepâncias com o motivo: Auditoria de stock, correção do stock de acordo com a contagem.',
      showDiscrepanciesOnly: 'Mostrar apenas itens com discrepância',
      justification: 'Justificativa',
      viewMovementHistory: 'Ver histórico de movimentos',
      largeDiscrepancy: 'Discrepância grande',
      recentStockHistory: 'Histórico Recente de Stock',
      totalItems: 'Total Itens',
      discrepanciesCount: 'Discrepâncias',
      approvedCount: 'Aprovados',
      positiveCount: 'Excedentes',
      negativeCount: 'Faltantes',
      applyingAdjustments: 'A aplicar...',
      applyingProgressItem: 'Item',
      applyingProgressOf: 'de',
      applyingProgressSaving: 'A gravar no sistema...',
      applyingProgressDoNotLeave: 'Não feche esta janela. Aguarde até terminar.',
      reviewAndApply: 'Revisar e Aplicar Ajustes',
      applyAdjustmentsForAuditDate: 'Ajustar stock (para a data da auditoria)',
      errorApplyingAdjustments: 'Erro ao aplicar ajustes',
      adjustmentsAppliedSuccess: 'ajustes aplicados com sucesso',
      selectOneAtLeast: 'Selecione pelo menos um item para aplicar',
      reasonRequired: 'Todos os itens selecionados devem ter um motivo especificado',
      confirmApplyAdjustments: 'Deseja aplicar {count} ajustes ao stock do sistema?\n\nEsta ação não pode ser revertida.',
      loadingReport: 'A carregar relatório...',
      noItemsFound: 'Nenhum produto encontrado com os filtros selecionados.',
      movementHistory: 'Histórico de Movimentos',
      lastMovements: 'últimos {count}',
      until: 'Até',
      totalVariation: 'Variação total (histórico)',
      noMovementsFound: 'Nenhum movimento encontrado',
      loadingHistory: 'A carregar histórico...',
      movementTypes: {
        purchase: 'Compra',
        order: 'Venda/Pedido',
        adjustment: 'Ajuste',
        transfer: 'Transferência',
        return: 'Devolução',
        waste: 'Quebra/Perda',
        generic: 'Movimento',
      },
      reasons: {
        damaged: 'Produto Danificado',
        loss: 'Perda/Roubo',
        correction: 'Erro de Contagem Anterior',
        expired: 'Produto Expirado',
        return: 'Devolução',
        other: 'Outro',
      },
      exportPDF: 'Exportar PDF',
      adjustmentsTitle: 'Ajustes de Stock',
      adjustmentsDescription: 'Lista e controle de ajustes de stock (estragados, devoluções, correções, etc.)',
      newAdjustment: 'Novo ajuste',
      noAdjustments: 'Nenhum ajuste encontrado',
      deleteAdjustmentConfirm: 'Eliminar este ajuste reverte o stock. Continuar?',
      adjustmentDeleted: 'Ajuste eliminado',
      errorDeletingAdjustment: 'Erro ao eliminar ajuste',
      deleteSelected: 'Eliminar selecionados',
      confirmDeleteAdjustments: 'Eliminar {count} ajuste(s)? O stock será revertido para cada um. Continuar?',
      adjustmentsBulkDeleted: '{count} ajustes eliminados',
      adjustmentsBulkDeletePartial: '{deleted} eliminados, {failed} falharam',
      selectedCount: 'selecionado(s)',
      filterByReason: 'Todos os motivos',
      filterByPeriod: 'desde',
      filterByPeriodEnd: 'até',
      adjustmentsList: 'Lista de ajustes',
      entries: 'Entradas',
      exits: 'Saídas',
    },
    purchases: {
      title: 'Compras',
      newPurchase: 'Nova Compra',
      supplier: 'Fornecedor',
      purchaseOrder: 'Ordem de Compra',
      orderDate: 'Data do Pedido',
      deliveryDate: 'Data de Entrega',
      totalAmount: 'Valor Total',
      status: 'Status',
      pending: 'Pendente',
      received: 'Recebido',
      cancelled: 'Cancelado',
      addSupplier: 'Adicionar Fornecedor',
      supplierName: 'Nome do Fornecedor',
      supplierContact: 'Contacto do Fornecedor',
      supplierEmail: 'Email do Fornecedor',
      paymentTerms: 'Condições de Pagamento',
      paymentStatus: 'Status de Pagamento',
      paid: 'Pago',
      unpaid: 'Não Pago',
      partiallyPaid: 'Parcialmente Pago',
    },
    media: {
      title: 'Galeria',
      uploadImage: 'Carregar Imagem',
      uploadVideo: 'Carregar Vídeo',
      gallery: 'Galeria',
      myUploads: 'Meus Uploads',
      fileSize: 'Tamanho do Arquivo',
      uploadDate: 'Data de Upload',
      delete: 'Apagar',
      download: 'Baixar',
      fileName: 'Nome do Arquivo',
      fileType: 'Tipo de Arquivo',
      dimensions: 'Dimensões',
      selectFile: 'Selecionar Arquivo',
      dragDropFile: 'Arraste e solte o arquivo aqui',
    },
    users: {
      title: 'Usuários',
      allUsers: 'Todos os Usuários',
      staff: 'Staff',
      clients: 'Clientes',
      newUser: 'Novo Usuário',
      editUser: 'Editar Usuário',
      deleteUser: 'Apagar Usuário',
      userName: 'Nome do Usuário',
      userEmail: 'Email do Usuário',
      userRole: 'Função do Usuário',
      userStatus: 'Status do Usuário',
      active: 'Ativo',
      inactive: 'Inativo',
      permissions: 'Permissões',
      phone: 'Telefone',
      address: 'Endereço',
      createdAt: 'Data de Criação',
      lastLogin: 'Último Login',
    },
    products: {
      title: 'Produtos',
      addProduct: 'Adicionar Produto',
      editProduct: 'Editar Produto',
      deleteProduct: 'Apagar Produto',
      productName: 'Nome do Produto',
      productCode: 'Código do Produto',
      category: 'Categoria',
      price: 'Preço',
      cost: 'Custo',
      stock: 'Stock',
      description: 'Descrição',
      image: 'Imagem',
      active: 'Ativo',
      inactive: 'Inativo',
      categories: 'Categorias',
      units: 'Unidades',
      addCategory: 'Adicionar Categoria',
      addUnit: 'Adicionar Unidade',
    },
    forms: {
      required: 'Obrigatório',
      optional: 'Opcional',
      invalidEmail: 'Email inválido',
      invalidPhone: 'Telefone inválido',
      passwordTooShort: 'Password muito curta',
      passwordMismatch: 'Passwords não coincidem',
      selectOption: 'Selecione uma opção',
      uploadFile: 'Carregar arquivo',
      dragDropFile: 'Arraste e solte o arquivo',
      minLength: 'Comprimento mínimo',
      maxLength: 'Comprimento máximo',
      invalidFormat: 'Formato inválido',
      fieldRequired: 'Este campo é obrigatório',
    },
    modals: {
      confirmDelete: 'Confirmar Exclusão',
      confirmDeleteMessage: 'Tem certeza que deseja apagar este item?',
      confirmCancel: 'Confirmar Cancelamento',
      confirmCancelMessage: 'Tem certeza que deseja cancelar?',
      unsavedChanges: 'Alterações Não Guardadas',
      unsavedChangesMessage: 'Você tem alterações não guardadas. Deseja continuar?',
      areYouSure: 'Tem certeza?',
      proceedAction: 'Continuar',
      cancelAction: 'Cancelar',
    },
    messages: {
      saveSuccess: 'Guardado com sucesso!',
      saveError: 'Erro ao guardar',
      deleteSuccess: 'Apagado com sucesso!',
      deleteError: 'Erro ao apagar',
      updateSuccess: 'Atualizado com sucesso!',
      updateError: 'Erro ao atualizar',
      loadError: 'Erro ao carregar dados',
      networkError: 'Erro de conexão',
      permissionDenied: 'Permissão negada',
      sessionExpired: 'Sessão expirada',
      operationSuccess: 'Operação realizada com sucesso!',
      operationFailed: 'Operação falhou',
      invalidData: 'Dados inválidos',
      duplicateEntry: 'Entrada duplicada',
    },
    finance: {
      title: 'Finanças',
      selectEntity: 'Selecionar Entidade',
      naturErvaLoja: 'Natur Erva Loja',
      naturErvaProducao: 'Natur Erva Produção',
      naturErvaSabores: 'Natur Erva Sabores',
      workingCapital: 'Fundo de Maneio',
      accountStatement: 'Extrato de Contas',
      balanceSheet: 'Balanço',
      incomeStatement: 'Demonstração de Resultados',
      trialBalance: 'Balancete',
      period: 'Período',
      fromDate: 'Data Início',
      toDate: 'Data Fim',
      generateReport: 'Gerar Relatório',
      exportReport: 'Exportar Relatório',
      currentAssets: 'Ativos Correntes',
      currentLiabilities: 'Passivos Correntes',
      workingCapitalValue: 'Fundo de Maneio',
      liquidityRatio: 'Razão de Liquidez',
      openingBalance: 'Saldo Inicial',
      closingBalance: 'Saldo Final',
      totalDebit: 'Total Débito',
      totalCredit: 'Total Crédito',
      balance: 'Saldo',
      revenue: 'Receitas',
      expenses: 'Despesas',
      grossProfit: 'Lucro Bruto',
      operatingProfit: 'Lucro Operacional',
      netProfit: 'Lucro Líquido',
      assets: 'Ativos',
      liabilities: 'Passivos',
      equity: 'Património Líquido',
      total: 'Total',
      sales: 'Vendas',
      costOfGoodsSold: 'Custo das Mercadorias Vendidas',
      operatingExpenses: 'Despesas Operacionais',
      otherExpenses: 'Outras Despesas',
      otherRevenue: 'Outras Receitas',
    },
    reports: {
      title: 'Relatórios',
      selectCategory: 'Selecionar Categoria',
      selectReport: 'Selecionar Relatório',
      selectEntity: 'Selecionar Entidade',
      period: 'Período',
      generateReport: 'Gerar Relatório',
      exportReport: 'Exportar Relatório',
      categories: {
        financial: 'Financeiros',
        sales: 'Vendas',
        stock: 'Stock',
        production: 'Produção',
        customers: 'Clientes',
        orders: 'Pedidos',
      },
      financial: {
        workingCapital: 'Fundo de Maneio',
        accountStatement: 'Extrato de Contas',
        balanceSheet: 'Balanço',
        incomeStatement: 'Demonstração de Resultados',
        trialBalance: 'Balancete',
      },
      sales: {
        salesSummary: 'Resumo de Vendas',
        salesByProduct: 'Vendas por Produto',
        salesByPeriod: 'Vendas por Período',
        salesTrends: 'Tendências de Vendas',
        topProducts: 'Produtos Mais Vendidos',
      },
      stock: {
        stockSummary: 'Resumo de Stock',
        stockMovements: 'Movimentos de Stock',
        lowStock: 'Stock Baixo',
        stockValuation: 'Avaliação de Stock',
      },
      production: {
        productionSummary: 'Resumo de Produção',
        productionByCategory: 'Produção por Categoria',
        consumptionReport: 'Relatório de Consumo',
        animalMovements: 'Movimentos de Animais',
      },
      customers: {
        customersSummary: 'Resumo de Clientes',
        customerSegments: 'Segmentos de Clientes',
        topCustomers: 'Top Clientes',
      },
      orders: {
        ordersSummary: 'Resumo de Pedidos',
        ordersByStatus: 'Pedidos por Status',
        ordersByPeriod: 'Pedidos por Período',
        pendingOrders: 'Pedidos Pendentes',
      },
    },
  },
  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
      filter: 'Filter',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      confirm: 'Confirm',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      actions: 'Actions',
      select: 'Select',
      selectAll: 'Select All',
      deselectAll: 'Deselect All',
      noData: 'No data available',
      yes: 'Yes',
      no: 'No',
      view: 'View',
      download: 'Download',
      upload: 'Upload',
      export: 'Export',
      import: 'Import',
      print: 'Print',
      draft: 'Draft',
      applied: 'Applied',
      completed: 'Completed',
      total: 'Total',
      description: 'Description',
      scope: 'Scope',
      date: 'Date',
      createdAt: 'Created At',
      all: 'All',
      selected: 'Selected',
      category: 'Category',
      apply: 'Apply',
      product: 'Product',
      additionalNotes: 'Additional notes (optional)',
      outOfStock: 'Out of stock',
      noImage: 'No Image',
    },
    nav: {
      dashboard: 'Dashboard',
      orders: 'Orders',
      sales: 'Sales',
      stock: 'Stock',
      production: 'Production',
      customers: 'Customers',
      products: 'Products',
      finance: 'Finance',
      reports: 'Reports',
      settings: 'Settings',
      deliveries: 'Deliveries',
      purchases: 'Purchases',
      gallery: 'Gallery',
      users: 'Users',
      statistics: 'Statistics',
    },
    auth: {
      login: 'Login',
      logout: 'Logout',
      email: 'Email',
      password: 'Password',
      rememberMe: 'Remember Me',
      enterSystem: 'Enter System',
      loginError: 'Login error.',
      unexpectedError: 'An unexpected error occurred.',
    },
    settings: {
      title: 'System Settings',
      language: 'Language',
      languageDescription: 'Choose the interface language',
      theme: 'Theme',
      darkMode: 'Dark Mode',
      lightMode: 'Light Mode',
      database: 'Database',
      databaseConfig: 'Configure Connection (Supabase)',
      devMode: 'Dev Mode: Pre-filled credentials',
    },
    dashboard: {
      title: 'Dashboard',
      overview: 'Overview',
      realtimeData: 'Real-time data',
      customize: 'Customize',
      customizeDashboard: 'Customize Dashboard',

      // Periods
      today: 'Today',
      yesterday: 'Yesterday',
      thisWeek: 'This Week',
      lastWeek: 'Last Week',
      thisMonth: 'This Month',
      lastMonth: 'Last Month',
      thisYear: 'This Year',
      customPeriod: 'Custom Period',

      // Main metrics
      totalOrders: 'Total Orders',
      totalCustomers: 'Total Customers',
      totalSales: 'Total Sales',
      totalPurchases: 'Period Purchases',
      pendingOrders: 'Pending Orders',
      activeOrders: 'Active Orders in Period',
      completedOrders: 'Completed Orders',
      customersInPeriod: 'Customers in Period',
      newCustomers: 'New Customers',
      avgTicket: 'Average Ticket',
      completionRate: 'Completion Rate',

      // Charts and lists
      ordersChart: 'Orders Chart',
      salesChart: 'Sales Chart',
      topProducts: 'Top Products',
      topCustomers: 'Top Customers',
      productsSoldList: 'Products Sold List',
      productsPurchasedList: 'Products Purchased List',
      deliveryStats: 'Delivery Statistics',
      paymentStatus: 'Payment Status',

      // Details
      orders: 'orders',
      revenue: 'revenue',
      quantity: 'quantity',
      profitMargin: 'Profit Margin',
      profit: 'Profit',
      deliveryOrders: 'Delivery Orders',
      deliveryRate: 'Delivery Rate',
      deliveryFees: 'Delivery Fees',
      unpaidOrders: 'Unpaid Orders',
      unpaidAmount: 'Unpaid Amount',

      // Views
      fixedView: 'Fixed',
      variableView: 'Variable',
      byProduct: 'By Product',
      byVariant: 'By Variant',
    },
    orders: {
      title: 'Orders',
      addOrder: 'Add Order',
      editOrder: 'Edit Order',
      deleteOrder: 'Delete Order',
      orderStatus: 'Order Status',
      customerName: 'Customer Name',
      totalAmount: 'Total Amount',
      createdAt: 'Created At',
      newOrder: 'New Order',
      orderNumber: 'Order Number',
      orderDate: 'Order Date',
      deliveryDate: 'Delivery Date',
      items: 'Items',
      subtotal: 'Subtotal',
      tax: 'Tax',
      discount: 'Discount',
      notes: 'Notes',
    },
    ui: {
      naturErva: 'Natur Erva',
      crmManagement: 'CRM Management',
      systemTitle: 'Integrated Management System',
      admin: 'Administrator',
      staff: 'Staff',
    },
    stock: {
      title: 'Stock Management',
      audit: 'Audit',
      auditTitle: 'Stock Audit',
      startAudit: 'Start Audit',
      completeAudit: 'Complete Audit',
      productName: 'Product Name',
      systemQuantity: 'System Quantity',
      countedQuantity: 'Counted Quantity',
      difference: 'Difference',
      unitCost: 'Unit Cost',
      totalValue: 'Total Value',
      financialTotal: 'Financial Total',
      status: 'Status',
      movements: 'Movements',
      adjustment: 'Adjustment',
      adjustmentReason: 'Adjustment Reason',
      lowStockAlert: 'Low Stock Alert',
      outOfStock: 'Out of Stock',
      inStock: 'In Stock',
      quantity: 'Quantity',
      unit: 'Unit',
      location: 'Location',
      lastUpdated: 'Last Updated',
      addMovement: 'Add Movement',
      movementType: 'Movement Type',
      auditDescription: 'Record physical counts and compare with system',
      auditHistory: 'Audit History',
      noAudits: 'No audits registered',
      createFirstAudit: 'Create First Audit',
      registerCounts: 'Register counts',
      viewReport: 'View report',
      newAudit: 'New Stock Audit',
      auditDateLabel: 'Audit Date',
      descriptionOptional: 'Description (optional)',
      descriptionPlaceholder: 'Ex: Monthly audit January 2026',
      auditScope: 'Audit Scope',
      allProducts: 'All Products',
      specificProducts: 'Specific Products',
      byCategory: 'By Category',
      selectProducts: 'Select Products',
      productsSelected: 'selected',
      selectAll: 'Select All',
      clear: 'Clear',
      creationNote: 'The audit will be created with the stock existing on the audit date as the base. You can then record physical counts and compare with the system.',
      creatingAudit: 'Creating...',
      createAudit: 'Create Audit',
      auditCreatedSuccess: 'Audit created successfully',
      errorCreatingAudit: 'Error creating audit',
      selectDateWarning: 'Select the audit date',
      selectProductWarning: 'Select at least one product',
      selectCategoryWarning: 'Select a category',
      selectCategoryPlaceholder: 'Select a category',
      errorLoadingAudits: 'Error loading audits',
      onlyDraftCanDelete: 'Only draft audits can be deleted',
      confirmDeleteAudit: 'Do you want to delete the audit from',
      auditDeleted: 'Audit deleted',
      errorDeletingAudit: 'Error deleting audit',
      adjustmentsTitle: 'Stock Adjustments',
      adjustmentsDescription: 'List and manage stock adjustments (damaged, returns, corrections, etc.)',
      newAdjustment: 'New adjustment',
      noAdjustments: 'No adjustments found',
      deleteAdjustmentConfirm: 'Deleting this adjustment will revert the stock. Continue?',
      adjustmentDeleted: 'Adjustment deleted',
      errorDeletingAdjustment: 'Error deleting adjustment',
      deleteSelected: 'Delete selected',
      confirmDeleteAdjustments: 'Delete {count} adjustment(s)? Stock will be reverted for each. Continue?',
      adjustmentsBulkDeleted: '{count} adjustments deleted',
      adjustmentsBulkDeletePartial: '{deleted} deleted, {failed} failed',
      selectedCount: 'selected',
      filterByReason: 'All reasons',
      filterByPeriod: 'from',
      filterByPeriodEnd: 'to',
      adjustmentsList: 'Adjustments list',
      entries: 'Entries',
      exits: 'Exits',
      movementDate: 'Movement Date',
      reference: 'Reference',
      reviewAndApprove: 'Review and approve adjustments',
      reviewInstructions: 'Select the items you want to adjust and specify the reason for the discrepancy for each one.',
      auditReportApplyAllInstruction: 'Click Adjust stock to apply all discrepancies with the reason: Stock audit, stock correction according to the count.',
      showDiscrepanciesOnly: 'Show only items with discrepancy',
      justification: 'Justification',
      viewMovementHistory: 'View movement history',
      largeDiscrepancy: 'Large discrepancy',
      recentStockHistory: 'Recent Stock History',
      totalItems: 'Total Items',
      discrepanciesCount: 'Discrepancies',
      approvedCount: 'Approved',
      positiveCount: 'Surplus',
      negativeCount: 'Shortages',
      applyingAdjustments: 'Applying...',
      applyingProgressItem: 'Item',
      applyingProgressOf: 'of',
      applyingProgressSaving: 'Saving to system...',
      applyingProgressDoNotLeave: 'Do not close this window. Please wait until finished.',
      reviewAndApply: 'Review and Apply Adjustments',
      applyAdjustmentsForAuditDate: 'Adjust stock (for audit date)',
      errorApplyingAdjustments: 'Error applying adjustments',
      adjustmentsAppliedSuccess: 'adjustments applied successfully',
      selectOneAtLeast: 'Select at least one item to apply',
      reasonRequired: 'All selected items must have a reason specified',
      confirmApplyAdjustments: 'Do you want to apply {count} adjustments to the system stock?\n\nThis action cannot be reversed.',
      loadingReport: 'Loading report...',
      noItemsFound: 'No products found with the selected filters.',
      movementHistory: 'Movement History',
      lastMovements: 'last {count}',
      until: 'Until',
      totalVariation: 'Total variation (history)',
      noMovementsFound: 'No movements found',
      loadingHistory: 'Loading history...',
      movementTypes: {
        purchase: 'Purchase',
        order: 'Sale/Order',
        adjustment: 'Adjustment',
        transfer: 'Transfer',
        return: 'Return',
        waste: 'Waste/Loss',
        generic: 'Movement',
      },
      reasons: {
        damaged: 'Damaged Product',
        loss: 'Loss/Theft',
        correction: 'Previous Counting Error',
        expired: 'Expired Product',
        return: 'Return',
        other: 'Other',
      },
      exportPDF: 'Export PDF',
    },
    purchases: {
      title: 'Purchases',
      newPurchase: 'New Purchase',
      supplier: 'Supplier',
      purchaseOrder: 'Purchase Order',
      orderDate: 'Order Date',
      deliveryDate: 'Delivery Date',
      totalAmount: 'Total Amount',
      status: 'Status',
      pending: 'Pending',
      received: 'Received',
      cancelled: 'Cancelled',
      addSupplier: 'Add Supplier',
      supplierName: 'Supplier Name',
      supplierContact: 'Supplier Contact',
      supplierEmail: 'Supplier Email',
      paymentTerms: 'Payment Terms',
      paymentStatus: 'Payment Status',
      paid: 'Paid',
      unpaid: 'Unpaid',
      partiallyPaid: 'Partially Paid',
    },
    media: {
      title: 'Gallery',
      uploadImage: 'Upload Image',
      uploadVideo: 'Upload Video',
      gallery: 'Gallery',
      myUploads: 'My Uploads',
      fileSize: 'File Size',
      uploadDate: 'Upload Date',
      delete: 'Delete',
      download: 'Download',
      fileName: 'File Name',
      fileType: 'File Type',
      dimensions: 'Dimensions',
      selectFile: 'Select File',
      dragDropFile: 'Drag and drop file here',
    },
    users: {
      title: 'Users',
      allUsers: 'All Users',
      staff: 'Staff',
      clients: 'Clients',
      newUser: 'New User',
      editUser: 'Edit User',
      deleteUser: 'Delete User',
      userName: 'User Name',
      userEmail: 'User Email',
      userRole: 'User Role',
      userStatus: 'User Status',
      active: 'Active',
      inactive: 'Inactive',
      permissions: 'Permissions',
      phone: 'Phone',
      address: 'Address',
      createdAt: 'Created At',
      lastLogin: 'Last Login',
    },
    products: {
      title: 'Products',
      addProduct: 'Add Product',
      editProduct: 'Edit Product',
      deleteProduct: 'Delete Product',
      productName: 'Product Name',
      productCode: 'Product Code',
      category: 'Category',
      price: 'Price',
      cost: 'Cost',
      stock: 'Stock',
      description: 'Description',
      image: 'Image',
      active: 'Active',
      inactive: 'Inactive',
      categories: 'Categories',
      units: 'Units',
      addCategory: 'Add Category',
      addUnit: 'Add Unit',
    },
    forms: {
      required: 'Required',
      optional: 'Optional',
      invalidEmail: 'Invalid email',
      invalidPhone: 'Invalid phone',
      passwordTooShort: 'Password too short',
      passwordMismatch: 'Passwords do not match',
      selectOption: 'Select an option',
      uploadFile: 'Upload file',
      dragDropFile: 'Drag and drop file',
      minLength: 'Minimum length',
      maxLength: 'Maximum length',
      invalidFormat: 'Invalid format',
      fieldRequired: 'This field is required',
    },
    modals: {
      confirmDelete: 'Confirm Deletion',
      confirmDeleteMessage: 'Are you sure you want to delete this item?',
      confirmCancel: 'Confirm Cancellation',
      confirmCancelMessage: 'Are you sure you want to cancel?',
      unsavedChanges: 'Unsaved Changes',
      unsavedChangesMessage: 'You have unsaved changes. Do you want to continue?',
      areYouSure: 'Are you sure?',
      proceedAction: 'Proceed',
      cancelAction: 'Cancel',
    },
    messages: {
      saveSuccess: 'Saved successfully!',
      saveError: 'Error saving',
      deleteSuccess: 'Deleted successfully!',
      deleteError: 'Error deleting',
      updateSuccess: 'Updated successfully!',
      updateError: 'Error updating',
      loadError: 'Error loading data',
      networkError: 'Connection error',
      permissionDenied: 'Permission denied',
      sessionExpired: 'Session expired',
      operationSuccess: 'Operation completed successfully!',
      operationFailed: 'Operation failed',
      invalidData: 'Invalid data',
      duplicateEntry: 'Duplicate entry',
    },
    finance: {
      title: 'Finance',
      selectEntity: 'Select Entity',
      naturErvaLoja: 'Natur Erva Shop',
      naturErvaProducao: 'Natur Erva Production',
      naturErvaSabores: 'Natur Erva Flavors',
      workingCapital: 'Working Capital',
      accountStatement: 'Account Statement',
      balanceSheet: 'Balance Sheet',
      incomeStatement: 'Income Statement',
      trialBalance: 'Trial Balance',
      period: 'Period',
      fromDate: 'From Date',
      toDate: 'To Date',
      generateReport: 'Generate Report',
      exportReport: 'Export Report',
      currentAssets: 'Current Assets',
      currentLiabilities: 'Current Liabilities',
      workingCapitalValue: 'Working Capital',
      liquidityRatio: 'Liquidity Ratio',
      openingBalance: 'Opening Balance',
      closingBalance: 'Closing Balance',
      totalDebit: 'Total Debit',
      totalCredit: 'Total Credit',
      balance: 'Balance',
      revenue: 'Revenue',
      expenses: 'Expenses',
      grossProfit: 'Gross Profit',
      operatingProfit: 'Operating Profit',
      netProfit: 'Net Profit',
      assets: 'Assets',
      liabilities: 'Liabilities',
      equity: 'Equity',
      total: 'Total',
      sales: 'Sales',
      costOfGoodsSold: 'Cost of Goods Sold',
      operatingExpenses: 'Operating Expenses',
      otherExpenses: 'Other Expenses',
      otherRevenue: 'Other Revenue',
    },
    reports: {
      title: 'Reports',
      selectCategory: 'Select Category',
      selectReport: 'Select Report',
      selectEntity: 'Select Entity',
      period: 'Period',
      generateReport: 'Generate Report',
      exportReport: 'Export Report',
      categories: {
        financial: 'Financial',
        sales: 'Sales',
        stock: 'Stock',
        production: 'Production',
        customers: 'Customers',
        orders: 'Orders',
      },
      financial: {
        workingCapital: 'Working Capital',
        accountStatement: 'Account Statement',
        balanceSheet: 'Balance Sheet',
        incomeStatement: 'Income Statement',
        trialBalance: 'Trial Balance',
      },
      sales: {
        salesSummary: 'Sales Summary',
        salesByProduct: 'Sales by Product',
        salesByPeriod: 'Sales by Period',
        salesTrends: 'Sales Trends',
        topProducts: 'Top Products',
      },
      stock: {
        stockSummary: 'Stock Summary',
        stockMovements: 'Stock Movements',
        lowStock: 'Low Stock',
        stockValuation: 'Stock Valuation',
      },
      production: {
        productionSummary: 'Production Summary',
        productionByCategory: 'Production by Category',
        consumptionReport: 'Consumption Report',
        animalMovements: 'Animal Movements',
      },
      customers: {
        customersSummary: 'Customers Summary',
        customerSegments: 'Customer Segments',
        topCustomers: 'Top Customers',
      },
      orders: {
        ordersSummary: 'Orders Summary',
        ordersByStatus: 'Orders by Status',
        ordersByPeriod: 'Orders by Period',
        pendingOrders: 'Pending Orders',
      },
    },
  },
  changana: {
    common: {
      save: 'Hlayisa',
      cancel: 'Khansela',
      delete: 'Sula',
      edit: 'Lulamisa',
      add: 'Engetela',
      search: 'Lavisa',
      filter: 'Filtra',
      loading: 'Ku Layicha...',
      error: 'Xihoxo',
      success: 'Swi Kuka',
      confirm: 'Tiyisisa',
      close: 'Pfala',
      back: 'Tlhelela',
      next: 'Landzelaka',
      previous: 'Leya Hundayi',
      actions: 'Swiendlo',
      select: 'Hlawula',
      selectAll: 'Hlawula Hinkwaswo',
      deselectAll: 'Sula Hinkwaswo',
      noData: 'A kuna mahungo',
    },
    nav: {
      dashboard: 'Dashboard',
      orders: 'Swikombelo',
      sales: 'Maviselo',
      stock: 'Xitoku',
      production: 'Kuhumelerisa',
      customers: 'Vaxavi',
      products: 'Swikumiwa',
      finance: 'Timali',
      reports: 'Swiviko',
      settings: 'Matirhiselo',
    },
    auth: {
      login: 'Nghena',
      logout: 'Huma',
      email: 'Email',
      password: 'Paswedi',
      rememberMe: 'Ni tsundzuke',
      enterSystem: 'Nghena ka Sisiteme',
      loginError: 'Xihoxo xo nghena.',
      unexpectedError: 'Ku ve ni xihoxo.',
    },
    settings: {
      title: 'Matirhiselo ya Sisiteme',
      language: 'Ririmi',
      languageDescription: 'Hlawula ririmi ra sisiteme',
      theme: 'Theme',
      darkMode: 'Moodo wa Munyama',
      lightMode: 'Moodo wa Kuvonakala',
      database: 'Database',
      databaseConfig: 'Lulamisa Connection (Supabase)',
      devMode: 'Dev Mode: Credenciais pré-preenchidas',
    },
    dashboard: {
      title: 'Dashboard',
      totalOrders: 'Hinkwawo Swikombelo',
      totalCustomers: 'Hinkwawo Vaxavi',
      totalSales: 'Hinkwawo Maviselo',
      pendingOrders: 'Swikombelo swa ha yimela',
    },
    orders: {
      title: 'Swikombelo',
      addOrder: 'Engetela Xikombelo',
      editOrder: 'Lulamisa Xikombelo',
      deleteOrder: 'Sula Xikombelo',
      orderStatus: 'Xiyimo xa Xikombelo',
      customerName: 'Vito ra Muxavi',
      totalAmount: 'Ntsengo',
      createdAt: 'Siku ra Kutumbuluka',
    },
    ui: {
      naturErva: 'Natur Erva',
      crmManagement: 'CRM Management',
      systemTitle: 'Sistema Integrado de Gestão',
      admin: 'Mufambisi',
      staff: 'Mutirhi',
    },
    stock: {
      title: 'Xitoku',
      audit: 'Auditoria',
      auditTitle: 'Auditoria ya Xitoku',
      startAudit: 'Sungula Auditoria',
      completeAudit: 'Hela Auditoria',
      productName: 'Vito ra Xikumiwa',
      systemQuantity: 'Ntsengo wa Sisiteme',
      countedQuantity: 'Ntsengo lowu Hlawuriweke',
      difference: 'Ku hambana',
      status: 'Xiyimo',
      movements: 'Kufamba ka Xitoku',
      adjustment: 'Lulamiso',
      adjustmentReason: 'Xivangelo xa Lulamiso',
      lowStockAlert: 'Xitoku xa le Hansi',
      outOfStock: 'A kuna Xitoku',
      inStock: 'Xitoku xi kona',
      quantity: 'Ntsengo',
      unit: 'Unidade',
      location: 'Ndhawu',
      lastUpdated: 'Ku Lulamisiwa ko Hetelela',
      addMovement: 'Engetela Kufamba',
      movementType: 'Xiyimo xa Kufamba',
      movementDate: 'Siku ra Kufamba',
      reference: 'Referência',
      exportPDF: 'Rhumela PDF',
      auditCreatedSuccess: 'Auditoria yi endliwe kahle',
      errorCreatingAudit: 'Xihoxo xo endla auditoria',
      selectDateWarning: 'Hlawula siku ra auditoria',
      errorLoadingAudits: 'Xihoxo xo layicha auditoria',
      auditDeleted: 'Auditoria yi suleriwe',
      errorDeletingAudit: 'Xihoxo xo sula auditoria',
      adjustmentsTitle: 'Swilulamiso swa Xitoku',
      adjustmentsDescription: 'Ntlawa na ku lawula swilulamiso swa xitoku',
      newAdjustment: 'Lulamiso rintshwa',
      noAdjustments: 'A ku na swilulamiso',
      deleteAdjustmentConfirm: 'Ku sula lulamiso leri ku tlherisa xitoku. Hlayisa?',
      adjustmentDeleted: 'Lulamiso ri suleriwe',
      errorDeletingAdjustment: 'Xihoxo xo sula lulamiso',
      deleteSelected: 'Sula lexi hlawuriweke',
      confirmDeleteAdjustments: 'Sula lulamiso {count}? Xitoku xi tlherisiwa ku rin\'we na rin\'we. Hlayisa?',
      adjustmentsBulkDeleted: 'Lulamiso {count} ri suleriwe',
      adjustmentsBulkDeletePartial: '{deleted} ri suleriwe, {failed} ri helele',
      selectedCount: 'le xi hlawuriweke',
      filterByReason: 'Swivangelo hinkwaswo',
      filterByPeriod: 'kusukela',
      filterByPeriodEnd: 'kuya',
      adjustmentsList: 'Ntlawa wa swilulamiso',
      entries: 'Swinghena',
      exits: 'Swihuma',
      reasons: {
        damaged: 'Xikumiwa xi Borileke',
        loss: 'Ku lahleka/Kuyiviwa',
        correction: 'Xihoxo xa Ntsengo',
        expired: 'Xikumiwa xi Hundzeriweke hi Nkarhi',
        return: 'Ku tlheriseriwa',
        other: 'Xin\'wana',
      },
    },
    finance: {
      title: 'Timali',
      selectEntity: 'Hlawula Entidade',
      naturErvaLoja: 'Natur Erva Shop',
      naturErvaProducao: 'Natur Erva Production',
      naturErvaSabores: 'Natur Erva Flavors',
      workingCapital: 'Mali yo Fambisa',
      accountStatement: 'Extrato ya Timali',
      balanceSheet: 'Balanço',
      incomeStatement: 'Demonstração de Resultados',
      trialBalance: 'Balancete',
      period: 'Nkarhi',
      fromDate: 'Kusuka Siku',
      toDate: 'Kuya Siku',
      generateReport: 'Endla Xiviko',
      exportReport: 'Rhumela Xiviko',
      currentAssets: 'Switirhisiwa swa Sweswi',
      currentLiabilities: 'Swikweleti swa Sweswi',
      workingCapitalValue: 'Mali yo Fambisa',
      liquidityRatio: 'Razão de Liquidez',
      openingBalance: 'Saldo yo Sungula',
      closingBalance: 'Saldo yo Hetelela',
      totalDebit: 'Hinkwawo Debit',
      totalCredit: 'Hinkwawo Credit',
      balance: 'Saldo',
      revenue: 'Mali yo Nghena',
      expenses: 'Mali yo Huma',
      grossProfit: 'Lucro Bruto',
      operatingProfit: 'Lucro Operacional',
      netProfit: 'Lucro Líquido',
      assets: 'Switirhisiwa',
      liabilities: 'Swikweleti',
      equity: 'Património Líquido',
      total: 'Hinkwaswo',
      sales: 'Maviselo',
      costOfGoodsSold: 'Custo das Mercadorias Vendidas',
      operatingExpenses: 'Despesas Operacionais',
      otherExpenses: 'Tindluwa Tin\'wana',
      otherRevenue: 'Mali Yin\'wana',
    },
    reports: {
      title: 'Swiviko',
      selectCategory: 'Hlawula Categoria',
      selectReport: 'Hlawula Xiviko',
      selectEntity: 'Hlawula Entidade',
      period: 'Nkarhi',
      generateReport: 'Endla Xiviko',
      exportReport: 'Rhumela Xiviko',
      categories: {
        financial: 'Timali',
        sales: 'Maviselo',
        stock: 'Xitoku',
        production: 'Kuhumelerisa',
        customers: 'Vaxavi',
        orders: 'Swikombelo',
      },
      financial: {
        workingCapital: 'Mali yo Fambisa',
        accountStatement: 'Extrato',
        balanceSheet: 'Balanço',
        incomeStatement: 'Income Statement',
        trialBalance: 'Trial Balance',
      },
      sales: {
        salesSummary: 'Nkomiso wa Maviselo',
        salesByProduct: 'Maviselo hi Xikumiwa',
        salesByPeriod: 'Maviselo hi Nkarhi',
        salesTrends: 'Tendências de Vendas',
        topProducts: 'Swikumiwa swa le Henhla',
      },
      stock: {
        stockSummary: 'Nkomiso wa Xitoku',
        stockMovements: 'Kufamba ka Xitoku',
        lowStock: 'Xitoku xa le Hansi',
        stockValuation: 'Ntsengo wa Xitoku',
      },
      production: {
        productionSummary: 'Nkomiso wa Kuhumelerisa',
        productionByCategory: 'Kuhumelerisa hi Categoria',
        consumptionReport: 'Xiviko xa Matirhiselo',
        animalMovements: 'Kufamba ka Swifuwo',
      },
      customers: {
        customersSummary: 'Nkomiso wa Vaxavi',
        loyaltyReport: 'Xiviko xa Kutiyisela',
        customerSegments: 'Swiyenge swa Vaxavi',
        topCustomers: 'Vaxavi va le Henhla',
      },
      orders: {
        ordersSummary: 'Nkomiso wa Swikombelo',
        ordersByStatus: 'Swikombelo hi Xiyimo',
        ordersByPeriod: 'Swikombelo hi Nkarhi',
        pendingOrders: 'Swikombelo swa ha yimela',
      },
    },
  },
};


