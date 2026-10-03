'use strict';
(() => {
  const token=new URLSearchParams(window.location.search).get('pedido');
  const title=document.getElementById('statusTitle'),message=document.getElementById('statusMessage'),icon=document.getElementById('statusIcon');
  const list=document.getElementById('orderTracking'),button=document.getElementById('refreshOrder'),cancel=document.getElementById('cancelOrder');
  const statuses={pending:'Aguardando pagamento',in_process:'Pagamento em análise',authorized:'Pagamento em análise',approved:'Pagamento aprovado',rejected:'Pagamento recusado',cancelled:'Pagamento cancelado',refunded:'Pagamento devolvido',charged_back:'Pagamento contestado',review:'Pagamento em conferência'};
  const shipping={pending:'Envio em preparação',paid:'Envio em preparação',generated:'Etiqueta pronta',printed:'Aguardando postagem',posted:'Postado',released:'Em transporte',delivered:'Entregue',cancelled:'Envio cancelado'};
  let busy=false;
  function render(order) {
    const approved=order.payment_status==='approved',closed=['expired','cancelled'].includes(order.order_status);
    icon.textContent=approved?'✅':closed?'○':'⏳';
    title.textContent=order.order_status==='expired'?'Pedido expirado':order.order_status==='cancelled'?'Pedido cancelado':statuses[order.payment_status]||'Conferindo pagamento';
    message.textContent=approved?`Pedido ${order.id.slice(0,8).toUpperCase()} confirmado. Guarde este link para acompanhar a postagem e o rastreamento.`:
      closed?'Esta tentativa foi encerrada. Para comprar, volte à loja e faça um novo pedido.':
      order.cancellation_pending?'Seu cancelamento foi solicitado e aguarda confirmação. Atualize o status antes de iniciar outro pagamento.':
      'Seu pedido ainda não está confirmado. Você pode atualizar o status ou cancelar enquanto o pagamento não estiver aprovado ou em análise.';
    cancel.hidden=!order.can_cancel;cancel.textContent=order.cancellation_pending?'Concluir cancelamento':'Cancelar pedido sem pagamento';
    list.replaceChildren();
    if(!approved && !closed) {
      const deadline=order.payment_due_at || order.payment_expires_at;
      if(deadline && Number.isFinite(Date.parse(deadline))) {
        const p=document.createElement('p');p.textContent=(order.payment_due_at?'Prazo do pagamento: ':'Prazo para iniciar o pagamento: ')+new Date(deadline).toLocaleString('pt-BR');list.appendChild(p);
      }
    }
    for(const [i,t] of (order.tracking||[]).entries()) {
      const p=document.createElement('p');p.textContent=`Pacote ${i+1}: ${shipping[t.status]||'Em preparação'}`+(t.code?` · Rastreio: ${t.code}`:'');list.appendChild(p);
      if(t.code) {const a=document.createElement('a');a.href='https://rastreamento.correios.com.br/app/index.php';a.textContent='Consultar nos Correios';a.target='_blank';a.rel='noopener noreferrer';list.appendChild(a);}
    }
    try {
      localStorage.setItem('navoryxLastOrder',window.location.href);
      if(approved) {
        const attempt=JSON.parse(localStorage.getItem('navoryxPaymentCart')||'null');
        if(attempt && attempt.cart===localStorage.getItem('navoryxCart')) {localStorage.removeItem('navoryxCart');localStorage.removeItem('navoryxShipping');}
        localStorage.removeItem('navoryxPaymentCart');
      }
    } catch (_) { /* A consulta funciona também sem armazenamento local. */ }
  }
  async function update(cancelar=false) {
    if(busy)return;busy=true;button.disabled=true;cancel.disabled=true;
    try {
      if(!/^[a-f0-9]{64}$/.test(token||''))throw new Error('Use o link de acompanhamento do seu pedido para consultar ou cancelar.');
      const response=await fetch('https://navoryx-backend-2.onrender.com/pedidos/acompanhar/'+token+(cancelar?'/cancelar':''),{
        ...(cancelar?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true})}:{}),signal:AbortSignal.timeout(60000)
      });
      const order=await response.json().catch(()=>({}));if(!response.ok)throw new Error(order.erro||'Não foi possível atualizar. Tente novamente em instantes.');
      render(order);
    } catch(e) {
      if(!cancelar) {title.textContent='Acompanhamento do pedido';icon.textContent='⏳';cancel.hidden=true;}
      message.textContent=e.name==='TimeoutError'?'A consulta demorou. Atualize o status para conferir o resultado antes de tentar novamente.':e.message;
    } finally {busy=false;button.disabled=false;cancel.disabled=false;}
  }
  button.addEventListener('click',()=>update());
  cancel.addEventListener('click',()=>{if(!busy && window.confirm('Cancelar este pedido ainda não pago? Para comprar depois, será necessário fazer um novo pedido.'))update(true);});
  update();
})();
