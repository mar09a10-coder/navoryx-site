const API_URL = 'http://localhost:3000/produtos';
// ==========================================
// NAVORYX - PAINEL ADMINISTRATIVO
// ==========================================

const form = document.getElementById('adminProductForm');
const productsContainer = document.getElementById('adminProducts');
const productCount = document.getElementById('adminProductCount');

const nameInput = document.getElementById('adminName');
const priceInput = document.getElementById('adminPrice');
const imageInput = document.getElementById('adminImage');
const categoryInput = document.getElementById('adminCategory');
const descriptionInput = document.getElementById('adminDescription');

let produtoEditando = null;


// ==========================================
// PRODUTOS INICIAIS
// ==========================================

const produtosIniciais = [

  {
    id: 1,
    name: 'Headset Bluetooth',
    price: 99.90,
    image: 'img/produto-headset.jpg',
    category: 'audio',
    description: 'Conforto para música e chamadas.',
    page: 'produto-headset.html',
    active: true
  },

  {
    id: 2,
    name: 'Smartwatch',
    price: 129.90,
    image: 'img/produto-smartwatch.jpg',
    category: 'smartwatch',
    description: 'Visual moderno para o dia a dia.',
    page: 'produto-smartwatch.html',
    active: true
  },

  {
    id: 3,
    name: 'Carregador Rápido',
    price: 49.90,
    image: 'img/produto-carregador.jpg',
    category: 'cabos',
    description: 'Compacto e prático.',
    page: 'produto-carregador.html',
    active: true
  },

  {
    id: 4,
    name: 'Fone de Ouvido LEHMOX LEF-1216',
    price: 39.90,
    image: 'img/produto-fone-lehmox.png',
    category: 'audio',
    description: 'Fone com fio, microfone e controle integrado.',
    page: 'produto-lehmox.html',
    active: true
  }

];


// ==========================================
// CARREGAR PRODUTOS
// ==========================================

let produtos = [];

async function carregarProdutos() {

  try {

    const resposta = await fetch(API_URL);

    produtos = await resposta.json();

    renderizarProdutos();

  } catch (erro) {

    console.error(
      'Erro ao carregar produtos:',
      erro
    );

    alert(
      'Não foi possível carregar os produtos do servidor.'
    );

  }

}

// ==========================================
// SALVAR
// ==========================================

function salvarProdutos() {

  localStorage.setItem(
    'navoryxProducts',
    JSON.stringify(produtos)
  );

  renderizarProdutos();

}


// ==========================================
// FORMATAR PREÇO
// ==========================================

function formatarPreco(valor) {

  return Number(valor).toLocaleString(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL'
    }
  );

}


// ==========================================
// MOSTRAR PRODUTOS
// ==========================================

function renderizarProdutos() {

  productsContainer.innerHTML = '';

  productCount.textContent = produtos.length;


  if (produtos.length === 0) {

    productsContainer.innerHTML = `
      <p>
        Nenhum produto cadastrado.
      </p>
    `;

    return;

  }


  produtos.forEach(produto => {

    const item = document.createElement('div');

    item.className = 'admin-product-item';


    item.innerHTML = `

      <div class="admin-product-image">

        <img
          src="${produto.image}"
          alt="${produto.name}">

      </div>


      <div class="admin-product-info">

        <strong>
          ${produto.name}
        </strong>

        <span>
          ${formatarPreco(produto.price)}
        </span>

        <small>
          ${produto.active ? '🟢 Visível na loja' : '🔴 Oculto'}
        </small>

      </div>


      <div class="admin-product-actions">

        <button
          type="button"
          data-action="edit"
          data-id="${produto.id}">
          Editar
        </button>

        <button
          type="button"
          data-action="visibility"
          data-id="${produto.id}">
          ${produto.active ? 'Ocultar' : 'Mostrar'}
        </button>

        <button
          type="button"
          data-action="delete"
          data-id="${produto.id}">
          Excluir
        </button>

      </div>

    `;


    productsContainer.appendChild(item);

  });

}


// ==========================================
// CADASTRAR / SALVAR ALTERAÇÃO
// ==========================================

form.addEventListener('submit', async event => {

  event.preventDefault();

  const nome = nameInput.value.trim();
  const preco = Number(priceInput.value);
  const imagem = imageInput.value.trim();
  const categoria = categoryInput.value;
  const descricao = descriptionInput.value.trim();

  if (
    !nome ||
    preco <= 0 ||
    !imagem ||
    !categoria ||
    !descricao
  ) {

    alert(
      'Preencha todos os campos corretamente.'
    );

    return;
  }


  const dadosProduto = {

    name: nome,
    price: preco,
    image: imagem,
    category: categoria,
    description: descricao

  };


  try {

    // EDITAR PRODUTO
    if (produtoEditando !== null) {

      const resposta = await fetch(
        `${API_URL}/${produtoEditando}`,
        {
          method: 'PUT',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify(dadosProduto)
        }
      );


      if (!resposta.ok) {
        throw new Error(
          'Erro ao editar produto.'
        );
      }


      produtoEditando = null;

      form.querySelector(
        'button[type="submit"]'
      ).textContent =
        '+ Cadastrar produto';


    } else {

      // CADASTRAR NOVO PRODUTO

      const resposta = await fetch(
        API_URL,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify(dadosProduto)
        }
      );


      if (!resposta.ok) {
        throw new Error(
          'Erro ao cadastrar produto.'
        );
      }

    }


    form.reset();

    await carregarProdutos();


  } catch (erro) {

    console.error(erro);

    alert(
      'Não foi possível salvar o produto.'
    );

  }

});


// ==========================================
// BOTÕES DOS PRODUTOS
// ==========================================

productsContainer.addEventListener(
  'click',
  event => {

    const botao =
      event.target.closest('button');

    if (!botao) {
      return;
    }


    const id =
      Number(botao.dataset.id);

    const acao =
      botao.dataset.action;

    const produto =
      produtos.find(
        produto => produto.id === id
      );


    if (!produto) {
      return;
    }


    // EDITAR
    if (acao === 'edit') {

      nameInput.value =
        produto.name;

      priceInput.value =
        produto.price;

      imageInput.value =
        produto.image;

      categoryInput.value =
        produto.category;

      descriptionInput.value =
        produto.description;


      produtoEditando =
        produto.id;


      form.querySelector(
        'button[type="submit"]'
      ).textContent =
        'Salvar alterações';


      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

    }


    // OCULTAR / MOSTRAR
if (acao === 'visibility') {

  const novoStatus = !produto.active;

  fetch(
    `${API_URL}/${produto.id}`,
    {
      method: 'PUT',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        active: novoStatus
      })
    }
  )
    .then(resposta => {

      if (!resposta.ok) {
        throw new Error(
          'Erro ao alterar visibilidade.'
        );
      }

      return resposta.json();

    })
    .then(() => {

      carregarProdutos();

    })
    .catch(erro => {

      console.error(erro);

      alert(
        'Não foi possível alterar a visibilidade.'
      );

    });

}


// EXCLUIR
if (acao === 'delete') {

  const confirmar = confirm(
    `Excluir "${produto.name}"?`
  );

  if (!confirmar) {
    return;
  }

  fetch(
    `${API_URL}/${produto.id}`,
    {
      method: 'DELETE'
    }
  )
    .then(resposta => {

      if (!resposta.ok) {
        throw new Error(
          'Erro ao excluir produto.'
        );
      }

      return resposta.json();

    })
    .then(() => {

      carregarProdutos();

    })
    .catch(erro => {

      console.error(erro);

      alert(
        'Não foi possível excluir o produto.'
      );

    });

}

  }
);


// ==========================================
// INICIAR
// ==========================================

carregarProdutos();