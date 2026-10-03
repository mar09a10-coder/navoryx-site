'use strict';

// Execute com: node --test test/pagamento.test.cjs
// Os testes não acessam a rede nem criam pagamentos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const produto = { id: 123, name: 'Fone Bluetooth', price: 30, salePrice: 26, image: 'fone.jpg', active: true };
const item = (price = 26) => ({ id: 123, name: produto.name, price, quantity: 1, image: 'fone.jpg' });
const linkSeguro = 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=teste';
const resposta = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };

function elemento() {
  const listeners = new Map();
  return {
    textContent: '', innerHTML: '', hidden: true, disabled: false, dataset: {}, attributes: {}, children: [],
    addEventListener(type, fn) { listeners.set(type, fn); },
    click() { return listeners.get('click')?.(); },
    appendChild(child) { this.children.push(child); },
    setAttribute(key, value) { this.attributes[key] = value; }
  };
}

async function abrirPagina({ cart = [item()], catalogo = [produto], request, pagina = 'pagamento' } = {}) {
  const ids = ['cartCount', 'checkoutStatus','lastOrderLink'];
  if (pagina === 'pagamento') ids.push('paymentItems', 'paymentProductsTotal', 'paymentTotal', 'payButton');
  if (pagina === 'carrinho') ids.push('cartItems', 'summaryProducts', 'cartTotal', 'checkoutButton');
  if (pagina === 'checkout') ids.push('checkoutItems', 'checkoutProductsTotal', 'checkoutTotal');
  const nodes = Object.fromEntries(ids.map(id => [id, elemento()]));
  const memory = new Map([['navoryxCart', JSON.stringify(cart)]]);
  const requests = [];
  const state = { catalogo, request };
  const windowListeners = new Map();
  const window = { location: { href: `${pagina}.html`, search: '' },
    addEventListener(type, fn) { windowListeners.set(type, fn); } };
  window.dispatch = (type, event) => windowListeners.get(type)?.(event);
  const context = vm.createContext({
    window, crypto: require('node:crypto').webcrypto, URL, URLSearchParams, AbortController, TypeError, setTimeout, clearTimeout,
    console: { error() {}, warn() {} },
    document: { getElementById: id => nodes[id] || null, createElement: elemento,
      addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) },
    alert: () => assert.fail('Os erros devem aparecer na página.'),
    fetch: async (url, options = {}) => {
      const call = { path: new URL(url).pathname, body: options.body ? JSON.parse(options.body) : null, options };
      requests.push(call);
      if (state.request) {
        const custom = await state.request(call);
        if (custom) return custom;
      }
      if (call.path === '/criar-preferencia') {
        for (const item of call.body.items) {
          const match = state.catalogo.find(p => String(p.id) === String(item.id) && p.active !== false);
          if (!match) return resposta({ erro: 'Um produto não está mais disponível.' }, 409);
          if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)
            return resposta({ erro: 'Quantidade inválida.' }, 400);
          const atual = Number(match.salePrice) > 0 && Number(match.salePrice) < Number(match.price) ? Number(match.salePrice) : Number(match.price);
          if (Math.round(item.price * 100) !== Math.round(atual * 100))
            return resposta({ erro: 'O preço de um produto mudou.' }, 409);
        }
      }
      return resposta(call.path === '/produtos' ? state.catalogo : { init_point: linkSeguro });
    }
  });
  vm.runInContext(source, context);
  await settle();
  return { nodes, context, state, requests, window,
    cart: () => JSON.parse(memory.get('navoryxCart')),
    posts: () => requests.filter(call => call.path === '/criar-preferencia') };
}

test('promoções válidas e centavos seguem a regra do servidor', async () => {
  const page = await abrirPagina({ cart: [] });
  for (const [price, salePrice, esperado] of [
    [30, 26, 26], [30, 0, 30], [30, '', 30], [30, null, 30], [30, undefined, 30],
    [30, 40, 30], [30, 30, 30], [30, -1, 30], ['30', '26', 26], [10.235, 0, 10.24]
  ]) assert.equal(page.context.precoAtualProduto({ price, salePrice }), esperado);
  page.context.adicionarAoCarrinho(produto, 1);
  assert.equal(page.cart()[0].price, 26);
  page.context.adicionarAoCarrinho({ ...produto, salePrice: 25 }, 1);
  assert.equal(page.cart()[0].price, 25);
  assert.equal(page.cart()[0].quantity, 2);
});

for (const [pagina, totalId] of [['carrinho', 'cartTotal'], ['checkout', 'checkoutTotal']]) {
  test(`${pagina}: atualiza carrinho antigo e avisa sobre o novo total`, async () => {
    const page = await abrirPagina({ pagina, cart: [item(30)] });
    assert.equal(page.cart()[0].price, 26);
    assert.match(page.nodes[totalId].textContent, /26,00/);
    assert.match(page.nodes.checkoutStatus.textContent, /preços foram atualizados/);
    assert.equal(page.posts().length, 0);
  });
}

test('pagamento abre imediatamente sem consultar o catálogo', async () => {
  const page = await abrirPagina({ cart: [item(30)] });
  assert.equal(page.requests.length, 0);
  assert.equal(page.nodes.payButton.disabled, false);
  assert.match(page.nodes.paymentTotal.textContent, /30,00/);
});
test('guarda e mostra o acompanhamento antes de redirecionar ao Mercado Pago', async () => {
  const tracking='https://navoryx-site.onrender.com/retorno.html?pedido='+'a'.repeat(64);
  const page=await abrirPagina({request:call=>call.path==='/criar-preferencia'?resposta({init_point:linkSeguro,tracking_url:tracking}):null});
  await page.nodes.payButton.click();
  assert.equal(page.nodes.lastOrderLink.href,tracking);assert.equal(page.nodes.lastOrderLink.hidden,false);
  assert.equal(page.window.location.href,linkSeguro);
});

test('envia o identificador e preço conferido ao criar o checkout', async () => {
  const page = await abrirPagina();
  await page.nodes.payButton.click();
  assert.deepEqual(page.posts()[0].body.items, [{ id: 123, name: produto.name, quantity: 1, price: 26 }]);
  assert.equal(page.requests.length, 1);
  assert.equal(page.window.location.href, linkSeguro);
  assert.equal(page.nodes.payButton.disabled, true);
});

test('mudança de preço exige nova revisão antes de abrir o pagamento', async () => {
  const page = await abrirPagina();
  page.state.catalogo = [{ ...produto, salePrice: 28 }];
  await page.nodes.payButton.click();
  assert.equal(page.posts().length, 1);
  assert.equal(page.cart()[0].price, 28);
  assert.match(page.nodes.paymentTotal.textContent, /28,00/);
  assert.match(page.nodes.checkoutStatus.textContent, /clique novamente/);
  assert.equal(page.nodes.payButton.disabled, false);
  await page.nodes.payButton.click();
  assert.equal(page.posts()[1].body.items[0].price, 28);
});

test('corrige conflito de preço ocorrido entre a consulta e o pagamento', async () => {
  const page = await abrirPagina();
  page.state.request = async call => {
    if (call.path === '/criar-preferencia') {
      page.state.catalogo = [{ ...produto, salePrice: 27 }];
      return resposta({ erro: 'O preço de um produto mudou.' }, 409);
    }
  };
  await page.nodes.payButton.click();
  assert.equal(page.cart()[0].price, 27);
  assert.match(page.nodes.paymentTotal.textContent, /27,00/);
  assert.match(page.nodes.checkoutStatus.textContent, /clique novamente/);
  assert.equal(page.posts().length, 1);
  assert.equal(page.window.location.href, 'pagamento.html');
});

test('mantém a mensagem real do servidor e permite tentar novamente', async () => {
  const erro = 'Pagamento temporariamente indisponível. Código abcd1234.';
  const page = await abrirPagina({ request: async call => call.path === '/criar-preferencia' ? resposta({ erro }, 503) : null });
  await page.nodes.payButton.click();
  assert.equal(page.nodes.checkoutStatus.textContent, erro);
  assert.equal(page.nodes.checkoutStatus.hidden, false);
  assert.equal(page.nodes.payButton.disabled, false);
  page.state.request = null;
  await page.nodes.payButton.click();
  assert.equal(page.window.location.href, linkSeguro);
});

test('não cria checkout com produto removido ou quantidade inválida', async () => {
  for (const options of [{ catalogo: [] }, { catalogo: [{ ...produto, active: false }] }, { cart: [{ ...item(), quantity: 1.5 }] }]) {
    const page = await abrirPagina(options);
    await page.nodes.payButton.click();
    assert.equal(page.posts().length, 1);
    assert.equal(page.nodes.checkoutStatus.dataset.type, 'error');
    assert.equal(page.window.location.href, 'pagamento.html');
  }
});

test('falha de rede preserva o carrinho e permite tentar novamente', async () => {
  const page = await abrirPagina({ cart: [item(30)], request: async () => { throw new TypeError('Failed to fetch'); } });
  await page.nodes.payButton.click();
  assert.equal(page.cart()[0].price, 30);
  assert.equal(page.posts().length, 1);
  assert.match(page.nodes.checkoutStatus.textContent, /conexão/);
  assert.equal(page.nodes.payButton.disabled, false);
});

test('resposta inválida e link externo não redirecionam o comprador', async () => {
  for (const result of [
    { ok: false, status: 502, json: async () => { throw new SyntaxError('HTML'); } },
    resposta({ init_point: 'javascript:alert(1)' }),
    resposta({ init_point: 'https://www.mercadopago.com.br.exemplo.com/pagar' }),
    resposta({})
  ]) {
    const page = await abrirPagina({ request: async call => call.path === '/criar-preferencia' ? result : null });
    await page.nodes.payButton.click();
    assert.equal(page.window.location.href, 'pagamento.html');
    assert.equal(page.nodes.checkoutStatus.dataset.type, 'error');
    assert.equal(page.nodes.payButton.disabled, false);
  }
});

test('cliques repetidos geram somente uma preferência', async () => {
  let liberar;
  const page = await abrirPagina({ request: async call => call.path === '/criar-preferencia' ?
    new Promise(resolve => { liberar = resolve; }) : null });
  const primeiroClique = page.nodes.payButton.click();
  await settle();
  await page.nodes.payButton.click();
  assert.equal(page.posts().length, 1);
  liberar(resposta({ init_point: linkSeguro }));
  await primeiroClique;
});

test('carrinho vazio ou armazenamento inválido não inicia pagamento', async () => {
  for (const cart of [[], {}, null]) {
    const page = await abrirPagina({ cart });
    assert.equal(page.nodes.payButton.disabled, true);
    assert.equal(page.requests.length, 0);
  }
});



test('voltar do Mercado Pago restaura o botão no navegador móvel', async () => {
  const page = await abrirPagina();
  await page.nodes.payButton.click();
  assert.equal(page.nodes.payButton.disabled, true);
  page.window.dispatch('pageshow', { persisted: true });
  assert.equal(page.nodes.payButton.disabled, false);
  assert.match(page.nodes.checkoutStatus.textContent, /Confira o status/);
  assert.equal(page.posts().length, 1);
});
