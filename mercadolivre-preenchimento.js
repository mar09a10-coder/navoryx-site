(function (root, factory) {
  const assist = factory();
  if (typeof module === 'object' && module.exports) module.exports = assist;
  else root.NavoryxMLAssist = assist;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clean = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const aliases = {
    BRAND: ['marca', 'marca do produto'], MODEL: ['modelo', 'modelo do produto'], LINE: ['linha'],
    GTIN: ['ean', 'ean13', 'gtin', 'upc', 'codigo de barras', 'codigo universal de produto'],
    MPN: ['mpn', 'codigo do fabricante'], COLOR: ['cor', 'cor do produto'], MAIN_COLOR: ['cor principal'],
    MATERIAL: ['material'], BLUETOOTH_VERSION: ['versao de bluetooth', 'versao do bluetooth', 'bluetooth versao'],
    WITH_BLUETOOTH: ['bluetooth', 'com bluetooth', 'funcao estendida bluetooth'],
    WITH_MICROPHONE: ['microfone', 'com microfone'], IS_WIRELESS: ['sem fio', 'e sem fio', 'conectividade'],
    IMPEDANCE: ['impedancia'], FREQUENCY_RESPONSE: ['resposta de frequencia'], DRIVER_TYPE: ['tipo de driver'],
    WEIGHT: ['peso', 'peso do produto'], HEIGHT: ['altura', 'altura do produto'],
    WIDTH: ['largura', 'largura do produto'], LENGTH: ['comprimento', 'comprimento do produto'],
    SELLER_PACKAGE_HEIGHT: ['altura da embalagem', 'altura do pacote'],
    SELLER_PACKAGE_WIDTH: ['largura da embalagem', 'largura do pacote'],
    SELLER_PACKAGE_LENGTH: ['comprimento da embalagem', 'comprimento do pacote'],
    SELLER_PACKAGE_WEIGHT: ['peso da embalagem', 'peso do pacote'],
    WARRANTY_TIME: ['prazo de garantia', 'tempo de garantia'], WARRANTY_TYPE: ['tipo de garantia']
  };
  const help = {
    BRAND: 'Veja a marca impressa no produto ou na embalagem. Use Genérica apenas se o produto realmente não tiver marca.',
    MODEL: 'Use o modelo ou código identificado pelo fabricante na embalagem, etiqueta ou manual.',
    GTIN: 'É o número abaixo do código de barras (EAN, UPC ou GTIN). O SKU da sua loja não substitui esse código.',
    EMPTY_GTIN_REASON: 'Se o produto não tem código de barras, escolha o motivo verdadeiro entre as opções disponíveis.',
    MPN: 'Código da peça ou do produto definido pelo fabricante, quando existir.',
    WARRANTY_TIME: 'Informe o prazo real de garantia e a unidade: dias, meses ou anos.',
    WARRANTY_TYPE: 'Escolha quem oferece a garantia que você está anunciando.',
    LINE: 'Família ou linha comercial do fabricante. Pode ser diferente do modelo.',
    SELLER_PACKAGE_WEIGHT: 'Peso do pacote pronto para envio, incluindo a embalagem.',
    SELLER_PACKAGE_HEIGHT: 'Altura do pacote pronto para envio, em centímetros.',
    SELLER_PACKAGE_WIDTH: 'Largura do pacote pronto para envio, em centímetros.',
    SELLER_PACKAGE_LENGTH: 'Comprimento do pacote pronto para envio, em centímetros.'
  };
  function dica(attribute) {
    return help[attribute.id] || (attribute.id.includes('ANATEL') ?
      'Confira o número de homologação na etiqueta ou documentação do produto. Ele é diferente do código de barras.' :
      attribute.tooltip || attribute.hint || (attribute.value_type === 'number_unit' ? 'Informe o valor com a unidade, por exemplo: 15 cm.' : ''));
  }
  function validoGTIN(value) {
    const digits = String(value).replace(/[\s-]/g, '');
    if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
    let sum = 0;
    for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) sum += Number(digits[i]) * weight;
    return (10 - sum % 10) % 10 === Number(digits.at(-1));
  }
  function pares(description) {
    const text = String(description || '').replace(/<br\s*\/?\s*>|<\/p>/gi, '\n').replace(/<[^>]*>/g, '');
    return text.split(/[\n;]+/).flatMap(line => {
      const match = line.match(/^\s*[-•✔*]*\s*([^:]{2,80})\s*:\s*(.{1,255})$/);
      return match ? [{ label: clean(match[1]), value: match[2].trim() }] : [];
    });
  }
  function normalizeValue(attribute, raw) {
    let value = String(raw ?? '').trim();
    if (!value || value.length > (attribute.value_max_length || 255)) return null;
    if (attribute.id === 'GTIN') {
      if (!validoGTIN(value)) return null;
      value = value.replace(/[\s-]/g, '');
    }
    if (attribute.id === 'BLUETOOTH_VERSION') value = value.replace(/^v\s*/i, '').replace(',', '.');
    const yes = ['sim', 'yes', 'true', 'sem fio'];
    const no = ['nao', 'no', 'false', 'com fio'];
    let normalized = clean(value);
    if (attribute.value_type === 'boolean') {
      if (yes.includes(normalized)) normalized = 'sim';
      else if (no.includes(normalized)) normalized = 'nao';
      else return null;
    }
    const choice = (attribute.values || []).find(v => clean(v.name) === normalized);
    if (choice?.id != null) return { value_id: String(choice.id), value_name: choice.name };
    if (['list', 'boolean'].includes(attribute.value_type)) return null;
    return { value_name: value };
  }
  function comparable(value) { return clean(String(value.value_name || '').replace(/^v(?=\d)/i, '')); }
  function suggestions(product, metadata, predicted = []) {
    const text = `${product.name || ''}\n${product.description || ''}`;
    const pairs = pares(product.description);
    const result = { attributes: [], sale_terms: [], conflicts: [] };
    for (const group of ['attributes', 'sale_terms']) {
      for (const a of metadata[group] || []) {
        const labels = new Set([clean(a.name), ...(aliases[a.id] || [])]);
        const raw = pairs.filter(p => labels.has(p.label)).map(p => p.value);
        if (a.id === 'BLUETOOTH_VERSION') {
          for (const m of text.matchAll(/bluetooth\s*(?:vers[aã]o\s*)?[:=-]?\s*v?\s*([1-9][.,]\d)\b/gi)) raw.push(m[1]);
        }
        const explicit = raw.map(v => normalizeValue(a, v)).filter(Boolean);
        const candidates = [...new Map(explicit.map(v => [comparable(v), v])).values()];
        const distinct = new Set(raw.map(v => { const n = normalizeValue(a, v); return n ? comparable(n) : clean(v); }));
        if (distinct.size > 1) {
          result.conflicts.push({ id: a.id, group, name: a.name, message: `${a.name}: o cadastro contém valores diferentes (${[...new Set(raw)].slice(0, 4).join(' / ')}). Confira na embalagem ou no manual.` });
          continue;
        }
        if (raw.length && !candidates.length) {
          result.conflicts.push({ id: a.id, group, name: a.name, message: `${a.name}: não foi possível aproveitar o valor da descrição. Confira o dado e as opções deste campo.` });
          continue;
        }
        let source = candidates.length ? 'Identificado na descrição — confira' : '';
        let value = candidates[0];
        // Predictor suggestions are candidates for review, not verified product specifications.
        const prediction = group === 'attributes' ? predicted.find(p => p.id === a.id) : null;
        const inferred = prediction?.value_name ? normalizeValue(a, prediction.value_name) : null;
        const sensitive = a.id === 'GTIN' || a.id.includes('ANATEL') || a.id.startsWith('SELLER_PACKAGE_');
        if (value && inferred && comparable(value) !== comparable(inferred)) {
          result.conflicts.push({ id: a.id, group, name: a.name, message: `${a.name}: a descrição informa ${value.value_name}, mas o Mercado Livre sugeriu ${inferred.value_name}. Confirme o dado correto.` });
          continue;
        }
        if (!value && inferred && !sensitive) { value = inferred; source = 'Sugestão do Mercado Livre — confira'; }
        if (!value && !sensitive && a.tags?.fixed && ['list', 'boolean'].includes(a.value_type) && a.values?.length === 1) {
          value = normalizeValue(a, a.values[0].name); source = 'Única opção da categoria — confira';
        }
        if (value) result[group].push({ id: a.id, ...value, source });
      }
    }
    // Warn about contradictory Bluetooth versions even if the category omits that attribute.
    const versions = [...new Set([...text.matchAll(/bluetooth\s*(?:vers[aã]o\s*)?[:=-]?\s*v?\s*([1-9][.,]\d)\b/gi)].map(m => m[1].replace(',', '.')))];
    if (versions.length > 1 && !result.conflicts.some(c => c.id === 'BLUETOOTH_VERSION')) {
      result.conflicts.push({ id: 'BLUETOOTH_VERSION', group: 'attributes', name: 'Versão do Bluetooth',
        message: `A descrição cita Bluetooth ${versions.join(' e ')}. Confira e corrija o texto antes de anunciar.` });
    }
    return result;
  }
  function title(value, max) {
    const normalized = String(value || '').trim().replace(/\s+/g, ' ');
    if (normalized.length <= max) return normalized;
    const slice = normalized.slice(0, max + 1);
    const lastSpace = slice.lastIndexOf(' ');
    return normalized.slice(0, lastSpace > max / 2 ? lastSpace : max).trim();
  }
  function signature(product) { return JSON.stringify([product.name, product.sku, product.description]); }
  return { suggestions, dica, title, signature, validoGTIN };
});
