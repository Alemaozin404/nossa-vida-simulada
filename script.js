/* Vida Financeira RP - script.js
   Versão profissional local-first: sistemas reais, tempo offline, economia persistente e pronto para GitHub Pages. */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const now = () => Date.now();
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v) => `${Math.round(v * 100)}%`;
const id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const clamp = (num, min, max) => Math.min(max, Math.max(min, num));
const hours = (ms) => Math.max(0, ms / 3600000).toFixed(1);

let state = null;
let activeBankTab = 'overview';
let modalAction = null;

function createDefaultState(name = 'Jogador', companyId = COMPANIES[0].id) {
  return {
    createdAt: now(), lastSeen: now(), syncedMs: 0,
    player: {
      id: id('player'), name, balance: GAME_CONFIG.startingBalance, xp: 0, level: 1,
      score: GAME_CONFIG.startingScore, companyId, roleId: 'intern', socialStatus: 'Trabalhador',
      achievements: [], promotionRequests: [], consecutiveDebtFreeDays: 0
    },
    bank: { debts: [], loans: [], pendingBills: [], transactions: [] },
    work: { taskLog: [], taskWindowStart: now(), tasksDoneInWindow: 0, pendingPromotion: null },
    houses: { currentHomeId: null, owned: [], rentStreak: 0, lastHousingEvent: null },
    investments: [],
    notifications: [],
    history: [],
    admin: {
      companies: JSON.parse(JSON.stringify(COMPANIES)),
      fakeUsers: [
        { name: 'Bianca', wealth: 14200, debt: 400, score: 735, role: 'Supervisor', houses: 1, invested: 3400, tasks: 38 },
        { name: 'Carlos', wealth: 8800, debt: 0, score: 810, role: 'Gerente', houses: 0, invested: 2600, tasks: 52 },
        { name: 'Maya', wealth: 27100, debt: 1900, score: 690, role: 'Diretor', houses: 2, invested: 8900, tasks: 44 }
      ]
    }
  };
}

function saveGame() {
  if (!state) return;
  state.lastSeen = now();
  localStorage.setItem(GAME_CONFIG.saveKey, JSON.stringify(state));
  toast('Jogo salvo com sucesso.', 'good');
}

function loadGame() {
  const raw = localStorage.getItem(GAME_CONFIG.saveKey);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function boot() {
  $('#versionBadge').textContent = `v${GAME_CONFIG.version}`;
  populateCompanySelect();
  state = loadGame();
  if (!state) {
    $('#setupPanel').classList.remove('hidden');
    $('#gamePanel').classList.add('hidden');
  } else {
    migrateSave();
    processOfflineTime();
    renderAll();
  }
  bindEvents();
  setInterval(() => {
    if (!state) return;
    $('#clockBadge').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    processSmallTick();
  }, 15000);
}

function migrateSave() {
  state.admin ||= { companies: JSON.parse(JSON.stringify(COMPANIES)), fakeUsers: [] };
  state.bank ||= { debts: [], loans: [], pendingBills: [], transactions: [] };
  state.houses ||= { currentHomeId: null, owned: [], rentStreak: 0 };
  state.investments ||= [];
  state.notifications ||= [];
  state.history ||= [];
}

function populateCompanySelect() {
  $('#companySelect').innerHTML = COMPANIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function bindEvents() {
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $('#createPlayerBtn').addEventListener('click', () => {
    const name = $('#playerNameInput').value.trim() || 'Jogador';
    state = createDefaultState(name, $('#companySelect').value);
    addHistory('sistema', `Jogador ${name} criado.`, GAME_CONFIG.startingBalance, 'ok');
    notify('Bem-vindo ao Vida Financeira RP. Seu progresso local começou.', 'good');
    unlockAchievement('first-salary', false);
    $('#setupPanel').classList.add('hidden');
    $('#gamePanel').classList.remove('hidden');
    renderAll(); saveSilent();
  });
  $('#saveBtn').addEventListener('click', saveGame);
  $('#resetBtn').addEventListener('click', () => confirmModal('Resetar progresso', 'Isso apagará o save local deste navegador.', () => {
    localStorage.removeItem(GAME_CONFIG.saveKey); location.reload();
  }));
  $('#syncBtn').addEventListener('click', () => {
    processOfflineTime(true);
    renderAll();
    saveSilent();
    toast('Economia sincronizada com o tempo real.', 'good');
  });
  $('#modalCancel').addEventListener('click', closeModal);
  $('#modalConfirm').addEventListener('click', () => { if (modalAction) modalAction(); closeModal(); });
}

function switchTab(tab) {
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === tab));
  $('#tabTitle').textContent = ({home:'Home',bank:'Banco',work:'Trabalho',taxes:'Impostos',loans:'Empréstimos',houses:'Casas',investments:'Investimentos',profile:'Perfil',ranking:'Ranking',history:'Histórico',admin:'Admin / CEO'})[tab] || 'Home';
  renderAll();
}

function getCompany() { return state.admin.companies.find(c => c.id === state.player.companyId) || state.admin.companies[0]; }
function getRole(roleId = state.player.roleId) { return getCompany().roles.find(r => r.id === roleId) || getCompany().roles[0]; }
function getNextRole() { const roles = getCompany().roles; return roles[roles.findIndex(r => r.id === state.player.roleId) + 1]; }
function totalDebts() { return [...state.bank.debts, ...state.bank.pendingBills].filter(d => d.status !== 'quitado').reduce((s,d)=>s+d.currentValue,0) + state.bank.loans.filter(l=>l.status!=='Quitado').reduce((s,l)=>s+l.remaining,0); }
function totalInvested() { return state.investments.reduce((s,i)=>s+i.currentValue,0); }
function houseNetWorth() { return state.houses.owned.reduce((s,h)=>s+(h.totalValue*(h.ownedPercent/100)),0); }
function totalWealth() { return state.player.balance + totalInvested() + houseNetWorth() - totalDebts(); }

function addHistory(type, description, value = 0, status = 'ok') {
  state.history.unshift({ id: id('hist'), at: now(), type, description, value, status });
  state.history = state.history.slice(0, 250);
}
function notify(text, kind='info') {
  state.notifications.unshift({ id: id('note'), at: now(), text, kind, read: false });
  state.notifications = state.notifications.slice(0, 80);
  toast(text, kind);
}
function toast(text, kind='info') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<strong>${kind === 'bad' ? 'Atenção' : kind === 'good' ? 'Sucesso' : 'Aviso'}</strong><br><span>${text}</span>`;
  $('#toastArea').appendChild(el);
  setTimeout(() => el.remove(), 4300);
}
function saveSilent(){ if(state){ state.lastSeen=now(); localStorage.setItem(GAME_CONFIG.saveKey, JSON.stringify(state)); } }
function confirmModal(title, text, action){ $('#modalTitle').textContent=title; $('#modalText').textContent=text; modalAction=action; $('#modal').classList.remove('hidden'); }
function closeModal(){ $('#modal').classList.add('hidden'); modalAction=null; }

function changeBalance(amount, reason, type='transacao') {
  const next = state.player.balance + amount;
  if (next < 0) return false;
  state.player.balance = Math.round(next * 100) / 100;
  state.bank.transactions.unshift({ id:id('tx'), at:now(), amount, reason, type });
  addHistory(type, reason, amount, amount >= 0 ? 'ok' : 'saida');
  return true;
}
function changeScore(delta, reason) {
  const old = state.player.score;
  state.player.score = clamp(state.player.score + delta, GAME_CONFIG.minScore, GAME_CONFIG.maxScore);
  if (state.player.score !== old) addHistory('score', `${reason}. Score ${old} → ${state.player.score}.`, delta, delta>=0?'ok':'alerta');
  if (state.player.score >= 1000) unlockAchievement('perfect-score');
}

function processOfflineTime(forceNotice = false) {
  const elapsed = Math.max(0, now() - (state.lastSeen || now()));
  if (elapsed < 1000 && !forceNotice) return;
  state.syncedMs = (state.syncedMs || 0) + elapsed;
  processLoans(elapsed);
  processHousing(elapsed);
  processInvestments(elapsed);
  resetWorkWindowIfNeeded();
  updateSocialStatus();
  if (forceNotice || elapsed > 60000) notify(`Tempo real processado: ${hours(elapsed)}h desde a última sincronização.`, 'info');
  state.lastSeen = now();
  saveSilent();
}
function processSmallTick(){ processOfflineTime(); renderBadges(); }

function resetWorkWindowIfNeeded() {
  if (now() - state.work.taskWindowStart >= GAME_CONFIG.taskWindowMs) {
    state.work.taskWindowStart = now(); state.work.tasksDoneInWindow = 0;
    notify('Seu limite diário de 10 tarefas foi renovado.', 'good');
  }
}
function processLoans(elapsed) {
  state.bank.loans.forEach(loan => {
    if (loan.status === 'Quitado') return;
    while (loan.nextChargeAt <= now()) {
      const fee = Math.round(loan.initialValue * GAME_CONFIG.loanFeeRate * 100) / 100;
      loan.currentValue += fee; loan.remaining += fee; loan.nextChargeAt += GAME_CONFIG.loanCycleMs;
      loan.status = loan.dueAt < now() ? 'Atrasado' : 'Em dia';
      createDebt('loan-fee', `Taxa de 5% do empréstimo ${loan.id.slice(-5)}`, fee, 'empréstimo', loan.id);
      changeScore(loan.dueAt < now() ? -10 : -2, 'Cobrança de empréstimo registrada');
      notify(`Taxa de empréstimo aplicada: ${money(fee)}.`, loan.dueAt < now() ? 'bad' : 'warn');
    }
    if (loan.dueAt < now() && loan.status !== 'Crítico') {
      loan.status = loan.remaining > loan.initialValue * 1.6 ? 'Crítico' : 'Atrasado';
    }
  });
}
function processHousing() {
  const home = getCurrentHome();
  if (!home) return;
  while (home.nextDueAt <= now()) {
    const isOwnedFull = home.ownedPercent >= 100;
    const rent = isOwnedFull ? 0 : home.rent;
    const billsTotal = home.bills.water + home.bills.energy + home.bills.internet + rent;
    createBill(`Contas da casa: ${home.name}`, billsTotal, 'casa', home.id, home.nextDueAt + GAME_CONFIG.homeLateGraceMs);
    home.nextDueAt += GAME_CONFIG.homeCycleMs;
    notify(`Nova conta de casa gerada: ${money(billsTotal)}.`, 'warn');
  }
  [...state.bank.pendingBills, ...state.bank.debts].forEach(d => {
    if ((d.category === 'casa' || d.category === 'conta') && d.status !== 'quitado' && d.graceAt && d.graceAt < now() && !d.lateApplied) {
      const add = Math.round(d.currentValue * GAME_CONFIG.houseLateRate * 100) / 100;
      d.currentValue += add; d.interest += add; d.status = 'atrasado'; d.lateApplied = true;
      changeScore(-18, 'Atraso de casa/contas após 5 horas');
      notify(`Atraso de casa: +3% aplicado (${money(add)}).`, 'bad');
    }
  });
  const housingDebt = [...state.bank.pendingBills, ...state.bank.debts].filter(d => d.category === 'casa' && d.status !== 'quitado').reduce((s,d)=>s+d.currentValue,0);
  if (housingDebt > home.totalValue * 0.08 && home.ownedPercent > 0) repossessHome(home);
}
function processInvestments() {
  state.investments.forEach(inv => {
    while (inv.nextCycleAt <= now()) {
      const base = INVESTMENTS.find(i => i.id === inv.templateId);
      const randomSwing = (Math.random() - 0.45) * base.volatility;
      const rate = base.expected + randomSwing;
      const result = Math.round(inv.currentValue * rate * 100) / 100;
      inv.currentValue = Math.max(0, Math.round((inv.currentValue + result) * 100) / 100);
      inv.history.unshift({ at: now(), result, rate });
      inv.nextCycleAt += GAME_CONFIG.investmentCycleMs;
      addHistory('investimento', `${inv.name} ${result >= 0 ? 'rendeu' : 'deu prejuízo'} ${money(result)}.`, result, result>=0?'ok':'alerta');
      changeScore(result >= 0 ? 4 : -5, result >= 0 ? 'Investimento com lucro' : 'Investimento com prejuízo');
      if (result > 0) unlockAchievement('first-profit');
    }
  });
}

function createDebt(type, name, value, category='geral', refId=null) {
  state.bank.debts.unshift({ id:id('debt'), type, name, originalValue:value, currentValue:value, interest:0, createdAt:now(), dueAt:now(), graceAt:null, status:'em dia', category, refId });
}
function createBill(name, value, category='conta', refId=null, graceAt=null) {
  state.bank.pendingBills.unshift({ id:id('bill'), name, originalValue:value, currentValue:value, interest:0, createdAt:now(), dueAt:now(), graceAt, status:'em dia', category, refId, lateApplied:false });
}
function payItem(collection, itemId) {
  const item = state.bank[collection].find(d => d.id === itemId);
  if (!item || item.status === 'quitado') return;
  if (!changeBalance(-item.currentValue, `Pagamento: ${item.name}`, 'pagamento')) return toast('Saldo insuficiente para pagar essa pendência.', 'bad');
  item.status = 'quitado';
  changeScore(14, 'Pagamento realizado em dia');
  unlockAchievement('first-debt-paid');
  if (item.category === 'casa') {
    state.houses.rentStreak += 1;
    unlockAchievement('first-rent-paid');
    const home = getCurrentHome();
    if (home && state.houses.rentStreak >= 5 && home.ownedPercent < 50) {
      home.purchaseOffer50 = true;
      notify('Banco liberou proposta para comprar 50% da casa.', 'good');
    }
  }
  renderAll(); saveSilent();
}
function payLoan(loanId, amount=null) {
  const loan = state.bank.loans.find(l => l.id === loanId);
  if (!loan || loan.status === 'Quitado') return;
  const pay = Math.min(amount || loan.remaining, loan.remaining);
  if (!changeBalance(-pay, `Pagamento do empréstimo ${loan.id.slice(-5)}`, 'empréstimo')) return toast('Saldo insuficiente para pagar empréstimo.', 'bad');
  loan.paid += pay; loan.remaining -= pay;
  if (loan.remaining <= 0.01) { loan.remaining = 0; loan.status = 'Quitado'; changeScore(35, 'Empréstimo quitado'); notify('Empréstimo quitado com sucesso.', 'good'); }
  else { loan.status = loan.dueAt < now() ? 'Atrasado' : 'Em dia'; changeScore(8, 'Parcela de empréstimo paga'); }
  renderAll(); saveSilent();
}

function doTask(taskId) {
  resetWorkWindowIfNeeded();
  if (state.work.tasksDoneInWindow >= GAME_CONFIG.taskLimit) return toast('Limite diário de 10 tarefas atingido.', 'warn');
  const role = getRole(); const task = TASKS.find(t=>t.id===taskId);
  const gain = Math.round(role.salary * GAME_CONFIG.taskSalaryRate * 100) / 100;
  const bonus = Math.random() < 0.18 ? role.bonus : 0;
  const total = gain + bonus;
  changeBalance(total, `${task.name}: +${money(total)}`, 'trabalho');
  state.player.xp += task.xp;
  state.work.tasksDoneInWindow += 1;
  state.work.taskLog.unshift({ id:id('task'), taskId, at:now(), gain:total, xp:task.xp });
  changeScore(3, 'Tarefa concluída');
  unlockAchievement('first-salary');
  notify(`${task.name} concluída: ${money(total)} e ${task.xp} XP.`, 'good');
  checkPromotion(); renderAll(); saveSilent();
}
function checkPromotion() {
  const next = getNextRole(); if (!next) return;
  if (state.player.xp < next.xpRequired) return;
  if (next.needsApproval || next.id === 'ceo') {
    if (!state.work.pendingPromotion) {
      state.work.pendingPromotion = { id:id('promo'), targetRoleId:next.id, createdAt:now(), status:'pendente' };
      notify(`Promoção para ${next.name} precisa de aprovação do CEO/Admin.`, 'warn');
    }
  } else promoteTo(next.id, 'Promoção automática por XP');
}
function promoteTo(roleId, reason='Promoção aprovada') {
  state.player.roleId = roleId; state.work.pendingPromotion = null;
  const role = getRole(); addHistory('promoção', `${reason}: agora você é ${role.name}.`, role.salary, 'ok');
  notify(`Parabéns! Novo cargo: ${role.name}.`, 'good');
  if (role.id === 'manager') unlockAchievement('manager');
  if (role.id === 'ceo') unlockAchievement('ceo');
}

function requestLoan(value, hoursDeadline, parcels) {
  value = Number(value); hoursDeadline = Number(hoursDeadline); parcels = Number(parcels);
  if (!value || value < 100) return toast('Digite um valor de empréstimo válido.', 'bad');
  const limit = 500 + state.player.score * 11 + Math.max(0, totalWealth() * 0.08);
  if (value > limit) return toast(`Seu limite atual é ${money(limit)}.`, 'bad');
  const fee = value * GAME_CONFIG.loanFeeRate;
  const total = value + fee;
  const loan = { id:id('loan'), initialValue:value, currentValue:total, paid:0, remaining:total, startAt:now(), dueAt:now()+hoursDeadline*3600000, nextChargeAt:now()+GAME_CONFIG.loanCycleMs, parcels, parcelValue:total/parcels, status:'Ativo' };
  state.bank.loans.unshift(loan);
  changeBalance(value, `Empréstimo recebido ${loan.id.slice(-5)}`, 'empréstimo');
  changeScore(-12, 'Novo empréstimo solicitado');
  unlockAchievement('first-loan');
  notify(`Empréstimo aprovado: ${money(value)}. Taxa inicial: ${money(fee)}.`, 'good');
  renderAll(); saveSilent();
}

function rentHouse(houseId) {
  if (getCurrentHome()) return toast('Você já possui ou aluga uma casa atual.', 'warn');
  const base = HOUSES.find(h=>h.id===houseId);
  if (!base) return;
  const firstPayment = base.rent + base.bills.water + base.bills.energy + base.bills.internet;
  if (!changeBalance(-firstPayment, `Entrada e primeiras contas: ${base.name}`, 'casa')) return toast('Saldo insuficiente para alugar essa casa.', 'bad');
  const home = { ...JSON.parse(JSON.stringify(base)), ownedPercent:0, status:'alugada', ownerId:'bank', tenantId:state.player.id, nextDueAt:now()+GAME_CONFIG.homeCycleMs, purchaseOffer50:false, rentedTo:null };
  state.houses.owned.unshift(home); state.houses.currentHomeId = home.id; state.houses.rentStreak = 1;
  addHistory('casa', `Casa alugada: ${home.name}.`, firstPayment, 'ok');
  notify(`Você alugou ${home.name}. Próxima cobrança em 10h.`, 'good');
  renderAll(); saveSilent();
}
function getCurrentHome(){ return state.houses.owned.find(h=>h.id===state.houses.currentHomeId); }
function acceptBuy50(homeId) {
  const home = state.houses.owned.find(h=>h.id===homeId); if (!home || !home.purchaseOffer50) return;
  const cost = home.totalValue * 0.5;
  if (!changeBalance(-cost, `Compra de 50% da casa ${home.name}`, 'casa')) return toast(`Você precisa de ${money(cost)} para aceitar.`, 'bad');
  home.ownedPercent = 50; home.status='dono parcial'; home.purchaseOffer50=false;
  changeScore(45, 'Compra parcial de casa'); unlockAchievement('house-50');
  notify(`Agora 50% de ${home.name} está no seu nome.`, 'good');
  renderAll(); saveSilent();
}
function buyMoreHouse(homeId, percent) {
  const home = state.houses.owned.find(h=>h.id===homeId); if (!home) return;
  const realPercent = Math.min(percent, 100-home.ownedPercent);
  if (realPercent <= 0) return;
  const cost = home.totalValue * (realPercent/100);
  if (!changeBalance(-cost, `Compra de ${realPercent}% da casa ${home.name}`, 'casa')) return toast('Saldo insuficiente para comprar essa porcentagem.', 'bad');
  home.ownedPercent += realPercent;
  if (home.ownedPercent >= 100) { home.ownedPercent=100; home.status='100% comprada'; unlockAchievement('house-100'); notify(`${home.name} agora é 100% sua.`, 'good'); }
  changeScore(20, 'Pagamento de casa realizado'); renderAll(); saveSilent();
}
function rentToNpc(homeId) {
  const home = state.houses.owned.find(h=>h.id===homeId); if(!home || home.ownedPercent<100) return;
  home.rentedTo = home.rentedTo ? null : 'Inquilino NPC';
  if (home.rentedTo) {
    const bills = home.bills.water+home.bills.energy+home.bills.internet;
    const profit = home.rent - bills;
    changeBalance(profit, `Aluguel recebido menos contas de ${home.name}`, 'aluguel');
    unlockAchievement('first-landlord');
    notify(`Imóvel alugado. Lucro inicial: ${money(profit)}.`, profit>=0?'good':'warn');
  } else notify('Contrato de aluguel encerrado.', 'warn');
  renderAll(); saveSilent();
}
function repossessHome(home) {
  const refund = Math.round(home.totalValue * GAME_CONFIG.houseLossRefundRate * 100) / 100;
  changeBalance(refund, `Devolução de 5% pela perda da casa ${home.name}`, 'casa');
  state.houses.owned = state.houses.owned.filter(h=>h.id!==home.id);
  state.houses.currentHomeId = null; state.houses.rentStreak = 0;
  changeScore(-95, 'Casa tomada pelo banco');
  notify(`Banco tomou ${home.name}. Você recebeu apenas ${money(refund)}.`, 'bad');
}

function invest(templateId, value) {
  const base = INVESTMENTS.find(i=>i.id===templateId); value = Number(value);
  if (!base || value < base.min) return toast(`Investimento mínimo: ${money(base?.min || 0)}.`, 'bad');
  if (!changeBalance(-value, `Investimento em ${base.name}`, 'investimento')) return toast('Saldo insuficiente para investir.', 'bad');
  state.investments.unshift({ id:id('inv'), templateId:base.id, name:base.name, type:base.type, initialValue:value, currentValue:value, risk:base.risk, createdAt:now(), nextCycleAt:now()+GAME_CONFIG.investmentCycleMs, history:[] });
  changeScore(8, 'Investimento iniciado'); unlockAchievement('first-investment');
  notify(`Investimento criado: ${base.name}.`, 'good'); renderAll(); saveSilent();
}
function withdrawInvestment(invId) {
  const inv = state.investments.find(i=>i.id===invId); if(!inv) return;
  changeBalance(inv.currentValue, `Retirada de investimento: ${inv.name}`, 'investimento');
  state.investments = state.investments.filter(i=>i.id!==invId);
  notify(`Você retirou ${money(inv.currentValue)} de ${inv.name}.`, inv.currentValue>=inv.initialValue?'good':'warn');
  renderAll(); saveSilent();
}

function unlockAchievement(achId, notifyUser=true) {
  if (state.player.achievements.includes(achId)) return;
  const ach = ACHIEVEMENTS.find(a=>a.id===achId); if(!ach) return;
  state.player.achievements.push(achId);
  state.player.balance += ach.reward;
  addHistory('conquista', `Conquista: ${ach.name}. Recompensa ${money(ach.reward)}.`, ach.reward, 'ok');
  if (notifyUser) notify(`Conquista desbloqueada: ${ach.name} (+${money(ach.reward)}).`, 'good');
}
function updateSocialStatus() {
  const wealth = totalWealth(), role = getRole().id;
  if (role === 'ceo') state.player.socialStatus = 'CEO';
  else if (wealth >= 1000000) state.player.socialStatus = 'Milionário';
  else if (houseNetWorth() >= 250000) state.player.socialStatus = 'Dono de imóveis';
  else if (totalInvested() >= 25000) state.player.socialStatus = 'Investidor';
  else if (totalDebts() > state.player.balance * 2) state.player.socialStatus = 'Endividado';
  else state.player.socialStatus = 'Trabalhador';
}

function renderAll() {
  if (!state) return;
  updateSocialStatus(); renderBadges();
  renderHome(); renderBank(); renderWork(); renderTaxes(); renderLoans(); renderHouses(); renderInvestments(); renderProfile(); renderRanking(); renderHistory(); renderAdmin();
}
function renderBadges(){ $('#scoreBadge').textContent = `Score ${state.player.score}`; $('#scoreBadge').className = `pill ${state.player.score>=700?'success':state.player.score<400?'debt':'warn'}`; $('#clockBadge').textContent = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}); }
function statCard(title, value, cls='', sub='') { return `<article class="card"><h3>${title}</h3><div class="metric ${cls}">${value}</div>${sub?`<p>${sub}</p>`:''}</article>`; }
function renderHome() {
  const home = getCurrentHome(); const role = getRole();
  $('#home').innerHTML = `
    <div class="grid cols-4">
      ${statCard('Saldo disponível', money(state.player.balance), 'money', 'Dinheiro livre para decisões.')}
      ${statCard('Dívidas totais', money(totalDebts()), 'debt', 'Empréstimos, contas e atrasos.')}
      ${statCard('Cargo atual', role.name, 'info', `${getCompany().name} • Salário ${money(role.salary)}`)}
      ${statCard('Patrimônio total', money(totalWealth()), totalWealth()>=0?'money':'debt', 'Saldo + bens + investimentos - dívidas.')}
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <article class="card"><h3>Progresso de vida</h3><p>Jogador: <strong>${state.player.name}</strong></p><p>Status social: <strong>${state.player.socialStatus}</strong></p><p>Casa atual: <strong>${home?home.name:'Sem casa'}</strong></p><p>Investimentos ativos: <strong>${state.investments.length}</strong></p><div class="progress"><span style="width:${clamp(state.player.score/10,0,100)}%"></span></div><p>Score financeiro: ${state.player.score}/1000</p></article>
      <article class="card"><h3>Avisos importantes</h3><div class="list">${state.notifications.slice(0,6).map(n=>`<div class="item"><div><strong>${n.text}</strong><span>${new Date(n.at).toLocaleString('pt-BR')}</span></div><span class="tag">${n.kind}</span></div>`).join('') || '<div class="empty">Nenhum aviso por enquanto.</div>'}</div></article>
    </div>`;
}
function renderBank() {
  const tabs = ['overview','debts','bills','loans','houses','investments','history'];
  const names = {overview:'Visão geral',debts:'Dívidas',bills:'Contas',loans:'Empréstimos',houses:'Casas',investments:'Investimentos',history:'Histórico'};
  let body = '';
  if (activeBankTab === 'overview') body = `<div class="grid cols-3">${statCard('Saldo', money(state.player.balance),'money')}${statCard('Dívidas', money(totalDebts()),'debt')}${statCard('Score', state.player.score,'info')}</div>`;
  if (activeBankTab === 'debts') body = renderDebtList('debts');
  if (activeBankTab === 'bills') body = renderDebtList('pendingBills');
  if (activeBankTab === 'loans') body = renderLoanList();
  if (activeBankTab === 'houses') body = `<div class="list">${state.houses.owned.map(h=>houseItem(h)).join('') || '<div class="empty">Nenhum imóvel.</div>'}</div>`;
  if (activeBankTab === 'investments') body = `<div class="list">${state.investments.map(inv=>investmentItem(inv)).join('') || '<div class="empty">Nenhum investimento.</div>'}</div>`;
  if (activeBankTab === 'history') body = renderTxTable();
  $('#bank').innerHTML = `<article class="card"><div class="bank-tabs">${tabs.map(t=>`<button class="bank-tab-btn ${activeBankTab===t?'active':''}" data-banktab="${t}">${names[t]}</button>`).join('')}</div>${body}</article>`;
  $$('[data-banktab]').forEach(b=>b.onclick=()=>{activeBankTab=b.dataset.banktab; renderBank();});
}
function renderDebtList(collection){ const arr=state.bank[collection].filter(d=>d.status!=='quitado'); return `<div class="list">${arr.map(d=>`<div class="item"><div><strong>${d.name}</strong><span>Original ${money(d.originalValue)} • Atual ${money(d.currentValue)} • Juros ${money(d.interest)} • Status ${d.status}</span></div><div class="actions"><button class="mini-btn good" onclick="payItem('${collection}','${d.id}')">Pagar</button></div></div>`).join('') || '<div class="empty">Nada pendente aqui.</div>'}</div>`; }
function renderLoanList(){ const arr=state.bank.loans; return `<div class="list">${arr.map(l=>`<div class="item"><div><strong>Empréstimo ${l.id.slice(-5)} • ${l.status}</strong><span>Inicial ${money(l.initialValue)} • Restante ${money(l.remaining)} • Parcela ${money(l.parcelValue)} • Próx. taxa ${new Date(l.nextChargeAt).toLocaleString('pt-BR')}</span></div><div class="actions"><button class="mini-btn good" onclick="payLoan('${l.id}', ${l.parcelValue})">Pagar parcela</button><button class="mini-btn" onclick="payLoan('${l.id}')">Quitar</button></div></div>`).join('') || '<div class="empty">Nenhum empréstimo.</div>'}</div>`; }
function renderTxTable(){ return `<table class="table"><thead><tr><th>Data</th><th>Motivo</th><th>Valor</th></tr></thead><tbody>${state.bank.transactions.slice(0,25).map(t=>`<tr><td>${new Date(t.at).toLocaleString('pt-BR')}</td><td>${t.reason}</td><td class="${t.amount>=0?'money':'debt'}">${money(t.amount)}</td></tr>`).join('')}</tbody></table>`; }
function renderWork(){ const role=getRole(), next=getNextRole(); const remaining=GAME_CONFIG.taskLimit-state.work.tasksDoneInWindow; $('#work').innerHTML=`<div class="grid cols-3">${statCard('Cargo', role.name,'info',`Salário ${money(role.salary)}`)}${statCard('XP', state.player.xp,'money',next?`Próximo: ${next.name} com ${next.xpRequired} XP`:'Cargo máximo')}${statCard('Tarefas restantes', remaining,'warn','Limite renova a cada 24h')}</div><div class="section-title"><h3>Atividades disponíveis</h3><span class="tag">Cada tarefa paga 10% do salário</span></div><div class="grid cols-2">${TASKS.map(t=>`<article class="card"><h3>${t.name}</h3><p>Ganho: <strong class="money">${money(role.salary*GAME_CONFIG.taskSalaryRate)}</strong> • XP: <strong>${t.xp}</strong></p><button class="primary-btn wide" onclick="doTask('${t.id}')">Cumprir tarefa</button></article>`).join('')}</div>${state.work.pendingPromotion?`<article class="card" style="margin-top:16px"><h3>Promoção pendente</h3><p>Sua promoção para <strong>${getCompany().roles.find(r=>r.id===state.work.pendingPromotion.targetRoleId).name}</strong> precisa ser aprovada no painel Admin / CEO.</p></article>`:''}`; }
function renderTaxes(){ $('#taxes').innerHTML=`<div class="grid cols-2"><article class="card"><h3>Dívidas e taxas</h3>${renderDebtList('debts')}</article><article class="card"><h3>Contas de vida</h3>${renderDebtList('pendingBills')}</article></div>`; }
function renderLoans(){ const limit=500+state.player.score*11+Math.max(0,totalWealth()*0.08); $('#loans').innerHTML=`<div class="grid cols-2"><article class="card"><h3>Solicitar empréstimo</h3><p>Taxa obrigatória: 5% a cada 3 horas. Limite atual: <strong>${money(limit)}</strong></p><div class="form-row"><input id="loanValue" type="number" placeholder="Valor" min="100"><input id="loanHours" type="number" placeholder="Prazo em horas" value="24"></div><div class="form-row" style="margin-top:10px"><input id="loanParcels" type="number" placeholder="Parcelas" value="4"><button class="primary-btn" onclick="requestLoan($('#loanValue').value,$('#loanHours').value,$('#loanParcels').value)">Pedir empréstimo</button></div></article><article class="card"><h3>Empréstimos ativos</h3>${renderLoanList()}</article></div>`; }
function houseItem(h){ const bills=h.bills.water+h.bills.energy+h.bills.internet; return `<div class="item"><div><strong>${h.name} • ${h.status}</strong><span>Valor ${money(h.totalValue)} • Aluguel ${money(h.rent)} • Contas ${money(bills)} • Comprada ${h.ownedPercent}% ${h.nextDueAt?`• Próx. ${new Date(h.nextDueAt).toLocaleString('pt-BR')}`:''}</span><div class="progress" style="margin-top:8px"><span style="width:${h.ownedPercent}%"></span></div></div><div class="actions">${h.purchaseOffer50?`<button class="mini-btn good" onclick="acceptBuy50('${h.id}')">Comprar 50%</button>`:''}${h.ownedPercent>=50&&h.ownedPercent<100?`<button class="mini-btn good" onclick="buyMoreHouse('${h.id}',10)">Comprar +10%</button>`:''}${h.ownedPercent>=100?`<button class="mini-btn" onclick="rentToNpc('${h.id}')">${h.rentedTo?'Encerrar aluguel':'Alugar p/ NPC'}</button>`:''}</div></div>`; }
function renderHouses(){ $('#houses').innerHTML=`<div class="grid cols-2"><article class="card"><h3>Mercado de casas</h3><div class="list">${HOUSES.map(h=>`<div class="item"><div><strong>${h.name}</strong><span>Valor ${money(h.totalValue)} • Aluguel ${money(h.rent)} • Contas ${money(h.bills.water+h.bills.energy+h.bills.internet)}</span></div><button class="mini-btn good" onclick="rentHouse('${h.id}')">Alugar</button></div>`).join('')}</div></article><article class="card"><h3>Minha moradia</h3><div class="list">${state.houses.owned.map(h=>houseItem(h)).join('') || '<div class="empty">Você ainda não tem casa.</div>'}</div></article></div>`; }
function investmentItem(inv){ const diff=inv.currentValue-inv.initialValue; return `<div class="item"><div><strong>${inv.name}</strong><span>Inicial ${money(inv.initialValue)} • Atual ${money(inv.currentValue)} • Resultado <b class="${diff>=0?'money':'debt'}">${money(diff)}</b> • Risco ${inv.risk}</span></div><button class="mini-btn good" onclick="withdrawInvestment('${inv.id}')">Retirar</button></div>`; }
function renderInvestments(){ $('#investments').innerHTML=`<div class="grid cols-2"><article class="card"><h3>Novos investimentos</h3><div class="list">${INVESTMENTS.map(i=>`<div class="item"><div><strong>${i.name}</strong><span>${i.description} • Mínimo ${money(i.min)} • Risco ${i.risk}</span><input id="inv_${i.id}" type="number" placeholder="Valor para investir" style="margin-top:8px"></div><button class="mini-btn good" onclick="invest('${i.id}', $('#inv_${i.id}').value)">Investir</button></div>`).join('')}</div></article><article class="card"><h3>Carteira ativa</h3><div class="list">${state.investments.map(inv=>investmentItem(inv)).join('') || '<div class="empty">Nenhum investimento ativo.</div>'}</div></article></div>`; }
function renderProfile(){ const role=getRole(); $('#profile').innerHTML=`<div class="grid cols-3">${statCard('Jogador',state.player.name,'info',state.player.socialStatus)}${statCard('Nível',state.player.level,'warn',`${state.player.xp} XP acumulado`)}${statCard('Score',state.player.score,'money','Afeta juros e limites')}</div><article class="card" style="margin-top:16px"><h3>Conquistas</h3><div class="grid cols-3">${ACHIEVEMENTS.map(a=>`<div class="item"><div><strong>${state.player.achievements.includes(a.id)?'✅':'🔒'} ${a.name}</strong><span>${a.description} • Recompensa ${money(a.reward)}</span></div></div>`).join('')}</div></article>`; }
function renderRanking(){ const me={name:state.player.name,wealth:totalWealth(),debt:totalDebts(),score:state.player.score,role:getRole().name,houses:state.houses.owned.length,invested:totalInvested(),tasks:state.work.taskLog.length}; const users=[me,...state.admin.fakeUsers]; const richest=[...users].sort((a,b)=>b.wealth-a.wealth); const score=[...users].sort((a,b)=>b.score-a.score); $('#ranking').innerHTML=`<div class="grid cols-2"><article class="card"><h3>Mais ricos</h3>${rankingTable(richest,'wealth')}</article><article class="card"><h3>Melhores scores</h3>${rankingTable(score,'score')}</article></div>`; }
function rankingTable(arr,key){ return `<table class="table"><thead><tr><th>#</th><th>Jogador</th><th>Valor</th></tr></thead><tbody>${arr.map((u,i)=>`<tr><td>${i+1}</td><td>${u.name}</td><td>${key==='wealth'?money(u[key]):u[key]}</td></tr>`).join('')}</tbody></table>`; }
function renderHistory(){ $('#history').innerHTML=`<article class="card"><h3>Histórico completo</h3><table class="table"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Status</th></tr></thead><tbody>${state.history.slice(0,100).map(h=>`<tr><td>${new Date(h.at).toLocaleString('pt-BR')}</td><td>${h.type}</td><td>${h.description}</td><td class="${h.value>=0?'money':'debt'}">${money(h.value)}</td><td>${h.status}</td></tr>`).join('')}</tbody></table></article>`; }
function renderAdmin(){ const company=getCompany(); const pending=state.work.pendingPromotion; $('#admin').innerHTML=`<div class="grid cols-2"><article class="card"><h3>Painel CEO/Admin</h3><p>Empresa: <strong>${company.name}</strong></p><p>Você pode aprovar promoções, controlar cargos e preparar expansão multiplayer.</p>${pending?`<div class="item"><div><strong>Promoção pendente</strong><span>${state.player.name} quer virar ${company.roles.find(r=>r.id===pending.targetRoleId).name}</span></div><div class="actions"><button class="mini-btn good" onclick="promoteTo('${pending.targetRoleId}','Promoção aprovada pelo CEO/Admin'); renderAll(); saveSilent();">Aprovar</button><button class="mini-btn bad" onclick="state.work.pendingPromotion=null; changeScore(-4,'Promoção negada'); renderAll(); saveSilent();">Negar</button></div></div>`:'<div class="empty">Nenhuma promoção pendente.</div>'}</article><article class="card"><h3>Cargos da empresa</h3><div class="list">${company.roles.map(r=>`<div class="item"><div><strong>${r.name}</strong><span>Salário ${money(r.salary)} • XP ${r.xpRequired} • Bônus ${money(r.bonus)} • ${r.needsApproval?'Precisa aprovação':'Automático'}</span></div></div>`).join('')}</div></article></div>`; }


/* =========================================================
   Atualização v2.5.0 - Expansão profissional sem remover base
   Mantém sistemas existentes e adiciona: metas, energia, loja,
   pagamentos parciais, resumo offline, eventos de mercado,
   export/import de save, filtros de histórico e preparo backend.
========================================================= */

const DAILY_GOAL_TEMPLATES = [
  { id:'tasks3', name:'Fazer 3 tarefas', target:3, metric:'tasks', reward:{ money:120, xp:80, score:6 } },
  { id:'pay1', name:'Pagar 1 pendência', target:1, metric:'payments', reward:{ money:80, xp:40, score:10 } },
  { id:'invest1', name:'Fazer 1 investimento', target:1, metric:'investments', reward:{ money:100, xp:50, score:7 } },
  { id:'save500', name:'Terminar com R$ 500+', target:500, metric:'balance', reward:{ money:140, xp:60, score:8 } },
  { id:'work5', name:'Completar 5 ações de trabalho', target:5, metric:'tasks', reward:{ money:180, xp:120, score:9 } }
];

const SHOP_ITEMS = [
  { id:'finance-consult', name:'Consultoria financeira', price:450, icon:'🧠', description:'Aumenta score imediatamente e reduz risco bancário.', apply(){ changeScore(28, 'Consultoria financeira aplicada'); } },
  { id:'home-insurance', name:'Seguro residencial', price:850, icon:'🛡️', description:'Protege uma cobrança grave de casa e reduz multa futura.', apply(){ state.shop.effects.homeInsurance = (state.shop.effects.homeInsurance||0)+1; addHistory('loja','Seguro residencial contratado.', -850, 'ok'); } },
  { id:'career-course', name:'Curso profissional', price:650, icon:'📚', description:'Ganha XP profissional e melhora chance de promoção.', apply(){ state.player.xp += 260; addHistory('trabalho','Curso profissional concluído: +260 XP.', 0, 'ok'); checkPromotion(); } },
  { id:'productivity-tool', name:'Ferramenta de produtividade', price:520, icon:'⚙️', description:'Recupera energia e dá bônus na próxima tarefa.', apply(){ state.work.energy = Math.min(100, (state.work.energy||100)+35); state.shop.effects.taskBonus = (state.shop.effects.taskBonus||0)+1; addHistory('loja','Ferramenta de produtividade ativada.', -520, 'ok'); } },
  { id:'fine-protection', name:'Proteção contra multa', price:700, icon:'🚨', description:'Cancela a próxima multa/juros pequeno de atraso.', apply(){ state.shop.effects.fineShield = (state.shop.effects.fineShield||0)+1; addHistory('loja','Proteção contra multa comprada.', -700, 'ok'); } }
];

const MARKET_EVENTS = [
  { name:'Alta da bolsa', kind:'good', target:'Bolsa', impact:0.08, text:'A bolsa valorizou e investimentos de risco subiram.' },
  { name:'Queda no mercado', kind:'bad', target:'Bolsa', impact:-0.07, text:'O mercado caiu e investimentos de bolsa sofreram.' },
  { name:'Valorização imobiliária', kind:'good', target:'Imóveis', impact:0.045, text:'Imóveis valorizaram com demanda alta.' },
  { name:'Crise econômica', kind:'bad', target:'all', impact:-0.035, text:'Crise econômica afetou investimentos.' },
  { name:'Oportunidade rara', kind:'good', target:'all', impact:0.03, text:'Uma oportunidade rara melhorou sua carteira.' }
];

const oldCreateDefaultState = createDefaultState;
createDefaultState = function(name = 'Jogador', companyId = COMPANIES[0].id) {
  const s = oldCreateDefaultState(name, companyId);
  enhanceState(s, true);
  return s;
};

migrateSave = function() {
  state.admin ||= { companies: JSON.parse(JSON.stringify(COMPANIES)), fakeUsers: [] };
  state.admin.companies ||= JSON.parse(JSON.stringify(COMPANIES));
  state.admin.fakeUsers ||= [];
  state.bank ||= { debts: [], loans: [], pendingBills: [], transactions: [] };
  state.bank.debts ||= []; state.bank.loans ||= []; state.bank.pendingBills ||= []; state.bank.transactions ||= [];
  state.houses ||= { currentHomeId: null, owned: [], rentStreak: 0 };
  state.houses.owned ||= [];
  state.investments ||= [];
  state.notifications ||= [];
  state.history ||= [];
  enhanceState(state, false);
  sanitizeEconomy();
};

function enhanceState(s, fresh=false) {
  s.version = GAME_CONFIG.version;
  s.player ||= {};
  s.player.level ||= Math.max(1, Math.floor((s.player.xp||0) / 900) + 1);
  s.player.reputation ||= 'Trabalhador';
  s.player.stats ||= { tasks:0, payments:0, investments:0, loans:0, houses:0, shop:0 };
  s.work ||= {};
  s.work.energy = Number.isFinite(s.work.energy) ? s.work.energy : 100;
  s.work.fatigue = Number.isFinite(s.work.fatigue) ? s.work.fatigue : 0;
  s.work.dailyStreak ||= 0;
  s.work.lastWorkedDay ||= null;
  s.work.performance ||= 50;
  s.work.companyGoals ||= [];
  s.goals ||= { dayKey: '', list: [] };
  s.shop ||= { purchases: [], effects: {} };
  s.market ||= { lastEventAt: now(), events: [] };
  s.settings ||= { backendMode: 'local-first', apiBaseUrl: '', maintenance:false };
  s.lastOfflineSummary ||= null;
  if (fresh || !s.goals.list.length) refreshDailyGoals(s);
}

function dayKey(ts=now()) { return new Date(ts).toISOString().slice(0,10); }
function minutesLeft(ms) { return `${Math.max(0, Math.ceil(ms/60000))} min`; }
function getLoanLimit() { return Math.max(300, 500 + state.player.score * 12 + Math.max(0,totalWealth()) * 0.09 - totalDebts()*0.18); }
function statusClassFromValue(v){ return v>=0?'money':'debt'; }
function sanitizeMoney(v){ return Math.max(0, Math.round(Number(v||0)*100)/100); }
function sanitizeEconomy(){
  state.player.balance = sanitizeMoney(state.player.balance);
  [...state.bank.debts, ...state.bank.pendingBills].forEach(d=>{ d.originalValue=sanitizeMoney(d.originalValue); d.currentValue=sanitizeMoney(d.currentValue); d.interest=sanitizeMoney(d.interest); d.status ||= 'em dia'; });
  state.bank.loans.forEach(l=>{ l.initialValue=sanitizeMoney(l.initialValue); l.remaining=sanitizeMoney(l.remaining); l.currentValue=sanitizeMoney(l.currentValue); l.paid=sanitizeMoney(l.paid); l.parcelValue=sanitizeMoney(l.parcelValue); });
  state.investments.forEach(i=>{ i.initialValue=sanitizeMoney(i.initialValue); i.currentValue=sanitizeMoney(i.currentValue); i.history ||= []; });
}
function currentXPPercent(){ const next=getNextRole(); if(!next) return 100; const prev=getRole().xpRequired||0; return clamp(((state.player.xp-prev)/(next.xpRequired-prev))*100,0,100); }
function getFinancialRisk(){ const debt=totalDebts(); const ratio=debt/Math.max(1,state.player.balance+totalInvested()+houseNetWorth()); if(state.player.score<350||ratio>.8) return {label:'Crítico', cls:'debt'}; if(state.player.score<550||ratio>.35) return {label:'Atenção', cls:'warn'}; return {label:'Saudável', cls:'money'}; }
function nextChargeText(){ const dates=[]; state.bank.loans.filter(l=>l.status!=='Quitado').forEach(l=>dates.push(l.nextChargeAt)); const h=getCurrentHome(); if(h) dates.push(h.nextDueAt); [...state.bank.pendingBills,...state.bank.debts].filter(d=>d.status!=='quitado').forEach(d=>dates.push(d.graceAt||d.dueAt)); const t=Math.min(...dates.filter(Boolean)); return Number.isFinite(t)?new Date(t).toLocaleString('pt-BR'):'Nenhum vencimento'; }

function refreshDailyGoals(s=state){
  const dk=dayKey();
  if(s.goals?.dayKey === dk && s.goals.list?.length) return;
  const chosen = [...DAILY_GOAL_TEMPLATES].sort(()=>Math.random()-.5).slice(0,3);
  s.goals = { dayKey: dk, list: chosen.map(g=>({ ...g, progress:0, completed:false, claimed:false })) };
  if(s === state && state?.history) addHistory('sistema','Novas metas diárias foram geradas.',0,'ok');
}
function updateGoal(metric, amount=1){
  refreshDailyGoals();
  state.goals.list.forEach(g=>{
    if(g.completed) return;
    if(g.metric === metric) g.progress = Math.min(g.target, (g.progress||0)+amount);
    if(g.metric === 'balance') g.progress = state.player.balance;
    if(g.progress >= g.target){
      g.completed = true;
      notify(`Meta concluída: ${g.name}. Resgate sua recompensa na aba Metas.`, 'good');
      addHistory('metas',`Meta diária concluída: ${g.name}.`,0,'ok');
    }
  });
}
function claimGoal(goalId){
  const g=state.goals.list.find(x=>x.id===goalId); if(!g||!g.completed||g.claimed) return;
  g.claimed=true;
  state.player.balance += g.reward.money;
  state.player.xp += g.reward.xp;
  changeScore(g.reward.score, `Recompensa de meta: ${g.name}`);
  addHistory('metas',`Recompensa resgatada: ${g.name}.`,g.reward.money,'ok');
  notify(`Recompensa recebida: ${money(g.reward.money)}, ${g.reward.xp} XP e +${g.reward.score} score.`, 'good');
  renderAll(); saveSilent();
}

function applyMarketEvent(force=false){
  if(!force && now() - (state.market.lastEventAt||0) < 6*3600000) return;
  const ev = MARKET_EVENTS[Math.floor(Math.random()*MARKET_EVENTS.length)];
  let totalImpact=0;
  state.investments.forEach(inv=>{
    if(ev.target==='all' || inv.type===ev.target){
      const change = Math.round(inv.currentValue * ev.impact * 100)/100;
      inv.currentValue = Math.max(0, Math.round((inv.currentValue + change)*100)/100);
      inv.history.unshift({ at:now(), result:change, rate:ev.impact, event:ev.name });
      totalImpact += change;
    }
  });
  state.market.lastEventAt = now();
  state.market.events.unshift({ ...ev, at:now(), totalImpact });
  state.market.events = state.market.events.slice(0,20);
  if(state.investments.length){
    addHistory('mercado', `${ev.name}: ${ev.text} Impacto ${money(totalImpact)}.`, totalImpact, ev.kind==='good'?'ok':'alerta');
    notify(`${ev.name}: ${money(totalImpact)} na carteira.`, ev.kind);
  }
}

const oldProcessOfflineTime = processOfflineTime;
processOfflineTime = function(forceNotice=false){
  const before = {
    debt: totalDebts(), inv: totalInvested(), bills: state.bank.pendingBills.filter(b=>b.status!=='quitado').length,
    balance: state.player.balance, lastSeen: state.lastSeen || now()
  };
  oldProcessOfflineTime(forceNotice);
  refreshDailyGoals();
  applyMarketEvent(false);
  regenerateEnergy();
  state.player.level = Math.max(1, Math.floor((state.player.xp||0)/900)+1);
  state.lastOfflineSummary = {
    elapsed: now() - before.lastSeen,
    debtChange: totalDebts() - before.debt,
    investmentChange: totalInvested() - before.inv,
    newBills: state.bank.pendingBills.filter(b=>b.status!=='quitado').length - before.bills,
    balanceChange: state.player.balance - before.balance,
    at: now()
  };
  sanitizeEconomy();
};
function regenerateEnergy(){
  const since = now() - (state.work.lastEnergyAt || now());
  if(since > 0){
    const add = Math.floor(since / (30*60000)) * 4;
    if(add>0){ state.work.energy = Math.min(100, (state.work.energy||0)+add); state.work.lastEnergyAt = now(); }
  } else state.work.lastEnergyAt = now();
}

const oldChangeBalance = changeBalance;
changeBalance = function(amount, reason, type='transacao'){
  if(!Number.isFinite(Number(amount))) return false;
  const ok = oldChangeBalance(Number(amount), reason, type);
  if(ok){ state.bank.transactions[0].category = type; updateGoal('balance',0); }
  return ok;
};

function payPartial(collection, itemId){
  const item = state.bank[collection].find(d=>d.id===itemId);
  if(!item || item.status==='quitado') return;
  const raw = prompt(`Quanto deseja pagar de ${item.name}? Valor atual: ${money(item.currentValue)}`);
  const value = Number(raw);
  if(!value || value<=0) return toast('Pagamento parcial cancelado ou inválido.', 'warn');
  const pay = Math.min(value, item.currentValue);
  if(!changeBalance(-pay, `Pagamento parcial: ${item.name}`, 'pagamento')) return toast('Saldo insuficiente para esse pagamento parcial.', 'bad');
  item.currentValue = Math.round((item.currentValue-pay)*100)/100;
  item.status = item.currentValue<=0.01?'quitado':'parcial';
  if(item.status==='quitado') item.currentValue=0;
  state.player.stats.payments += 1;
  updateGoal('payments',1);
  changeScore(item.status==='quitado'?14:6, item.status==='quitado'?'Dívida quitada por pagamento parcial':'Pagamento parcial realizado');
  addHistory('impostos', `${item.status==='quitado'?'Quitação':'Pagamento parcial'} de ${item.name}. Restante ${money(item.currentValue)}.`, -pay, 'ok');
  unlockAchievement('first-debt-paid');
  renderAll(); saveSilent();
}

payItem = function(collection, itemId) {
  const item = state.bank[collection].find(d => d.id === itemId);
  if (!item || item.status === 'quitado') return;
  if (!changeBalance(-item.currentValue, `Pagamento: ${item.name}`, 'pagamento')) return toast('Saldo insuficiente para pagar essa pendência.', 'bad');
  item.status = 'quitado';
  item.currentValue = 0;
  state.player.stats.payments += 1;
  updateGoal('payments',1);
  changeScore(14, 'Pagamento realizado em dia');
  unlockAchievement('first-debt-paid');
  if (item.category === 'casa') {
    state.houses.rentStreak += 1;
    unlockAchievement('first-rent-paid');
    const home = getCurrentHome();
    if (home && state.houses.rentStreak >= 5 && home.ownedPercent < 50) {
      home.purchaseOffer50 = true;
      notify('Banco liberou proposta para comprar 50% da casa.', 'good');
    }
  }
  renderAll(); saveSilent();
};

const oldCreateDebt = createDebt;
createDebt = function(type, name, value, category='geral', refId=null){
  if(state.shop?.effects?.fineShield && (type.includes('fee') || category==='casa')){
    state.shop.effects.fineShield -= 1;
    addHistory('loja', `Proteção contra multa cancelou uma cobrança: ${name}.`, value, 'ok');
    notify('Proteção contra multa usada. Uma cobrança foi bloqueada.', 'good');
    return;
  }
  return oldCreateDebt(type,name,sanitizeMoney(value),category,refId);
};

const oldDoTask = doTask;
doTask = function(taskId){
  resetWorkWindowIfNeeded(); regenerateEnergy();
  if ((state.work.energy||0) < 12) return toast('Energia baixa. Aguarde recuperar ou compre ferramenta de produtividade na loja.', 'warn');
  const task = TASKS.find(t=>t.id===taskId); if(!task) return;
  const rare = Math.random() < 0.10;
  const urgent = Math.random() < 0.08;
  const beforeXP = state.player.xp;
  const oldBonus = state.shop.effects.taskBonus||0;
  oldDoTask(taskId);
  if(state.player.xp !== beforeXP){
    const drain = rare ? 18 : urgent ? 20 : 12;
    state.work.energy = clamp((state.work.energy||100)-drain,0,100);
    state.work.fatigue = clamp((state.work.fatigue||0)+Math.round(drain/2),0,100);
    state.work.performance = clamp((state.work.performance||50)+2,0,100);
    if(oldBonus>0){
      const extra = Math.round(getRole().salary * 0.04);
      state.shop.effects.taskBonus -= 1;
      changeBalance(extra, `Bônus da ferramenta de produtividade em ${task.name}`, 'trabalho');
    }
    if(rare || urgent){
      const extraXP = rare ? 90 : 60;
      const extraMoney = Math.round(getRole().salary * (rare ? 0.08 : 0.05));
      state.player.xp += extraXP;
      changeBalance(extraMoney, `${rare?'Tarefa rara':'Tarefa urgente'}: bônus extra`, 'trabalho');
      notify(`${rare?'Tarefa rara':'Tarefa urgente'} concluída: bônus de ${money(extraMoney)} e ${extraXP} XP.`, 'good');
    }
    state.player.stats.tasks += 1;
    state.work.lastWorkedDay = dayKey();
    updateGoal('tasks',1);
  }
  saveSilent(); renderAll();
};

requestLoan = function(value, hoursDeadline, parcels) {
  value = Number(value); hoursDeadline = Number(hoursDeadline); parcels = Number(parcels);
  if (!value || value < 100) return toast('Digite um valor de empréstimo válido.', 'bad');
  if(totalDebts() > Math.max(1000, state.player.balance*2.5) || state.player.score < 250) return toast('Crédito bloqueado: dívidas altas ou score muito baixo.', 'bad');
  const limit = getLoanLimit();
  if (value > limit) return toast(`Seu limite atual é ${money(limit)}.`, 'bad');
  hoursDeadline = clamp(hoursDeadline||24, 3, 720); parcels = clamp(parcels||4, 1, 48);
  const cycles = Math.ceil(hoursDeadline / 3);
  const fee = Math.round(value * GAME_CONFIG.loanFeeRate * 100) / 100;
  const total = Math.round((value + fee) * 100) / 100;
  const loan = { id:id('loan'), initialValue:value, currentValue:total, paid:0, remaining:total, startAt:now(), dueAt:now()+hoursDeadline*3600000, nextChargeAt:now()+GAME_CONFIG.loanCycleMs, parcels, parcelValue:Math.round((total/parcels)*100)/100, cycles, status:'Ativo', history:[{at:now(), type:'solicitado', value}] };
  state.bank.loans.unshift(loan);
  state.player.stats.loans += 1;
  changeBalance(value, `Empréstimo recebido ${loan.id.slice(-5)}`, 'empréstimo');
  changeScore(-12, 'Novo empréstimo solicitado');
  unlockAchievement('first-loan');
  notify(`Empréstimo aprovado: ${money(value)}. Taxa inicial: ${money(fee)}.`, 'good');
  renderAll(); saveSilent();
};
function simulateLoan(){
  const v=Number($('#loanValue')?.value), h=Number($('#loanHours')?.value||24), p=Number($('#loanParcels')?.value||4);
  if(!v||v<100) return toast('Digite um valor para simular.', 'warn');
  const cycles=Math.ceil(h/3), initialFee=v*GAME_CONFIG.loanFeeRate, risk=v>getLoanLimit()*0.7?'Alto':v>getLoanLimit()*0.4?'Médio':'Baixo';
  $('#loanSimulation').innerHTML = `<div class="item"><div><strong>Simulação do empréstimo</strong><span>Valor ${money(v)} • Taxa inicial ${money(initialFee)} • ${cycles} ciclos de 3h até o prazo • Parcela média ${money((v+initialFee)/Math.max(1,p))} • Risco ${risk} • Impacto inicial no score: -12</span></div></div>`;
}

const oldInvest = invest;
invest = function(templateId, value){
  const before = state.investments.length;
  oldInvest(templateId,value);
  if(state.investments.length>before){ state.player.stats.investments += 1; updateGoal('investments',1); }
};

function buyShopItem(itemId){
  const item=SHOP_ITEMS.find(i=>i.id===itemId); if(!item) return;
  if(!changeBalance(-item.price, `Compra na loja: ${item.name}`, 'loja')) return toast('Saldo insuficiente para comprar esse item.', 'bad');
  state.shop.purchases.unshift({ id:id('shop'), itemId, name:item.name, price:item.price, at:now() });
  state.player.stats.shop += 1;
  item.apply();
  notify(`${item.name} comprado e aplicado.`, 'good');
  renderAll(); saveSilent();
}
function sellHouse(homeId){
  const home=state.houses.owned.find(h=>h.id===homeId); if(!home||home.ownedPercent<=0) return toast('Você não possui porcentagem suficiente para vender.', 'bad');
  const marketFactor = 0.92 + Math.random()*0.18;
  const ownedValue = home.totalValue*(home.ownedPercent/100);
  const sale = Math.round(ownedValue*marketFactor*100)/100;
  confirmModal('Vender imóvel', `Vender ${home.name} por ${money(sale)}? Essa ação remove o imóvel do seu perfil.`, ()=>{
    changeBalance(sale, `Venda da casa ${home.name}`, 'casa');
    state.houses.owned = state.houses.owned.filter(h=>h.id!==homeId);
    if(state.houses.currentHomeId===homeId) state.houses.currentHomeId=null;
    addHistory('casa', `Imóvel vendido: ${home.name}.`, sale, 'ok');
    renderAll(); saveSilent();
  });
}
function reformHouse(homeId){
  const home=state.houses.owned.find(h=>h.id===homeId); if(!home) return;
  const cost=Math.round(home.totalValue*0.015);
  if(!changeBalance(-cost, `Reforma da casa ${home.name}`, 'casa')) return toast(`Saldo insuficiente. Reforma custa ${money(cost)}.`, 'bad');
  home.totalValue=Math.round(home.totalValue*1.025);
  home.rent=Math.round(home.rent*1.018);
  addHistory('casa', `Reforma aumentou valor de mercado de ${home.name}.`, -cost, 'ok');
  notify('Reforma concluída. Valor e aluguel potencial aumentaram.', 'good');
  renderAll(); saveSilent();
}

function exportSave(){
  saveSilent();
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=`vida-financeira-rp-save-${dayKey()}.json`; a.click();
  URL.revokeObjectURL(a.href);
  toast('Save exportado.', 'good');
}
function importSaveInput(){ $('#importSaveFile').click(); }
function handleImportSave(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{ const imported=JSON.parse(reader.result); if(!imported.player||!imported.bank) throw new Error('save inválido'); state=imported; migrateSave(); saveSilent(); renderAll(); toast('Save importado com sucesso.', 'good'); }
    catch(e){ toast('Arquivo de save inválido ou corrompido.', 'bad'); }
  };
  reader.readAsText(file);
}
function createBackup(){
  const key=`${GAME_CONFIG.saveKey}.backup.${Date.now()}`;
  localStorage.setItem(key, JSON.stringify(state));
  toast('Backup local criado no navegador.', 'good');
}

renderAll = function() {
  if (!state) return;
  refreshDailyGoals(); updateSocialStatus(); renderBadges();
  renderHome(); renderBank(); renderWork(); renderTaxes(); renderLoans(); renderHouses(); renderInvestments(); renderGoals(); renderShop(); renderProfile(); renderRanking(); renderHistory(); renderAdmin();
};

switchTab = function(tab) {
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === tab));
  $('#tabTitle').textContent = ({home:'Home',bank:'Banco',work:'Trabalho',taxes:'Impostos',loans:'Empréstimos',houses:'Casas',investments:'Investimentos',goals:'Metas',shop:'Loja',profile:'Perfil',ranking:'Ranking',history:'Histórico',admin:'Admin / CEO'})[tab] || 'Home';
  renderAll();
};

function smartCard(title, value, cls='', sub='', icon='') { return `<article class="card smart-card"><div class="smart-icon">${icon}</div><h3>${title}</h3><div class="metric ${cls}">${value}</div>${sub?`<p>${sub}</p>`:''}</article>`; }
renderHome = function(){
  const home=getCurrentHome(), role=getRole(), risk=getFinancialRisk(), next=getNextRole();
  const xpPct=currentXPPercent(); const s=state.lastOfflineSummary;
  $('#home').innerHTML = `
    <div class="hero-panel card"><div><p class="eyebrow">Painel principal</p><h2>${state.player.name}, sua vida financeira está em modo <span class="${risk.cls}">${risk.label}</span></h2><p>Controle trabalho, banco, imóveis, crédito e investimentos sem perder o ritmo.</p></div><div class="hero-score"><strong>${state.player.score}</strong><span>Score</span></div></div>
    <div class="grid cols-4">
      ${smartCard('Saldo atual', money(state.player.balance), 'money', 'Dinheiro disponível para decisões.', '💵')}
      ${smartCard('Patrimônio total', money(totalWealth()), totalWealth()>=0?'money':'debt', 'Saldo + bens + investimentos - dívidas.', '🏛️')}
      ${smartCard('Dívidas totais', money(totalDebts()), 'debt', 'Empréstimos, contas e multas.', '⚠️')}
      ${smartCard('Próxima cobrança', nextChargeText(), 'warn', 'Tempo real/offline ativo.', '⏰')}
    </div>
    <div class="grid cols-3" style="margin-top:16px">
      <article class="card"><h3>Status do trabalho</h3><p><strong>${role.name}</strong> em ${getCompany().name}</p><div class="progress"><span style="width:${xpPct}%"></span></div><p>XP para próximo cargo: ${next?`${state.player.xp}/${next.xpRequired}`:'cargo máximo'} • Energia ${state.work.energy}%</p></article>
      <article class="card"><h3>Status da casa</h3><p>${home?`${home.name} • ${home.status}`:'Sem moradia ativa'}</p><p>${home?`Comprada ${home.ownedPercent}% • Próximo vencimento ${new Date(home.nextDueAt).toLocaleString('pt-BR')}`:'Alugue uma casa para evoluir e liberar compra parcial.'}</p></article>
      <article class="card"><h3>Resumo de investimentos</h3><p>Ativos: <strong>${state.investments.length}</strong></p><p>Carteira: <strong class="money">${money(totalInvested())}</strong></p><button class="mini-btn" onclick="switchTab('investments')">Abrir investimentos</button></article>
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <article class="card"><h3>Enquanto você esteve fora</h3>${s?`<div class="list"><div class="item"><div><strong>Resumo offline</strong><span>Tempo: ${hours(s.elapsed)}h • Dívida ${money(s.debtChange)} • Investimentos ${money(s.investmentChange)} • Novas contas ${s.newBills}</span></div></div></div>`:'<div class="empty">Nenhum resumo offline ainda.</div>'}</article>
      <article class="card"><h3>Últimas ações</h3><div class="list">${state.history.slice(0,5).map(h=>`<div class="item"><div><strong>${h.description}</strong><span>${h.type} • ${new Date(h.at).toLocaleString('pt-BR')}</span></div><span class="tag ${h.status==='alerta'?'warn':''}">${h.status}</span></div>`).join('') || '<div class="empty">Sem ações registradas.</div>'}</div></article>
    </div>`;
};

renderBank = function(){
  const tabs=['overview','debts','bills','loans','houses','investments','history'];
  const names={overview:'Visão geral',debts:'Dívidas',bills:'Contas',loans:'Empréstimos',houses:'Casas',investments:'Investimentos',history:'Extrato'};
  const limit=getLoanLimit(), risk=getFinancialRisk();
  let body='';
  if(activeBankTab==='overview') body=`<div class="grid cols-4">${statCard('Saldo',money(state.player.balance),'money')}${statCard('Limite de crédito',money(limit),'info',state.player.score<250?'Bloqueado por score baixo':'Baseado no score')}${statCard('Score bancário',state.player.score,risk.cls,risk.label)}${statCard('Resumo mensal',money(state.bank.transactions.slice(0,50).reduce((s,t)=>s+t.amount,0)), 'warn','Últimas 50 movimentações')}</div><div class="section-title"><h3>Alertas de risco</h3></div><div class="list">${state.notifications.slice(0,5).map(n=>`<div class="item"><div><strong>${n.text}</strong><span>${new Date(n.at).toLocaleString('pt-BR')}</span></div><span class="tag">${n.kind}</span></div>`).join('') || '<div class="empty">Sem alertas.</div>'}</div>`;
  if(activeBankTab==='debts') body=renderDebtList('debts');
  if(activeBankTab==='bills') body=renderDebtList('pendingBills');
  if(activeBankTab==='loans') body=renderLoanList();
  if(activeBankTab==='houses') body=`<div class="list">${state.houses.owned.map(h=>houseItem(h)).join('') || '<div class="empty">Nenhum imóvel.</div>'}</div>`;
  if(activeBankTab==='investments') body=`<div class="list">${state.investments.map(inv=>investmentItem(inv)).join('') || '<div class="empty">Nenhum investimento.</div>'}</div>`;
  if(activeBankTab==='history') body=`<div class="section-title"><h3>Extrato bancário</h3><select id="txFilter" onchange="renderBank()"><option value="all">Todas</option><option value="trabalho">Trabalho</option><option value="pagamento">Pagamentos</option><option value="empréstimo">Empréstimos</option><option value="investimento">Investimentos</option><option value="casa">Casa</option></select></div>${renderTxTable($('#txFilter')?.value || 'all')}`;
  $('#bank').innerHTML=`<article class="card"><div class="bank-tabs">${tabs.map(t=>`<button class="bank-tab-btn ${activeBankTab===t?'active':''}" data-banktab="${t}">${names[t]}</button>`).join('')}</div>${body}</article>`;
  $$('[data-banktab]').forEach(b=>b.onclick=()=>{activeBankTab=b.dataset.banktab; renderBank();});
};

renderDebtList = function(collection){
  const arr=state.bank[collection].filter(d=>d.status!=='quitado');
  return `<div class="list">${arr.map(d=>{ const priority=d.status==='atrasado'||d.status==='crítico'?'Alta':d.currentValue>1000?'Média':'Baixa'; return `<div class="item"><div><strong>${d.name}</strong><span>Original ${money(d.originalValue)} • Atual ${money(d.currentValue)} • Juros ${money(d.interest)} • Status ${d.status} • Prioridade ${priority}</span><span>Vencimento ${new Date(d.dueAt||d.createdAt).toLocaleString('pt-BR')} ${d.graceAt?`• Multa após ${new Date(d.graceAt).toLocaleString('pt-BR')}`:''}</span></div><div class="actions"><button class="mini-btn good" onclick="payItem('${collection}','${d.id}')">Pagar tudo</button><button class="mini-btn" onclick="payPartial('${collection}','${d.id}')">Pagar parcial</button></div></div>`}).join('') || '<div class="empty">Nada pendente aqui.</div>'}</div>`;
};
renderLoans = function(){ const limit=getLoanLimit(); $('#loans').innerHTML=`<div class="grid cols-2"><article class="card"><h3>Solicitar empréstimo</h3><p>Taxa obrigatória: 5% a cada 3 horas. Limite atual: <strong>${money(limit)}</strong>. Crédito ${state.player.score<250?'bloqueado':'ativo'}.</p><div class="form-row"><input id="loanValue" type="number" placeholder="Valor" min="100"><input id="loanHours" type="number" placeholder="Prazo em horas" value="24"></div><div class="form-row" style="margin-top:10px"><input id="loanParcels" type="number" placeholder="Parcelas" value="4"><button class="primary-btn" onclick="requestLoan($('#loanValue').value,$('#loanHours').value,$('#loanParcels').value)">Pedir empréstimo</button></div><button class="ghost-btn wide" onclick="simulateLoan()">Simular antes de confirmar</button><div id="loanSimulation" style="margin-top:12px"></div></article><article class="card"><h3>Empréstimos ativos</h3>${renderLoanList()}</article></div>`; };
renderLoanList = function(){ const arr=state.bank.loans; return `<div class="list">${arr.map(l=>`<div class="item"><div><strong>Empréstimo ${l.id.slice(-5)} • ${l.status}</strong><span>Inicial ${money(l.initialValue)} • Restante ${money(l.remaining)} • Pago ${money(l.paid)} • Parcela ${money(l.parcelValue)}</span><span>Próx. taxa ${new Date(l.nextChargeAt).toLocaleString('pt-BR')} • Vence ${new Date(l.dueAt).toLocaleString('pt-BR')}</span></div><div class="actions"><button class="mini-btn good" onclick="payLoan('${l.id}', ${l.parcelValue})">Pagar parcela</button><button class="mini-btn" onclick="payLoan('${l.id}')">Quitar</button></div></div>`).join('') || '<div class="empty">Nenhum empréstimo.</div>'}</div>`; };
renderTxTable = function(filter='all'){ const rows=state.bank.transactions.filter(t=>filter==='all'||t.type===filter||t.category===filter).slice(0,80); return `<table class="table"><thead><tr><th>Data</th><th>Categoria</th><th>Motivo</th><th>Valor</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${new Date(t.at).toLocaleString('pt-BR')}</td><td>${t.type||t.category||'geral'}</td><td>${t.reason}</td><td class="${t.amount>=0?'money':'debt'}">${money(t.amount)}</td></tr>`).join('')}</tbody></table>`; };
renderWork = function(){ const role=getRole(), next=getNextRole(), remaining=GAME_CONFIG.taskLimit-state.work.tasksDoneInWindow; $('#work').innerHTML=`<div class="grid cols-4">${statCard('Cargo',role.name,'info',`Salário ${money(role.salary)}`)}${statCard('XP profissional',state.player.xp,'money',next?`Próximo: ${next.name} com ${next.xpRequired} XP`:'Cargo máximo')}${statCard('Energia',`${state.work.energy}%`,state.work.energy<25?'debt':'warn','Tarefas consomem energia')}${statCard('Desempenho',`${state.work.performance}%`,'info','Afeta reputação profissional')}</div><article class="card" style="margin-top:16px"><h3>Progresso para promoção</h3><div class="progress"><span style="width:${currentXPPercent()}%"></span></div><p>${next?`Requisito: ${next.xpRequired} XP • ${next.needsApproval?'Aprovação CEO/Admin obrigatória':'Promoção automática'}`:'Você chegou no topo.'}</p></article><div class="section-title"><h3>Atividades disponíveis</h3><span class="tag">Cada tarefa paga 10% do salário + chances reais de bônus</span></div><div class="grid cols-2">${TASKS.map(t=>`<article class="card"><h3>${t.name}</h3><p>${t.description||'Tarefa da empresa com recompensa financeira e XP.'}</p><p>Ganho: <strong class="money">${money(role.salary*GAME_CONFIG.taskSalaryRate)}</strong> • XP: <strong>${t.xp}</strong> • Dificuldade: <strong>${t.risk>.05?'Alta':t.risk>.025?'Média':'Baixa'}</strong></p><button class="primary-btn wide" onclick="doTask('${t.id}')">Cumprir tarefa</button></article>`).join('')}</div>${state.work.pendingPromotion?`<article class="card" style="margin-top:16px"><h3>Promoção pendente</h3><p>Sua promoção para <strong>${getCompany().roles.find(r=>r.id===state.work.pendingPromotion.targetRoleId).name}</strong> precisa ser aprovada no painel Admin / CEO.</p></article>`:''}`; };
renderTaxes = function(){ $('#taxes').innerHTML=`<div class="grid cols-2"><article class="card"><h3>Dívidas, taxas e empréstimos</h3>${renderDebtList('debts')}</article><article class="card"><h3>Contas de vida</h3>${renderDebtList('pendingBills')}</article></div><article class="card" style="margin-top:16px"><h3>Central de pagamento parcial</h3><p>Agora você pode pagar uma parte da dívida. O restante continua ativo e os juros seguem apenas sobre o valor que sobrar.</p></article>`; };

houseItem = function(h){ const bills=h.bills.water+h.bills.energy+h.bills.internet; const market=Math.round(h.totalValue*(0.98+((state.player.score-500)/10000))); return `<div class="item"><div><strong>${h.name} • ${h.status}</strong><span>Valor mercado ${money(market)} • Aluguel ${money(h.rent)} • Contas ${money(bills)} • Comprada ${h.ownedPercent}%</span><span>Manutenção estimada ${money(h.totalValue*0.002)} • ${h.rentedTo?`Alugada para ${h.rentedTo}`:'Sem inquilino'}</span><div class="progress" style="margin-top:8px"><span style="width:${h.ownedPercent}%"></span></div></div><div class="actions">${h.purchaseOffer50?`<button class="mini-btn good" onclick="acceptBuy50('${h.id}')">Comprar 50%</button>`:''}${h.ownedPercent>=50&&h.ownedPercent<100?`<button class="mini-btn good" onclick="buyMoreHouse('${h.id}',10)">Comprar +10%</button>`:''}${h.ownedPercent>=100?`<button class="mini-btn" onclick="rentToNpc('${h.id}')">${h.rentedTo?'Encerrar aluguel':'Alugar p/ NPC'}</button><button class="mini-btn" onclick="reformHouse('${h.id}')">Reformar</button><button class="mini-btn bad" onclick="sellHouse('${h.id}')">Vender</button>`:''}</div></div>`; };
renderHouses = function(){ $('#houses').innerHTML=`<div class="grid cols-2"><article class="card"><h3>Mercado de casas</h3><div class="list">${HOUSES.map(h=>`<div class="item"><div><strong>${h.name}</strong><span>Nível ${h.prestige} • Valor ${money(h.totalValue)} • Aluguel ${money(h.rent)} • Contas ${money(h.bills.water+h.bills.energy+h.bills.internet)}</span><span>Contrato: aluguel a cada 10h, multa de 3% após 5h de atraso.</span></div><button class="mini-btn good" onclick="rentHouse('${h.id}')">Alugar</button></div>`).join('')}</div></article><article class="card"><h3>Minha moradia e imóveis</h3><div class="list">${state.houses.owned.map(h=>houseItem(h)).join('') || '<div class="empty">Você ainda não tem casa.</div>'}</div></article></div>`; };

investmentItem = function(inv){ const diff=inv.currentValue-inv.initialValue; const points=(inv.history||[]).slice(0,8).reverse().map(h=>h.result); const max=Math.max(1,...points.map(Math.abs)); const bars=points.map(p=>`<span title="${money(p)}" style="height:${20+Math.abs(p)/max*42}px" class="${p>=0?'up':'down'}"></span>`).join(''); return `<div class="item"><div><strong>${inv.name}</strong><span>Inicial ${money(inv.initialValue)} • Atual ${money(inv.currentValue)} • Resultado <b class="${diff>=0?'money':'debt'}">${money(diff)}</b> • Risco ${inv.risk}</span><div class="mini-chart">${bars||'<em>sem ciclos ainda</em>'}</div></div><button class="mini-btn good" onclick="withdrawInvestment('${inv.id}')">Retirar</button></div>`; };
renderInvestments = function(){ $('#investments').innerHTML=`<div class="grid cols-2"><article class="card"><h3>Novos investimentos</h3><div class="list">${INVESTMENTS.map(i=>`<div class="item"><div><strong>${i.name}</strong><span>${i.description} • Mínimo ${money(i.min)} • Risco ${i.risk} • Retorno esperado ${Math.round(i.expected*1000)/10}%/ciclo</span><input id="inv_${i.id}" type="number" placeholder="Valor para investir" style="margin-top:8px"></div><button class="mini-btn good" onclick="invest('${i.id}', $('#inv_${i.id}').value)">Investir</button></div>`).join('')}</div></article><article class="card"><h3>Carteira ativa</h3><button class="ghost-btn wide" onclick="applyMarketEvent(true); renderAll(); saveSilent();">Gerar evento de mercado</button><div class="list" style="margin-top:12px">${state.investments.map(inv=>investmentItem(inv)).join('') || '<div class="empty">Nenhum investimento ativo.</div>'}</div></article></div><article class="card" style="margin-top:16px"><h3>Últimos eventos de mercado</h3><div class="list">${state.market.events.slice(0,6).map(e=>`<div class="item"><div><strong>${e.name}</strong><span>${e.text} • Impacto ${money(e.totalImpact)}</span></div><span class="tag ${e.kind==='bad'?'debt':'money'}">${e.kind}</span></div>`).join('') || '<div class="empty">Nenhum evento ainda.</div>'}</div></article>`; };

function renderGoals(){ const goals=state.goals.list; $('#goals').innerHTML=`<div class="grid cols-3">${goals.map(g=>`<article class="card"><h3>${g.name}</h3><p>Progresso: <strong>${Math.min(g.progress||0,g.target)}/${g.target}</strong></p><div class="progress"><span style="width:${clamp(((g.progress||0)/g.target)*100,0,100)}%"></span></div><p>Recompensa: ${money(g.reward.money)}, ${g.reward.xp} XP, +${g.reward.score} score.</p><button class="primary-btn wide" ${g.completed&&!g.claimed?'':'disabled'} onclick="claimGoal('${g.id}')">${g.claimed?'Resgatada':g.completed?'Resgatar':'Em andamento'}</button></article>`).join('')}</div><article class="card" style="margin-top:16px"><h3>Sistema de metas diárias</h3><p>Metas renovam por dia e recompensam ações reais do jogo: trabalhar, pagar, investir e manter saldo.</p></article>`; }
function renderShop(){ $('#shop').innerHTML=`<div class="grid cols-3">${SHOP_ITEMS.map(i=>`<article class="card"><h3>${i.icon} ${i.name}</h3><p>${i.description}</p><div class="metric money">${money(i.price)}</div><button class="primary-btn wide" onclick="buyShopItem('${i.id}')">Comprar</button></article>`).join('')}</div><article class="card" style="margin-top:16px"><h3>Itens ativos</h3><p>Seguro residencial: ${state.shop.effects.homeInsurance||0} • Proteção contra multa: ${state.shop.effects.fineShield||0} • Bônus de tarefa: ${state.shop.effects.taskBonus||0}</p></article>`; }

renderProfile = function(){ const role=getRole(); $('#profile').innerHTML=`<div class="grid cols-4">${statCard('Jogador',state.player.name,'info',state.player.socialStatus)}${statCard('Nível',state.player.level,'warn',`${state.player.xp} XP acumulado`)}${statCard('Score',state.player.score,'money','Afeta juros e limites')}${statCard('Reputação',state.player.reputation||state.player.socialStatus,'info','Status social dinâmico')}</div><article class="card" style="margin-top:16px"><h3>Gerenciamento de save</h3><div class="actions"><button class="mini-btn good" onclick="saveGame()">Salvar manualmente</button><button class="mini-btn" onclick="exportSave()">Exportar save</button><button class="mini-btn" onclick="importSaveInput()">Importar save</button><button class="mini-btn" onclick="createBackup()">Criar backup local</button><input id="importSaveFile" type="file" accept="application/json" class="hidden" onchange="handleImportSave(this.files[0])"></div><p>Compatível com versões antigas. O jogo migra dados sem apagar progresso.</p></article><article class="card" style="margin-top:16px"><h3>Conquistas</h3><div class="grid cols-3">${ACHIEVEMENTS.map(a=>`<div class="item"><div><strong>${state.player.achievements.includes(a.id)?'✅':'🔒'} ${a.name}</strong><span>${a.description} • Recompensa ${money(a.reward)}</span></div></div>`).join('')}</div></article>`; };
renderHistory = function(){ const filter = window.historyFilter || 'Tudo'; const q = (window.historySearch || '').toLowerCase(); const types=['Tudo','banco','trabalho','casa','empréstimos','empréstimo','impostos','investimento','CEO','sistema','metas','mercado','loja']; const rows=state.history.filter(h=>(filter==='Tudo'||h.type===filter) && (!q || h.description.toLowerCase().includes(q) || h.type.toLowerCase().includes(q))).slice(0,150); $('#history').innerHTML=`<article class="card"><div class="section-title"><h3>Histórico completo</h3><div class="actions"><select onchange="window.historyFilter=this.value; renderHistory()">${types.map(t=>`<option ${filter===t?'selected':''}>${t}</option>`).join('')}</select><input placeholder="Buscar no histórico" value="${window.historySearch||''}" oninput="window.historySearch=this.value; renderHistory()"></div></div><table class="table"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Status</th></tr></thead><tbody>${rows.map(h=>`<tr><td>${new Date(h.at).toLocaleString('pt-BR')}</td><td>${h.type}</td><td>${h.description}</td><td class="${h.value>=0?'money':'debt'}">${money(h.value)}</td><td>${h.status}</td></tr>`).join('')}</tbody></table></article>`; };
renderAdmin = function(){ const company=getCompany(); const pending=state.work.pendingPromotion; $('#admin').innerHTML=`<div class="grid cols-2"><article class="card"><h3>Painel CEO/Admin</h3><p>Empresa: <strong>${company.name}</strong></p><p>Modo backend: <strong>${state.settings.backendMode}</strong> • Preparado para Supabase/Firebase/Node no futuro.</p>${pending?`<div class="item"><div><strong>Promoção pendente</strong><span>${state.player.name} quer virar ${company.roles.find(r=>r.id===pending.targetRoleId).name}</span></div><div class="actions"><button class="mini-btn good" onclick="promoteTo('${pending.targetRoleId}','Promoção aprovada pelo CEO/Admin'); renderAll(); saveSilent();">Aprovar</button><button class="mini-btn bad" onclick="state.work.pendingPromotion=null; changeScore(-4,'Promoção negada'); addHistory('CEO','Promoção negada pelo CEO/Admin.',0,'alerta'); renderAll(); saveSilent();">Negar</button></div></div>`:'<div class="empty">Nenhuma promoção pendente.</div>'}<div class="actions" style="margin-top:12px"><button class="mini-btn" onclick="state.player.balance+=1000; addHistory('admin','Correção administrativa de saldo.',1000,'ok'); renderAll(); saveSilent();">Corrigir saldo +R$1000</button><button class="mini-btn bad" onclick="state.settings.maintenance=!state.settings.maintenance; notify('Modo manutenção '+(state.settings.maintenance?'ativado':'desativado'),'warn'); renderAll(); saveSilent();">Modo manutenção</button><button class="mini-btn" onclick="exportSave()">Exportar dados</button></div></article><article class="card"><h3>Cargos da empresa</h3><div class="list">${company.roles.map(r=>`<div class="item"><div><strong>${r.name}</strong><span>Salário ${money(r.salary)} • XP ${r.xpRequired} • Bônus ${money(r.bonus)} • ${r.needsApproval?'Precisa aprovação':'Automático'}</span></div><button class="mini-btn" onclick="r=prompt('Novo salário para ${r.name}', '${r.salary}'); if(r&&Number(r)>0){ getCompany().roles.find(x=>x.id==='${r.id}').salary=Number(r); addHistory('admin','Salário de ${r.name} ajustado.', Number(r), 'ok'); renderAll(); saveSilent(); }">Ajustar salário</button></div>`).join('')}</div></article></div><article class="card" style="margin-top:16px"><h3>Funcionários e ranking interno</h3>${rankingTable([{name:state.player.name,score:state.work.performance,wealth:totalWealth()},...state.admin.fakeUsers.map(u=>({name:u.name,score:u.tasks,wealth:u.wealth}))],'score')}</article>`; };

const oldUpdateSocialStatus = updateSocialStatus;
updateSocialStatus = function(){ oldUpdateSocialStatus(); const wealth=totalWealth(); if(state.player.score<300) state.player.reputation='Endividado'; else if(getRole().id==='ceo') state.player.reputation='CEO'; else if(wealth>1000000) state.player.reputation='Lenda financeira'; else if(houseNetWorth()>500000) state.player.reputation='Magnata'; else if(totalInvested()>50000) state.player.reputation='Investidor'; else if(state.work.performance>80) state.player.reputation='Organizado'; else state.player.reputation=state.player.socialStatus; };


boot();
