// ==========================================
// NAVORYX - CONFIGURAÇÕES
// ==========================================

const STORE_API_URL = 'https://navoryx-backend.onrender.com/produtos';

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


  // ========================================
  // TENTA BUSCAR NA API
  // ========================================

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


  // ========================================
  // SE FALHAR, BUSCA NO LOCALSTORAGE
  // ========================================

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

carregarProdutoIndividual();



// ==========================================
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


async function buscarCep(cepInformado) {

  const cepLimpo =
    String(cepInformado || '')
      .replace(/\D/g, '');


  if (cepLimpo.length !== 8) {
    return;
  }


  try {

    if (cepInput) {
      cepInput.disabled = true;
    }


    const resposta =
      await fetch(
        `https://viacep.com.br/ws/${cepLimpo}/json/`
      );


    if (!resposta.ok) {
      throw new Error(
        'Não foi possível consultar o CEP.'
      );
    }


    const dados =
      await resposta.json();


    if (dados.erro) {

      alert(
        'CEP não encontrado. Confira o número digitado.'
      );

      return;

    }


    if (enderecoInput) {

      enderecoInput.value =
        dados.logradouro || '';

    }


    if (bairroInput) {

      bairroInput.value =
        dados.bairro || '';

    }


    if (cidadeInput) {

      cidadeInput.value =
        dados.localidade || '';

    }


    if (estadoInput) {

      estadoInput.value =
        dados.uf || '';

    }


    const numeroInput =
      document.getElementById('numero');


    if (numeroInput) {

      numeroInput.focus();

    }


  } catch (erro) {

    console.error(
      'Erro ao buscar CEP:',
      erro
    );

    alert(
      'Não foi possível buscar o CEP agora. Tente novamente.'
    );


  } finally {

    if (cepInput) {

      cepInput.disabled =
        false;

      cepInput.focus();

    }

  }

}


if (cepInput) {

  cepInput.addEventListener(
    'input',
    function() {

      let valor =
        cepInput.value
          .replace(/\D/g, '')
          .slice(0, 8);


      if (valor.length > 5) {

        valor =
          valor.slice(0, 5) +
          '-' +
          valor.slice(5);

      }


      cepInput.value =
        valor;


      const cepNumerico =
        valor.replace(/\D/g, '');


      if (cepNumerico.length === 8) {

        buscarCep(
          cepNumerico
        );

      }

    }
  );


  cepInput.addEventListener(
    'blur',
    function() {

      const cepNumerico =
        cepInput.value
          .replace(/\D/g, '');


      if (cepNumerico.length === 8) {

        buscarCep(
          cepNumerico
        );

      }

    }
  );

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


renderizarResumoCheckout();



// ==========================================
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
// ABRIR CHECKOUT PRO DE TESTE
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
            name:
              String(item.name || 'Produto'),

            quantity:
              Number(item.quantity) || 1,

            price:
              Number(item.price) || 0
          }));

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
                  items
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
          dados.sandbox_init_point ||
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
          'Não foi possível abrir o pagamento. Verifique se o servidor está ligado e se o Access Token de teste está correto.'
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
