// ==========================================
// NAVORYX - SISTEMA DE CARRINHO
// ==========================================

let cart = JSON.parse(localStorage.getItem('navoryxCart')) || [];

cart = cart.filter(produto => {
  return (
    produto &&
    produto.name &&
    produto.image &&
    Number(produto.price) > 0 &&
    Number(produto.quantity) > 0
  );
});

localStorage.setItem('navoryxCart', JSON.stringify(cart));

function atualizarContador() {
  const countEl = document.getElementById('cartCount');

  const totalItens = cart.reduce(
    (total, produto) => total + Number(produto.quantity),
    0
  );

  if (countEl) {
    countEl.textContent = totalItens;
  }
}


// ==========================================
// SALVAR CARRINHO
// ==========================================

function salvarCarrinho() {
  localStorage.setItem(
    'navoryxCart',
    JSON.stringify(cart)
  );

  atualizarContador();
}

atualizarContador();


// ==========================================
// FORMATAR PREÇO
// ==========================================

function formatarPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}


// ==========================================
// ADICIONAR PRODUTO
// ==========================================

function adicionarProduto(
  name,
  price,
  image,
  quantity = 1
) {

  const produtoExistente = cart.find(
    produto => produto.name === name
  );

  if (produtoExistente) {
    produtoExistente.quantity += quantity;
  } else {
    cart.push({
      name: name,
      price: Number(price),
      image: image,
      quantity: quantity
    });
  }

  salvarCarrinho();
}


// ==========================================
// BOTÕES ADICIONAR
// ==========================================

document.addEventListener('click', event => {

  const btn = event.target.closest('.add-cart');

  if (!btn) {
    return;
  }

  const name = btn.dataset.name;
  const price = Number(btn.dataset.price);
  const image = btn.dataset.image;

  if (!name || !price || !image) {
    console.error('Dados do produto incompletos.');
    return;
  }

  adicionarProduto(
    name,
    price,
    image,
    1
  );

  const textoOriginal = btn.textContent;

  btn.textContent = 'Adicionado ✓';
  btn.disabled = true;

  setTimeout(() => {
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }, 1200);

});


// ==========================================
// PÁGINA INDIVIDUAL
// ==========================================

const quantityEl =
  document.getElementById('quantity');

const increaseBtn =
  document.getElementById('increase');

const decreaseBtn =
  document.getElementById('decrease');

const buyButton =
  document.getElementById('buyButton');

let quantity = 1;


if (increaseBtn && quantityEl) {

  increaseBtn.addEventListener('click', () => {

    quantity++;

    quantityEl.textContent = quantity;

  });

}


if (decreaseBtn && quantityEl) {

  decreaseBtn.addEventListener('click', () => {

    if (quantity > 1) {

      quantity--;

      quantityEl.textContent = quantity;

    }

  });

}


if (buyButton) {

  buyButton.addEventListener('click', () => {

    const name = buyButton.dataset.name;
    const price = Number(buyButton.dataset.price);
    const image = buyButton.dataset.image;

    adicionarProduto(
      name,
      price,
      image,
      quantity
    );

    const textoOriginal =
      buyButton.textContent;

    buyButton.textContent =
      '✓ Adicionado ao carrinho';

    setTimeout(() => {

      buyButton.textContent =
        textoOriginal;

    }, 1500);

  });

}


// ==========================================
// PÁGINA DO CARRINHO
// ==========================================

const cartItems =
  document.getElementById('cartItems');

const summaryProducts =
  document.getElementById('summaryProducts');

const cartTotal =
  document.getElementById('cartTotal');

const checkoutButton =
  document.getElementById('checkoutButton');


// ==========================================
// RENDERIZAR CARRINHO
// ==========================================

function renderizarCarrinho() {

  if (!cartItems) {
    return;
  }

  cartItems.innerHTML = '';

  if (cart.length === 0) {

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
          class="hero-btn">
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
      checkoutButton.disabled = true;
    }

    return;
  }

  if (checkoutButton) {
    checkoutButton.disabled = false;
  }

  cart.forEach((produto, index) => {

    const subtotalProduto =
      produto.price * produto.quantity;

    const item =
      document.createElement('div');

    item.className = 'cart-item';

    item.innerHTML = `

      <div class="cart-item-image">

        <img
          src="${produto.image}"
          alt="${produto.name}">

      </div>

      <div class="cart-item-info">

        <h2>
          ${produto.name}
        </h2>

        <p>
          ${formatarPreco(produto.price)} cada
        </p>

        <div class="cart-quantity">

          <button
            type="button"
            class="cart-decrease"
            data-index="${index}">
            −
          </button>

          <span>
            ${produto.quantity}
          </span>

          <button
            type="button"
            class="cart-increase"
            data-index="${index}">
            +
          </button>

        </div>

        <button
          type="button"
          class="remove-product"
          data-index="${index}">
          Remover produto
        </button>

      </div>

      <div class="cart-item-price">

        <span>
          Subtotal
        </span>

        <strong>
          ${formatarPreco(subtotalProduto)}
        </strong>

      </div>

    `;

    cartItems.appendChild(item);

  });

  atualizarTotalCarrinho();

}


// ==========================================
// TOTAL DO CARRINHO
// ==========================================

function atualizarTotalCarrinho() {

  const total = cart.reduce(
    (soma, produto) => {

      return soma +
        produto.price *
        produto.quantity;

    },
    0
  );

  if (summaryProducts) {
    summaryProducts.textContent =
      formatarPreco(total);
  }

  if (cartTotal) {
    cartTotal.textContent =
      formatarPreco(total);
  }

}


// ==========================================
// BOTÕES DO CARRINHO
// ==========================================

if (cartItems) {

  cartItems.addEventListener(
    'click',
    event => {

      const botao =
        event.target.closest('button');

      if (!botao) {
        return;
      }

      const index =
        Number(botao.dataset.index);

      if (
        Number.isNaN(index) ||
        !cart[index]
      ) {
        return;
      }

      if (
        botao.classList.contains(
          'cart-increase'
        )
      ) {

        cart[index].quantity++;

        salvarCarrinho();
        renderizarCarrinho();

      }

      if (
        botao.classList.contains(
          'cart-decrease'
        )
      ) {

        if (cart[index].quantity > 1) {

          cart[index].quantity--;

        } else {

          cart.splice(index, 1);

        }

        salvarCarrinho();
        renderizarCarrinho();

      }

      if (
        botao.classList.contains(
          'remove-product'
        )
      ) {

        cart.splice(index, 1);

        salvarCarrinho();
        renderizarCarrinho();

      }

    }
  );

}


// ==========================================
// IR PARA CHECKOUT
// ==========================================

if (checkoutButton) {

  checkoutButton.addEventListener(
    'click',
    () => {

      if (cart.length === 0) {

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


renderizarCarrinho(); // ==========================================
// CHECKOUT
// ==========================================

const checkoutItems =
  document.getElementById('checkoutItems');

const checkoutProductsTotal =
  document.getElementById(
    'checkoutProductsTotal'
  );

const checkoutTotal =
  document.getElementById('checkoutTotal');

const checkoutForm =
  document.getElementById('checkoutForm');


// ==========================================
// MOSTRAR PRODUTOS NO CHECKOUT
// ==========================================

function renderizarCheckout() {

  if (!checkoutItems) {
    return;
  }

  checkoutItems.innerHTML = '';

  if (cart.length === 0) {

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

    return;
  }

  cart.forEach(produto => {

    const subtotal =
      produto.price *
      produto.quantity;

    const item =
      document.createElement('div');

    item.className =
      'checkout-item';

    item.innerHTML = `

      <div class="checkout-item-image">

        <img
          src="${produto.image}"
          alt="${produto.name}">

      </div>

      <div class="checkout-item-info">

        <strong>
          ${produto.name}
        </strong>

        <span>
          Quantidade:
          ${produto.quantity}
        </span>

      </div>

      <div class="checkout-item-price">

        ${formatarPreco(subtotal)}

      </div>

    `;

    checkoutItems.appendChild(item);

  });

  const totalProdutos =
    cart.reduce(
      (total, produto) => {

        return total +
          produto.price *
          produto.quantity;

      },
      0
    );

  if (checkoutProductsTotal) {

    checkoutProductsTotal.textContent =
      formatarPreco(totalProdutos);

  }

  if (checkoutTotal) {

    checkoutTotal.textContent =
      formatarPreco(totalProdutos);

  }

}


renderizarCheckout();


// ==========================================
// BUSCA
// ==========================================

const searchForm =
  document.querySelector('.search');

const searchInput =
  searchForm
    ? searchForm.querySelector(
        'input[name="busca"]'
      )
    : null;


function executarBuscaProdutos() {

  if (!searchInput) {
    return;
  }

  const termo =
    searchInput.value
      .toLowerCase()
      .trim();

  const produtos =
    document.querySelectorAll(
      '.product-card'
    );

  if (termo === '') {

    produtos.forEach(produto => {

      produto.style.display = '';

    });

    return;
  }

  let encontrados = 0;

  produtos.forEach(produto => {

    const palavras =
      produto.dataset.search
        ? produto.dataset.search
            .toLowerCase()
        : produto.textContent
            .toLowerCase();

    if (palavras.includes(termo)) {

      produto.style.display = '';
      encontrados++;

    } else {

      produto.style.display = 'none';

    }

  });

  const destaques =
    document.getElementById(
      'destaques'
    );

  if (destaques) {

    destaques.scrollIntoView({
      behavior: 'smooth'
    });

  }

  if (
    produtos.length > 0 &&
    encontrados === 0
  ) {

    alert(
      'Nenhum produto encontrado para "' +
      searchInput.value +
      '".'
    );

    produtos.forEach(produto => {

      produto.style.display = '';

    });

  }

}


if (searchForm && searchInput) {

  searchForm.addEventListener(
    'submit',
    event => {

      event.preventDefault();

      executarBuscaProdutos();

    }
  );

}


// ==========================================
// BUSCA RECEBIDA DE OUTRAS PÁGINAS
// ==========================================

const parametrosBusca =
  new URLSearchParams(
    window.location.search
  );

const buscaRecebida =
  parametrosBusca.get('busca');

if (
  buscaRecebida &&
  searchInput
) {

  searchInput.value =
    buscaRecebida;

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


if (cepInput) {

  cepInput.addEventListener(
    'blur',
    async () => {

      let cep =
        cepInput.value.replace(
          /\D/g,
          ''
        );

      if (cep.length !== 8) {
        return;
      }

      try {

        const resposta =
          await fetch(
            `https://viacep.com.br/ws/${cep}/json/`
          );

        const dados =
          await resposta.json();

        if (dados.erro) {

          alert(
            'CEP não encontrado.'
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

      } catch (erro) {

        console.error(
          'Erro ao buscar CEP:',
          erro
        );

        alert(
          'Não foi possível consultar o CEP. Verifique sua conexão.'
        );

      }

    }
  );

}


// ==========================================
// CONTINUAR PARA PAGAMENTO
// ==========================================

if (checkoutForm) {

  checkoutForm.addEventListener(
    'submit',
    event => {

      event.preventDefault();

      if (cart.length === 0) {

        alert(
          'Seu carrinho está vazio.'
        );

        return;
      }

      if (!checkoutForm.checkValidity()) {

        checkoutForm.reportValidity();

        return;
      }

      const numero =
        document.getElementById(
          'numero'
        );

      if (
        !numero ||
        !numero.value.trim()
      ) {

        alert(
          'Digite o número da casa.'
        );

        if (numero) {
          numero.focus();
        }

        return;
      }

      const dadosCliente = {

        nome:
          document
            .getElementById('nome')
            ?.value.trim() || '',

        email:
          document
            .getElementById('email')
            ?.value.trim() || '',

        telefone:
          document
            .getElementById('telefone')
            ?.value.trim() || '',

        cep:
          document
            .getElementById('cep')
            ?.value.trim() || '',

        numero:
          numero.value.trim(),

        endereco:
          document
            .getElementById('endereco')
            ?.value.trim() || '',

        complemento:
          document
            .getElementById('complemento')
            ?.value.trim() || '',

        bairro:
          document
            .getElementById('bairro')
            ?.value.trim() || '',

        cidade:
          document
            .getElementById('cidade')
            ?.value.trim() || '',

        estado:
          (
            document
              .getElementById('estado')
              ?.value.trim() || ''
          ).toUpperCase()

      };

      localStorage.setItem(
        'navoryxCheckout',
        JSON.stringify(
          dadosCliente
        )
      );

      window.location.href =
        'pagamento.html';

    }
  );

} // ==========================================
// PAGAMENTO
// ==========================================

const paymentItems =
  document.getElementById(
    'paymentItems'
  );

const paymentProductsTotal =
  document.getElementById(
    'paymentProductsTotal'
  );

const paymentTotal =
  document.getElementById(
    'paymentTotal'
  );

const payButton =
  document.getElementById(
    'payButton'
  );


// ==========================================
// MOSTRAR PRODUTOS NO PAGAMENTO
// ==========================================

function renderizarPagamento() {

  if (!paymentItems) {
    return;
  }

  paymentItems.innerHTML = '';

  if (cart.length === 0) {

    paymentItems.innerHTML = `
      <p style="color:#aebccc;">
        Seu carrinho está vazio.
      </p>
    `;

    if (paymentProductsTotal) {

      paymentProductsTotal.textContent =
        formatarPreco(0);

    }

    if (paymentTotal) {

      paymentTotal.textContent =
        formatarPreco(0);

    }

    return;
  }

  cart.forEach(produto => {

    const subtotal =
      produto.price *
      produto.quantity;

    const item =
      document.createElement('div');

    item.className =
      'checkout-item';

    item.innerHTML = `

      <div class="checkout-item-image">

        <img
          src="${produto.image}"
          alt="${produto.name}">

      </div>

      <div class="checkout-item-info">

        <strong>
          ${produto.name}
        </strong>

        <span>
          Quantidade:
          ${produto.quantity}
        </span>

      </div>

      <div class="checkout-item-price">

        ${formatarPreco(subtotal)}

      </div>

    `;

    paymentItems.appendChild(
      item
    );

  });

  const totalProdutos =
    cart.reduce(
      (total, produto) => {

        return total +
          produto.price *
          produto.quantity;

      },
      0
    );

  if (paymentProductsTotal) {

    paymentProductsTotal.textContent =
      formatarPreco(
        totalProdutos
      );

  }

  if (paymentTotal) {

    paymentTotal.textContent =
      formatarPreco(
        totalProdutos
      );

  }

}


// ==========================================
// IR PARA MERCADO PAGO
// ==========================================

if (payButton) {

  payButton.addEventListener(
    'click',
    async () => {

      if (cart.length === 0) {

        alert(
          'Seu carrinho está vazio.'
        );

        return;
      }

      try {

        payButton.disabled = true;

        payButton.textContent =
          'Abrindo pagamento...';

        const resposta =
          await fetch(
            'https://navoryx-backend-2.onrender.com/criar-preferencia',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body: JSON.stringify({
                items: cart
              })
            }
          );

        const dados =
          await resposta.json();

        if (!resposta.ok) {

          console.error(dados);

          alert(
            dados.erro ||
            'Não foi possível iniciar o pagamento.'
          );

          return;
        }

        // PAGAMENTO REAL
        if (dados.init_point) {

          window.location.href =
            dados.init_point;

          return;
        }

        alert(
          'O Mercado Pago não retornou o link de pagamento.'
        );

      } catch (erro) {

        console.error(
          'Erro ao conectar com o servidor:',
          erro
        );

        alert(
          'Não foi possível conectar ao servidor de pagamento.'
        );

      } finally {

        payButton.disabled =
          false;

        payButton.textContent =
          'Ir para pagamento seguro';

      }

    }
  );

}


renderizarPagamento();


// ==========================================
// PRODUTOS DINÂMICOS NA HOME
// ==========================================

const storeProducts =
  document.getElementById(
    'storeProducts'
  );

const STORE_API_URL =
  'https://navoryx-backend-2.onrender.com/produtos';


if (storeProducts) {

  let produtosLoja = [];


  function formatarPrecoLoja(
    valor
  ) {

    return Number(
      valor
    ).toLocaleString(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL'
      }
    );

  }


  function renderizarProdutosLoja() {

    storeProducts.innerHTML = '';

    const produtosVisiveis =
      produtosLoja.filter(
        produto =>
          produto.active !== false
      );

    if (
      produtosVisiveis.length === 0
    ) {

      storeProducts.innerHTML = `
        <p>
          Nenhum produto disponível no momento.
        </p>
      `;

      return;
    }

    produtosVisiveis.forEach(
      produto => {

        const article =
          document.createElement(
            'article'
          );

        article.className =
          'product-card';

        article.dataset.search = `
          ${produto.name || ''}
          ${produto.description || ''}
          ${produto.category || ''}
        `.toLowerCase();

        const linkProduto =
          produto.page
            ? produto.page
            : `produto.html?id=${produto.id}`;

        article.innerHTML = `

          <a
            href="${linkProduto}"
            class="product-link">

            <div class="product-image">

              <img
                src="${produto.image}"
                alt="${produto.name}">

            </div>

            <span class="tag">
              Destaque
            </span>

            <h3>
              ${produto.name}
            </h3>

            <p>
              ${produto.description}
            </p>

            <strong>
              ${formatarPrecoLoja(
                produto.price
              )}
            </strong>

          </a>

          <button
            class="add-cart"
            data-name="${produto.name}"
            data-price="${produto.price}"
            data-image="${produto.image}">

            Adicionar

          </button>

        `;

        storeProducts.appendChild(
          article
        );

      }
    );

    if (
      buscaRecebida &&
      searchInput
    ) {

      executarBuscaProdutos();

    }

  }


  async function carregarProdutosLoja() {

    try {

      const resposta =
        await fetch(
          STORE_API_URL
        );

      if (!resposta.ok) {

        throw new Error(
          'Erro ao carregar produtos.'
        );

      }

      produtosLoja =
        await resposta.json();

      renderizarProdutosLoja();

    } catch (erro) {

      console.error(
        'Erro ao carregar a loja:',
        erro
      );

      storeProducts.innerHTML = `
        <p>
          Não foi possível carregar os produtos.
        </p>
      `;

    }

  }

  carregarProdutosLoja();

}


// ==========================================
// PÁGINA DINÂMICA DO PRODUTO
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


if (
  dynamicProductName &&
  dynamicProductDescription &&
  dynamicProductPrice &&
  dynamicProductImage
) {

  function mostrarProdutoNaoEncontrado() {

    dynamicProductName.textContent =
      'Produto não encontrado';

    dynamicProductDescription.textContent =
      'Este produto não está disponível.';

    dynamicProductPrice.textContent =
      '';

    dynamicProductImage.style.display =
      'none';

    if (
      dynamicProductFullDescription
    ) {

      dynamicProductFullDescription.textContent =
        '';

    }

    if (dynamicProductContent) {

      dynamicProductContent.textContent =
        '';

    }

    if (buyButton) {

      buyButton.style.display =
        'none';

    }

  }


  async function carregarProdutoDinamico() {

    const parametrosProduto =
      new URLSearchParams(
        window.location.search
      );

    const produtoId =
      Number(
        parametrosProduto.get('id')
      );

    if (!produtoId) {

      mostrarProdutoNaoEncontrado();

      return;
    }

    try {

      const resposta =
        await fetch(
          STORE_API_URL
        );

      if (!resposta.ok) {

        throw new Error(
          'Erro ao carregar produto.'
        );

      }

      const produtos =
        await resposta.json();

      const produto =
        produtos.find(
          item =>
            Number(item.id) ===
            produtoId
        );

      if (
        !produto ||
        produto.active === false
      ) {

        mostrarProdutoNaoEncontrado();

        return;
      }

      document.title =
        `${produto.name} | Navoryx`;

      dynamicProductName.textContent =
        produto.name;

      dynamicProductDescription.textContent =
        produto.description || '';

      dynamicProductPrice.textContent =
        formatarPreco(
          produto.price
        );

      dynamicProductImage.src =
        produto.image;

      dynamicProductImage.alt =
        produto.name;

      dynamicProductImage.style.display =
        '';

      if (
        dynamicProductFullDescription
      ) {

        dynamicProductFullDescription.textContent =
          produto.description || '';

      }

      if (dynamicProductContent) {

        dynamicProductContent.textContent =
          produto.description || '';

      }

      if (buyButton) {

        buyButton.style.display =
          '';

        buyButton.dataset.name =
          produto.name;

        buyButton.dataset.price =
          produto.price;

        buyButton.dataset.image =
          produto.image;

      }

    } catch (erro) {

      console.error(
        'Erro ao carregar produto:',
        erro
      );

      mostrarProdutoNaoEncontrado();

    }

  }

  carregarProdutoDinamico();

}
