// ==========================================
// NAVORYX - CONFIGURAÇÕES
// ==========================================

const STORE_API_URL =
  'https://navoryx-backend-2.onrender.com/produtos';

const CART_STORAGE_KEY = 'navoryxCart';
const PRODUCTS_STORAGE_KEY = 'navoryxProducts';

// A vitrine e o carrinho usam a mesma regra de promoção do servidor.
function precoAtualProduto(produto) {
  const normal = Number(produto.price);
  const promocao = Number(produto.salePrice);
  const preco = promocao > 0 && promocao < normal ? promocao : normal;
  return Number.isFinite(preco) && preco > 0 ? Math.round(preco * 100) / 100 : 0;
}

function dadosPromocaoProduto(produto) {
  const normal = Number(produto?.price);
  const atual = precoAtualProduto(produto || {});
  const emPromocao = Number.isFinite(normal) && normal > 0 && atual > 0 && atual < normal;
  return {
    emPromocao,
    precoAnterior: emPromocao ? Math.round(normal * 100) / 100 : 0,
    desconto: emPromocao ? Math.max(1, Math.round((1 - atual / normal) * 100)) : 0
  };
}

function animarCarrinho() {
  const botao = document.querySelector('.cart-button');
  if (!botao) return;
  botao.classList.remove('cart-updated');
  void botao.offsetWidth;
  botao.classList.add('cart-updated');
  setTimeout(() => botao.classList.remove('cart-updated'), 550);
}

async function consultarLoja(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const resposta = await fetch(url, { ...options, signal: controller.signal });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      const mensagem = typeof dados?.erro === 'string' ? dados.erro :
        'A loja está temporariamente indisponível. Tente novamente em instantes.';
      throw Object.assign(new Error(mensagem), { status: resposta.status });
    }
    if (dados === null) throw new Error('Não foi possível consultar a loja. Tente novamente.');
    return dados;
  } catch (erro) {
    if (erro.name === 'AbortError') {
      throw new Error('A loja demorou para responder. Tente novamente em instantes.');
    }
    if (erro instanceof TypeError) {
      throw new Error('Não foi possível conectar à loja. Confira sua conexão e tente novamente.');
    }
    throw erro;
  } finally {
    clearTimeout(timeout);
  }
}

async function atualizarPrecosCarrinho() {
  if (!obterCarrinho().length) return { carrinho: [], precosAlterados: false };
  const catalogo = await consultarLoja(STORE_API_URL, { cache: 'no-store' });
  if (!Array.isArray(catalogo)) throw new Error('Não foi possível atualizar os produtos. Tente novamente.');
  let precosAlterados = false;
  // Leia novamente depois da consulta para preservar alterações feitas no carrinho.
  const carrinho = obterCarrinho().map(item => {
    const candidatos = catalogo.filter(produto => produto.active !== false &&
      (item.id !== undefined ? String(produto.id) === String(item.id) : produto.name === item.name));
    if (candidatos.length !== 1) {
      throw new Error('Um produto não está mais disponível. Volte ao carrinho e remova esse item antes de pagar.');
    }
    const produto = candidatos[0];
    const preco = precoAtualProduto(produto);
    if (preco <= 0) throw new Error('Um produto está com o preço indisponível. Entre em contato com a loja.');
    if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 99) {
      throw new Error('Confira as quantidades no carrinho. São permitidas de 1 a 99 unidades por produto.');
    }
    const estoque = Math.max(0, Math.floor(Number(produto.stock) || 0));
    if (Number(item.quantity) > estoque) {
      throw new Error(estoque > 0
        ? 'O estoque mudou e restam apenas ' + estoque + ' unidade(s) de ' + (produto.name || 'um produto') + '. Ajuste o carrinho.'
        : (produto.name || 'Um produto') + ' está esgotado. Remova o item do carrinho.');
    }
    if (!Number.isFinite(Number(item.price)) || Math.round(Number(item.price) * 100) !== Math.round(preco * 100)) {
      precosAlterados = true;
    }
    return { ...item, id: produto.id, name: produto.name, image: produto.image || '', price: preco, stock: estoque };
  });
  salvarCarrinho(carrinho);
  return { carrinho, precosAlterados };
}


// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function formatarPreco(valor) {

  const preco = Number(valor);

  if (isNaN(preco)) {
    return 'R$ 0,00';
  }

  return preco.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}


function obterCarrinho() {

  try {

    const carrinho = JSON.parse(
      localStorage.getItem(CART_STORAGE_KEY)
    );
    return Array.isArray(carrinho) ? carrinho.filter(item => item && typeof item === 'object') : [];

  } catch (erro) {

    console.error(
      'Erro ao ler carrinho:',
      erro
    );

    return [];
  }
}


function salvarCarrinho(carrinho) {

  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify(carrinho)
  );

  atualizarContadorCarrinho();
}


// ==========================================
// CONTADOR DO CARRINHO
// ==========================================

function atualizarContadorCarrinho() {

  const cartCount =
    document.getElementById('cartCount');

  if (!cartCount) {
    return;
  }

  const carrinho =
    obterCarrinho();

  const quantidadeTotal =
    carrinho.reduce(
      (total, item) =>
        total + Number(item.quantity || 1),
      0
    );

  cartCount.textContent =
    quantidadeTotal;
}


// ==========================================
// ADICIONAR AO CARRINHO
// ==========================================

function adicionarAoCarrinho(produto, quantidade = 1) {

  if (!produto) {
    return;
  }

  const carrinho =
    obterCarrinho();

  const quantidadeAdicionar =
    Math.max(
      1,
      Number(quantidade) || 1
    );

  const produtoExistente =
    carrinho.find(
      item =>
        String(item.id) ===
        String(produto.id)
    );

  const estoque = Math.max(0, Math.floor(Number(produto.stock) || 0));
  const atual = Number(produtoExistente?.quantity || 0);
  if (estoque <= 0 || atual + quantidadeAdicionar > estoque) {
    return false;
  }

  if (produtoExistente) {

    produtoExistente.price = precoAtualProduto(produto);
    produtoExistente.name = produto.name || 'Produto';
    produtoExistente.image = produto.image || '';

    produtoExistente.quantity =
      Number(produtoExistente.quantity || 1) +
      quantidadeAdicionar;

  } else {

    carrinho.push({
      id: produto.id,
      name: produto.name || 'Produto',
      price: precoAtualProduto(produto),
      image: produto.image || '',
      stock: estoque,
      quantity: quantidadeAdicionar
    });
  }

  salvarCarrinho(carrinho);
  return true;
}


// ==========================================
// PRODUTOS DINÂMICOS NA HOME
// ==========================================

const storeProducts =
  document.getElementById('storeProducts');

let produtosLoja = [];
let listaCatalogoAtual = [];

function ordenarProdutos(lista) {
  const ordenacao = document.getElementById('sortProducts')?.value || 'featured';
  const copia = Array.isArray(lista) ? [...lista] : [];
  if (ordenacao === 'price-asc') copia.sort((a, b) => precoAtualProduto(a) - precoAtualProduto(b));
  if (ordenacao === 'price-desc') copia.sort((a, b) => precoAtualProduto(b) - precoAtualProduto(a));
  if (ordenacao === 'name') copia.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  return copia;
}


// ==========================================
// RENDERIZAR PRODUTOS
// ==========================================

function renderizarProdutosLoja(lista = produtosLoja) {

  if (!storeProducts) {
    return;
  }

  storeProducts.innerHTML = '';
  storeProducts.classList.remove('product-grid-loading');
  storeProducts.setAttribute('aria-busy', 'false');
  listaCatalogoAtual = Array.isArray(lista) ? [...lista] : [];
  const listaOrdenada = ordenarProdutos(listaCatalogoAtual);
  const catalogStatus = document.getElementById('catalogStatus');
  if (catalogStatus) {
    const total = listaOrdenada.filter(produto => produto.active !== false).length;
    catalogStatus.textContent = `${total} ${total === 1 ? 'produto disponível' : 'produtos disponíveis'}`;
  }

  if (
    !Array.isArray(listaOrdenada) ||
    listaOrdenada.length === 0
  ) {

    storeProducts.innerHTML = `
      <p class="no-products">
        Nenhum produto encontrado.
      </p>
    `;

    return;
  }

  listaOrdenada.forEach(produto => {

    if (produto.active === false) {
      return;
    }

    const card =
      document.createElement('div');

    card.className =
      'product-card';

    const nomeProduto =
      produto.name || 'Produto';

    const descricaoProduto =
      produto.description || '';

    const imagemProduto =
      produto.image || 'img/sem-imagem.png';

    const precoProduto =
      precoAtualProduto(produto);
    const estoqueProduto =
      Math.max(0, Math.floor(Number(produto.stock) || 0));
    const promocao = dadosPromocaoProduto(produto);

    card.dataset.search = `
      ${nomeProduto}
      ${descricaoProduto}
      ${produto.category || ''}
    `.toLowerCase();

    card.innerHTML = `

      <a
        href="produto.html?id=${encodeURIComponent(produto.id)}"
        class="product-media-link"
      >
        ${promocao.emPromocao ? `<span class="product-discount-card">-${promocao.desconto}%</span>` : ''}
        <img
          src="${imagemProduto}"
          alt="${nomeProduto}"
          class="product-image" loading="lazy" decoding="async"
        >
      </a>

      <div class="product-card-content">
        <a href="produto.html?id=${encodeURIComponent(produto.id)}" class="product-link">
          <h3>${nomeProduto}</h3>
        </a>

        <p>${descricaoProduto}</p>

        <div class="product-card-price">
          ${promocao.emPromocao ? `<span class="product-old-price">${formatarPreco(promocao.precoAnterior)}</span>` : ''}
          <span class="product-price">${formatarPreco(precoProduto)}</span>
        </div>

        <div class="product-card-meta">
          <span>${estoqueProduto > 0 ? 'Em estoque' : 'Indisponível'}</span>
          <span>Frete no carrinho</span>
        </div>

        <button
          type="button"
          class="add-cart"
          data-id="${produto.id}"
          data-name="${nomeProduto}"
          data-price="${precoProduto}"
          data-image="${imagemProduto}"
          data-stock="${estoqueProduto}"
          ${estoqueProduto <= 0 ? 'disabled' : ''}
        >
          ${estoqueProduto <= 0 ? 'Produto esgotado' : 'Adicionar ao carrinho'}
        </button>
      </div>

    `;

    storeProducts.appendChild(card);
  });
}


// ==========================================
// CARREGAR PRODUTOS DA API
// ==========================================

async function carregarProdutos() {

  if (!storeProducts) {
    return;
  }

  try {

    const resposta =
      await fetch(STORE_API_URL);

    if (!resposta.ok) {

      throw new Error(
        `Erro HTTP ${resposta.status}`
      );
    }

    const dados =
      await resposta.json();

    if (!Array.isArray(dados)) {

      throw new Error(
        'Formato inválido recebido da API.'
      );
    }

    produtosLoja =
      dados.filter(
        produto =>
          produto.active !== false
      );

    localStorage.setItem(
      PRODUCTS_STORAGE_KEY,
      JSON.stringify(produtosLoja)
    );

    const buscaInicial = new URLSearchParams(window.location.search).get('busca') || '';
    if (searchInput && buscaInicial) {
      searchInput.value = buscaInicial;
      aplicarBusca(buscaInicial);
      document.getElementById('destaques')?.scrollIntoView();
    } else {
      renderizarProdutosLoja(produtosLoja);
    }

  } catch (erro) {

    console.error(
      'Erro ao carregar produtos:',
      erro
    );

    try {

      const produtosSalvos =
        JSON.parse(
          localStorage.getItem(
            PRODUCTS_STORAGE_KEY
          )
        ) || [];

      produtosLoja =
        produtosSalvos;

      if (produtosLoja.length) {

        renderizarProdutosLoja(
          produtosLoja
        );

      } else {

        storeProducts.setAttribute('aria-busy', 'false');

        storeProducts.innerHTML = `
          <p class="no-products">
            Não foi possível carregar os produtos.
          </p>
        `;
      }

    } catch (erroStorage) {

      storeProducts.setAttribute('aria-busy', 'false');

      storeProducts.innerHTML = `
        <p class="no-products">
          Não foi possível carregar os produtos.
        </p>
      `;
    }
  }
}


// ==========================================
// CLIQUE NOS BOTÕES DA HOME
// ==========================================

document.addEventListener(
  'click',
  function(evento) {

    const botao =
      evento.target.closest('.add-cart');

    if (!botao) {
      return;
    }

    // O buyButton da página individual
    // possui tratamento próprio abaixo.
    if (botao.id === 'buyButton') {
      return;
    }

    const produto = {
      id:
        botao.dataset.id,

      name:
        botao.dataset.name,

      price:
        Number(botao.dataset.price),

      image:
        botao.dataset.image,
      stock:
        Number(botao.dataset.stock || 0)
    };

    if (!adicionarAoCarrinho(
      produto,
      1
    )) {
      botao.textContent = 'Sem estoque';
      return;
    }

    const textoOriginal =
      botao.textContent;

    botao.textContent =
      '✓ Adicionado';
    animarCarrinho();

    setTimeout(() => {

      botao.textContent =
        textoOriginal;

    }, 1200);
  }
);


// ==========================================
// PESQUISA DA HOME
// ==========================================

const searchForm =
  document.getElementById('searchForm');

const searchInput =
  document.getElementById('searchInput');

const searchSuggestions =
  document.getElementById('searchSuggestions');

function produtosQueCombinam(termo) {
  const normalizado = String(termo || '').trim().toLowerCase();
  if (!normalizado) return produtosLoja;
  return produtosLoja.filter(produto => `
    ${produto.name || ''}
    ${produto.description || ''}
    ${produto.category || ''}
  `.toLowerCase().includes(normalizado));
}

function aplicarBusca(termo) {
  const normalizado = String(termo || '').trim();
  renderizarProdutosLoja(normalizado ? produtosQueCombinam(normalizado) : produtosLoja);
}

function ocultarSugestoesBusca() {
  if (!searchSuggestions || !searchInput) return;
  searchSuggestions.hidden = true;
  searchSuggestions.replaceChildren();
  searchInput.setAttribute('aria-expanded', 'false');
}

function mostrarSugestoesBusca(termo) {
  if (!searchSuggestions || !searchInput) return;
  const normalizado = String(termo || '').trim();
  if (normalizado.length < 2) {
    ocultarSugestoesBusca();
    return;
  }
  const resultados = produtosQueCombinam(normalizado).slice(0, 5);
  searchSuggestions.replaceChildren();
  if (!resultados.length) {
    const vazio = document.createElement('div');
    vazio.className = 'search-suggestion-empty';
    vazio.textContent = 'Nenhum produto encontrado';
    searchSuggestions.appendChild(vazio);
  } else {
    resultados.forEach(produto => {
      const link = document.createElement('a');
      link.className = 'search-suggestion-item';
      link.href = 'produto.html?id=' + encodeURIComponent(produto.id);

      const imagem = document.createElement('img');
      imagem.src = produto.image || 'img/sem-imagem.png';
      imagem.alt = '';

      const texto = document.createElement('span');
      texto.className = 'search-suggestion-copy';
      const nome = document.createElement('strong');
      nome.textContent = produto.name || 'Produto';
      const preco = document.createElement('span');
      preco.textContent = formatarPreco(precoAtualProduto(produto));
      texto.append(nome, preco);

      link.append(imagem, texto);
      searchSuggestions.appendChild(link);
    });
  }
  searchSuggestions.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
}

if (
  searchForm &&
  searchInput
) {

  searchForm.addEventListener(
    'submit',
    function(evento) {
      evento.preventDefault();
      aplicarBusca(searchInput.value);
      ocultarSugestoesBusca();
      const secaoProdutos = document.getElementById('destaques');
      secaoProdutos?.scrollIntoView({ behavior: 'smooth' });
    }
  );

  searchInput.addEventListener('input', function() {
    const termo = searchInput.value.trim();
    if (!termo) renderizarProdutosLoja(produtosLoja);
    mostrarSugestoesBusca(termo);
  });

  searchInput.addEventListener('keydown', function(evento) {
    if (evento.key === 'Escape') ocultarSugestoesBusca();
  });

  document.addEventListener('click', function(evento) {
    if (!searchForm.contains(evento.target)) ocultarSugestoesBusca();
  });
}


// As imagens de categoria também funcionam como atalhos da vitrine.
const categoryCards = document.querySelectorAll('.category-image-card[data-category]');
const categoryTerms = {
  audio: /áudio|audio|fone|headset|caixa de som|bluetooth|earbud/i,
  cabos: /cabo|carregador|carregamento|fonte|adaptador/i,
  celular: /celular|smartphone|capinha|película|suporte|acessório/i,
  smartwatch: /smartwatch|relógio|relogio|pulseira inteligente/i
};

categoryCards.forEach(card => {
  card.addEventListener('click', () => {
    const selected = card.dataset.category;
    categoryCards.forEach(item => item.removeAttribute('aria-current'));
    card.setAttribute('aria-current', 'true');
    if (searchInput) searchInput.value = '';
    const matches = produtosLoja.filter(produto =>
      categoryTerms[selected]?.test(`${produto.category || ''} ${produto.name || ''}`)
    );
    renderizarProdutosLoja(matches);
    ocultarSugestoesBusca();
  });
});

// Retorna ao catálogo completo após buscar ou selecionar uma categoria.
document.getElementById('showAllProducts')?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  categoryCards.forEach(card => card.removeAttribute('aria-current'));
  ocultarSugestoesBusca();
  renderizarProdutosLoja(produtosLoja);
});

document.getElementById('sortProducts')?.addEventListener('change', () => {
  renderizarProdutosLoja(listaCatalogoAtual);
});

// ==========================================
// INICIAR PRODUTOS DA HOME
// ==========================================

if (storeProducts) {
  carregarProdutos();
}


// ==========================================
// PÁGINA INDIVIDUAL DO PRODUTO
// ==========================================

const dynamicProductName =
  document.getElementById(
    'dynamicProductName'
  );

const dynamicProductDescription =
  document.getElementById(
    'dynamicProductDescription'
  );

const dynamicProductPrice =
  document.getElementById(
    'dynamicProductPrice'
  );

const dynamicProductImage =
  document.getElementById(
    'dynamicProductImage'
  );

const dynamicProductOldPrice =
  document.getElementById('dynamicProductOldPrice');

const dynamicProductDiscount =
  document.getElementById('dynamicProductDiscount');

const dynamicBreadcrumbName =
  document.getElementById('dynamicBreadcrumbName');

const dynamicProductFullDescription =
  document.getElementById(
    'dynamicProductFullDescription'
  );

const dynamicProductContent =
  document.getElementById(
    'dynamicProductContent'
  );

const buyButton =
  document.getElementById(
    'buyButton'
  );

const quantityElement =
  document.getElementById(
    'quantity'
  );

const increaseButton =
  document.getElementById(
    'increase'
  );

const decreaseButton =
  document.getElementById(
    'decrease'
  );

let produtoAtual = null;
let quantidadeProduto = 1;


// ==========================================
// QUANTIDADE NA PÁGINA DO PRODUTO
// ==========================================

function atualizarQuantidadeProduto() {

  if (quantityElement) {

    quantityElement.textContent =
      quantidadeProduto;
  }
}


if (increaseButton) {

  increaseButton.addEventListener(
    'click',
    function() {

      const estoque = Math.max(0, Math.floor(Number(produtoAtual?.stock) || 0));
      if (quantidadeProduto < estoque) quantidadeProduto++;

      atualizarQuantidadeProduto();
    }
  );
}


if (decreaseButton) {

  decreaseButton.addEventListener(
    'click',
    function() {

      if (quantidadeProduto > 1) {

        quantidadeProduto--;

        atualizarQuantidadeProduto();
      }
    }
  );
}


// ==========================================
// PRODUTO NÃO ENCONTRADO
// ==========================================

function mostrarProdutoNaoEncontrado() {

  if (dynamicProductName) {

    dynamicProductName.textContent =
      'Produto não encontrado';
  }

  if (dynamicProductDescription) {

    dynamicProductDescription.textContent =
      'Este produto não está disponível.';
  }

  if (dynamicProductPrice) {
    dynamicProductPrice.textContent = '';
  }
  if (dynamicProductOldPrice) dynamicProductOldPrice.hidden = true;
  if (dynamicProductDiscount) dynamicProductDiscount.hidden = true;
  if (dynamicBreadcrumbName) dynamicBreadcrumbName.textContent = 'Produto';

  if (dynamicProductImage) {

    dynamicProductImage.style.display =
      'none';
  }

  if (dynamicProductFullDescription) {

    dynamicProductFullDescription.textContent =
      '';
  }

  if (buyButton) {

    buyButton.style.display =
      'none';
  }
}


// ==========================================
// CARREGAR PRODUTO INDIVIDUAL
// ==========================================

async function carregarProdutoIndividual() {

  if (
    !dynamicProductName ||
    !dynamicProductPrice ||
    !dynamicProductImage
  ) {

    return;
  }

  const parametros =
    new URLSearchParams(
      window.location.search
    );

  const produtoId =
    parametros.get('id');

  if (!produtoId) {

    mostrarProdutoNaoEncontrado();

    return;
  }

  let produto = null;

  try {

    const resposta =
      await fetch(
        `${STORE_API_URL}/${encodeURIComponent(produtoId)}`
      );

    if (resposta.ok) {

      produto =
        await resposta.json();
    }

  } catch (erro) {

    console.warn(
      'Produto não encontrado diretamente na API.',
      erro
    );
  }

  if (!produto) {

    try {

      const produtosSalvos =
        JSON.parse(
          localStorage.getItem(
            PRODUCTS_STORAGE_KEY
          )
        ) || [];

      produto =
        produtosSalvos.find(
          item =>
            String(item.id) ===
            String(produtoId)
        );

    } catch (erro) {

      console.error(
        'Erro ao ler produtos salvos:',
        erro
      );
    }
  }

  if (
    !produto ||
    produto.active === false
  ) {

    mostrarProdutoNaoEncontrado();

    return;
  }

  produtoAtual =
    produto;

  document.title =
    `${produto.name || 'Produto'} | Navoryx`;

  dynamicProductName.textContent =
    produto.name ||
    'Produto';

  if (dynamicBreadcrumbName) {
    dynamicBreadcrumbName.textContent = produto.name || 'Produto';
  }

  if (dynamicProductDescription) {

    dynamicProductDescription.textContent =
      produto.description || '';
  }

  dynamicProductPrice.textContent =
    formatarPreco(
      precoAtualProduto(produto)
    );

  const promocaoProduto = dadosPromocaoProduto(produto);
  if (dynamicProductOldPrice) {
    dynamicProductOldPrice.hidden = !promocaoProduto.emPromocao;
    dynamicProductOldPrice.textContent = promocaoProduto.emPromocao
      ? formatarPreco(promocaoProduto.precoAnterior)
      : '';
  }
  if (dynamicProductDiscount) {
    dynamicProductDiscount.hidden = !promocaoProduto.emPromocao;
    dynamicProductDiscount.textContent = promocaoProduto.emPromocao
      ? '-' + promocaoProduto.desconto + '%'
      : '';
  }

  dynamicProductImage.src =
    produto.image ||
    'img/sem-imagem.png';

  dynamicProductImage.alt =
    produto.name ||
    'Produto';

  dynamicProductImage.style.display =
    'block';

  if (dynamicProductFullDescription) {

    dynamicProductFullDescription.textContent =
      produto.description || '';
  }

  if (dynamicProductContent) {

    dynamicProductContent.textContent =
      produto.content ||
      '1 unidade.';
  }

  if (buyButton) {
    const estoque = Math.max(0, Math.floor(Number(produto.stock) || 0));
    buyButton.style.display = '';
    buyButton.disabled = estoque <= 0;
    buyButton.textContent = estoque <= 0 ? 'Produto esgotado' : '🛒 Adicionar ao carrinho';
    if (increaseButton) increaseButton.disabled = estoque <= 1;
    if (decreaseButton) decreaseButton.disabled = estoque <= 0;
    const status = document.getElementById('productStockStatus');
    if (status) status.textContent = estoque <= 0 ? 'Sem estoque no momento' :
      estoque <= 3 ? 'Últimas ' + estoque + ' unidade(s) disponíveis' : 'Em estoque';
  }
}


// ==========================================
// BOTÃO COMPRAR NA PÁGINA DO PRODUTO
// ==========================================

if (buyButton) {

  buyButton.addEventListener(
    'click',
    function() {

      if (!produtoAtual) {
        return;
      }

      if (!adicionarAoCarrinho(
        produtoAtual,
        quantidadeProduto
      )) {
        buyButton.textContent = 'Quantidade indisponível';
        return;
      }

      const textoOriginal =
        buyButton.textContent;

      buyButton.textContent =
        '✓ Produto adicionado';
      animarCarrinho();

      setTimeout(() => {

        buyButton.textContent =
          textoOriginal;

      }, 1200);
    }
  );
}


// ==========================================
// INICIA PÁGINA DO PRODUTO
// ==========================================

carregarProdutoIndividual();// ==========================================
// PÁGINA DO CARRINHO
// ==========================================

const cartItems =
  document.getElementById(
    'cartItems'
  );

const summaryProducts =
  document.getElementById(
    'summaryProducts'
  );

const cartTotal =
  document.getElementById(
    'cartTotal'
  );

const checkoutButton =
  document.getElementById(
    'checkoutButton'
  );


// ==========================================
// ALTERAR QUANTIDADE DO CARRINHO
// ==========================================

function alterarQuantidadeCarrinho(
  id,
  quantidade
) {

  const carrinho =
    obterCarrinho();

  const item =
    carrinho.find(
      produto =>
        String(produto.id) ===
        String(id)
    );

  if (!item) {
    return;
  }

  item.quantity =
    Math.max(
      1,
      Number(quantidade)
    );

  salvarCarrinho(
    carrinho
  );

  renderizarCarrinho();
}


// ==========================================
// REMOVER PRODUTO
// ==========================================

function removerProdutoCarrinho(id) {

  let carrinho =
    obterCarrinho();

  carrinho =
    carrinho.filter(
      produto =>
        String(produto.id) !==
        String(id)
    );

  salvarCarrinho(
    carrinho
  );

  renderizarCarrinho();
}


// ==========================================
// RENDERIZAR CARRINHO
// ==========================================

function renderizarCarrinho() {

  if (!cartItems) {
    return;
  }

  const carrinho =
    obterCarrinho();

  cartItems.innerHTML = '';

  if (carrinho.length === 0) {

    cartItems.innerHTML = `

      <div class="empty-cart">

        <h2>
          Seu carrinho está vazio
        </h2>

        <p>
          Adicione produtos para continuar.
        </p>

        <a
          href="index.html#destaques"
          class="continue-shopping"
        >
          Ver produtos
        </a>

      </div>

    `;

    if (summaryProducts) {

      summaryProducts.textContent =
        formatarPreco(0);
    }

    if (cartTotal) {

      cartTotal.textContent =
        formatarPreco(0);
    }

    if (checkoutButton) {

      checkoutButton.disabled =
        true;
    }

    atualizarContadorCarrinho();

    return;
  }

  let total = 0;

  carrinho.forEach(item => {

    const quantidade =
      Number(item.quantity) || 1;

    const preco =
      Number(item.price) || 0;

    const subtotal =
      preco * quantidade;

    total += subtotal;

    const elemento =
      document.createElement('div');

    elemento.className =
      'cart-item';

    elemento.innerHTML = `

      <div class="cart-item-image">

        <img
          src="${item.image || 'img/sem-imagem.png'}"
          alt="${item.name || 'Produto'}"
        >

      </div>

      <div class="cart-item-info">

        <h2>
          ${item.name || 'Produto'}
        </h2>

        <p>
          Produto selecionado
        </p>

        <div class="cart-quantity">

          <button
            type="button"
            class="cart-decrease"
            data-id="${item.id}"
            aria-label="Diminuir quantidade"
          >
            −
          </button>

          <span>
            ${quantidade}
          </span>

          <button
            type="button"
            class="cart-increase"
            data-id="${item.id}"
            aria-label="Aumentar quantidade"
          >
            +
          </button>

        </div>

        <button
          type="button"
          class="remove-product cart-remove"
          data-id="${item.id}"
        >
          Remover
        </button>

      </div>

      <div class="cart-item-price">

        <span>
          Subtotal
        </span>

        <strong>
          ${formatarPreco(subtotal)}
        </strong>

      </div>

    `;

    cartItems.appendChild(
      elemento
    );
  });

  if (summaryProducts) {

    summaryProducts.textContent =
      formatarPreco(total);
  }

  if (cartTotal) {

    cartTotal.textContent =
      formatarPreco(total);
  }

  if (checkoutButton) {

    checkoutButton.disabled =
      false;
  }

  atualizarContadorCarrinho();
  if (typeof atualizarResumoFrete === 'function') atualizarResumoFrete();
}


// ==========================================
// CLIQUES NO CARRINHO
// ==========================================

if (cartItems) {

  cartItems.addEventListener(
    'click',
    function(evento) {

      const aumentar =
        evento.target.closest(
          '.cart-increase'
        );

      const diminuir =
        evento.target.closest(
          '.cart-decrease'
        );

      const remover =
        evento.target.closest(
          '.cart-remove'
        );

      if (aumentar) {

        const id =
          aumentar.dataset.id;

        const carrinho =
          obterCarrinho();

        const item =
          carrinho.find(
            produto =>
              String(produto.id) ===
              String(id)
          );

        if (item) {
          const estoque = Math.max(0, Math.floor(Number(item.stock) || 0));
          const proxima = Number(item.quantity || 1) + 1;
          if (proxima <= estoque) alterarQuantidadeCarrinho(id, proxima);
        }
      }

      if (diminuir) {

        const id =
          diminuir.dataset.id;

        const carrinho =
          obterCarrinho();

        const item =
          carrinho.find(
            produto =>
              String(produto.id) ===
              String(id)
          );

        if (item) {

          const quantidadeAtual =
            Number(item.quantity || 1);

          if (quantidadeAtual > 1) {

            alterarQuantidadeCarrinho(
              id,
              quantidadeAtual - 1
            );

          } else {

            removerProdutoCarrinho(
              id
            );
          }
        }
      }

      if (remover) {

        removerProdutoCarrinho(
          remover.dataset.id
        );
      }
    }
  );
}


// ==========================================
// FINALIZAR COMPRA
// ==========================================

if (checkoutButton) {

  checkoutButton.addEventListener(
    'click',
    function() {

      const carrinho =
        obterCarrinho();

      if (carrinho.length === 0) {

        alert(
          'Seu carrinho está vazio.'
        );

        return;
      }

      window.location.href =
        'checkout.html';
    }
  );
}


// ==========================================
// BUSCA AUTOMÁTICA DE CEP
// ==========================================

const cepInput =
  document.getElementById('cep');

const enderecoInput =
  document.getElementById('endereco');

const bairroInput =
  document.getElementById('bairro');

const cidadeInput =
  document.getElementById('cidade');

const estadoInput =
  document.getElementById('estado');


const cepStatus = document.getElementById('cepStatus');
let consultaCep = null;
let ultimoCepConsultado = '';
let versaoCep = 0;

function mostrarStatusCep(mensagem, tipo = 'info') {
  if (!cepStatus) return;
  cepStatus.textContent = mensagem;
  cepStatus.dataset.type = tipo;
  cepStatus.hidden = !mensagem;
}

async function buscarCep(cepInformado) {
  const cepLimpo = String(cepInformado || '').replace(/\D/g, '');
  if (cepLimpo.length !== 8 || consultaCep?.cep === cepLimpo || ultimoCepConsultado === cepLimpo) return;
  consultaCep?.controller.abort();
  const version = ++versaoCep;
  const controller = new AbortController();
  consultaCep = { cep: cepLimpo, controller };
  const campos = [enderecoInput, bairroInput, cidadeInput, estadoInput];
  const anteriores = campos.map(campo => campo?.value || '');
  const timeout = setTimeout(() => controller.abort(), 8000);
  mostrarStatusCep('Consultando CEP… Você pode continuar preenchendo seus dados.');
  cepInput?.setAttribute('aria-busy', 'true');
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { signal: controller.signal });
    if (!resposta.ok) throw new Error('Consulta indisponível');
    const dados = await resposta.json();
    if (version !== versaoCep || cepInput?.value.replace(/\D/g, '') !== cepLimpo) return;
    if (!dados || dados.erro) {
      mostrarStatusCep('CEP não encontrado. Confira o número ou preencha o endereço manualmente.', 'error');
      return;
    }
    [dados.logradouro, dados.bairro, dados.localidade, dados.uf].forEach((valor, index) => {
      // Não sobrescreva alterações feitas enquanto a consulta estava em andamento.
      if (campos[index] && campos[index].value === anteriores[index] && valor) campos[index].value = valor;
    });
    ultimoCepConsultado = cepLimpo;
    mostrarStatusCep('CEP consultado. Confira o endereço e informe o número.');
  } catch (_) {
    if (version === versaoCep) mostrarStatusCep('Não foi possível consultar o CEP agora. Você pode preencher o endereço manualmente.', 'error');
  } finally {
    clearTimeout(timeout);
    if (version === versaoCep) {
      consultaCep = null;
      cepInput?.setAttribute('aria-busy', 'false');
    }
  }
}

if (cepInput) {
  cepInput.addEventListener('input', function() {
    const digits = cepInput.value.replace(/\D/g, '').slice(0, 8);
    cepInput.value = digits.length > 5 ? digits.slice(0, 5) + '-' + digits.slice(5) : digits;
    if (digits !== ultimoCepConsultado) ultimoCepConsultado = '';
    if (consultaCep && consultaCep.cep !== digits) {
      versaoCep++;
      consultaCep.controller.abort();
      consultaCep = null;
      cepInput.setAttribute('aria-busy', 'false');
      mostrarStatusCep('');
    }
    if (digits.length === 8) buscarCep(digits);
  });
  cepInput.addEventListener('blur', function() {
    buscarCep(cepInput.value);
  });
}


// ==========================================
// PÁGINA DE CHECKOUT
// ==========================================

const checkoutForm =
  document.getElementById(
    'checkoutForm'
  );

const checkoutItems =
  document.getElementById(
    'checkoutItems'
  );

const checkoutProductsTotal =
  document.getElementById(
    'checkoutProductsTotal'
  );

const checkoutTotal =
  document.getElementById(
    'checkoutTotal'
  );


// ==========================================
// RENDERIZAR RESUMO DO CHECKOUT
// ==========================================

function renderizarResumoCheckout() {

  if (!checkoutItems) {
    return;
  }

  const carrinho =
    obterCarrinho();

  checkoutItems.innerHTML =
    '';

  if (carrinho.length === 0) {

    checkoutItems.innerHTML = `
      <p style="color:#aebccc;">
        Seu carrinho está vazio.
      </p>
    `;

    if (checkoutProductsTotal) {

      checkoutProductsTotal.textContent =
        formatarPreco(0);
    }

    if (checkoutTotal) {

      checkoutTotal.textContent =
        formatarPreco(0);
    }

    const botaoContinuar =
      document.querySelector(
        '.checkout-confirm-button'
      );

    if (botaoContinuar) {

      botaoContinuar.disabled =
        true;
    }

    return;
  }

  let total = 0;

  carrinho.forEach(item => {

    const quantidade =
      Number(item.quantity) || 1;

    const preco =
      Number(item.price) || 0;

    const subtotal =
      preco * quantidade;

    total += subtotal;

    const elemento =
      document.createElement('div');

    elemento.className =
      'checkout-item';

    elemento.innerHTML = `

      <div class="checkout-item-image">

        <img
          src="${item.image || 'img/sem-imagem.png'}"
          alt="${item.name || 'Produto'}"
        >

      </div>

      <div class="checkout-item-info">

        <strong>
          ${item.name || 'Produto'}
        </strong>

        <span>
          Quantidade: ${quantidade}
        </span>

      </div>

      <div class="checkout-item-price">
        ${formatarPreco(subtotal)}
      </div>

    `;

    checkoutItems.appendChild(
      elemento
    );
  });

  if (checkoutProductsTotal) {

    checkoutProductsTotal.textContent =
      formatarPreco(total);
  }

  if (checkoutTotal) {

    checkoutTotal.textContent =
      formatarPreco(total);
  }
}


// ==========================================
// SALVAR DADOS DO CLIENTE
// ==========================================

if (checkoutForm) {

  checkoutForm.addEventListener(
    'submit',
    function(evento) {

      evento.preventDefault();

      const carrinho =
        obterCarrinho();

      if (carrinho.length === 0) {

        alert(
          'Seu carrinho está vazio.'
        );

        return;
      }

      if (!checkoutForm.checkValidity()) {

        checkoutForm.reportValidity();

        return;
      }

      const dadosCliente = {
        documento: document.getElementById('documento')?.value.trim() || '',

        nome:
          document.getElementById('nome')?.value.trim() || '',

        email:
          document.getElementById('email')?.value.trim() || '',

        telefone:
          document.getElementById('telefone')?.value.trim() || '',

        cep:
          document.getElementById('cep')?.value.trim() || '',

        numero:
          document.getElementById('numero')?.value.trim() || '',

        endereco:
          document.getElementById('endereco')?.value.trim() || '',

        complemento:
          document.getElementById('complemento')?.value.trim() || '',

        bairro:
          document.getElementById('bairro')?.value.trim() || '',

        cidade:
          document.getElementById('cidade')?.value.trim() || '',

        estado:
          (
            document.getElementById('estado')?.value.trim() || ''
          ).toUpperCase()
      };

      try {
        localStorage.setItem('navoryxCheckout', JSON.stringify(dadosCliente));
      } catch (_) {
        mostrarStatusCompra('O navegador não permitiu salvar os dados. Libere o armazenamento deste site e tente novamente.', 'error');
        return;
      }

      window.location.href =
        'pagamento.html';
    }
  );
}


renderizarResumoCheckout();// ==========================================
// PAGAMENTO - CHECKOUT PRO MERCADO PAGO
// ==========================================

const paymentItems =
  document.getElementById('paymentItems');

const paymentProductsTotal =
  document.getElementById('paymentProductsTotal');

const paymentTotal =
  document.getElementById('paymentTotal');

const payButton =
  document.getElementById('payButton');


function renderizarResumoPagamento() {

  if (!paymentItems) {
    return;
  }

  const carrinho =
    obterCarrinho();

  paymentItems.innerHTML = '';

  if (carrinho.length === 0) {

    paymentItems.innerHTML = `
      <p>Seu carrinho está vazio.</p>
    `;

    if (paymentProductsTotal) {
      paymentProductsTotal.textContent =
        formatarPreco(0);
    }

    if (paymentTotal) {
      paymentTotal.textContent =
        formatarPreco(0);
    }

    if (payButton) {
      payButton.disabled = true;
    }

    return;
  }

  let total = 0;

  carrinho.forEach(item => {

    const quantidade =
      Number(item.quantity) || 1;

    const preco =
      Number(item.price) || 0;

    const subtotal =
      preco * quantidade;

    total += subtotal;

    const elemento =
      document.createElement('div');

    elemento.className =
      'checkout-item';

    elemento.innerHTML = `

      <div class="checkout-item-image">

        <img
          src="${item.image || 'img/sem-imagem.png'}"
          alt="${item.name || 'Produto'}">

      </div>

      <div class="checkout-item-info">

        <strong>
          ${item.name || 'Produto'}
        </strong>

        <span>
          Quantidade: ${quantidade}
        </span>

      </div>

      <div class="checkout-item-price">
        ${formatarPreco(subtotal)}
      </div>

    `;

    paymentItems.appendChild(
      elemento
    );
  });

  if (paymentProductsTotal) {
    paymentProductsTotal.textContent =
      formatarPreco(total);
  }

  if (paymentTotal) {
    paymentTotal.textContent =
      formatarPreco(total);
  }

  if (payButton) {
    payButton.disabled = false;
  }
}


// ==========================================
// ABRIR CHECKOUT PRO
// ==========================================

const checkoutStatus = document.getElementById('checkoutStatus');
let pagamentoEmAndamento = false;
let checkoutAttempt = { fingerprint: '', key: '' };
function mostrarUltimoPedido() {
  const link=document.getElementById('lastOrderLink');if(!link)return;
  try {
    const url=new URL(localStorage.getItem('navoryxLastOrder')||'');
    if(url.origin==='https://navoryx-site.onrender.com' && url.pathname==='/retorno.html' && /^[a-f0-9]{64}$/.test(url.searchParams.get('pedido')||'')) {
      link.href=url.href;link.hidden=false;
    }
  } catch (_) { /* Ainda não há pedido neste navegador. */ }
}
mostrarUltimoPedido();

function mostrarStatusCompra(mensagem, tipo = 'info') {
  if (!checkoutStatus) return;
  checkoutStatus.textContent = mensagem;
  checkoutStatus.dataset.type = tipo;
  checkoutStatus.hidden = !mensagem;
}

function atualizarResumosCompra() {
  renderizarCarrinho();
  renderizarResumoCheckout();
  renderizarResumoPagamento();
  if (typeof atualizarResumoFrete === 'function') atualizarResumoFrete();
}

function definirPagamentoEmAndamento(ativo, texto = 'Ir para pagamento seguro') {
  pagamentoEmAndamento = ativo;
  if (!payButton) return;
  payButton.disabled = ativo || !obterCarrinho().length;
  payButton.textContent = texto;
  payButton.setAttribute('aria-busy', String(ativo));
}

async function prepararResumoCompra() {
  if (!cartItems && !checkoutItems && !paymentItems) return;
  if (!obterCarrinho().length) return;
  definirPagamentoEmAndamento(true, 'Conferindo valores...');
  mostrarStatusCompra('Conferindo os preços atuais dos produtos...');
  try {
    const resultado = await atualizarPrecosCarrinho();
    atualizarResumosCompra();
    mostrarStatusCompra(resultado.precosAlterados ?
      'Os preços foram atualizados. Confira o novo total antes de continuar.' : '');
  } catch (erro) {
    mostrarStatusCompra(erro.message, 'error');
  } finally {
    definirPagamentoEmAndamento(false);
  }
}

if (payButton) {
  payButton.addEventListener('click', async function() {
    if (pagamentoEmAndamento) return;
    if (!obterCarrinho().length) {
      mostrarStatusCompra('Seu carrinho está vazio.', 'error');
      payButton.disabled = true;
      return;
    }
    definirPagamentoEmAndamento(true, 'Abrindo pagamento...');
    mostrarStatusCompra('Conectando ao pagamento seguro. Aguarde alguns instantes...');
    let redirecionando = false;
    try {
      // O servidor confere preço e disponibilidade antes de criar a preferência.
      // Evite uma consulta extra ao catálogo na abertura do pagamento.
      const items = obterCarrinho().map(item => ({
        id: item.id,
        name: String(item.name || 'Produto'),
        quantity: Number(item.quantity),
        price: Number(item.price)
      }));
      const shipping = typeof obterFreteSelecionado === 'function' ? obterFreteSelecionado() : null;
      const customer = typeof obterClienteEntrega === 'function' ? obterClienteEntrega() : null;
      const fingerprint = JSON.stringify({items,shipping,customer});
      if (checkoutAttempt.fingerprint !== fingerprint) checkoutAttempt = { fingerprint, key: crypto.randomUUID() };
      const dados = await consultarLoja('https://navoryx-backend-2.onrender.com/criar-preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, shipping, customer, checkoutKey: checkoutAttempt.key })
      });
      let linkPagamento;
      try { linkPagamento = new URL(dados.init_point); } catch (_) { /* Validado abaixo. */ }
      if (!linkPagamento || linkPagamento.origin !== 'https://www.mercadopago.com.br') {
        throw new Error('Não foi possível obter o link seguro do Mercado Pago. Tente novamente.');
      }
      try {
        localStorage.setItem('navoryxPaymentCart', JSON.stringify({ cart: localStorage.getItem('navoryxCart') }));
        if(dados.tracking_url) localStorage.setItem('navoryxLastOrder',dados.tracking_url);
        mostrarUltimoPedido();
      } catch (_) {}
      window.location.href = linkPagamento.href;
      redirecionando = true;
    } catch (erro) {
      let mensagem = erro.message;
      // O catálogo pode mudar entre a conferência e a criação do pagamento.
      if (erro.status === 409) {
        try {
          const atualizacao = await atualizarPrecosCarrinho();
          atualizarResumosCompra();
          if (atualizacao.precosAlterados) {
            mensagem = 'Os preços foram atualizados. Confira o novo total e clique novamente para continuar.';
          }
        } catch (_) { /* Preserve a mensagem original se a nova consulta falhar. */ }
      }
      mostrarStatusCompra(mensagem, 'error');
    } finally {
      if (!redirecionando) definirPagamentoEmAndamento(false);
    }
  });
}


renderizarResumoPagamento();


// ==========================================
// INICIALIZAÇÃO GERAL
// ==========================================

atualizarContadorCarrinho();

renderizarCarrinho();

// Atualiza também carrinhos salvos antes da correção dos preços promocionais.
// No pagamento, o servidor já valida o carrinho; a consulta só ocorre em caso de conflito.
if (!paymentItems) prepararResumoCompra();


// Navegadores móveis podem restaurar o botão desativado ao voltar do Mercado Pago.
window.addEventListener('pageshow', function(event) {
  if (event.persisted && payButton) {
    definirPagamentoEmAndamento(false);
    atualizarResumosCompra();
    mostrarStatusCompra('Confira o status no Mercado Pago antes de iniciar outro pagamento.');
  }
});
