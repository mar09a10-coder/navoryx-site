const API_BASE = 'https://navoryx-backend-2.onrender.com';
const TOKEN_KEY = 'navoryxAdminToken';

const loginView = document.getElementById('loginView');
const adminApp = document.getElementById('adminApp');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const form = document.getElementById('adminProductForm');
const formMessage = document.getElementById('formMessage');
const productsContainer = document.getElementById('adminProducts');
const productCount = document.getElementById('adminProductCount');
const cancelEdit = document.getElementById('cancelEdit');
const saveButton = document.getElementById('saveButton');
const formTitle = document.getElementById('formTitle');

const fields = {
  name: document.getElementById('adminName'),
  sku: document.getElementById('adminSku'),
  price: document.getElementById('adminPrice'),
  salePrice: document.getElementById('adminSalePrice'),
  stock: document.getElementById('adminStock'),
  image: document.getElementById('adminImage'),
  category: document.getElementById('adminCategory'),
  description: document.getElementById('adminDescription'),
  active: document.getElementById('adminActive')
};

let produtos = [];
let produtoEditando = null;

function token() { return sessionStorage.getItem(TOKEN_KEY); }
function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() };
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function formatarPreco(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function mostrarApp() {
  loginView.hidden = true;
  adminApp.hidden = false;
  carregarProdutos();
  carregarConfiguracoesSite();
  carregarPedidos();
}
function mostrarLogin() { adminApp.hidden = true; loginView.hidden = false; }
function logout() { sessionStorage.removeItem(TOKEN_KEY); produtoEditando = null; mostrarLogin(); }

async function api(path, options = {}) {
  const resposta = await fetch(API_BASE + path, options);
  const dados = await resposta.json().catch(() => ({}));
  if (resposta.status === 401) { logout(); throw new Error('Sessão expirada. Entre novamente.'); }
  if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir a operação.');
  return dados;
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginMessage.textContent = 'Entrando...';
  loginMessage.className = 'admin-message';
  try {
    const dados = await api('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('adminPassword').value })
    });
    sessionStorage.setItem(TOKEN_KEY, dados.token);
    loginForm.reset();
    mostrarApp();
  } catch (erro) {
    loginMessage.textContent = erro.message;
    loginMessage.className = 'admin-message error';
  }
});

async function verificarSessao() {
  if (!token()) return mostrarLogin();
  try {
    await api('/admin/me', { headers: authHeaders() });
    mostrarApp();
  } catch (_) { mostrarLogin(); }
}

async function carregarProdutos() {
  productsContainer.innerHTML = '<p>Carregando...</p>';
  try {
    produtos = await api('/produtos');
    renderizarProdutos();
  } catch (erro) {
    productsContainer.innerHTML = '<p>' + escapeHtml(erro.message) + '</p>';
  }
}

function renderizarProdutos() {
  productCount.textContent = produtos.length;
  if (!produtos.length) return productsContainer.innerHTML = '<p>Nenhum produto cadastrado.</p>';
  productsContainer.innerHTML = produtos.map(produto => `
    <div class="admin-product-item">
      <div class="admin-product-image"><img src="${escapeHtml(produto.image)}" alt="${escapeHtml(produto.name)}"></div>
      <div class="admin-product-info">
        <strong>${escapeHtml(produto.name)}</strong>
        <span>${formatarPreco(produto.salePrice || produto.price)}</span>
        <small>SKU: ${escapeHtml(produto.sku || '—')} • Estoque: ${Number(produto.stock || 0)}</small>
        <small>${produto.active !== false ? '🟢 Visível na loja' : '🔴 Oculto'}</small>
      </div>
      <div class="admin-product-actions">
        <button type="button" data-action="edit" data-id="${produto.id}">Editar</button>
        <button type="button" data-action="visibility" data-id="${produto.id}">${produto.active !== false ? 'Ocultar' : 'Mostrar'}</button>
        <button type="button" data-action="delete" data-id="${produto.id}">Excluir</button>
      </div>
    </div>`).join('');
}

function resetarFormulario() {
  form.reset();
  fields.stock.value = 0;
  fields.active.checked = true;
  produtoEditando = null;
  formTitle.textContent = 'Cadastrar produto';
  saveButton.textContent = '+ Cadastrar produto';
  cancelEdit.hidden = true;
  formMessage.textContent = '';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const dados = {
    name: fields.name.value.trim(), sku: fields.sku.value.trim(),
    price: Number(fields.price.value), salePrice: fields.salePrice.value ? Number(fields.salePrice.value) : null,
    stock: Number(fields.stock.value || 0), image: fields.image.value.trim(),
    category: fields.category.value, description: fields.description.value.trim(),
    active: fields.active.checked
  };
  saveButton.disabled = true;
  formMessage.textContent = 'Salvando...';
  try {
    const path = produtoEditando ? '/produtos/' + produtoEditando : '/produtos';
    await api(path, { method: produtoEditando ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(dados) });
    resetarFormulario();
    await carregarProdutos();
    formMessage.textContent = 'Produto salvo com sucesso.';
  } catch (erro) {
    formMessage.textContent = erro.message;
    formMessage.className = 'admin-message error';
  } finally { saveButton.disabled = false; }
});

productsContainer.addEventListener('click', async event => {
  const botao = event.target.closest('button');
  if (!botao) return;
  const produto = produtos.find(item => String(item.id) === String(botao.dataset.id));
  if (!produto) return;

  if (botao.dataset.action === 'edit') {
    produtoEditando = produto.id;
    Object.entries(fields).forEach(([key, input]) => {
      if (key === 'active') input.checked = produto.active !== false;
      else input.value = produto[key] ?? '';
    });
    formTitle.textContent = 'Editar produto';
    saveButton.textContent = 'Salvar alterações';
    cancelEdit.hidden = false;
    form.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (botao.dataset.action === 'delete' && !confirm('Excluir "' + produto.name + '"?')) return;
  try {
    if (botao.dataset.action === 'visibility') {
      await api('/produtos/' + produto.id, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ active: produto.active === false }) });
    }
    if (botao.dataset.action === 'delete') {
      await api('/produtos/' + produto.id, { method: 'DELETE', headers: authHeaders() });
    }
    await carregarProdutos();
  } catch (erro) { alert(erro.message); }
});

cancelEdit.addEventListener('click', resetarFormulario);
document.getElementById('logoutButton').addEventListener('click', logout);


// ==========================================
// PEDIDOS
// ==========================================

const ordersContainer = document.getElementById('adminOrders');
const refreshOrdersButton = document.getElementById('refreshOrdersButton');

function nomeStatusPedido(status) {
  return ({
    creating: 'Criando pagamento',
    pending: 'Aguardando pagamento',
    in_process: 'Em análise',
    approved: 'Pagamento aprovado',
    approved_stock_review: 'Aprovado — conferir estoque',
    rejected: 'Pagamento recusado',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
    charged_back: 'Contestação/chargeback',
    payment_amount_mismatch: 'Valor divergente',
    error: 'Erro ao criar pagamento'
  })[status] || status || 'Desconhecido';
}

async function carregarPedidos() {
  if (!ordersContainer) return;
  ordersContainer.innerHTML = '<p>Carregando pedidos...</p>';

  try {
    const pedidos = await api('/admin/pedidos', { headers: authHeaders() });

    if (!pedidos.length) {
      ordersContainer.innerHTML = '<p>Nenhum pedido registrado até o momento.</p>';
      return;
    }

    ordersContainer.innerHTML = pedidos.map(pedido => {
      const cliente = pedido.cliente || {};
      const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
      const resumo = itens.map(item =>
        Number(item.quantity || 0) + '× ' + escapeHtml(item.name || 'Produto')
      ).join('<br>');

      return `
        <div class="admin-product-item">
          <div class="admin-product-info">
            <strong>Pedido ${escapeHtml(String(pedido.id).slice(0, 8))}</strong>
            <span>${formatarPreco(pedido.total)}</span>
            <small>${escapeHtml(nomeStatusPedido(pedido.status))}</small>
            <small>${escapeHtml(cliente.nome || 'Cliente não informado')} • ${escapeHtml(cliente.email || 'sem e-mail')}</small>
            <small>${resumo}</small>
            <small>${new Date(pedido.criado_em).toLocaleString('pt-BR')}</small>
          </div>
        </div>
      `;
    }).join('');
  } catch (erro) {
    ordersContainer.innerHTML = '<p>' + escapeHtml(erro.message) + '</p>';
  }
}

if (refreshOrdersButton) {
  refreshOrdersButton.addEventListener('click', carregarPedidos);
}

// ==========================================
// CONFIGURAÇÕES DO SITE
// ==========================================

const siteConfigForm = document.getElementById('siteConfigForm');
const siteConfigMessage = document.getElementById('siteConfigMessage');
const saveSiteConfigButton = document.getElementById('saveSiteConfigButton');

const siteConfigFields = {
  nome_loja: document.getElementById('siteName'),
  logo_url: document.getElementById('siteLogo'),
  texto_topo: document.getElementById('siteTopText'),
  titulo_banner: document.getElementById('siteBannerTitle'),
  subtitulo_banner: document.getElementById('siteBannerSubtitle'),
  banner_url: document.getElementById('siteBannerUrl'),
  cor_principal: document.getElementById('sitePrimaryColor'),
  cor_secundaria: document.getElementById('siteSecondaryColor'),
  whatsapp: document.getElementById('siteWhatsapp'),
  email: document.getElementById('siteEmail'),
  texto_rodape: document.getElementById('siteFooterText')
};

async function carregarConfiguracoesSite() {
  if (!siteConfigForm) return;
  siteConfigMessage.textContent = 'Carregando configurações...';
  siteConfigMessage.className = 'admin-message';

  try {
    const config = await api('/site-config');
    Object.entries(siteConfigFields).forEach(([campo, input]) => {
      if (input && config[campo] !== undefined && config[campo] !== null) {
        input.value = config[campo];
      }
    });
    siteConfigMessage.textContent = '';
  } catch (erro) {
    siteConfigMessage.textContent = erro.message;
    siteConfigMessage.className = 'admin-message error';
  }
}

if (siteConfigForm) {
  siteConfigForm.addEventListener('submit', async event => {
    event.preventDefault();
    const config = {};

    Object.entries(siteConfigFields).forEach(([campo, input]) => {
      config[campo] = input ? input.value.trim() : '';
    });

    saveSiteConfigButton.disabled = true;
    siteConfigMessage.textContent = 'Salvando configurações...';
    siteConfigMessage.className = 'admin-message';

    try {
      const salvo = await api('/site-config', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(config)
      });

      Object.entries(siteConfigFields).forEach(([campo, input]) => {
        if (input && salvo[campo] !== undefined && salvo[campo] !== null) {
          input.value = salvo[campo];
        }
      });

      siteConfigMessage.textContent = 'Configurações salvas. A loja já foi atualizada.';
    } catch (erro) {
      siteConfigMessage.textContent = erro.message;
      siteConfigMessage.className = 'admin-message error';
    } finally {
      saveSiteConfigButton.disabled = false;
    }
  });
}

verificarSessao();