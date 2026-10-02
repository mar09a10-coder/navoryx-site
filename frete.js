'use strict';

const FRETE_STORAGE_KEY = 'navoryxShipping';
const FRETE_API = 'https://navoryx-backend-2.onrender.com/frete/cotar';
let freteConsultaVersao = 0;
let freteOpcoes = [];
let freteConsultando = false;
const freteCep = document.getElementById('shippingCep');
const freteBotao = document.getElementById('shippingCalculate');
const freteStatus = document.getElementById('shippingStatus');
const freteLista = document.getElementById('shippingOptions');

function identidadeCarrinhoFrete() {
  return JSON.stringify(obterCarrinho().map(i => [String(i.id), Number(i.quantity), Number(i.price)])
    .sort((a, b) => a[0].localeCompare(b[0])));
}

function obterFreteSelecionado() {
  try {
    const frete = JSON.parse(localStorage.getItem(FRETE_STORAGE_KEY));
    if (!frete || frete.cart !== identidadeCarrinhoFrete() || frete.expiresAt <= Date.now() ||
        !/^\d{8}$/.test(frete.cep) || (frete.method !== 'combinar' &&
        (!frete.token || !Number.isFinite(frete.price) || frete.price <= 0))) return null;
    return frete;
  } catch (_) { return null; }
}

function obterClienteEntrega() {
  try { return JSON.parse(localStorage.getItem('navoryxCheckout') || '{}') || {}; }
  catch (_) { return {}; }
}

function statusFrete(mensagem, tipo = 'info') {
  if (!freteStatus) return;
  freteStatus.textContent = mensagem;
  freteStatus.dataset.type = tipo;
}

function atualizarResumoFrete() {
  const frete = obterFreteSelecionado();
  const subtotal = obterCarrinho().reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
  document.querySelectorAll('[data-shipping-summary]').forEach(el => {
    el.textContent = !frete ? 'Selecione a entrega' : frete.method === 'combinar' ? 'Valor a combinar' : formatarPreco(frete.price);
  });
  ['cartTotal', 'checkoutTotal', 'paymentTotal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatarPreco(subtotal + (frete?.method !== 'combinar' ? frete?.price || 0 : 0));
  });
  document.querySelectorAll('[data-total-label]').forEach(el => {
    el.textContent = frete?.method === 'combinar' || !frete ? 'Produtos (frete pendente)' : 'Total';
  });
  const botao = document.getElementById('payButton');
  if (botao) botao.textContent = frete?.method === 'combinar' ? 'Combinar entrega antes de pagar' : 'Ir para pagamento seguro';
  const info = document.getElementById('shippingPaymentInfo');
  if (info) info.textContent = !frete ? 'Volte ao checkout para selecionar ou recalcular a entrega.' :
    frete.method === 'combinar' ? 'Entrega sujeita à confirmação. Consulte valor e prazo com o vendedor antes de pagar.' : frete.name;
}

function invalidarFrete() {
  freteConsultaVersao++;
  freteOpcoes = [];
  try { localStorage.removeItem(FRETE_STORAGE_KEY); } catch (_) { /* A validação também usa CEP e carrinho. */ }
  if (freteLista) freteLista.replaceChildren();
  statusFrete('CEP ou pedido alterado. Calcule novamente para escolher a entrega.');
  atualizarResumoFrete();
}

async function calcularFrete() {
  if (freteConsultando) return;
  const cep = String(freteCep?.value || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(cep)) { statusFrete('Informe um CEP com oito números.', 'error'); return; }
  if (!obterCarrinho().length) { statusFrete('Adicione um produto ao carrinho.', 'error'); return; }
  invalidarFrete();
  const versao = freteConsultaVersao;
  const cart = identidadeCarrinhoFrete();
  freteConsultando = true;
  freteBotao.disabled = true;
  freteBotao.setAttribute('aria-busy', 'true');
  statusFrete('Consultando as opções de entrega...');
  try {
    const data = await consultarLoja(FRETE_API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: obterCarrinho(), cep })
    });
    if (versao !== freteConsultaVersao || cart !== identidadeCarrinhoFrete()) return;
    if (!Array.isArray(data.options) || data.cep !== cep || !Number.isFinite(data.expiresAt)) throw new Error('Não foi possível consultar as opções de entrega.');
    freteOpcoes = data.options.filter(o => o.id === 'combinar' || (typeof o.token === 'string' && Number.isFinite(o.price) && o.price > 0));
    for (const opcao of freteOpcoes) {
      const label = document.createElement('label'); label.className = 'shipping-option';
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'shippingMethod'; radio.value = opcao.id;
      const texto = document.createElement('span');
      const titulo = document.createElement('strong'); titulo.textContent = opcao.name;
      const descricao = document.createElement('small'); descricao.textContent = opcao.description;
      const preco = document.createElement('b'); preco.textContent = opcao.id === 'combinar' ? 'A combinar' : formatarPreco(opcao.price);
      texto.append(titulo, descricao); label.append(radio, texto, preco); freteLista.appendChild(label);
      radio.addEventListener('change', () => {
        if (cart !== identidadeCarrinhoFrete() || data.expiresAt <= Date.now()) { invalidarFrete(); return; }
        try {
          localStorage.setItem(FRETE_STORAGE_KEY, JSON.stringify({ method: opcao.id, name: opcao.name,
            price: opcao.price, token: opcao.token, cep, cart, expiresAt: data.expiresAt }));
          if (cepInput) { cepInput.value = cep.slice(0, 5) + '-' + cep.slice(5); buscarCep(cep); }
          atualizarResumoFrete();
        } catch (_) { statusFrete('Permita o armazenamento do site para continuar.', 'error'); }
      });
    }
    statusFrete(data.warning || 'Escolha uma das opções de entrega.');
  } catch (erro) {
    if (versao === freteConsultaVersao) statusFrete(erro.message, 'error');
  } finally {
    freteConsultando = false; freteBotao.disabled = false; freteBotao.setAttribute('aria-busy', 'false');
  }
}

if (freteCep) {
  const salvo = obterFreteSelecionado();
  if (salvo) {
    freteCep.value = salvo.cep;
    statusFrete(`Entrega selecionada: ${salvo.name}. Calcule novamente para trocar.`);
    if (cepInput && !cepInput.value) {
      cepInput.value = salvo.cep.slice(0, 5) + '-' + salvo.cep.slice(5);
      buscarCep(salvo.cep);
    }
  }
  freteCep.addEventListener('input', () => {
    const cep = freteCep.value.replace(/\D/g, '').slice(0, 8);
    freteCep.value = cep.length > 5 ? cep.slice(0, 5) + '-' + cep.slice(5) : cep;
    invalidarFrete();
  });
  freteCep.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); calcularFrete(); } });
  freteBotao.addEventListener('click', calcularFrete);
}

if (cepInput && freteCep) cepInput.addEventListener('input', () => {
  const cep = cepInput.value.replace(/\D/g, '');
  if (cep !== freteCep.value.replace(/\D/g, '')) { freteCep.value = cepInput.value; invalidarFrete(); }
});

if (checkoutForm) checkoutForm.addEventListener('submit', event => {
  const frete = obterFreteSelecionado();
  const cep = cepInput?.value.replace(/\D/g, '');
  if (!frete || frete.cep !== cep) {
    event.preventDefault(); event.stopImmediatePropagation();
    mostrarStatusCompra('Calcule o frete e escolha a entrega para este CEP antes de continuar.', 'error');
  }
}, true);

async function abrirConversaEntrega() {
  const cliente = obterClienteEntrega();
  const config = await consultarLoja('https://navoryx-backend-2.onrender.com/site-config');
  const telefone = String(config.whatsapp || '').replace(/\D/g, '');
  if (!/^\d{10,13}$/.test(telefone)) throw new Error('O contato da loja está indisponível. Tente novamente.');
  const numero = telefone.length <= 11 ? '55' + telefone : telefone;
  const frete = obterFreteSelecionado();
  if (!frete || frete.method !== 'combinar' || cliente.cep?.replace(/\D/g, '') !== frete.cep) throw new Error('Volte ao checkout para confirmar o CEP e a entrega.');
  const itens = obterCarrinho().map(i => `${i.quantity} × ${i.name}`).join('\n');
  const mensagem = `Olá! Gostaria de confirmar a entrega de uma compra na Navoryx.\n${itens}\nCEP: ${frete.cep}\nBairro: ${cliente.bairro || ''}\nCidade: ${cliente.cidade || ''}/${cliente.estado || ''}\nÉ possível entregar pessoalmente? Qual seria o valor e o prazo? Ainda não efetuei o pagamento.`;
  window.location.href = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

if (payButton) payButton.addEventListener('click', async event => {
  const frete = obterFreteSelecionado();
  const cliente = obterClienteEntrega();
  if (!frete || cliente.cep?.replace(/\D/g, '') !== frete.cep) {
    event.stopImmediatePropagation();
    mostrarStatusCompra('Volte ao checkout para selecionar ou recalcular a entrega.', 'error'); return;
  }
  if (frete.method === 'combinar') {
    event.stopImmediatePropagation();
    if (pagamentoEmAndamento) return;
    definirPagamentoEmAndamento(true, 'Abrindo atendimento...');
    try { await abrirConversaEntrega(); }
    catch (erro) { mostrarStatusCompra(erro.message, 'error'); }
    finally { definirPagamentoEmAndamento(false); atualizarResumoFrete(); }
  }
}, true);

window.addEventListener('storage', event => {
  if (event.key === 'navoryxCart' && !obterFreteSelecionado()) invalidarFrete();
  else if (event.key === FRETE_STORAGE_KEY) atualizarResumoFrete();
});
window.addEventListener('pageshow', atualizarResumoFrete);
// Reavalie a validade também após o tempo de cotação, sem travar os campos.
setInterval(atualizarResumoFrete, 30000);
atualizarResumoFrete();
