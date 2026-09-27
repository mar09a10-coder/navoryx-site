/* global API_BASE, token, authHeaders, logout, formatarPreco */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const prefix = '/admin/mercadolivre/publicacoes';
  const conditionNames = { new: 'Novo', used: 'Usado', not_specified: 'Não especificado' };
  let catalog = [], history = [], model = null, meta = null, draft = null;
  let generation = 0, categoryGeneration = 0, busy = false;

  function node(tag, text, className) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (className) n.className = className;
    return n;
  }
  function message(text = '', error = false, details = []) {
    el('mlMessage').textContent = text;
    el('mlMessage').className = 'admin-message' + (error ? ' error' : '');
    el('mlErrors').replaceChildren(...details.map(d => node('li', d)));
    el('mlErrors').hidden = !details.length;
  }
  function failure(error) { message(error.message, true, error.details || []); }
  function invalidate() {
    draft = null;
    el('mlReview').hidden = true;
    el('mlConfirm').checked = false;
    el('mlPublish').disabled = true;
  }
  function setBusy(value) {
    busy = value;
    el('mlRefresh').disabled = value;
    el('mlProduct').disabled = value;
    el('mlFields').disabled = value || !el('mlProduct').value;
    el('mlPublish').disabled = value || !draft || !el('mlConfirm').checked;
  }
  async function call(path = '', body) {
    const response = await fetch(API_BASE + prefix + path, {
      method: body === undefined ? 'GET' : 'POST', headers: authHeaders(),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(90000)
    }).catch(() => { throw new Error('A conexão foi interrompida. Atualize o histórico para conferir o resultado do envio.'); });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { logout(); throw new Error('Sua sessão expirou. Entre novamente no painel.'); }
    if (!response.ok) {
      const error = new Error(data.erro || (response.status === 404 ?
        'A publicação ainda não está disponível no servidor. Atualize o backend no Render.' : 'Não foi possível concluir a operação.'));
      error.details = Array.isArray(data.detalhes) ? data.detalhes : [];
      throw error;
    }
    return data;
  }
  function option(select, value, text) {
    const o = node('option', text); o.value = value; select.append(o);
  }
  function options(select, values, placeholder = 'Selecione') {
    select.replaceChildren(); option(select, '', placeholder);
    values.forEach(v => option(select, v.id, v.name));
  }
  function safeImage(value) {
    try {
      const url = new URL(value, window.location.href);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }
  function marketplaceLink(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password &&
        (url.hostname === 'mercadolivre.com.br' || url.hostname.endsWith('.mercadolivre.com.br')) ? url.href : '';
    } catch (_) { return ''; }
  }
  function selectProduct() {
    invalidate(); meta = null; categoryGeneration++;
    el('mlCategoryFields').hidden = true;
    options(el('mlCategory'), [], 'Busque e selecione uma categoria');
    el('mlCategoryCode').value = '';
    const p = catalog.find(p => String(p.id) === el('mlProduct').value);
    el('mlFields').disabled = !p;
    if (!p) return;
    el('mlTitle').maxLength = 200;
    el('mlTitle').value = p.name || '';
    el('mlPrice').value = Number(p.salePrice) > 0 ? p.salePrice : p.price;
    el('mlQuantity').value = '';
    el('mlQuantity').max = Math.max(0, Number(p.stock) || 0);
    el('mlStock').textContent = 'Estoque cadastrado: ' + (Number(p.stock) || 0) + '. Informe quantas unidades vai reservar para o Mercado Livre.';
    el('mlDescription').value = p.description || '';
    const image = safeImage(p.image);
    el('mlPhoto').hidden = !image;
    if (image) el('mlPhoto').src = image;
    else el('mlPhoto').removeAttribute('src');
    el('mlFreeShipping').value = '';
    message('Confira o nome e busque a categoria correspondente.');
  }
  function fillProducts() {
    const locked = new Set(history.filter(h => !['draft', 'failed'].includes(h.state)).map(h => h.product_id));
    options(el('mlProduct'), catalog.filter(p => !locked.has(String(p.id))).map(p => ({ id: String(p.id), name: p.name })), 'Selecione um produto');
    selectProduct();
  }
  async function load() {
    if (busy || !token()) return;
    const version = ++generation;
    setBusy(true); invalidate(); el('mlForm').hidden = true;
    message('Consultando conta e histórico…');
    try {
      const results = await Promise.allSettled([
        call(), fetch(API_BASE + '/produtos', { signal: AbortSignal.timeout(25000) }).then(async r => {
          if (!r.ok) throw new Error('Não foi possível carregar os produtos da loja.');
          const data = await r.json();
          if (!Array.isArray(data)) throw new Error('O catálogo retornou dados incompletos.');
          return data;
        })
      ]);
      const rejected = results.find(r => r.status === 'rejected');
      if (rejected) throw rejected.reason;
      if (version !== generation || !token()) return;
      const [account, products] = results.map(r => r.value);
      catalog = products; history = account.publications; model = account.model;
      el('mlAccount').textContent = `Conta conectada: ${account.seller.nickname} · ${account.seller.id}`;
      el('mlTitleLabel').textContent = model === 'user_products' ? 'Nome do produto no Mercado Livre *' : 'Título do anúncio *';
      el('mlTitleHint').textContent = model === 'user_products' ?
        'Nesta conta, o Mercado Livre gera o título final a partir do nome e das características informadas.' : '';
      fillProducts(); renderHistory(); el('mlForm').hidden = false;
      message(catalog.length ? 'Escolha o produto que deseja anunciar.' : 'Cadastre primeiro um produto na aba Produtos e anúncios.');
    } catch (error) { if (version === generation) { el('mlAccount').textContent = 'Não foi possível consultar a conta.'; failure(error); } }
    finally { if (version === generation) setBusy(false); }
  }
  function attributeField(attribute, group) {
    const wrapper = node('div', undefined, 'admin-field');
    const id = `${group}-${attribute.id}`;
    const required = attribute.tags?.required === true;
    const label = node('label', attribute.name + (required ? ' *' : ''));
    label.htmlFor = id;
    const isList = ['list', 'boolean'].includes(attribute.value_type);
    const input = node(isList ? 'select' : 'input');
    input.id = id; input.dataset.attributeId = attribute.id; input.dataset.group = group;
    input.required = required;
    if (isList) options(input, (attribute.values || []).filter(v => v.id != null));
    else {
      input.type = 'text'; input.maxLength = attribute.value_max_length || 255;
      const values = (attribute.values || []).filter(v => v.name).slice(0, 150);
      if (values.length) {
        const list = node('datalist'); list.id = id + '-values'; input.setAttribute('list', list.id);
        values.forEach(v => { const o = node('option'); o.value = v.name; list.append(o); }); wrapper.append(list);
      }
      if (attribute.value_type === 'number_unit') input.placeholder = 'Valor e unidade';
    }
    wrapper.append(label, input);
    if (attribute.tooltip || attribute.hint) wrapper.append(node('small', attribute.tooltip || attribute.hint, 'admin-preview-note'));
    return wrapper;
  }
  async function categoryChanged(id) {
    invalidate(); meta = null; el('mlCategoryFields').hidden = true;
    if (!id) return;
    const version = ++categoryGeneration;
    message('Consultando os campos exigidos pela categoria…');
    setBusy(true);
    try {
      const data = await call('/categorias/' + encodeURIComponent(id));
      if (version !== categoryGeneration || !token()) return;
      meta = data;
      el('mlCategoryName').textContent = data.category.path_from_root?.map(c => c.name).join(' › ') || data.category.name;
      el('mlTitle').maxLength = Math.min(Number(data.category.settings?.max_title_length) || 60, 200);
      options(el('mlCondition'), data.conditions.map(id => ({ id, name: conditionNames[id] })));
      options(el('mlListingType'), data.listing_types);
      ['mlAttributes', 'mlOptionalAttributes', 'mlSaleTerms'].forEach(id => el(id).replaceChildren());
      for (const a of data.attributes) {
        const important = a.tags?.required || ['BRAND', 'MODEL', 'GTIN', 'EMPTY_GTIN_REASON'].includes(a.id);
        el(important ? 'mlAttributes' : 'mlOptionalAttributes').append(attributeField(a, 'attributes'));
      }
      data.sale_terms.forEach(a => el('mlSaleTerms').append(attributeField(a, 'sale_terms')));
      if (!data.sale_terms.length) el('mlSaleTerms').append(node('p', 'Nenhuma condição adicional retornada para esta categoria.', 'admin-preview-note'));
      el('mlOptionalDetails').hidden = !el('mlOptionalAttributes').childElementCount;
      el('mlCategoryFields').hidden = false;
      el('mlReviewButton').disabled = !data.me2 || !data.listing_types.length;
      message(!data.me2 ? 'Mercado Envios indisponível para esta conta ou categoria. Conclua este produto diretamente no Mercado Livre.' :
        !data.listing_types.length ? 'Não há um tipo de anúncio disponível para esta categoria.' : 'Preencha os dados da categoria e valide o anúncio.', !data.me2 || !data.listing_types.length);
    } catch (error) { if (version === categoryGeneration) failure(error); }
    finally { if (version === categoryGeneration) setBusy(false); }
  }
  function values(group, schema) {
    return [...el('mlForm').querySelectorAll(`[data-group="${group}"]`)].flatMap(input => {
      const value = input.value.trim(); if (!value) return [];
      const a = schema.find(a => a.id === input.dataset.attributeId);
      const match = (a?.values || []).find(v => v.id != null && (input.tagName === 'SELECT' ? String(v.id) === value : v.name === value));
      return [{ id: input.dataset.attributeId, ...(match ? { value_id: String(match.id) } : { value_name: value }) }];
    });
  }
  function reviewContent(data) {
    const r = data.review, root = el('mlReviewContent'); root.replaceChildren();
    const list = node('dl', undefined, 'ml-review-grid');
    const entries = [['Conta', `${r.seller.nickname} (${r.seller.id})`], ['Produto', r.title], ['Categoria', r.category],
      ['Preço', formatarPreco(r.price)], ['Unidades', r.quantity], ['Condição', conditionNames[r.condition]],
      ['Tipo de anúncio', r.listing_type], ['Frete', r.free_shipping ? 'Mercado Envios com frete grátis oferecido' : 'Mercado Envios, sujeito às regras de frete grátis obrigatório']];
    if (r.fee) {
      entries.push(['Tarifa estimada por venda / unidade', formatarPreco(r.fee.sale)], ['Tarifa para anunciar', formatarPreco(r.fee.listing)]);
    }
    entries.forEach(([label, value]) => { const pair = node('div'); pair.append(node('dt', label), node('dd', value)); list.append(pair); });
    const photo = node('img'); photo.src = safeImage(r.image); photo.alt = 'Foto que será enviada';
    const photoWrapper = node('div', undefined, 'ml-photo'); photoWrapper.append(photo);
    root.append(photoWrapper, list);
    root.append(node('p', r.fee ?
      'As tarifas são estimadas para a logística padrão da conta (' + r.fee.logistic + '). Não incluem o frete, impostos ou outros custos e podem mudar conforme as condições do Mercado Livre.' :
      'Não foi possível estimar as tarifas desta conta. Confira as tarifas e o custo do frete no Mercado Livre antes de confirmar.', 'admin-preview-note'));
    const feesLink = node('a', 'Consultar tarifas e condições no Mercado Livre');
    feesLink.href = 'https://www.mercadolivre.com.br/ajuda'; feesLink.target = '_blank'; feesLink.rel = 'noopener noreferrer'; root.append(feesLink);
    [['attributes', 'Características', meta.attributes], ['sale_terms', 'Condições de venda', meta.sale_terms]].forEach(([key, title, schema]) => {
      const list = node('ul');
      (r[key] || []).forEach(v => {
        const definition = schema.find(a => a.id === v.id);
        const value = v.value_name || definition?.values?.find(x => String(x.id) === v.value_id)?.name || v.value_id;
        list.append(node('li', `${definition?.name || (v.id === 'SELLER_SKU' ? 'SKU' : v.id)}: ${value}`));
      });
      if (list.childElementCount) root.append(node('h3', title, 'admin-subheading'), list);
    });
    const details = node('details'); details.append(node('summary', 'Conferir descrição completa'), node('p', r.description, 'ml-review-description')); root.append(details);
    if (r.warnings.length) { const list = node('ul', undefined, 'ml-errors'); r.warnings.forEach(w => list.append(node('li', w))); root.append(node('h3', 'Orientações do Mercado Livre'), list); }
    el('mlReview').hidden = false;
    el('mlReview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderHistory() {
    const root = el('mlHistory'); root.replaceChildren();
    const entries = history.filter(h => h.state !== 'draft');
    if (!entries.length) { root.append(node('p', 'Nenhum envio registrado nesta conta.')); return; }
    const states = { published: 'Anúncio criado', failed: 'Envio recusado — corrija os dados e revise novamente',
      sending: 'Envio iniciado — confirme o resultado', unknown: 'Resultado ainda não confirmado' };
    entries.forEach(item => {
      const card = node('div', undefined, 'ml-history-item');
      card.append(node('strong', item.title), node('p', states[item.state] || item.state));
      if (item.item_id) {
        card.append(node('p', `${item.item_id} · status recebido: ${item.item_status || 'aguardando'}`));
        const href = marketplaceLink(item.permalink);
        if (href) { const a = node('a', 'Abrir anúncio no Mercado Livre'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; card.append(a); }
        if (!item.description_sent) {
          card.append(node('p', 'O anúncio foi criado, mas o envio da descrição precisa ser conferido.'));
          const button = node('button', 'Conferir e reenviar descrição', 'admin-secondary'); button.type = 'button';
          button.addEventListener('click', () => historyAction(button, `/${encodeURIComponent(item.product_id)}/descricao`, {})); card.append(button);
        }
      } else if (['sending', 'unknown'].includes(item.state)) {
        card.append(node('p', 'Confira Seus anúncios no Mercado Livre. Se o anúncio apareceu, informe o código MLB abaixo. Não crie outro anúncio deste produto enquanto o resultado estiver pendente.'));
        const form = node('form', undefined, 'admin-actions');
        const field = node('div', undefined, 'admin-field'); const label = node('label', 'Código do anúncio criado');
        const input = node('input'); input.id = 'recover-' + item.product_id; label.htmlFor = input.id;
        input.placeholder = 'MLB123456789'; input.required = true; input.pattern = 'MLB[0-9]+'; field.append(label, input);
        const button = node('button', 'Recuperar anúncio', 'admin-secondary'); button.type = 'submit'; form.append(field, button);
        form.addEventListener('submit', e => { e.preventDefault(); historyAction(button, `/${encodeURIComponent(item.product_id)}/recuperar`, { item_id: input.value.trim() }); }); card.append(form);
      }
      root.append(card);
    });
  }
  async function updateHistory() {
    const version = generation;
    const result = await call();
    if (version !== generation || !token()) return;
    history = result.publications; renderHistory();
  }
  async function historyAction(button, path, body) {
    if (busy) return;
    const version = generation; setBusy(true); button.disabled = true; message('Conferindo o anúncio…');
    try {
      const result = await call(path, body);
      if (version !== generation) return;
      message(result.description_sent ? 'Anúncio e descrição confirmados.' : 'Anúncio recuperado. Confira o envio da descrição.');
      await updateHistory();
    } catch (error) { if (version === generation) failure(error); }
    finally { if (version === generation) { setBusy(false); button.disabled = false; } }
  }

  el('mlProduct').addEventListener('change', selectProduct);
  el('mlForm').addEventListener('input', invalidate);
  el('mlForm').addEventListener('change', invalidate);
  el('mlCategory').addEventListener('change', () => categoryChanged(el('mlCategory').value));
  el('mlUseCategory').addEventListener('click', () => {
    if (busy) return;
    const value = el('mlCategoryCode').value.trim().toUpperCase();
    if (!/^MLB\d+$/.test(value)) return message('Informe um código de categoria como MLB1234.', true);
    options(el('mlCategory'), [{ id: value, name: value }]); el('mlCategory').value = value; categoryChanged(value);
  });
  el('mlSearch').addEventListener('click', async () => {
    if (busy) return;
    const title = el('mlTitle').value.trim();
    if (!title) return message('Preencha o nome do produto para buscar categorias.', true);
    const version = generation; setBusy(true); invalidate(); meta = null; el('mlCategoryFields').hidden = true;
    message('Buscando categorias…');
    try {
      const categories = await call('/categorias?' + new URLSearchParams({ q: title }));
      if (version !== generation) return;
      options(el('mlCategory'), categories, 'Selecione a categoria correta');
      message(categories.length ? 'Escolha a categoria que corresponde ao produto.' : 'Não houve sugestões. Ajuste o nome ou informe o código da categoria.');
    } catch (error) { if (version === generation) failure(error); }
    finally { if (version === generation) setBusy(false); }
  });
  el('mlForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !meta) return;
    const version = generation;
    const input = { product_id: el('mlProduct').value, title: el('mlTitle').value.trim(), price: Number(el('mlPrice').value),
      quantity: Number(el('mlQuantity').value), description: el('mlDescription').value.trim(), category_id: el('mlCategory').value,
      condition: el('mlCondition').value, listing_type_id: el('mlListingType').value, free_shipping: el('mlFreeShipping').value === 'true',
      attributes: values('attributes', meta.attributes), sale_terms: values('sale_terms', meta.sale_terms) };
    setBusy(true); invalidate(); message('Validando com o Mercado Livre. Nenhum anúncio é criado nesta etapa…');
    try {
      const result = await call('/revisar', input);
      if (version !== generation) return;
      draft = result; reviewContent(result); message('Validação concluída. Confira o resumo antes de publicar.');
    } catch (error) { if (version === generation) failure(error); }
    finally { if (version === generation) setBusy(false); }
  });
  el('mlConfirm').addEventListener('change', () => { el('mlPublish').disabled = busy || !draft || !el('mlConfirm').checked; });
  el('mlPublish').addEventListener('click', async () => {
    if (busy || !draft || !el('mlConfirm').checked) return;
    const version = generation;
    const input = { product_id: draft.product_id, draft_id: draft.draft_id, confirm: true };
    setBusy(true); invalidate(); message('Enviando anúncio. Aguarde a confirmação…');
    try {
      const result = await call('/publicar', input);
      if (version !== generation) return;
      message(`Anúncio ${result.item_id} criado.` + (result.description_sent ? ' Descrição enviada.' : ' Confira a descrição no histórico abaixo.'));
    } catch (error) { if (version === generation) failure(error); }
    finally {
      if (version === generation) {
        try { await updateHistory(); fillProducts(); } catch (_) { /* Keep the publication result and allow explicit refresh. */ }
        setBusy(false);
      }
    }
  });
  el('mlRefresh').addEventListener('click', load);
  document.querySelector('[data-tab="mercadolivre"]').addEventListener('click', load);
  document.addEventListener('navoryx:login', () => { if (!el('mlPanel').hidden) load(); });
  document.addEventListener('navoryx:logout', () => {
    generation++; categoryGeneration++; setBusy(false); invalidate(); meta = null; catalog = []; history = [];
    el('mlForm').hidden = true; el('mlHistory').replaceChildren(); el('mlAccount').textContent = 'Entre novamente para consultar a conta.';
  });
})();
