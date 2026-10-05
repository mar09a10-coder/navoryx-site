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
        !/^\d{8}$/.test(frete.cep) || !/^melhorenvio:[12]$/.test(frete.method) ||
        !frete.token || !Number.isFinite(frete.price) || frete.price < 0) return null;
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

function formatarValorFrete(valor) {
  return Number(valor) === 0 ? 'Grátis' : formatarPreco(Number(valor));
}

function atualizarResumoFrete() {
  const frete = obterFreteSelecionado();
  const subtotal = obterCarrinho().reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
  document.querySelectorAll('[data-shipping-summary]').forEach(el => {
    el.textContent = !frete ? 'Selecione a entrega' : formatarValorFrete(frete.price);
  });
  ['cartTotal', 'checkoutTotal', 'paymentTotal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatarPreco(subtotal + (frete?.price || 0));
  });
  document.querySelectorAll('[data-total-label]').forEach(el => {
    el.textContent = !frete ? 'Produtos (frete pendente)' : 'Total';
  });
  const botao = document.getElementById('payButton');
  if (botao && !pagamentoEmAndamento) botao.textContent = 'Ir para pagamento seguro';
  const info = document.getElementById('shippingPaymentInfo');
  if (info) info.textContent = !frete ? 'Volte ao checkout para selecionar ou recalcular a entrega.' :
    frete.name + (frete.price === 0 ? ' • Grátis' : '');
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
    freteOpcoes = data.options.filter(o => /^melhorenvio:[12]$/.test(o.id) && typeof o.token === 'string' &&
      Number.isFinite(o.price) && o.price >= 0).sort((a, b) => Number(Boolean(b.isEconomy || b.id === 'melhorenvio:1')) -
        Number(Boolean(a.isEconomy || a.id === 'melhorenvio:1')));

    const selecionar = (opcao, radio) => {
      if (cart !== identidadeCarrinhoFrete() || data.expiresAt <= Date.now()) { invalidarFrete(); return; }
      try {
        localStorage.setItem(FRETE_STORAGE_KEY, JSON.stringify({ method: opcao.id, name: opcao.name,
          price: opcao.price, originalPrice: Number.isFinite(opcao.originalPrice) ? opcao.originalPrice : opcao.price,
          discount: Number.isFinite(opcao.discount) ? opcao.discount : 0, free: Boolean(opcao.free),
          token: opcao.token, cep, cart, expiresAt: data.expiresAt }));
        radio.checked = true;
        if (cepInput) { cepInput.value = cep.slice(0, 5) + '-' + cep.slice(5); buscarCep(cep); }
        atualizarResumoFrete();
      } catch (_) { statusFrete('Permita o armazenamento do site para continuar.', 'error'); }
    };

    const criarOpcao = opcao => {
      const economica = Boolean(opcao.isEconomy || opcao.id === 'melhorenvio:1');
      const label = document.createElement('label');
      label.className = 'shipping-option' + (economica ? ' shipping-option--economy' : '');
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'shippingMethod'; radio.value = opcao.id;
      const texto = document.createElement('span');
      const titulo = document.createElement('strong'); titulo.textContent = economica ? 'Entrega econômica' : opcao.name;
      const descricao = document.createElement('small');
      descricao.textContent = economica ? opcao.name + ' • ' + opcao.description : opcao.description;
      texto.append(titulo, descricao);
      if (Number(opcao.discount) > 0) {
        const economia = document.createElement('small'); economia.className = 'shipping-saving';
        economia.textContent = 'Você economiza ' + formatarPreco(opcao.discount) + ' no frete';
        texto.append(economia);
      }
      const preco = document.createElement('span'); preco.className = 'shipping-option-price';
      if (Number(opcao.discount) > 0 && Number(opcao.originalPrice) > Number(opcao.price)) {
        const original = document.createElement('s'); original.textContent = formatarPreco(opcao.originalPrice); preco.append(original);
      }
      const atual = document.createElement('b'); atual.textContent = formatarValorFrete(opcao.price); preco.append(atual);
      label.append(radio, texto, preco);
      radio.addEventListener('change', () => selecionar(opcao, radio));
      return { label, radio };
    };

    const principal = freteOpcoes[0];
    if (principal) {
      const elementoPrincipal = criarOpcao(principal);
      freteLista.appendChild(elementoPrincipal.label);

      const promocao = data.promotion && typeof data.promotion === 'object' ? data.promotion : null;
      if (promocao || Number(principal.discount) > 0 || principal.free) {
        const caixa = document.createElement('div'); caixa.className = 'shipping-promo';
        const mensagem = document.createElement('strong');
        if (principal.free) mensagem.textContent = 'Frete grátis econômico liberado neste carrinho.';
        else if (Number(principal.discount) > 0) mensagem.textContent = 'Você economizou ' + formatarPreco(principal.discount) + ' no frete econômico.';
        else mensagem.textContent = 'Economize no frete aumentando o valor do carrinho.';
        caixa.append(mensagem);
        if (promocao && Number(promocao.freeShippingTarget) > 0) {
          const restante = Math.max(0, Number(promocao.remainingToFree) || 0);
          const alvo = Number(promocao.freeShippingTarget);
          const subtotalPromocao = Math.max(0, Number(promocao.subtotal) || 0);
          const detalhe = document.createElement('small');
          detalhe.textContent = restante > 0
            ? 'Faltam ' + formatarPreco(restante) + ' para atingir a faixa de frete grátis econômico.'
            : principal.free ? 'Benefício aplicado automaticamente.' : 'Melhor condição disponível aplicada ao pedido.';
          const barra = document.createElement('div'); barra.className = 'shipping-progress'; barra.setAttribute('aria-hidden', 'true');
          const progresso = document.createElement('span'); progresso.style.width = Math.min(100, Math.round(subtotalPromocao / alvo * 100)) + '%';
          barra.append(progresso); caixa.append(detalhe, barra);
        }
        freteLista.appendChild(caixa);
      }

      const outras = freteOpcoes.slice(1);
      if (outras.length) {
        const detalhes = document.createElement('details'); detalhes.className = 'shipping-more';
        const resumo = document.createElement('summary'); resumo.textContent = 'Ver outras formas de entrega';
        detalhes.append(resumo);
        for (const opcao of outras) detalhes.appendChild(criarOpcao(opcao).label);
        freteLista.appendChild(detalhes);
      }

      selecionar(principal, elementoPrincipal.radio);
    }
    statusFrete(data.warning || (principal && (principal.isEconomy || principal.id === 'melhorenvio:1')
      ? 'Entrega econômica selecionada. Você pode trocar em “Ver outras formas de entrega”.'
      : 'Opção de entrega selecionada.'));
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

if (payButton) payButton.addEventListener('click', async event => {
  const frete = obterFreteSelecionado();
  const cliente = obterClienteEntrega();
  if (!frete || cliente.cep?.replace(/\D/g, '') !== frete.cep) {
    event.stopImmediatePropagation();
    mostrarStatusCompra('Volte ao checkout para selecionar ou recalcular a entrega.', 'error'); return;
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
