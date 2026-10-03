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
const siteConfigForm = document.getElementById('siteConfigForm');
const siteConfigMessage = document.getElementById('siteConfigMessage');
const siteConfigFields = ['nome_loja','logo_url','texto_topo','titulo_banner','subtitulo_banner','banner_url','cor_principal','cor_secundaria','whatsapp','email','texto_rodape','horario_atendimento'];
let siteConfig = {};
const embalagemFields = {
  pesoGramas: document.getElementById('adminWeight'),
  comprimento: document.getElementById('adminLength'),
  largura: document.getElementById('adminWidth'),
  altura: document.getElementById('adminHeight')
};
const shippingConfigForm = document.getElementById('shippingConfigForm');
const shippingConfigMessage = document.getElementById('shippingConfigMessage');
const shippingOrigin = document.getElementById('shippingOrigin');
let origemCarregada = false;

const fields = {
  name: document.getElementById('adminName'),
  sku: document.getElementById('adminSku'),
  price: document.getElementById('adminPrice'),
  cost: document.getElementById('adminCost'),
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
function mostrarApp() { loginView.hidden = true; adminApp.hidden = false; carregarProdutos(); carregarSiteConfig(); carregarOrigemFrete(); prepararResumoFinanceiro(); document.dispatchEvent(new Event('navoryx:login')); }
function mostrarLogin() { adminApp.hidden = true; loginView.hidden = false; }
function logout() { sessionStorage.removeItem(TOKEN_KEY); produtoEditando = null; mostrarLogin(); document.dispatchEvent(new Event('navoryx:logout')); }

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
  const resposta = await fetch(API_BASE + path, { ...options, signal: controller.signal });
  const dados = await resposta.json().catch(() => ({}));
  if (resposta.status === 401 && path !== '/admin/login') { logout(); throw new Error('Sessão expirada. Entre novamente.'); }
  if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir a operação.');
  return dados;
  } catch (erro) {
    if (erro.name === 'AbortError') throw new Error('O servidor demorou para responder. Tente novamente em instantes.');
    if (erro instanceof TypeError) throw new Error('Não foi possível conectar ao servidor. Confira sua conexão.');
    throw erro;
  } finally { clearTimeout(timeout); }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const loginButton = loginForm.querySelector('button[type="submit"]');
  if (loginButton.disabled) return;
  loginButton.disabled = true;
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
  } finally { loginButton.disabled = false; }
});

async function verificarSessao() {
  if (!token()) return mostrarLogin();
  try {
    await api('/admin/me', { headers: authHeaders() });
    mostrarApp();
    const retornoMeli = new URLSearchParams(window.location.search).get('mercadolivre');
    if (retornoMeli) {
      document.querySelector('[data-tab="integrations"]').click();
      const mensagens = { conectado: 'Conta do Mercado Livre conectada.', cancelado: 'A autorização do Mercado Livre foi cancelada.', erro: 'Não foi possível concluir a autorização.', 'erro-configuracao': 'Configure o aplicativo do Mercado Livre no backend.', 'erro-state': 'A autorização expirou ou não pôde ser validada. Tente conectar novamente.', 'erro-autorizacao': 'A autorização não foi concluída. Confira o cadastro do aplicativo e tente novamente.' };
      const mensagem = document.getElementById('mercadoLivreMessage');
      mensagem.textContent = mensagens[retornoMeli] || 'Retorno da autorização recebido.';
      mensagem.className = 'admin-preview-note' + (retornoMeli === 'conectado' ? '' : ' error');
      history.replaceState({}, '', window.location.pathname);
    }
  } catch (_) { mostrarLogin(); }
}

async function carregarProdutos() {
  productsContainer.innerHTML = '<p>Carregando...</p>';
  try {
    produtos = await api('/admin/produtos', { headers: authHeaders() });
    renderizarProdutos();
  } catch (erro) {
    productsContainer.innerHTML = '<p>' + escapeHtml(erro.message) + '</p>';
  }
}

function preencherSiteConfig(config) {
  siteConfig = config || {};
  siteConfigFields.forEach(name => {
    const campo = siteConfigForm.elements.namedItem(name);
    if (campo) campo.value = siteConfig[name] ?? '';
  });
  document.getElementById('configPrimaryPicker').value = /^#[0-9a-f]{6}$/i.test(siteConfig.cor_principal || '') ? siteConfig.cor_principal : '#111827';
  document.getElementById('configSecondaryPicker').value = /^#[0-9a-f]{6}$/i.test(siteConfig.cor_secundaria || '') ? siteConfig.cor_secundaria : '#2563eb';
  atualizarPrevia();
}

async function carregarOrigemFrete() {
  origemCarregada = false;
  document.getElementById('saveShippingConfig').disabled = true;
  try {
    const config = await api('/admin/frete-config', { headers: authHeaders() });
    shippingOrigin.value = config.cep_origem || '';
    shippingConfigMessage.textContent = '';
    origemCarregada = true;
    document.getElementById('saveShippingConfig').disabled = false;
  } catch (erro) {
    shippingConfigMessage.textContent = erro.message;
    shippingConfigMessage.className = 'admin-message error';
  }
}
shippingConfigForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.getElementById('saveShippingConfig');
  if (!origemCarregada || button.disabled) return;
  button.disabled = true;
  shippingConfigMessage.className = 'admin-message';
  shippingConfigMessage.textContent = 'Salvando…';
  try {
    const config = await api('/admin/frete-config', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ cep_origem: shippingOrigin.value.trim() }) });
    shippingOrigin.value = config.cep_origem || '';
    shippingConfigMessage.textContent = 'Origem salva. Este dado fica restrito ao painel.';
  } catch (erro) {
    shippingConfigMessage.textContent = erro.message;
    shippingConfigMessage.className = 'admin-message error';
  } finally { button.disabled = false; }
});

function lerSiteConfigDoFormulario() {
  return Object.fromEntries(siteConfigFields.map(name => [name, String(siteConfigForm.elements.namedItem(name)?.value || '').trim()]));
}

function atualizarPrevia() {
  const config = lerSiteConfigDoFormulario();
  const bar = document.getElementById('previewTopbar');
  const banner = document.getElementById('previewBanner');
  document.getElementById('previewTitle').textContent = config.titulo_banner || 'Título do banner principal';
  bar.textContent = config.texto_topo || 'Aviso da loja';
  bar.style.background = config.cor_principal || '#111827';
  banner.style.backgroundColor = config.cor_secundaria || '#2563eb';
  banner.style.backgroundImage = config.banner_url ? `linear-gradient(90deg,rgba(15,23,42,.72),rgba(15,23,42,.18)),url("${config.banner_url.replace(/["\\]/g, '')}")` : `linear-gradient(110deg,${config.cor_principal || '#111827'},${config.cor_secundaria || '#2563eb'})`;
}

async function carregarSiteConfig() {
  siteConfigMessage.textContent = 'Carregando configurações…';
  try {
    preencherSiteConfig(await api('/site-config'));
    siteConfigMessage.textContent = '';
  } catch (erro) {
    siteConfigMessage.textContent = 'Configurações indisponíveis: ' + erro.message;
    siteConfigMessage.className = 'admin-message error';
  }
}

siteConfigForm.addEventListener('input', event => {
  if (event.target.id === 'configPrimary') document.getElementById('configPrimaryPicker').value = /^#[0-9a-f]{6}$/i.test(event.target.value) ? event.target.value : '#111827';
  if (event.target.id === 'configSecondary') document.getElementById('configSecondaryPicker').value = /^#[0-9a-f]{6}$/i.test(event.target.value) ? event.target.value : '#2563eb';
  atualizarPrevia();
});
document.getElementById('configPrimaryPicker').addEventListener('input', event => { siteConfigForm.elements.namedItem('cor_principal').value = event.target.value; atualizarPrevia(); });
document.getElementById('configSecondaryPicker').addEventListener('input', event => { siteConfigForm.elements.namedItem('cor_secundaria').value = event.target.value; atualizarPrevia(); });
document.getElementById('reloadSiteConfig').addEventListener('click', carregarSiteConfig);
siteConfigForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.getElementById('saveSiteConfig');
  button.disabled = true;
  siteConfigMessage.className = 'admin-message';
  siteConfigMessage.textContent = 'Salvando…';
  try {
    preencherSiteConfig(await api('/site-config', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(lerSiteConfigDoFormulario()) }));
    siteConfigMessage.textContent = 'Configurações salvas. A loja pública já pode exibi-las.';
  } catch (erro) {
    siteConfigMessage.textContent = erro.message;
    siteConfigMessage.className = 'admin-message error';
  } finally { button.disabled = false; }
});

document.querySelector('.admin-tabs').addEventListener('click', event => {
  const tab = event.target.closest('[data-tab]');
  if (!tab) return;
  document.querySelectorAll('.admin-tab').forEach(item => item.setAttribute('aria-selected', String(item === tab)));
  document.querySelectorAll('.admin-panel').forEach(panel => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
  if (tab.dataset.tab === 'integrations') carregarIntegracoes();
  if (tab.dataset.tab === 'finance') carregarResumoFinanceiro();
});

async function carregarIntegracoes() {
  const catalog = document.getElementById('integrationCatalogStatus');
  const payment = document.getElementById('integrationPaymentStatus');
  const note = document.getElementById('integrationStatusNote');
  catalog.textContent = 'Consultando…';
  payment.textContent = 'Consultando…';
  try {
    const status = await api('/health/integrations');
    catalog.textContent = status.catalogo === 'available' ? 'API respondeu com catálogo disponível' : 'Indisponível';
    payment.textContent = status.mercado_pago_credencial === 'configured' ? 'Configurada; validade não verificada' : 'Não encontrada neste ambiente';
    note.textContent = 'Leitura do status em ' + new Date().toLocaleString('pt-BR') + '. Não foi realizada cobrança de teste.';
  } catch (erro) {
    catalog.textContent = 'Não foi possível verificar';
    payment.textContent = 'Não foi possível verificar';
    note.textContent = erro.message;
  }
  await carregarStatusMercadoLivre();
}
document.getElementById('refreshIntegrations').addEventListener('click', carregarIntegracoes);

async function carregarStatusMercadoLivre() {
  const status = document.getElementById('mercadoLivreStatus');
  const model = document.getElementById('mercadoLivreModel');
  const message = document.getElementById('mercadoLivreMessage');
  const button = document.getElementById('connectMercadoLivre');
  status.textContent = 'Consultando…';
  button.disabled = true;
  try {
    const resultado = await api('/admin/mercadolivre/status', { headers: authHeaders() });
    if (!resultado.configured) {
      status.textContent = 'Aplicativo ainda não configurado';
      model.textContent = 'Aguardando conexão';
      message.textContent = 'O backend precisa receber o ID, o segredo e a URL de retorno cadastrados no aplicativo de desenvolvedor do Mercado Livre.';
      button.disabled = true;
      return;
    }
    if (resultado.connected) {
      status.textContent = 'Conectada' + (resultado.seller?.nickname ? ' — ' + resultado.seller.nickname : '');
      model.textContent = resultado.seller_model === 'user_products' ? 'User Products' : resultado.seller_model === 'legacy_or_not_enabled' ? 'User Products não identificado' : 'Não informado pela API';
      message.textContent = 'Conta autorizada. ID do vendedor: ' + (resultado.seller?.id || '—') + (resultado.seller_model === 'user_products' ? '. A publicação deverá seguir o modelo User Products.' : '.');
    } else if (resultado.needs_reconnect) {
      status.textContent = 'Precisa reconectar';
      model.textContent = 'Aguardando conexão';
      message.textContent = 'Não foi possível validar o token salvo. Reconecte a conta pelo OAuth.';
    } else {
      status.textContent = 'Aguardando autorização';
      model.textContent = 'Aguardando conexão';
      message.textContent = 'O app está configurado. Conecte a conta vendedora para continuar.';
    }
    button.disabled = false;
  } catch (erro) {
    status.textContent = 'Status indisponível';
    message.textContent = erro.message;
  }
}

document.getElementById('connectMercadoLivre').addEventListener('click', async event => {
  const button = event.currentTarget;
  const message = document.getElementById('mercadoLivreMessage');
  button.disabled = true;
  message.textContent = 'Preparando a autorização segura…';
  try {
    const result = await api('/admin/mercadolivre/authorize-url', { headers: authHeaders() });
    if (!result.authorization_url) throw new Error('O endereço de autorização não foi retornado.');
    window.location.assign(result.authorization_url);
  } catch (erro) {
    message.textContent = erro.message;
    button.disabled = false;
  }
});

function renderizarProdutos() {
  productCount.textContent = produtos.length;
  if (!produtos.length) return productsContainer.innerHTML = '<p>Nenhum produto cadastrado.</p>';
  productsContainer.innerHTML = produtos.map(produto => `
    <div class="admin-product-item">
      <div class="admin-product-image"><img src="${escapeHtml(produto.image)}" alt="${escapeHtml(produto.name)}"></div>
      <div class="admin-product-info">
        <strong>${escapeHtml(produto.name)}</strong>
        <span>${formatarPreco(produto.salePrice || produto.price)}</span>
        <small>SKU: ${escapeHtml(produto.sku || '—')} • Físico: ${Number(produto.stock || 0)} • Reservado: ${Number(produto.reservedStock || 0)} • Disponível: ${Number(produto.availableStock ?? produto.stock ?? 0)}</small>
        <small>Custo: ${produto.cost === null || produto.cost === undefined ? 'não informado' : formatarPreco(produto.cost)} • Margem unitária: ${produto.cost === null || produto.cost === undefined ? '—' : formatarPreco((produto.salePrice || produto.price) - produto.cost)}</small>
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
  if (saveButton.disabled) return;
  const dados = {
    name: fields.name.value.trim(), sku: fields.sku.value.trim(),
    price: Number(fields.price.value), cost: fields.cost.value === '' ? null : Number(fields.cost.value),
    salePrice: fields.salePrice.value ? Number(fields.salePrice.value) : null,
    stock: Number(fields.stock.value || 0), image: fields.image.value.trim(),
    category: fields.category.value, description: fields.description.value.trim(),
    active: fields.active.checked
  };
  const valoresEmbalagem = Object.entries(embalagemFields).map(([k, input]) => [k, input.value.trim()]);
  const preenchidos = valoresEmbalagem.filter(([, v]) => v !== '').length;
  if (preenchidos && preenchidos !== 4) {
    formMessage.textContent = 'Preencha peso, comprimento, largura e altura da embalagem, ou deixe os quatro campos vazios.';
    formMessage.className = 'admin-message error';
    embalagemFields[valoresEmbalagem.find(([, v]) => !v)[0]].focus();
    return;
  }
  dados.embalagem = preenchidos ? Object.fromEntries(valoresEmbalagem.map(([k, v]) => [k, Number(v)])) : null;
  saveButton.disabled = true;
  formMessage.className = 'admin-message';
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
    Object.entries(embalagemFields).forEach(([key, input]) => { input.value = produto.embalagem?.[key] ?? ''; });
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
verificarSessao();


const financeMonth = document.getElementById('financeMonth');
function mesAtualLocal() {
  const hoje = new Date();
  return hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2,'0');
}
function prepararResumoFinanceiro() {
  if (!financeMonth.value) financeMonth.value = mesAtualLocal();
}
async function carregarResumoFinanceiro() {
  prepararResumoFinanceiro();
  const message = document.getElementById('financeMessage');
  message.className = 'admin-preview-note';
  message.textContent = 'Carregando balanço…';
  try {
    const resumo = await api('/admin/resumo-vendas?month=' + encodeURIComponent(financeMonth.value), { headers: authHeaders() });
    const dinheiro = centavos => formatarPreco(Number(centavos || 0) / 100);
    document.getElementById('financeOrders').textContent = Number(resumo.paid_orders || 0);
    document.getElementById('financeUnits').textContent = Number(resumo.units_sold || 0);
    document.getElementById('financeRevenue').textContent = dinheiro(resumo.revenue_total_cents);
    document.getElementById('financeProductCost').textContent = dinheiro(resumo.product_cost_cents);
    document.getElementById('financeShippingRevenue').textContent = dinheiro(resumo.shipping_revenue_cents);
    document.getElementById('financeShippingCost').textContent = dinheiro(resumo.shipping_cost_estimated_cents);
    document.getElementById('financeMargin').textContent = dinheiro(resumo.operating_margin_estimated_cents);
    const progresso = Math.max(0, Math.min(100, (Number(resumo.operating_margin_estimated_cents || 0) / 100000) * 100));
    document.getElementById('financeGoalText').textContent = progresso.toFixed(0) + '%';
    document.getElementById('financeGoalBar').style.width = progresso + '%';
    const alertas = [];
    if (resumo.missing_cost_units) alertas.push(resumo.missing_cost_units + ' unidade(s) vendida(s) sem custo cadastrado');
    if (resumo.shipping_cost_pending_orders) alertas.push(resumo.shipping_cost_pending_orders + ' pedido(s) com custo de frete ainda estimado');
    message.textContent = alertas.length ? 'Atenção: ' + alertas.join(' • ') + '.' : 'Balanço atualizado com vendas pagas do mês.';
    message.className = 'admin-preview-note' + (alertas.length ? ' error' : '');
  } catch (erro) {
    message.textContent = erro.message;
    message.className = 'admin-preview-note error';
  }
}
financeMonth.addEventListener('change', carregarResumoFinanceiro);
