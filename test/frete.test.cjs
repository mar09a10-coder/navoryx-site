'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'frete.js'), 'utf8');
function page() {
  let cart = [{ id: 1, name: 'Fone', price: 30, quantity: 2 }];
  const memory = new Map();
  const eventNode = () => ({ value: '', textContent: '', dataset: {}, style: {}, children: [], listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    append(...els) { this.children.push(...els); }, appendChild(el) { this.children.push(el); },
    replaceChildren() { this.children = []; }, setAttribute() {} });
  const nodes = Object.fromEntries(['shippingCep', 'shippingCalculate', 'shippingStatus', 'shippingOptions',
    'paymentTotal', 'shippingPaymentInfo', 'cep'].map(id => [id, eventNode()]));
  const summary = eventNode(); const label = eventNode(); const pay = eventNode(); const form = eventNode();
  const state = { request: async () => ({ cep: '29047535', expiresAt: Date.now() + 900000,
    options: [{ id: 'melhorenvio:2', name: 'Correios SEDEX', price: 21.56, description: '3 dias úteis', token: 'assinado' },
      { id: 'combinar', name: 'Combinar entrega com o vendedor', price: null, description: 'Valor e prazo a confirmar' }] }) };
  const messages = []; const calls = [];
  const context = vm.createContext({ document: { getElementById: id => nodes[id] || null,
    querySelectorAll: sel => sel === '[data-shipping-summary]' ? [summary] : [label], createElement: tag => { const node = eventNode(); node.tagName = String(tag).toUpperCase(); return node; } },
    obterCarrinho: () => cart, formatarPreco: n => n.toFixed(2),
    localStorage: { getItem: k => memory.get(k) || null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) },
    window: { location: { href: '' }, addEventListener() {} },
    consultarLoja: async (url, options) => { calls.push({ url, options }); return state.request(url, options); },
    cepInput: nodes.cep, checkoutForm: form, payButton: pay, pagamentoEmAndamento: false,
    buscarCep() {}, mostrarStatusCompra: m => messages.push(m), definirPagamentoEmAndamento() {}, setInterval() {} });
  vm.runInContext(source, context);
  return { context, nodes, pay, form, summary, label, memory, messages, state, calls,
    setCart(v) { cart = v; },
    async calculate() { nodes.shippingCep.value = '29047-535'; await context.calcularFrete(); },
    select(index) { nodes.shippingOptions.children[index].children[0].listeners.change(); },
    customer() { memory.set('navoryxCheckout', JSON.stringify({ cep: '29047-535', bairro: 'Centro', cidade: 'Vitória', estado: 'ES' })); } };
}
const event = () => ({ stopped: false, prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } });
test('selecionar Correios soma o valor e guarda a cotação, sem mudar o foco', async () => {
  const p = page(); await p.calculate(); p.select(0);
  assert.equal(p.nodes.paymentTotal.textContent, '81.56'); assert.equal(p.summary.textContent, '21.56');
  assert.equal(p.context.obterFreteSelecionado().token, 'assinado');
});
test('PAC econômico é selecionado automaticamente, aceita frete grátis e esconde SEDEX em outras formas', async () => {
  const p = page();
  p.state.request = async () => ({ cep: '29047535', expiresAt: Date.now() + 900000,
    promotion: { freeShippingTarget: 199, subtotal: 240, remainingToFree: 0, economyOnly: true },
    options: [
      { id: 'melhorenvio:1', name: 'Correios PAC', price: 0, originalPrice: 33.11, discount: 33.11, free: true, isEconomy: true, description: '21 dias úteis', token: 'pac-gratis' },
      { id: 'melhorenvio:2', name: 'Correios SEDEX', price: 72.71, originalPrice: 72.71, discount: 0, free: false, isEconomy: false, description: '5 dias úteis', token: 'sedex' }
    ] });
  await p.calculate();
  const salvo = p.context.obterFreteSelecionado();
  assert.equal(salvo.method, 'melhorenvio:1'); assert.equal(salvo.price, 0); assert.equal(salvo.token, 'pac-gratis');
  assert.equal(p.summary.textContent, 'Grátis'); assert.equal(p.nodes.paymentTotal.textContent, '60.00');
  assert.equal(p.nodes.shippingOptions.children.length, 3);
  assert.equal(p.nodes.shippingOptions.children[2].tagName, 'DETAILS');
  assert.equal(p.nodes.shippingOptions.children[2].children[0].textContent, 'Ver outras formas de entrega');
});
test('entrega a combinar retornada por servidor antigo não é oferecida nem autoriza pagamento', async () => {
  const p = page(); await p.calculate(); p.customer();
  assert.equal(p.nodes.shippingOptions.children.length, 1);
  p.memory.set('navoryxShipping', JSON.stringify({method:'combinar',cep:'29047535',cart:p.context.identidadeCarrinhoFrete(),expiresAt:Date.now()+900000}));
  assert.equal(p.context.obterFreteSelecionado(),null);
  const e=event();await p.pay.listeners.click(e);assert.equal(e.stopped,true);
  assert.equal(p.context.window.location.href,'');
});
test('CEP alterado invalida cotação e bloqueia avanço', async () => {
  const p = page(); await p.calculate(); p.select(0);
  p.nodes.cep.value = '01001-000'; p.nodes.cep.listeners.input();
  assert.equal(p.context.obterFreteSelecionado(), null);
  const e = event(); p.form.listeners.submit(e); assert.equal(e.stopped, true); assert.equal(e.prevented, true);
});
test('quantidade ou preço alterados invalidam cotação', async () => {
  const p = page(); await p.calculate(); p.select(0);
  p.setCart([{ id: 1, name: 'Fone', quantity: 3, price: 30 }]);
  assert.equal(p.context.obterFreteSelecionado(), null);
  p.context.atualizarResumoFrete(); assert.equal(p.summary.textContent, 'Selecione a entrega');
});
test('resposta atrasada para CEP antigo é descartada', async () => {
  const p = page(); let resolve;
  const request = p.state.request; p.state.request = () => new Promise(r => { resolve = r; });
  const calculando = p.calculate();
  p.nodes.shippingCep.value = '01001000'; p.nodes.shippingCep.listeners.input();
  resolve(await request()); await calculando;
  assert.equal(p.nodes.shippingOptions.children.length, 0); assert.equal(p.context.obterFreteSelecionado(), null);
});
test('cotação expirada e armazenamento inválido bloqueiam pagamento', async () => {
  const p = page(); await p.calculate(); p.select(0); p.customer();
  const frete = JSON.parse(p.memory.get('navoryxShipping')); frete.expiresAt = 1;
  p.memory.set('navoryxShipping', JSON.stringify(frete));
  const e = event(); await p.pay.listeners.click(e); assert.equal(e.stopped, true);
  p.memory.set('navoryxCheckout', '{'); p.memory.set('navoryxShipping', '{');
  const invalid = event(); await p.pay.listeners.click(invalid); assert.equal(invalid.stopped, true);
});
test('erros de cotação aparecem e liberam nova tentativa', async () => {
  const p = page(); p.state.request = async () => { throw new Error('Frete indisponível'); };
  await p.calculate(); assert.equal(p.nodes.shippingStatus.textContent, 'Frete indisponível');
  assert.equal(p.nodes.shippingCalculate.disabled, false);
});
test('checkout aceita só a cotação do mesmo CEP', async () => {
  const p = page(); await p.calculate(); p.select(0);
  const e = event(); p.form.listeners.submit(e); assert.equal(e.stopped, false);
  p.nodes.cep.value = '99999-999'; const outro = event(); p.form.listeners.submit(outro); assert.equal(outro.stopped, true);
});
