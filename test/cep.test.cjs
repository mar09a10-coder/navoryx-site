'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const all = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const source = all.slice(all.indexOf('const cepInput ='), all.indexOf('// PÁGINA DE CHECKOUT'));
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };

function page(request) {
  const nodes = Object.fromEntries(['cep', 'cepStatus', 'endereco', 'bairro', 'cidade', 'estado', 'numero'].map(id => [id, {
    value: '', textContent: '', disabled: false, hidden: true, dataset: {}, attributes: {}, listeners: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    focus() { assert.fail('A consulta não deve mudar o foco ou reabrir o teclado.'); }
  }]));
  const calls = [], timers = new Map(); let timerId = 0;
  const context = vm.createContext({
    document: { getElementById: id => nodes[id] }, AbortController,
    fetch: (url, options) => { calls.push({ url, options }); return request(url, options); },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); },
    alert() { assert.fail('Falhas devem ser exibidas sem abrir alertas modais.'); }
  });
  vm.runInContext(source, context);
  return { nodes, calls, timers, enter(value) { nodes.cep.value = value; nodes.cep.listeners.input(); } };
}
const address = (data = {}) => ({ ok: true, json: async () => ({ logradouro: 'Rua teste', bairro: 'Centro', localidade: 'Vitória', uf: 'ES', ...data }) });

test('digitar e sair do CEP faz uma única consulta, sem bloquear os campos', async () => {
  let resolve;
  const p = page(() => new Promise(r => { resolve = r; }));
  p.enter('29010000'); p.nodes.cep.listeners.blur();
  assert.equal(p.calls.length, 1);
  assert.equal(p.nodes.cep.disabled, false);
  resolve(address()); await settle();
  assert.equal(p.nodes.endereco.value, 'Rua teste');
  p.nodes.cep.listeners.blur();
  assert.equal(p.calls.length, 1);
  assert.equal(p.timers.size, 0);
});

test('resposta de CEP antigo não substitui o endereço do CEP atual', async () => {
  const pending = [];
  const p = page(() => new Promise(resolve => pending.push(resolve)));
  p.enter('29010000'); p.enter('29020000');
  assert.equal(p.calls[0].options.signal.aborted, true);
  pending[1](address({ logradouro: 'Rua atual' })); await settle();
  pending[0](address({ logradouro: 'Rua antiga' })); await settle();
  assert.equal(p.nodes.endereco.value, 'Rua atual');
});

test('consulta não apaga informações digitadas durante a espera', async () => {
  let resolve;
  const p = page(() => new Promise(r => { resolve = r; }));
  p.enter('29010000'); p.nodes.endereco.value = 'Endereço preenchido à mão';
  resolve(address()); await settle();
  assert.equal(p.nodes.endereco.value, 'Endereço preenchido à mão');
  assert.equal(p.nodes.cidade.value, 'Vitória');
});

test('consulta sem resposta tem limite de espera e permite endereço manual', async () => {
  const p = page((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('timeout'), { name: 'AbortError' })));
  }));
  p.enter('29010000'); [...p.timers.values()][0](); await settle();
  assert.match(p.nodes.cepStatus.textContent, /manualmente/);
  assert.equal(p.nodes.cep.disabled, false);
  assert.equal(p.nodes.cep.attributes['aria-busy'], 'false');
});

test('CEP inexistente e falha de rede mantêm os campos editáveis', async () => {
  for (const request of [async () => address({ erro: true }), async () => { throw new Error('offline'); }]) {
    const p = page(request); p.enter('29010000'); await settle();
    assert.equal(p.nodes.cepStatus.dataset.type, 'error');
    assert.equal(p.nodes.cep.disabled, false);
  }
});
