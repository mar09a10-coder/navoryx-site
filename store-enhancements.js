'use strict';

const NAVORYX_FAVORITES_KEY = 'navoryxFavorites';
const NAVORYX_RECENT_KEY = 'navoryxRecent';
const NAVORYX_PRODUCTS_KEY = 'navoryxProducts';
const NAVORYX_API = 'https://navoryx-backend-2.onrender.com/produtos';
const NAVORYX_FRETE_API = 'https://navoryx-backend-2.onrender.com/frete/cotar';

function nxMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
}
function nxNormalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function nxReadArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (_) { return []; }
}
function nxWriteArray(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}
function nxFavorites() {
  return nxReadArray(NAVORYX_FAVORITES_KEY).map(String);
}
function nxIsFavorite(id) {
  return nxFavorites().includes(String(id));
}
function nxToggleFavorite(id) {
  const key = String(id);
  const current = nxFavorites();
  const next = current.includes(key) ? current.filter(item => item !== key) : [key, ...current].slice(0, 100);
  nxWriteArray(NAVORYX_FAVORITES_KEY, next);
  document.dispatchEvent(new CustomEvent('navoryx:favorites', { detail: { id: key, active: next.includes(key) } }));
  return next.includes(key);
}
function nxProductsFromCache() {
  const local = nxReadArray(NAVORYX_PRODUCTS_KEY);
  try {
    if (typeof produtosLoja !== 'undefined' && Array.isArray(produtosLoja) && produtosLoja.length) return produtosLoja;
  } catch (_) {}
  return local;
}
async function nxGetProducts() {
  const current = nxProductsFromCache();
  if (current.length) return current;
  try {
    const response = await fetch(NAVORYX_API, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (Array.isArray(data)) {
      nxWriteArray(NAVORYX_PRODUCTS_KEY, data);
      return data;
    }
  } catch (_) {}
  return [];
}
function nxPrice(product) {
  const regular = Number(product && product.price);
  const sale = Number(product && product.salePrice);
  return Number.isFinite(sale) && sale > 0 && sale < regular ? sale : regular;
}
function nxDiscount(product) {
  const regular = Number(product && product.price);
  const current = nxPrice(product);
  return Number.isFinite(regular) && regular > 0 && current > 0 && current < regular
    ? Math.round((1 - current / regular) * 100) : 0;
}
function nxToast(message, type) {
  let region = document.getElementById('nxToastRegion');
  if (!region) {
    region = document.createElement('div');
    region.id = 'nxToastRegion';
    region.className = 'nx-toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  const item = document.createElement('div');
  item.className = 'nx-toast' + (type ? ' nx-toast--' + type : '');
  item.textContent = message;
  region.appendChild(item);
  requestAnimationFrame(() => item.classList.add('is-visible'));
  setTimeout(() => {
    item.classList.remove('is-visible');
    setTimeout(() => item.remove(), 220);
  }, 2600);
}
function nxProductLink(product) {
  return 'produto.html?id=' + encodeURIComponent(product.id);
}
function nxCreateMiniCard(product, options) {
  const card = document.createElement('article');
  card.className = 'nx-mini-card';
  card.dataset.productId = String(product.id);

  const link = document.createElement('a');
  link.href = nxProductLink(product);
  link.className = 'nx-mini-card-media';

  const img = document.createElement('img');
  img.src = product.image || 'img/sem-imagem.png';
  img.alt = product.name || 'Produto';
  img.loading = 'lazy';
  img.decoding = 'async';
  link.appendChild(img);

  const body = document.createElement('div');
  body.className = 'nx-mini-card-body';

  const title = document.createElement('a');
  title.href = link.href;
  title.className = 'nx-mini-card-title';
  title.textContent = product.name || 'Produto';

  const prices = document.createElement('div');
  prices.className = 'nx-mini-card-prices';
  const regular = Number(product.price);
  const current = nxPrice(product);
  if (current > 0 && regular > current) {
    const old = document.createElement('s');
    old.textContent = nxMoney(regular);
    prices.appendChild(old);
  }
  const strong = document.createElement('strong');
  strong.textContent = nxMoney(current);
  prices.appendChild(strong);

  body.append(title, prices);

  if (!options || options.actions !== false) {
    const actions = document.createElement('div');
    actions.className = 'nx-mini-card-actions';

    const details = document.createElement('a');
    details.href = link.href;
    details.className = 'nx-secondary-button';
    details.textContent = 'Ver produto';

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'nx-primary-button';
    const stock = Math.max(0, Math.floor(Number(product.stock) || 0));
    add.disabled = stock <= 0;
    add.textContent = stock <= 0 ? 'Esgotado' : 'Adicionar';
    add.addEventListener('click', () => {
      let ok = false;
      try {
        if (typeof adicionarAoCarrinho === 'function') ok = adicionarAoCarrinho(product, 1);
      } catch (_) {}
      if (ok) {
        nxToast('Produto adicionado ao carrinho.', 'success');
        add.textContent = 'Adicionado ✓';
        setTimeout(() => { add.textContent = 'Adicionar'; }, 1200);
      } else if (stock > 0) {
        nxToast('Não foi possível adicionar esta quantidade.', 'error');
      }
    });
    actions.append(details, add);
    body.appendChild(actions);
  }

  card.append(link, body);
  return card;
}

function nxInstallFooter() {
  document.querySelectorAll('footer .footer-inner').forEach(footer => {
    if (footer.querySelector('.nx-footer-links')) return;
    const block = document.createElement('div');
    block.className = 'nx-footer-links';
    block.innerHTML = '<strong>Atendimento e informações</strong>' +
      '<a href="ajuda.html">Central de ajuda</a>' +
      '<a href="rastrear.html">Rastrear pedido</a>' +
      '<a href="envios.html">Política de envios</a>' +
      '<a href="trocas-devolucoes.html">Trocas e devoluções</a>' +
      '<a href="privacidade.html">Privacidade</a>' +
      '<a href="termos.html">Termos de uso</a>';
    footer.appendChild(block);
  });
}

function nxInstallSearchSuggestions() {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  if (form && input && !form.querySelector('.nx-search-suggestions')) {
    form.classList.add('nx-search-ready');
    const box = document.createElement('div');
    box.className = 'nx-search-suggestions';
    box.hidden = true;
    form.appendChild(box);

    const render = async () => {
      const term = nxNormalize(input.value);
      if (term.length < 2) { box.hidden = true; box.replaceChildren(); return; }
      const products = await nxGetProducts();
      const matches = products.filter(p => p.active !== false && nxNormalize((p.name || '') + ' ' + (p.category || '') + ' ' + (p.description || '')).includes(term)).slice(0, 6);
      box.replaceChildren();
      if (!matches.length) {
        const empty = document.createElement('div');
        empty.className = 'nx-search-empty';
        empty.textContent = 'Nenhum produto encontrado';
        box.appendChild(empty);
      } else {
        matches.forEach(product => {
          const a = document.createElement('a');
          a.href = nxProductLink(product);
          a.className = 'nx-search-item';
          const img = document.createElement('img');
          img.src = product.image || 'img/sem-imagem.png';
          img.alt = '';
          const text = document.createElement('span');
          const name = document.createElement('strong');
          name.textContent = product.name || 'Produto';
          const price = document.createElement('small');
          price.textContent = nxMoney(nxPrice(product));
          text.append(name, price);
          a.append(img, text);
          box.appendChild(a);
        });
      }
      box.hidden = false;
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    document.addEventListener('click', event => {
      if (!form.contains(event.target)) box.hidden = true;
    });
  }

  document.querySelectorAll('form.search:not(#searchForm)').forEach(other => {
    if (other.dataset.nxSearch === '1') return;
    other.dataset.nxSearch = '1';
    other.addEventListener('submit', event => {
      const field = other.querySelector('input[type="search"]');
      const term = field && field.value.trim();
      if (!term) return;
      event.preventDefault();
      location.href = 'index.html?busca=' + encodeURIComponent(term) + '#destaques';
    });
  });
}

function nxDecorateProductCards() {
  const grid = document.getElementById('storeProducts');
  if (!grid) return;
  const products = nxProductsFromCache();
  const byId = new Map(products.map(p => [String(p.id), p]));
  grid.querySelectorAll('.product-card').forEach(card => {
    const add = card.querySelector('.add-cart');
    if (!add) return;
    const id = String(add.dataset.id || '');
    const product = byId.get(id);
    if (!product) return;
    card.dataset.nxPrice = String(nxPrice(product) || 0);
    card.dataset.nxName = nxNormalize(product.name || '');
    card.dataset.nxStock = String(Math.max(0, Math.floor(Number(product.stock) || 0)));

    if (!card.querySelector('.nx-favorite-card')) {
      const fav = document.createElement('button');
      fav.type = 'button';
      fav.className = 'nx-favorite-card';
      fav.dataset.productId = id;
      fav.setAttribute('aria-label', nxIsFavorite(id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
      fav.setAttribute('aria-pressed', String(nxIsFavorite(id)));
      fav.innerHTML = nxIsFavorite(id) ? '♥' : '♡';
      const media = card.querySelector('.product-media-link');
      if (media) media.insertAdjacentElement('afterend', fav);
    }

    const discount = nxDiscount(product);
    if (discount > 0 && !card.querySelector('.nx-sale-badge')) {
      const badge = document.createElement('span');
      badge.className = 'nx-sale-badge';
      badge.textContent = '-' + discount + '%';
      card.prepend(badge);
    }

    const price = card.querySelector('.product-price');
    if (price && Number(product.price) > nxPrice(product) && !price.parentElement.querySelector('.nx-old-price')) {
      const old = document.createElement('s');
      old.className = 'nx-old-price';
      old.textContent = nxMoney(product.price);
      price.insertAdjacentElement('beforebegin', old);
    }
  });
}
function nxApplyCatalogControls() {
  const grid = document.getElementById('storeProducts');
  const sort = document.getElementById('nxCatalogSort');
  const stockOnly = document.getElementById('nxStockOnly');
  if (!grid) return;
  const cards = [...grid.querySelectorAll('.product-card')];
  cards.forEach(card => {
    card.hidden = Boolean(stockOnly && stockOnly.checked && Number(card.dataset.nxStock || 0) <= 0);
  });
  const mode = sort ? sort.value : 'relevance';
  if (mode !== 'relevance') {
    cards.sort((a, b) => {
      if (mode === 'price-asc') return Number(a.dataset.nxPrice || 0) - Number(b.dataset.nxPrice || 0);
      if (mode === 'price-desc') return Number(b.dataset.nxPrice || 0) - Number(a.dataset.nxPrice || 0);
      if (mode === 'name') return String(a.dataset.nxName || '').localeCompare(String(b.dataset.nxName || ''), 'pt-BR');
      return 0;
    }).forEach(card => grid.appendChild(card));
  }
}
function nxInstallCatalogToolbar() {
  const grid = document.getElementById('storeProducts');
  if (!grid || document.getElementById('nxCatalogToolbar')) return;
  const toolbar = document.createElement('div');
  toolbar.id = 'nxCatalogToolbar';
  toolbar.className = 'nx-catalog-toolbar';
  toolbar.innerHTML = '<label>Ordenar <select id="nxCatalogSort">' +
    '<option value="relevance">Relevância</option><option value="price-asc">Menor preço</option>' +
    '<option value="price-desc">Maior preço</option><option value="name">Nome A–Z</option></select></label>' +
    '<label class="nx-switch"><input id="nxStockOnly" type="checkbox"><span>Somente disponíveis</span></label>';
  const status = document.getElementById('catalogStatus');
  (status ? status.parentElement : grid.parentElement).insertBefore(toolbar, grid);
  toolbar.addEventListener('change', nxApplyCatalogControls);

  const observer = new MutationObserver(() => {
    nxDecorateProductCards();
    nxApplyCatalogControls();
  });
  observer.observe(grid, { childList: true });
  nxDecorateProductCards();
  nxApplyCatalogControls();
}

function nxInstallFavoriteClicks() {
  document.addEventListener('click', event => {
    const button = event.target.closest('.nx-favorite-card, .nx-product-favorite');
    if (!button) return;
    event.preventDefault();
    const id = button.dataset.productId;
    if (!id) return;
    const active = nxToggleFavorite(id);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
    if (button.classList.contains('nx-favorite-card')) button.innerHTML = active ? '♥' : '♡';
    else button.textContent = active ? '♥ Salvo nos favoritos' : '♡ Salvar nos favoritos';
    nxToast(active ? 'Produto salvo nos favoritos.' : 'Produto removido dos favoritos.', 'success');
  });
  document.addEventListener('navoryx:favorites', () => {
    document.querySelectorAll('.nx-favorite-card, .nx-product-favorite').forEach(button => {
      const active = nxIsFavorite(button.dataset.productId);
      button.setAttribute('aria-pressed', String(active));
      if (button.classList.contains('nx-favorite-card')) button.innerHTML = active ? '♥' : '♡';
      else button.textContent = active ? '♥ Salvo nos favoritos' : '♡ Salvar nos favoritos';
    });
  });
}

function nxAddProfessionalHeaderLink() {
  document.querySelectorAll('.nav').forEach(nav => {
    if (nav.querySelector('a[href="favoritos.html"]')) return;
    const link = document.createElement('a');
    link.href = 'favoritos.html';
    link.textContent = 'Favoritos';
    nav.appendChild(link);
  });
}

function nxRecordRecent(product) {
  if (!product || product.id === undefined) return;
  const id = String(product.id);
  const recent = nxReadArray(NAVORYX_RECENT_KEY).map(String).filter(item => item !== id);
  nxWriteArray(NAVORYX_RECENT_KEY, [id, ...recent].slice(0, 8));
}

function nxUpdateMeta(product) {
  if (!product) return;
  const description = String(product.description || 'Tecnologia, acessórios e utilidades na Navoryx').replace(/\s+/g, ' ').trim().slice(0, 155);
  const image = new URL(product.image || 'img/logo-small.webp', location.href).href;
  const canonical = location.origin + location.pathname + '?id=' + encodeURIComponent(product.id);
  const setMeta = (selector, attr, value) => {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      if (selector.includes('property=')) el.setAttribute('property', selector.match(/property="([^"]+)"/)[1]);
      else el.setAttribute('name', selector.match(/name="([^"]+)"/)[1]);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  };
  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:title"]', 'content', (product.name || 'Produto') + ' | Navoryx');
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:image"]', 'content', image);
  setMeta('meta[property="og:url"]', 'content', canonical);
  setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
  link.href = canonical;

  let schema = document.getElementById('nxProductSchema');
  if (!schema) {
    schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.id = 'nxProductSchema';
    document.head.appendChild(schema);
  }
  const stock = Math.max(0, Math.floor(Number(product.stock) || 0));
  schema.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name || 'Produto',
    description,
    image: [image],
    sku: product.sku || String(product.id),
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'BRL',
      price: Number(nxPrice(product) || 0).toFixed(2),
      availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
    }
  }).replace(/</g, '\\u003c');
}

function nxInstallProductTools(product) {
  const info = document.querySelector('.product-page-info');
  if (!info || document.getElementById('nxProductTools')) return;
  const id = String(product.id);
  const tools = document.createElement('div');
  tools.id = 'nxProductTools';
  tools.className = 'nx-product-tools';

  const favorite = document.createElement('button');
  favorite.type = 'button';
  favorite.className = 'nx-product-favorite';
  favorite.dataset.productId = id;
  favorite.setAttribute('aria-pressed', String(nxIsFavorite(id)));
  favorite.textContent = nxIsFavorite(id) ? '♥ Salvo nos favoritos' : '♡ Salvar nos favoritos';

  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'nx-secondary-button';
  share.textContent = 'Compartilhar';
  share.addEventListener('click', async () => {
    const payload = { title: product.name || 'Navoryx', text: product.name || 'Confira este produto', url: location.href };
    try {
      if (navigator.share) await navigator.share(payload);
      else {
        await navigator.clipboard.writeText(location.href);
        nxToast('Link copiado.', 'success');
      }
    } catch (_) {}
  });
  tools.append(favorite, share);

  const buy = document.getElementById('buyButton');
  if (buy) {
    buy.insertAdjacentElement('afterend', tools);
    const now = document.createElement('button');
    now.type = 'button';
    now.className = 'nx-buy-now';
    now.textContent = 'Comprar agora';
    now.disabled = buy.disabled;
    now.addEventListener('click', () => {
      let ok = false;
      try {
        const qty = typeof quantidadeProduto !== 'undefined' ? quantidadeProduto : 1;
        if (typeof adicionarAoCarrinho === 'function') ok = adicionarAoCarrinho(product, qty);
      } catch (_) {}
      if (ok) location.href = 'carrinho.html';
      else nxToast('Confira a disponibilidade antes de continuar.', 'error');
    });
    buy.insertAdjacentElement('afterend', now);
  }

  const shipping = document.createElement('section');
  shipping.className = 'nx-product-shipping';
  shipping.setAttribute('aria-labelledby', 'nxShippingTitle');
  shipping.innerHTML = '<h2 id="nxShippingTitle">Calcule a entrega</h2>' +
    '<p>Veja o prazo e o valor da entrega econômica antes de adicionar ao carrinho.</p>' +
    '<div class="nx-shipping-form"><input id="nxProductCep" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000" aria-label="CEP de entrega">' +
    '<button type="button" id="nxProductShippingButton">Calcular</button></div>' +
    '<div id="nxProductShippingResult" class="nx-shipping-result" role="status" aria-live="polite"></div>';
  const security = info.querySelector('.product-security');
  (security || info).insertAdjacentElement(security ? 'beforebegin' : 'beforeend', shipping);

  const cep = shipping.querySelector('#nxProductCep');
  const button = shipping.querySelector('#nxProductShippingButton');
  const result = shipping.querySelector('#nxProductShippingResult');
  cep.addEventListener('input', () => {
    const digits = cep.value.replace(/\D/g, '').slice(0, 8);
    cep.value = digits.length > 5 ? digits.slice(0, 5) + '-' + digits.slice(5) : digits;
  });
  button.addEventListener('click', async () => {
    const digits = cep.value.replace(/\D/g, '');
    if (!/^\d{8}$/.test(digits)) { result.textContent = 'Informe um CEP válido com 8 números.'; return; }
    button.disabled = true;
    result.textContent = 'Calculando entrega…';
    try {
      const qty = typeof quantidadeProduto !== 'undefined' ? quantidadeProduto : 1;
      const response = await fetch(NAVORYX_FRETE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: product.id, quantity: qty, price: nxPrice(product) }], cep: digits })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.erro || 'Não foi possível calcular a entrega.');
      const option = Array.isArray(data.options) ? data.options.find(item => item.isEconomy || item.id === 'melhorenvio:1') || data.options[0] : null;
      if (!option) throw new Error('Entrega indisponível para este CEP.');
      result.replaceChildren();
      const strong = document.createElement('strong');
      strong.textContent = Number(option.price) === 0 ? 'Entrega econômica grátis' : 'Entrega econômica: ' + nxMoney(option.price);
      const small = document.createElement('small');
      small.textContent = (option.name || 'Envio') + ' • ' + (option.days || 0) + ' dia(s) útil(eis) após a postagem';
      result.append(strong, small);
      if (Number(option.discount) > 0) {
        const saving = document.createElement('small');
        saving.className = 'nx-positive';
        saving.textContent = 'Economia de ' + nxMoney(option.discount) + ' aplicada automaticamente.';
        result.appendChild(saving);
      }
    } catch (error) {
      result.textContent = error.message || 'Não foi possível calcular a entrega.';
    } finally { button.disabled = false; }
  });
}

async function nxInstallRelated(product) {
  const anchor = document.querySelector('.product-full-description');
  if (!anchor || document.getElementById('nxRelatedProducts')) return;
  const products = (await nxGetProducts()).filter(p => p.active !== false && String(p.id) !== String(product.id));
  const same = products.filter(p => p.category && product.category && String(p.category) === String(product.category));
  const selected = [...same, ...products.filter(p => !same.includes(p))].slice(0, 4);
  if (!selected.length) return;
  const section = document.createElement('section');
  section.id = 'nxRelatedProducts';
  section.className = 'nx-related-section';
  const heading = document.createElement('div');
  heading.className = 'nx-section-heading';
  heading.innerHTML = '<span>VOCÊ TAMBÉM PODE GOSTAR</span><h2>Produtos relacionados</h2>';
  const grid = document.createElement('div');
  grid.className = 'nx-mini-grid';
  selected.forEach(p => grid.appendChild(nxCreateMiniCard(p)));
  section.append(heading, grid);
  anchor.insertAdjacentElement('afterend', section);
}

async function nxInstallRecentSection() {
  const home = document.querySelector('.store-home main');
  if (!home || document.getElementById('nxRecentProducts')) return;
  const ids = nxReadArray(NAVORYX_RECENT_KEY).map(String);
  if (!ids.length) return;
  const products = await nxGetProducts();
  const byId = new Map(products.map(p => [String(p.id), p]));
  const selected = ids.map(id => byId.get(id)).filter(Boolean).slice(0, 4);
  if (!selected.length) return;
  const section = document.createElement('section');
  section.id = 'nxRecentProducts';
  section.className = 'section nx-recent-section';
  const container = document.createElement('div');
  container.className = 'container';
  const heading = document.createElement('div');
  heading.className = 'nx-section-heading';
  heading.innerHTML = '<span>CONTINUE DE ONDE PAROU</span><h2>Vistos recentemente</h2>';
  const grid = document.createElement('div');
  grid.className = 'nx-mini-grid';
  selected.forEach(p => grid.appendChild(nxCreateMiniCard(p, { actions: false })));
  container.append(heading, grid);
  section.appendChild(container);
  const benefits = document.getElementById('beneficios');
  if (benefits) benefits.insertAdjacentElement('beforebegin', section);
  else home.appendChild(section);
}

async function nxInstallCartRecommendations() {
  const layout = document.querySelector('.cart-layout');
  if (!layout || document.getElementById('nxCartRecommendations')) return;
  let cart = [];
  try { if (typeof obterCarrinho === 'function') cart = obterCarrinho(); } catch (_) {}
  if (!cart.length) return;
  const ids = new Set(cart.map(item => String(item.id)));
  const products = (await nxGetProducts()).filter(p => p.active !== false && !ids.has(String(p.id)) && Number(p.stock) > 0).slice(0, 4);
  if (!products.length) return;
  const section = document.createElement('section');
  section.id = 'nxCartRecommendations';
  section.className = 'nx-cart-recommendations';
  const heading = document.createElement('div');
  heading.className = 'nx-section-heading';
  heading.innerHTML = '<span>COMPLETE SEU PEDIDO</span><h2>Talvez você também precise</h2>';
  const grid = document.createElement('div');
  grid.className = 'nx-mini-grid';
  products.forEach(p => grid.appendChild(nxCreateMiniCard(p)));
  section.append(heading, grid);
  layout.parentElement.appendChild(section);
}

function nxInstallCheckoutStepper() {
  const cart = document.querySelector('.cart-page .container');
  const checkout = document.querySelector('.checkout-page .container');
  const target = cart || checkout;
  if (!target || target.querySelector('.nx-checkout-steps')) return;
  const current = checkout ? 2 : 1;
  const steps = document.createElement('ol');
  steps.className = 'nx-checkout-steps';
  ['Carrinho', 'Entrega e dados', 'Pagamento'].forEach((label, index) => {
    const li = document.createElement('li');
    li.className = index + 1 <= current ? 'is-active' : '';
    li.innerHTML = '<span>' + (index + 1) + '</span><strong>' + label + '</strong>';
    steps.appendChild(li);
  });
  target.prepend(steps);
  if (checkout) {
    const button = checkout.querySelector('.checkout-confirm-button');
    if (button && !checkout.querySelector('.nx-payment-trust')) {
      const note = document.createElement('div');
      note.className = 'nx-payment-trust';
      note.innerHTML = '<strong>Pagamento seguro</strong><span>Você será direcionado ao ambiente protegido do Mercado Pago para concluir o pagamento.</span>';
      button.insertAdjacentElement('afterend', note);
    }
  }
}

function nxInstallBackToTop() {
  if (document.getElementById('nxBackToTop')) return;
  const button = document.createElement('button');
  button.id = 'nxBackToTop';
  button.type = 'button';
  button.className = 'nx-back-to-top';
  button.setAttribute('aria-label', 'Voltar ao topo');
  button.textContent = '↑';
  button.hidden = true;
  button.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(button);
  addEventListener('scroll', () => { button.hidden = scrollY < 500; }, { passive: true });
}

async function nxRenderFavoritesPage() {
  const grid = document.getElementById('favoriteProducts');
  if (!grid) return;
  const ids = nxFavorites();
  const products = await nxGetProducts();
  const byId = new Map(products.map(p => [String(p.id), p]));
  const selected = ids.map(id => byId.get(id)).filter(Boolean);
  grid.replaceChildren();
  const status = document.getElementById('favoriteStatus');
  if (status) status.textContent = selected.length ? selected.length + (selected.length === 1 ? ' produto salvo' : ' produtos salvos') : '';
  if (!selected.length) {
    const empty = document.createElement('div');
    empty.className = 'nx-empty-state';
    empty.innerHTML = '<h2>Você ainda não salvou produtos</h2><p>Use o coração nos produtos para criar sua lista.</p><a class="nx-primary-button" href="index.html#destaques">Explorar produtos</a>';
    grid.appendChild(empty);
    return;
  }
  selected.forEach(product => grid.appendChild(nxCreateMiniCard(product)));
}

function nxApplySearchFromUrl() {
  const input = document.getElementById('searchInput');
  const form = document.getElementById('searchForm');
  if (!input || !form) return;
  const term = new URLSearchParams(location.search).get('busca');
  if (!term) return;
  input.value = term;
  const run = () => {
    try {
      if (typeof produtosLoja !== 'undefined' && Array.isArray(produtosLoja) && produtosLoja.length) form.requestSubmit();
      else setTimeout(run, 150);
    } catch (_) { setTimeout(run, 150); }
  };
  run();
}

function nxInstallHomeSchema() {
  if (!document.body.classList.contains('store-home') || document.getElementById('nxStoreSchema')) return;
  const schema = document.createElement('script');
  schema.type = 'application/ld+json';
  schema.id = 'nxStoreSchema';
  schema.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: 'Navoryx',
    url: location.origin + '/',
    description: 'Tecnologia, acessórios e utilidades para o dia a dia.',
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', email: 'navoryx.atendimento@gmail.com' }
  });
  document.head.appendChild(schema);
}

function nxWaitForProduct() {
  if (!document.getElementById('dynamicProductName')) return;
  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    let product = null;
    try { if (typeof produtoAtual !== 'undefined') product = produtoAtual; } catch (_) {}
    if (product) {
      clearInterval(timer);
      nxRecordRecent(product);
      nxUpdateMeta(product);
      nxInstallProductTools(product);
      nxInstallRelated(product);
    } else if (attempts > 80) clearInterval(timer);
  }, 100);
}

document.addEventListener('DOMContentLoaded', () => {
  nxInstallFooter();
  nxInstallSearchSuggestions();
  nxInstallCatalogToolbar();
  nxInstallFavoriteClicks();
  nxAddProfessionalHeaderLink();
  nxInstallCheckoutStepper();
  nxInstallBackToTop();
  nxInstallHomeSchema();
  nxWaitForProduct();
  nxInstallCartRecommendations();
  nxInstallRecentSection();
  nxRenderFavoritesPage();
  nxApplySearchFromUrl();
});
