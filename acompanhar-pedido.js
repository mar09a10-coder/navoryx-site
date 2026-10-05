'use strict';
(() => {
  const API_BASE = 'https://navoryx-backend-2.onrender.com';
  const params = new URLSearchParams(window.location.search);
  let token = params.get('pedido') || '';
  const title = document.getElementById('statusTitle');
  const message = document.getElementById('statusMessage');
  const icon = document.getElementById('statusIcon');
  const list = document.getElementById('orderTracking');
  const button = document.getElementById('refreshOrder');
  const cancel = document.getElementById('cancelOrder');
  const form = document.getElementById('trackingForm');
  const input = document.getElementById('trackingCode');
  const lastOrder = document.getElementById('lastOrderLink');
  const copyLink = document.getElementById('copyTrackingLink');
  const trackLater = document.getElementById('trackLaterLink');
  const statuses = {
    pending: 'Aguardando pagamento',
    in_process: 'Pagamento em análise',
    authorized: 'Pagamento em análise',
    approved: 'Pagamento aprovado',
    rejected: 'Pagamento recusado',
    cancelled: 'Pagamento cancelado',
    refunded: 'Pagamento devolvido',
    charged_back: 'Pagamento contestado',
    review: 'Pagamento em conferência'
  };
  const shipping = {
    pending: 'Envio em preparação',
    paid: 'Envio em preparação',
    generated: 'Etiqueta pronta',
    printed: 'Aguardando postagem',
    posted: 'Postado',
    released: 'Em transporte',
    delivered: 'Entregue',
    cancelled: 'Envio cancelado'
  };
  let busy = false;
  let autoTimer = null;
  const shipmentLabels = {
    not_prepared: 'Aguardando preparação do envio',
    prepared: 'Frete preparado',
    purchase_pending: 'Compra do frete em processamento',
    cart_uncertain: 'Conferindo criação da etiqueta',
    paid: 'Frete comprado',
    generated: 'Etiqueta gerada',
    printed: 'Etiqueta impressa',
    posted: 'Pedido postado',
    released: 'Pedido em transporte',
    delivered: 'Pedido entregue'
  };

  function extractToken(value) {
    const raw = String(value || '').trim();
    if (/^[a-f0-9]{64}$/i.test(raw)) return raw.toLowerCase();
    try {
      const url = new URL(raw, window.location.origin);
      const pedido = url.searchParams.get('pedido');
      if (/^[a-f0-9]{64}$/i.test(pedido || '')) return pedido.toLowerCase();
    } catch (_) {
      const found = raw.match(/[a-f0-9]{64}/i);
      if (found) return found[0].toLowerCase();
    }
    return '';
  }

  function trackingUrl(currentToken = token) {
    return window.location.origin + '/rastrear.html?pedido=' + encodeURIComponent(currentToken);
  }

  function setIdleState(text) {
    if (!title || !message || !icon || !list) return;
    icon.textContent = '⌕';
    title.textContent = 'Rastrear pedido';
    message.textContent = text || 'Cole o link de acompanhamento ou o código do pedido para consultar o pagamento, a postagem e o rastreio.';
    list.replaceChildren();
    if (cancel) cancel.hidden = true;
    if (copyLink) copyLink.hidden = true;
  }

  function scheduleRefresh(order) {
    if (autoTimer && typeof clearTimeout === 'function') clearTimeout(autoTimer);
    autoTimer = null;
    const active = !['closed', 'expired', 'cancelled'].includes(order.order_status) &&
      !['approved', 'cancelled', 'rejected', 'refunded', 'charged_back'].includes(order.payment_status);
    if (!form && active && typeof setTimeout === 'function') autoTimer = setTimeout(() => update(), 30000);
  }

  function render(order) {
    const approved = order.payment_status === 'approved';
    const closed = ['closed', 'expired', 'cancelled'].includes(order.order_status) ||
      ['cancelled', 'rejected', 'refunded', 'charged_back'].includes(order.payment_status);
    icon.textContent = approved ? '✓' : closed ? '○' : '⏳';
    title.textContent = order.order_status === 'expired' ? 'Pedido expirado' :
      order.order_status === 'cancelled' || order.payment_status === 'cancelled' ? 'Pedido cancelado' :
      statuses[order.payment_status] || 'Conferindo pagamento';
    message.textContent = approved ? `Pedido ${order.id.slice(0, 8).toUpperCase()} confirmado. Guarde este link para acompanhar a postagem e o rastreamento.` :
      closed ? 'Esta tentativa foi encerrada. Para comprar, volte à loja e faça um novo pedido.' :
      order.cancellation_pending ? 'Seu cancelamento foi solicitado e aguarda confirmação. Atualize o status antes de iniciar outro pagamento.' :
      'Seu pedido ainda não está confirmado. Você pode atualizar o status ou cancelar enquanto o pagamento não estiver aprovado ou em análise.';
    if (cancel) {
      cancel.hidden = !order.can_cancel;
      cancel.textContent = order.cancellation_pending ? 'Concluir cancelamento' : 'Cancelar pedido sem pagamento';
    }
    list.replaceChildren();

    const details = document.createElement('p');
    details.textContent = `Total: ${Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Entrega: ${order.shipping_method || 'A definir'}`;
    list.appendChild(details);

    if (approved && order.shipment_status) {
      const envio = document.createElement('p');
      envio.textContent = 'Status do envio: ' + (shipmentLabels[order.shipment_status] || 'Em preparação');
      list.appendChild(envio);
    }

    if (!approved && !closed) {
      const deadline = order.payment_due_at || order.payment_expires_at;
      if (deadline && Number.isFinite(Date.parse(deadline))) {
        const p = document.createElement('p');
        p.textContent = (order.payment_due_at ? 'Prazo do pagamento: ' : 'Prazo para iniciar o pagamento: ') + new Date(deadline).toLocaleString('pt-BR');
        list.appendChild(p);
      }
    }

    const rastreios = order.tracking || [];
    if (!rastreios.length) {
      const p = document.createElement('p');
      p.textContent = approved ? 'A etiqueta ainda não foi postada. Assim que o envio avançar, o código de rastreio aparece aqui.' : 'O rastreio fica disponível depois da aprovação do pagamento e preparação do envio.';
      list.appendChild(p);
    }

    for (const [i, t] of rastreios.entries()) {
      const p = document.createElement('p');
      p.textContent = `Pacote ${i + 1}: ${shipping[t.status] || 'Em preparação'}` + (t.code ? ` · Rastreio: ${t.code}` : '');
      list.appendChild(p);
      if (t.code) {
        const a = document.createElement('a');
        a.href = 'https://rastreamento.correios.com.br/app/index.php';
        a.textContent = 'Consultar nos Correios';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        list.appendChild(a);
      }
    }

    if (trackLater) trackLater.href = trackingUrl(token);
    if (copyLink) copyLink.hidden = false;
    scheduleRefresh(order);

    try {
      localStorage.setItem('navoryxLastOrder', trackingUrl(token));
      if (approved) {
        const attempt = JSON.parse(localStorage.getItem('navoryxPaymentCart') || 'null');
        if (attempt && attempt.cart === localStorage.getItem('navoryxCart')) {
          localStorage.removeItem('navoryxCart');
          localStorage.removeItem('navoryxShipping');
        }
        localStorage.removeItem('navoryxPaymentCart');
      }
    } catch (_) {
      /* A consulta funciona também sem armazenamento local. */
    }
  }

  async function update(cancelar = false) {
    if (busy) return;
    if (autoTimer && typeof clearTimeout === 'function') clearTimeout(autoTimer);
    autoTimer = null;
    if (!/^[a-f0-9]{64}$/.test(token || '')) {
      setIdleState('Informe o link ou o código do pedido para consultar.');
      return;
    }
    busy = true;
    if (button) button.disabled = true;
    if (cancel) cancel.disabled = true;
    if (cancelar) {
      message.textContent = 'Cancelando o pedido...';
      if (cancel) cancel.textContent = 'Cancelando...';
    }
    try {
      const response = await fetch(API_BASE + '/pedidos/acompanhar/' + token + (cancelar ? '/cancelar' : ''), {
        ...(cancelar ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true }) } : {}),
        signal: AbortSignal.timeout(60000)
      });
      const order = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(order.erro || 'Não foi possível atualizar. Tente novamente em instantes.');
      render(order);
      if (history.replaceState && form) history.replaceState(null, '', '?pedido=' + encodeURIComponent(token));
    } catch (e) {
      if (!cancelar) {
        title.textContent = form ? 'Não encontramos esse pedido' : 'Acompanhamento do pedido';
        icon.textContent = '⏳';
        if (cancel) cancel.hidden = true;
      }
      message.textContent = e.name === 'TimeoutError' ? 'A consulta demorou. Atualize o status para conferir o resultado antes de tentar novamente.' : e.message;
    } finally {
      busy = false;
      if (button) button.disabled = false;
      if (cancel) cancel.disabled = false;
    }
  }

  form?.addEventListener('submit', event => {
    event.preventDefault();
    token = extractToken(input?.value || '');
    if (!token) {
      setIdleState('Não reconheci esse código. Cole o link completo do pedido ou o código de 64 caracteres.');
      return;
    }
    update();
  });

  button?.addEventListener('click', () => update());
  cancel?.addEventListener('click', () => {
    if (!busy) update(true);
  });
  copyLink?.addEventListener('click', async () => {
    if (!/^[a-f0-9]{64}$/.test(token || '')) return;
    try {
      await navigator.clipboard.writeText(trackingUrl(token));
      copyLink.textContent = 'Link copiado';
      setTimeout(() => { copyLink.textContent = 'Copiar link'; }, 1400);
    } catch (_) {
      copyLink.textContent = 'Copie pela barra do navegador';
    }
  });

  try {
    const saved = localStorage.getItem('navoryxLastOrder');
    if (lastOrder && saved) {
      lastOrder.href = saved;
      lastOrder.hidden = false;
    }
  } catch (_) {}

  if (input && token) input.value = trackingUrl(token);
  if (/^[a-f0-9]{64}$/.test(token || '')) update();
  else setIdleState(form ? undefined : 'Use o link de acompanhamento do seu pedido para consultar ou cancelar.');
})();
