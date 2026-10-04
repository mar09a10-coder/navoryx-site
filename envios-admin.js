'use strict';
(() => {
  const form = document.getElementById('melhorEnvioForm');
  const status = document.getElementById('melhorEnvioStatus');
  const message = document.getElementById('melhorEnvioMessage');
  const list = document.getElementById('shippingOrders');
  const orderMessage = document.getElementById('shippingOrdersMessage');
  const filter = document.getElementById('ordersFilter'),counts = document.getElementById('ordersCounts');
  const senderFields = ['nome','documento','inscricao_estadual','email','telefone','cep','endereco','numero','complemento','bairro','cidade','estado'];
  let orders = [], page = 0, busy = false, sessionGeneration = 0, pendingBuyConfirmation = null;
  const statuses = {pending:'Aguardando pagamento',approved:'Pagamento aprovado',in_process:'Pagamento em análise',rejected:'Pagamento recusado',cancelled:'Pagamento cancelado',refunded:'Pagamento devolvido',charged_back:'Pagamento contestado',review:'Pagamento exige conferência',paid:'Frete comprado',generated:'Etiqueta gerada',printed:'Etiqueta impressa',posted:'Postado',released:'Em transporte',delivered:'Entregue'};
  async function shippingApi(path, options = {}) {
    const response = await fetch(API_BASE + path, {...options,headers:authHeaders(),signal:AbortSignal.timeout(60000)});
    const data = await response.json().catch(() => ({}));
    if(response.status===401){logout();throw new Error('Sessão expirada. Entre novamente.');}
    if(!response.ok)throw new Error(data.erro || 'Não foi possível concluir a operação. Atualize o pedido para conferir o resultado.');
    return data;
  }
  async function loadConfig() {
    const generation = sessionGeneration;
    status.textContent='Verificando conexão…';
    try {
      const c=await shippingApi('/admin/melhorenvio');if(generation!==sessionGeneration)return;
      status.textContent=c.connected?'Token cadastrado. Fretes sujeitos à disponibilidade da conta.':'Conecte sua conta para liberar o cálculo de frete.';
      senderFields.forEach(k=>form.elements.namedItem(k).value=c.remetente[k]|| (k==='cep'?c.origem:''));
      form.elements.namedItem('token').value='';
    }catch(e){status.textContent=e.message;}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('[type="submit"]');if(button.disabled)return;
    button.disabled=true;message.textContent='Validando a conexão e salvando o remetente…';message.className='admin-message';
    try{
      const remetente=Object.fromEntries(senderFields.map(k=>[k,form.elements.namedItem(k).value.trim()]));remetente.estado=remetente.estado.toUpperCase();
      await shippingApi('/admin/melhorenvio',{method:'PUT',body:JSON.stringify({token:form.elements.namedItem('token').value.trim(),remetente})});
      form.elements.namedItem('token').value='';message.textContent='Melhor Envio conectado e remetente salvo. Cadastre a embalagem de cada produto para liberar as cotações.';
      carregarOrigemFrete();await loadConfig();
    }catch(e){message.textContent=e.message;message.className='admin-message error';}finally{button.disabled=false;}
  });
  function abrirEtiqueta(url) {
    const link=document.createElement('a');
    link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Abrir etiqueta para imprimir';link.className='admin-secondary';
    const opened=window.open(url,'_blank','noopener,noreferrer');
    orderMessage.replaceChildren(link);
    if(!opened)orderMessage.prepend(document.createTextNode('O navegador bloqueou a abertura automática. '));
  }
  async function acaoPedido(id, action, body = {}) {
    return shippingApi('/admin/pedidos/'+id+'/'+action,{method:'POST',body:JSON.stringify(body)});
  }
  function textoBotaoEtiqueta(order, count, pending, paid, generated) {
    if(pendingBuyConfirmation?.id===order.id)return 'Confirmar compra e imprimir etiqueta';
    if(generated)return 'Imprimir etiqueta';
    if(paid)return 'Gerar e imprimir etiqueta';
    if(pending)return 'Comprar e imprimir etiqueta';
    if(count)return 'Continuar e imprimir etiqueta';
    return 'Preparar e imprimir etiqueta';
  }
  async function executarFluxoEtiqueta(order, invoice) {
    let atual=order;
    const id=order.id;
    while(atual.labels.length<atual.package_count){
      orderMessage.textContent=`Preparando pacote ${atual.labels.length+1}/${atual.package_count}...`;
      atual=await acaoPedido(id,'prepare',{invoice});
      orders=orders.map(o=>o.id===id?atual:o);render();
    }
    if(atual.labels.some(l=>l.status==='pending')){
      const total=atual.pending_cost_cents||atual.labels.filter(l=>l.status==='pending').reduce((s,l)=>s+(Number(l.cost_cents)||0),0);
      if(pendingBuyConfirmation?.id!==id || pendingBuyConfirmation?.total!==total){
        pendingBuyConfirmation={id,total};
        orderMessage.textContent=`Envio preparado. Para comprar o frete por ${formatarPreco(total/100)} e imprimir, clique em Confirmar compra e imprimir etiqueta.`;
        orders=orders.map(o=>o.id===id?atual:o);render();
        return atual;
      }
      pendingBuyConfirmation=null;
      orderMessage.textContent='Comprando frete no Melhor Envio...';
      atual=await acaoPedido(id,'buy',{confirmedCents:total});
      orders=orders.map(o=>o.id===id?atual:o);render();
      if(atual.labels.some(l=>l.status==='pending')){
        orderMessage.textContent='A compra do frete está processando. Clique em Conferir pagamento e rastreio ou tente imprimir novamente em alguns instantes.';
        return atual;
      }
    }
    if(atual.labels.some(l=>l.status==='paid')){
      orderMessage.textContent='Gerando etiqueta...';
      atual=await acaoPedido(id,'generate');
      orders=orders.map(o=>o.id===id?atual:o);render();
    }
    const pronta=atual.labels.length===atual.package_count && atual.labels.every(l=>['generated','printed','posted','released','delivered'].includes(l.status));
    if(!pronta){
      orderMessage.textContent='A etiqueta ainda não ficou pronta para impressão. Confira o pedido novamente em alguns instantes.';
      return atual;
    }
    orderMessage.textContent='Abrindo etiqueta para imprimir...';
    atual=await acaoPedido(id,'print');
    orders=orders.map(o=>o.id===id?atual:o);render();
    if(atual.url)abrirEtiqueta(atual.url);
    return atual;
  }
  function render() {
    list.innerHTML=orders.length?orders.map(order=>{
      const c=order.customer,approved=order.payment_status==='approved',count=order.labels.length;
      const generated=count===order.package_count && order.labels.every(l=>['generated','printed','posted','released','delivered'].includes(l.status));
      const pending=order.labels.some(l=>l.status==='pending'),paid=order.labels.some(l=>l.status==='paid');
      const labelFlowText=textoBotaoEtiqueta(order,count,pending,paid,generated);
      return `<article class="admin-card shipping-order" data-order="${escapeHtml(order.id)}">
        <div class="admin-toolbar"><h3>Pedido ${escapeHtml(order.id.slice(0,8).toUpperCase())}</h3><strong>${escapeHtml(order.order_status==='expired'?'Pedido expirado':order.order_status==='cancelled'?'Pedido cancelado':statuses[order.payment_status]||order.payment_status)}</strong></div>
        ${order.cancellation_pending?'<p class="admin-message">Cancelamento solicitado; aguardando confirmação. Confira o pagamento para atualizar.</p>':''}
        ${order.late_payment?'<p class="admin-message error">Pagamento confirmado após o encerramento da tentativa. Confira este pedido antes de enviar.</p>':''}
        ${order.is_test_order?'<p class="admin-message">🧪 Pedido teste — não entra no resumo financeiro.</p>':''}
        <p>${escapeHtml(new Date(order.created_at).toLocaleString('pt-BR'))} · ${escapeHtml(c.nome)}</p>
        <p>${order.items.map(i=>`${i.quantity} × ${escapeHtml(i.title)}`).join('<br>')}</p>
        <p>${escapeHtml(c.endereco)}, ${escapeHtml(c.numero)} ${escapeHtml(c.complemento)}<br>${escapeHtml(c.bairro)} · ${escapeHtml(c.cidade)}/${escapeHtml(c.estado)} · CEP ${escapeHtml(c.cep)}</p>
        <p>${escapeHtml(order.shipping_method)} · Frete pago pelo cliente: <strong>${formatarPreco(order.shipping_price)}</strong> · Total: <strong>${formatarPreco(order.total)}</strong></p>
        <p>${count}/${order.package_count} pacote(s) preparado(s). Embale cada unidade separadamente, como cadastrado no produto.</p>
        ${order.labels.map((l,i)=>`<p>Pacote ${i+1}: ${escapeHtml(statuses[l.status]||l.status)} ${l.tracking?`· Rastreio: <strong>${escapeHtml(l.tracking)}</strong>`:''} ${l.protocol?`· Protocolo: ${escapeHtml(l.protocol)}`:''}<br><small>ID: ${escapeHtml(l.id)}</small></p>`).join('')}
        ${count<order.package_count?`<div class="admin-field"><label>Chave da NF-e, se tiver<input data-invoice value="${escapeHtml(order.invoice)}" inputmode="numeric" maxlength="44" placeholder="Deixe em branco para declaração" ${count?'readonly':''}></label><small class="admin-preview-note">Use NF-e quando houver obrigação fiscal. Sem chave, o envio será preparado como declaração de conteúdo.</small></div>`:''}
        ${order.shipment_status==='cart_uncertain'?`<p class="admin-message error">Confira o carrinho no Melhor Envio. A criação ficou sem confirmação; vincule a etiqueta existente para continuar.</p><div class="admin-field"><label>ID da etiqueta existente<input data-recover placeholder="ID da etiqueta no Melhor Envio"></label></div>`:''}
        ${order.purchase_uncertain?'<p class="admin-message error">A compra de frete aguarda confirmação. Confira a carteira no Melhor Envio e atualize este pedido.</p>':''}
        <div class="admin-actions">
          <button class="admin-secondary" data-action="refresh" type="button">Conferir pagamento e rastreio</button>
          <button class="admin-secondary" data-action="test" type="button">${order.is_test_order?'Contar no financeiro':'Marcar como pedido teste'}</button>
          ${order.can_cancel?'<button class="admin-secondary" data-action="cancel" type="button">'+(order.cancellation_pending?'Concluir cancelamento':'Cancelar pedido sem pagamento')+'</button>':''}
          ${approved && order.shipment_status!=='cart_uncertain'?`<button class="product-buy-button" data-action="labelFlow" type="button">${labelFlowText}</button>`:''}
          ${approved && order.shipment_status==='cart_uncertain'?'<button class="admin-secondary" data-action="recover" type="button">Vincular etiqueta existente</button>':''}
          <a class="admin-secondary" href="https://melhorenvio.com.br" target="_blank" rel="noopener noreferrer">Abrir Melhor Envio</a>
        </div>
      </article>`;
    }).join(''):'<p>Nenhum pedido nesta categoria. Use o filtro acima para consultar os outros status.</p>';
    document.getElementById('ordersPrevious').disabled=page===0;
    document.getElementById('ordersPage').textContent='Página ' + (page+1);
  }
  async function loadOrders() {
    if(busy)return;busy=true;filter.disabled=true;const generation=sessionGeneration;
    orderMessage.textContent='Carregando pedidos…';
    try{const r=await shippingApi('/admin/pedidos?page='+page+'&status='+filter.value);if(generation!==sessionGeneration)return;
      orders=r.orders;render();document.getElementById('ordersNext').disabled=!r.hasMore;
      counts.textContent=`${r.counts?.paid||0} pagos · ${r.counts?.waiting||0} aguardando / em análise · ${r.counts?.closed||0} encerrados`;
      orderMessage.textContent='O envio é liberado após a confirmação do pagamento. Tentativas abandonadas são encerradas automaticamente; Pix e boletos ativos respeitam o status do Mercado Pago.';
    }catch(e){orderMessage.textContent=e.message;}finally{busy=false;filter.disabled=false;}
  }
  list.addEventListener('click',async event=>{
    const button=event.target.closest('[data-action]');if(!button || busy)return;
    const card=button.closest('[data-order]'),id=card.dataset.order,action=button.dataset.action;
    const order=orders.find(o=>o.id===id);const body={};
    if(action==='test') {
      body.isTest=!order.is_test_order;
      button.textContent=body.isTest?'Marcando…':'Atualizando…';
    }
    if(action==='cancel') {
      body.confirmed=true;
      button.textContent='Cancelando…';
    }
    if(action==='prepare' || action==='labelFlow'){
      const invoiceField=card.querySelector('[data-invoice]');
      body.invoice=invoiceField?invoiceField.value.replace(/\D/g,''):(order.invoice||'');
      if(body.invoice && !/^\d{44}$/.test(body.invoice)){orderMessage.textContent='A chave da NF-e precisa ter 44 números. Para declaração, deixe o campo em branco.';return;}
      button.textContent=action==='labelFlow'?'Processando etiqueta...':'Preparando...';
    }
    if(action==='recover')body.labelId=card.querySelector('[data-recover]').value.trim();
    if(action==='buy'){
      if(!window.confirm(`Comprar as etiquetas por ${formatarPreco(order.pending_cost_cents/100)} usando o saldo da carteira do Melhor Envio?`))return;
      body.confirmedCents=order.pending_cost_cents;
    }
    if(action==='print')button.textContent='Abrindo etiqueta...';
    busy=true;filter.disabled=true;list.querySelectorAll('button').forEach(b=>b.disabled=true);const generation=sessionGeneration;
    orderMessage.textContent=action==='labelFlow'?'Preparando a etiqueta até a impressão…':action==='prepare'?'Preparando os pacotes…':action==='print'?'Abrindo a etiqueta para impressão…':action==='cancel'?'Cancelando pedido e liberando a reserva de estoque…':action==='test'?(body.isTest?'Marcando pedido como teste…':'Voltando a contar o pedido no financeiro…'):'Processando. Aguarde a confirmação…';
    let result;
    try{
      if(action==='labelFlow'){
        result=await executarFluxoEtiqueta(order,body.invoice);
        return;
      }
      do{
        result=await shippingApi('/admin/pedidos/'+id+'/'+action,{method:'POST',body:JSON.stringify(body)});
        if(generation!==sessionGeneration)return;
        orderMessage.textContent=action==='prepare'?`${result.labels.length}/${result.package_count} pacotes preparados…`:action==='cancel'?(result.cancellation_pending?'Cancelamento solicitado. Tentando concluir automaticamente…':'Pedido cancelado. Reserva de estoque liberada.'):'Operação confirmada.';
      }while(action==='prepare' && result.labels.length<result.package_count);
      orders=orders.map(o=>o.id===id?result:o);render();
      if(result.url){abrirEtiqueta(result.url);}
      else if(action==='cancel') orderMessage.textContent=result.cancellation_pending?'Cancelamento solicitado. O sistema continuará tentando concluir automaticamente.':'Pedido cancelado. A reserva de estoque foi liberada.';
      else if(action==='test') orderMessage.textContent=result.is_test_order?'Pedido marcado como teste. Ele não entra mais no resumo financeiro.':'Pedido voltou a contar no resumo financeiro.';
      else orderMessage.textContent=action==='generate'?'Etiquetas geradas. Agora clique em Abrir etiqueta para imprimir.':'Pedido atualizado.';
    }catch(e){
      if(action==='labelFlow')pendingBuyConfirmation=null;
      const prefix=action==='labelFlow'?'Não foi possível preparar/imprimir a etiqueta: ':action==='cancel'?'Não foi possível confirmar o cancelamento agora. Tente novamente em alguns instantes. ':'';
      orderMessage.textContent=prefix+e.message;
      orderMessage.className='admin-message error';
      render();
    }
    finally{busy=false;filter.disabled=false;if(result && action==='cancel')loadOrders();}
  });
  document.getElementById('refreshOrders').addEventListener('click',loadOrders);
  filter.addEventListener('change',()=>{page=0;loadOrders();});
  document.getElementById('ordersPrevious').addEventListener('click',()=>{if(!busy&&page>0){page--;loadOrders();}});
  document.getElementById('ordersNext').addEventListener('click',()=>{if(!busy){page++;loadOrders();}});
  document.querySelector('.admin-tabs').addEventListener('click',e=>{if(e.target.closest('[data-tab="shipping"]')){loadConfig();loadOrders();}});
  document.addEventListener('navoryx:login',()=>{sessionGeneration++;loadConfig();});
  document.addEventListener('navoryx:logout',()=>{sessionGeneration++;orders=[];pendingBuyConfirmation=null;list.replaceChildren();form.reset();status.textContent='';message.textContent='';orderMessage.textContent='';});
  if(token())loadConfig();
})();
