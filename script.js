// ==========================================
// NAVORYX - CONFIGURAÇÕES
// ==========================================

const STORE_API_URL =
  'https://navoryx-backend-2.onrender.com/produtos';

const CART_STORAGE_KEY = 'navoryxCart';
const PRODUCTS_STORAGE_KEY = 'navoryxProducts';


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

    return JSON.parse(
      localStorage.getItem(CART_STORAGE_KEY)
    ) || [];

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

  if (produtoExistente) {

    produtoExistente.quantity =
      Number(produtoExistente.quantity || 1) +
      quantidadeAdicionar;

  } else {

    carrinho.push({
      id: produto.id,
      name: produto.name || 'Produto',
      price: Number(produto.price) || 0,
      image: produto.image || '',
      quantity: quantidadeAdicionar
    });
  }

  salvarCarrinho(carrinho);
}


// ==========================================
// PRODUTOS DINÂMICOS NA HOME
// ==========================================

const storeProducts =
  document.getElementById('storeProducts');

let produtosLoja = [];


// ==========================================
// RENDERIZAR PRODUTOS
// ==========================================

function renderizarProdutosLoja(lista = produtosLoja) {

  if (!storeProducts) {
    return;
  }

  storeProducts.innerHTML = '';

  if (
    !Array.isArray(lista) ||
    lista.length === 0
  ) {

    storeProducts.innerHTML = `
      <p class="no-products">
        Nenhum produto encontrado.
      </p>
    `;

    return;
  }

  lista.forEach(produto => {

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
      Number(produto.price) || 0;

    card.dataset.search = `
      ${nomeProduto}
      ${descricaoProduto}
      ${produto.category || ''}
    `.toLowerCase();

    card.innerHTML = `

      <a
        href="produto.html?id=${encodeURIComponent(produto.id)}"
        class="product-link"
      >

        <img
          src="${imagemProduto}"
          alt="${nomeProduto}"
          class="product-image"
        >

        <h3>
          ${nomeProduto}
        </h3>

      </a>

      <p>
        ${descricaoProduto}
      </p>

      <span class="product-price">
        ${formatarPreco(precoProduto)}
      </span>

      <button
        type="button"
        class="add-cart"
        data-id="${produto.id}"
        data-name="${nomeProduto}"
        data-price="${precoProduto}"
        data-image="${imagemProduto}"
      >
        Adicionar ao Carrinho
      </button>

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

    renderizarProdutosLoja(
      produtosLoja
    );

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

        storeProducts.innerHTML = `
          <p class="no-products">
            Não foi possível carregar os produtos.
          </p>
        `;
      }

    } catch (erroStorage) {

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
        botao.dataset.image
    };

    adicionarAoCarrinho(
      produto,
      1
    );

    const textoOriginal =
      botao.textContent;

    botao.textContent =
      '✓ Adicionado';

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

if (
  searchForm &&
  searchInput
) {

  searchForm.addEventListener(
    'submit',
    function(evento) {

      evento.preventDefault();

      const termo =
        searchInput.value
          .trim()
          .toLowerCase();

      if (!termo) {

        renderizarProdutosLoja(
          produtosLoja
        );

        return;
      }

      const resultado =
        produtosLoja.filter(produto => {

          const texto = `
            ${produto.name || ''}
            ${produto.description || ''}
            ${produto.category || ''}
          `.toLowerCase();

          return texto.includes(
            termo
          );
        });

      renderizarProdutosLoja(
        resultado
      );

      const secaoProdutos =
        document.getElementById(
          'destaques'
        );

      if (secaoProdutos) {

        secaoProdutos.scrollIntoView({
          behavior: 'smooth'
        });
      }
    }
  );

  searchInput.addEventListener(
    'input',
    function() {

      if (
        searchInput.value.trim() === ''
      ) {

        renderizarProdutosLoja(
          produtosLoja
        );
      }
    }
  );
}


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

      quantidadeProduto++;

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

    dynamicProductPrice.textContent =
      '';
  }

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

  if (dynamicProductDescription) {

    dynamicProductDescription.textContent =
      produto.description || '';
  }

  dynamicProductPrice.textContent =
    formatarPreco(
      produto.price
    );

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

    buyButton.style.display =
      '';
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

      adicionarAoCarrinho(
        produtoAtual,
        quantidadeProduto
      );

      const textoOriginal =
        buyButton.textContent;

      buyButton.textContent =
        '✓ Produto adicionado';

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

          alterarQuantidadeCarrinho(
            id,
            Number(item.quantity || 1) + 1
          );
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

const cepInput = document.getElementById('cep');
const enderecoInput = document.getElementById('endereco');
const bairroInput = document.getElementById('bairro');
const cidadeInput = document.getElementById('cidade');
const estadoInput = document.getElementById('estado');

let cepTimer;
let cepRequest;
let cepRevision = 0;
let cepMessage;

function mensagemCep(texto, invalido = false) {
  if (!cepInput) return;
  cepInput.setCustomValidity(invalido ? texto : '');
  cepInput.setAttribute('aria-invalid', String(invalido));
  if (cepMessage) {
    cepMessage.textContent = texto;
    cepMessage.style.color = invalido ? '#fca5a5' : '#aebccc';
  }
}

async function buscarCep(cepLimpo, revision = cepRevision) {
  if (!cepInput || !/^\d{8}$/.test(cepLimpo)) return;
  const controller = new AbortController();
  cepRequest = controller;
  const timeout = setTimeout(() => controller.abort(), 8000);
  const atual = () => revision === cepRevision &&
    cepInput.value.replace(/\D/g, '') === cepLimpo;
  // Preserve edits the customer makes while the lookup is running.
  const inputs = [enderecoInput, bairroInput, cidadeInput, estadoInput];
  const anteriores = inputs.map(input => input ? input.value : '');
  mensagemCep('Consultando CEP...');
  try {
    const resposta = await fetch(
      'https://viacep.com.br/ws/' + cepLimpo + '/json/',
      { signal: controller.signal }
    );
    if (!resposta.ok) throw new Error('Consulta indisponível');
    const dados = await resposta.json();
    if (!atual()) return;
    if (dados.erro) {
      mensagemCep('CEP não encontrado. Confira e corrija o número digitado.', true);
      return;
    }
    const valores = [dados.logradouro, dados.bairro, dados.localidade, dados.uf];
    inputs.forEach((input, index) => {
      if (input && input.value === anteriores[index]) input.value = valores[index] || '';
    });
    mensagemCep('CEP localizado. Confira o endereço e informe o número.');
  } catch (_) {
    if (atual()) {
      mensagemCep('Consulta de CEP indisponível. Preencha o endereço manualmente ou edite o CEP para tentar novamente.');
    }
  } finally {
    clearTimeout(timeout);
    if (cepRequest === controller) cepRequest = null;
  }
}

if (cepInput) {
  cepMessage = document.createElement('p');
  cepMessage.id = 'cepMessage';
  cepMessage.setAttribute('role', 'status');
  cepMessage.setAttribute('aria-live', 'polite');
  cepMessage.style.cssText = 'font-size:13px;line-height:1.5;margin:6px 0 0;color:#aebccc';
  cepInput.insertAdjacentElement('afterend', cepMessage);
  const describedBy = cepInput.getAttribute('aria-describedby') || '';
  cepInput.setAttribute('aria-describedby', (describedBy + ' cepMessage').trim());
  cepInput.maxLength = 9;
  cepInput.pattern = '[0-9]{5}-?[0-9]{3}';
  cepInput.title = 'Informe um CEP com 8 números.';

  cepInput.addEventListener('input', function() {
    clearTimeout(cepTimer);
    cepRevision += 1;
    if (cepRequest) cepRequest.abort();
    const numeros = cepInput.value.replace(/\D/g, '').slice(0, 8);
    cepInput.value = numeros.length > 5
      ? numeros.slice(0, 5) + '-' + numeros.slice(5)
      : numeros;
    mensagemCep('');
    if (numeros.length === 8) {
      const revision = cepRevision;
      cepTimer = setTimeout(() => buscarCep(numeros, revision), 350);
    }
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

      localStorage.setItem(
        'navoryxCheckout',
        JSON.stringify(dadosCliente)
      );

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

if (payButton) {

  payButton.addEventListener(
    'click',
    async function() {

      const carrinho =
        obterCarrinho();

      if (carrinho.length === 0) {

        alert(
          'Seu carrinho está vazio.'
        );

        return;
      }

      const textoOriginal =
        payButton.textContent;

      try {

        payButton.disabled = true;

        payButton.textContent =
          'Abrindo pagamento...';

        const items =
          carrinho.map(item => ({
            id: item.id,
            quantity: Number(item.quantity) || 1
          }));

        let customer = {};
        try {
          customer = JSON.parse(
            localStorage.getItem('navoryxCheckout')
          ) || {};
        } catch (_) {
          customer = {};
        }

        const resposta =
          await fetch(
            'https://navoryx-backend-2.onrender.com/criar-preferencia',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  items,
                  customer
                })
            }
          );

        const dados =
          await resposta.json();

        if (!resposta.ok) {

          throw new Error(
            dados.erro ||
            'Não foi possível iniciar o pagamento.'
          );
        }

        const linkPagamento =
          dados.init_point;

        if (!linkPagamento) {

          throw new Error(
            'O Mercado Pago não retornou o link de pagamento.'
          );
        }

        window.location.href =
          linkPagamento;

      } catch (erro) {

        console.error(
          'Erro ao abrir Mercado Pago:',
          erro
        );

        alert(
          erro.message ||
          'Não foi possível abrir o pagamento. Verifique a conexão com o Mercado Pago.'
        );

        payButton.disabled = false;

        payButton.textContent =
          textoOriginal;
      }
    }
  );
}


renderizarResumoPagamento();


// ==========================================
// INICIALIZAÇÃO GERAL
// ==========================================

atualizarContadorCarrinho();

renderizarCarrinho();


// ==========================================
// CONFIGURAÇÕES VISUAIS DA LOJA
// ==========================================

async function carregarConfiguracoesDaLoja() {
  try {
    const resposta = await fetch(
      'https://navoryx-backend-2.onrender.com/site-config'
    );

    if (!resposta.ok) return;

    const config = await resposta.json();
    const topbar = document.querySelector('.topbar');
    const logo = document.querySelector('.logo-navoryx');
    const hero = document.querySelector('.hero-banner');
    const heroTitle = document.querySelector('.hero-content h1');
    const heroSubtitle = document.querySelector('.hero-content .eyebrow');
    const whatsappLink = document.querySelector('a[href^="https://wa.me/"]');
    const emailLink = document.querySelector('a[href^="mailto:"]');
    const footerLogo = document.querySelector('.footer-logo');
    const footerText = footerLogo && footerLogo.parentElement
      ? footerLogo.parentElement.querySelector('p')
      : null;

    if (config.nome_loja) {
      document.title = config.nome_loja + ' | Tecnologia e Acessórios';
      if (footerLogo) footerLogo.textContent = config.nome_loja.toUpperCase();
    }
    if (topbar && config.texto_topo) topbar.textContent = config.texto_topo;
    if (logo && config.logo_url) {
      logo.src = config.logo_url;
      logo.alt = config.nome_loja || 'Navoryx';
    }
    if (hero && config.banner_url) {
      hero.style.backgroundImage =
        'linear-gradient(90deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.68) 43%, rgba(0,0,0,.25) 100%), url("' +
        String(config.banner_url).replace(/"/g, '%22') + '")';
    }
    if (heroTitle && config.titulo_banner) heroTitle.textContent = config.titulo_banner;
    if (heroSubtitle && config.subtitulo_banner) heroSubtitle.textContent = config.subtitulo_banner;
    if (whatsappLink && config.whatsapp) {
      const numero = String(config.whatsapp).replace(/\D/g, '');
      whatsappLink.href =
        'https://wa.me/' + (numero.startsWith('55') ? numero : '55' + numero) +
        '?text=' + encodeURIComponent('Olá, vim pelo site da ' + (config.nome_loja || 'Navoryx') + ' e gostaria de atendimento.');
    }
    if (emailLink && config.email) emailLink.href = 'mailto:' + config.email;
    if (footerText && config.texto_rodape) footerText.textContent = config.texto_rodape;

    const corPrincipal = /^#[0-9a-f]{6}$/i.test(config.cor_principal || '')
      ? config.cor_principal
      : '#05070b';
    const corSecundaria = /^#[0-9a-f]{6}$/i.test(config.cor_secundaria || '')
      ? config.cor_secundaria
      : '#008cff';

    document.documentElement.style.setProperty('--navoryx-primary', corPrincipal);
    document.documentElement.style.setProperty('--navoryx-secondary', corSecundaria);

    let dynamicStyle = document.getElementById('navoryxDynamicTheme');
    if (!dynamicStyle) {
      dynamicStyle = document.createElement('style');
      dynamicStyle.id = 'navoryxDynamicTheme';
      document.head.appendChild(dynamicStyle);
    }

    dynamicStyle.textContent = `
      body { background-color: ${corPrincipal}; }
      .cart-button, .search button, .hero-btn, .contact-button,
      .product-buy-button, .checkout-confirm-button {
        background: linear-gradient(135deg, ${corSecundaria}, ${corSecundaria}) !important;
      }
      .nav a:hover, .footer-logo, .eyebrow { color: ${corSecundaria} !important; }
      .search input:focus { border-color: ${corSecundaria} !important; }
    `;
  } catch (erro) {
    console.warn('Não foi possível carregar as configurações visuais da loja.', erro);
  }
}

carregarConfiguracoesDaLoja();
