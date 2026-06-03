/* Vida Financeira RP - data.js
   Dados base separados para facilitar expansão futura. */

const GAME_CONFIG = {
  version: '2.0.0',
  saveKey: 'vidaFinanceiraRP.save.v1',
  storageMode: 'local-first',
  apiBaseUrl: '', // Futuro backend opcional. GitHub Pages usa localStorage.
  taskLimit: 10,
  taskWindowMs: 24 * 60 * 60 * 1000,
  loanCycleMs: 3 * 60 * 60 * 1000,
  homeCycleMs: 10 * 60 * 60 * 1000,
  homeLateGraceMs: 5 * 60 * 60 * 1000,
  investmentCycleMs: 2 * 60 * 60 * 1000,
  loanFeeRate: 0.05,
  houseLateRate: 0.03,
  houseLossRefundRate: 0.05,
  taskSalaryRate: 0.10,
  startingBalance: 850,
  startingScore: 550,
  maxScore: 1000,
  minScore: 0
};

const COMPANIES = [
  {
    id: 'abas-bank',
    name: 'ABAS Banco Digital',
    growth: 1,
    ceoId: null,
    roles: [
      { id: 'intern', name: 'Estagiário', salary: 900, xpRequired: 0, bonus: 0, taskLimit: 10, permission: 'basic', needsApproval: false },
      { id: 'assistant', name: 'Auxiliar', salary: 1400, xpRequired: 320, bonus: 20, taskLimit: 10, permission: 'basic', needsApproval: false },
      { id: 'attendant', name: 'Atendente', salary: 1850, xpRequired: 720, bonus: 40, taskLimit: 10, permission: 'basic', needsApproval: false },
      { id: 'employee', name: 'Funcionário', salary: 2600, xpRequired: 1250, bonus: 70, taskLimit: 10, permission: 'normal', needsApproval: false },
      { id: 'supervisor', name: 'Supervisor', salary: 3600, xpRequired: 2100, bonus: 120, taskLimit: 10, permission: 'team', needsApproval: true },
      { id: 'manager', name: 'Gerente', salary: 5200, xpRequired: 3300, bonus: 220, taskLimit: 10, permission: 'team', needsApproval: true },
      { id: 'director', name: 'Diretor', salary: 8500, xpRequired: 5200, bonus: 450, taskLimit: 10, permission: 'executive', needsApproval: true },
      { id: 'vice-president', name: 'Vice-presidente', salary: 12500, xpRequired: 8100, bonus: 800, taskLimit: 10, permission: 'executive', needsApproval: true },
      { id: 'ceo', name: 'CEO', salary: 21000, xpRequired: 13000, bonus: 1600, taskLimit: 10, permission: 'ceo', needsApproval: true }
    ]
  },
  {
    id: 'aurora-tech',
    name: 'Aurora Tech Investimentos',
    growth: 1.08,
    ceoId: null,
    roles: [
      { id: 'intern', name: 'Estagiário', salary: 1050, xpRequired: 0, bonus: 0, taskLimit: 10, permission: 'basic', needsApproval: false },
      { id: 'assistant', name: 'Auxiliar', salary: 1650, xpRequired: 380, bonus: 30, taskLimit: 10, permission: 'basic', needsApproval: false },
      { id: 'attendant', name: 'Atendente', salary: 2100, xpRequired: 820, bonus: 60, taskLimit: 10, permission: 'basic', needsApproval: false },
      { id: 'employee', name: 'Funcionário', salary: 3100, xpRequired: 1450, bonus: 90, taskLimit: 10, permission: 'normal', needsApproval: false },
      { id: 'supervisor', name: 'Supervisor', salary: 4300, xpRequired: 2400, bonus: 160, taskLimit: 10, permission: 'team', needsApproval: true },
      { id: 'manager', name: 'Gerente', salary: 6100, xpRequired: 3800, bonus: 290, taskLimit: 10, permission: 'team', needsApproval: true },
      { id: 'director', name: 'Diretor', salary: 9500, xpRequired: 6100, bonus: 520, taskLimit: 10, permission: 'executive', needsApproval: true },
      { id: 'vice-president', name: 'Vice-presidente', salary: 14000, xpRequired: 9200, bonus: 950, taskLimit: 10, permission: 'executive', needsApproval: true },
      { id: 'ceo', name: 'CEO', salary: 24500, xpRequired: 15000, bonus: 1900, taskLimit: 10, permission: 'ceo', needsApproval: true }
    ]
  }
];

const TASKS = [
  { id: 'docs', name: 'Organizar documentos', xp: 45, risk: 0.02 },
  { id: 'delivery', name: 'Fazer entrega', xp: 55, risk: 0.04 },
  { id: 'customer', name: 'Atender cliente', xp: 50, risk: 0.03 },
  { id: 'problem', name: 'Resolver problema', xp: 70, risk: 0.05 },
  { id: 'report', name: 'Fazer relatório', xp: 60, risk: 0.03 },
  { id: 'meeting', name: 'Participar de reunião', xp: 40, risk: 0.01 },
  { id: 'sales', name: 'Vender produto', xp: 75, risk: 0.07 },
  { id: 'help', name: 'Ajudar colega', xp: 35, risk: 0.01 },
  { id: 'maintenance', name: 'Fazer manutenção', xp: 65, risk: 0.04 },
  { id: 'goal', name: 'Completar meta diária', xp: 90, risk: 0.06 }
];

const HOUSES = [
  { id: 'kitnet', name: 'Kitnet Centro', totalValue: 52000, rent: 390, bills: { water: 45, energy: 80, internet: 70 }, prestige: 1 },
  { id: 'apartment-basic', name: 'Apartamento Popular', totalValue: 115000, rent: 780, bills: { water: 70, energy: 140, internet: 95 }, prestige: 2 },
  { id: 'house-family', name: 'Casa Familiar', totalValue: 235000, rent: 1450, bills: { water: 120, energy: 260, internet: 120 }, prestige: 3 },
  { id: 'premium-condo', name: 'Condomínio Premium', totalValue: 480000, rent: 3100, bills: { water: 230, energy: 490, internet: 180 }, prestige: 5 },
  { id: 'mansion', name: 'Mansão Empresarial', totalValue: 1200000, rent: 8500, bills: { water: 600, energy: 1600, internet: 350 }, prestige: 8 }
];

const INVESTMENTS = [
  { id: 'safe-real-estate', name: 'Fundo Imobiliário Local', type: 'Imóveis', min: 250, risk: 'Baixo', expected: 0.025, volatility: 0.018, description: 'Rende devagar, mas com menor risco.' },
  { id: 'own-company', name: 'Empresa onde trabalha', type: 'Empresa', min: 500, risk: 'Médio', expected: 0.045, volatility: 0.04, description: 'Retorno depende do crescimento da empresa.' },
  { id: 'stock-market', name: 'Bolsa de Valores', type: 'Bolsa', min: 300, risk: 'Alto', expected: 0.065, volatility: 0.09, description: 'Pode subir bem ou cair forte.' },
  { id: 'crypto-risk', name: 'Ativo Especulativo', type: 'Futuro', min: 150, risk: 'Muito alto', expected: 0.10, volatility: 0.18, description: 'Altíssimo risco. Preparado para expansão.' }
];

const ACHIEVEMENTS = [
  { id: 'first-salary', name: 'Primeiro salário', reward: 80, description: 'Complete sua primeira tarefa.' },
  { id: 'first-loan', name: 'Primeiro empréstimo', reward: 40, description: 'Solicite seu primeiro empréstimo.' },
  { id: 'first-debt-paid', name: 'Primeira dívida paga', reward: 100, description: 'Quite uma pendência.' },
  { id: 'first-investment', name: 'Primeiro investimento', reward: 120, description: 'Invista pela primeira vez.' },
  { id: 'first-rent-paid', name: 'Primeiro aluguel pago', reward: 80, description: 'Pague o primeiro ciclo de casa.' },
  { id: 'house-50', name: 'Casa 50% comprada', reward: 400, description: 'Aceite a proposta de 50%.' },
  { id: 'house-100', name: 'Casa 100% comprada', reward: 1000, description: 'Finalize a compra de uma casa.' },
  { id: 'first-landlord', name: 'Primeiro imóvel alugado', reward: 600, description: 'Alugue sua casa para outro jogador.' },
  { id: 'first-profit', name: 'Primeiro lucro com investimento', reward: 150, description: 'Receba retorno positivo.' },
  { id: 'manager', name: 'Virou gerente', reward: 500, description: 'Chegue ao cargo de Gerente.' },
  { id: 'ceo', name: 'Virou CEO', reward: 2000, description: 'Alcance o topo da empresa.' },
  { id: 'perfect-score', name: 'Score perfeito', reward: 3000, description: 'Chegue ao score 1000.' },
  { id: 'debt-free', name: 'Sem dívidas por 7 dias', reward: 900, description: 'Mantenha a vida financeira limpa.' }
];
