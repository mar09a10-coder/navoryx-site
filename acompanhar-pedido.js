'use strict';
(() => {
  const params=new URLSearchParams(window.location.search),token=params.get('pedido');
  const title=document.getElementById('statusTitle'),message=document.getElementById('statusMessage'),icon=document.getElementById('statusIcon');
  const list=document.getElementById('orderTracking'),button=document.getElementById('refreshOrder');
  let busy=false;
  const statuses={pending:'Aguardando pagamento',in_process:'Pagamento em análise',approved:'Pagamento aprovado',rejected:'Pagamento recusado',cancelled:'Pagamento cancelado',refunded:'Pagamento devolvido',charged_back:'Pagamento contestado',review:'Pagamento em conferência'};
  const shipping={pending:'Envio em preparação',paid:'Envio em preparação',generated:'Etiqueta pronta',printed:'Aguardando postagem',posted:'Postado',released:'Em transporte',delivered:'Entregue',cancelled:'Envio cancelado'};
  async function update(){
    if(busy)return;busy=true;button.disabled=true;
    try{
      if(!/^[a-f0-9]{64}$/.test(token||''))throw new Error('Consulte o resultado no Mercado Pago. Para novos pedidos, o link de acompanhamento aparece ao retornar do pagamento.');
      const res=await fetch('https://navoryx-backend-2.onrender.com/pedidos/acompanhar/'+token,{signal:AbortSignal.timeout(60000)});
      const order=await res.json().catch(()=>({}));if(!res.ok)throw new Error(order.erro||'Não foi possível atualizar. Tente novamente em instantes.');
      const approved=order.payment_status==='approved';icon.textContent=approved?'✅':'⏳';title.textContent=statuses[order.payment_status]||'Conferindo pagamento';
      message.textContent=approved?`Pedido ${order.id.slice(0,8).toUpperCase()} confirmado. A entrega será feita pela transportadora. Guarde este link para acompanhar a postagem e o rastreamento.`:'O status foi consultado no Mercado Pago. Use o botão abaixo para conferir novas atualizações.';
      list.replaceChildren();
      for(const [i,t] of order.tracking.entries()){
        const p=document.createElement('p');p.textContent=`Pacote ${i+1}: ${shipping[t.status]||'Em preparação'}` + (t.code?` · Rastreio: ${t.code}`:'');list.appendChild(p);
        if(t.code){const a=document.createElement('a');a.href='https://rastreamento.correios.com.br/app/index.php';a.textContent='Consultar nos Correios';a.target='_blank';a.rel='noopener noreferrer';list.appendChild(a);}
      }
      if(approved){
        // Não apague um carrinho novo que o comprador montou depois de pagar.
        const attempt=JSON.parse(localStorage.getItem('navoryxPaymentCart')||'null');
        if(attempt && attempt.cart===localStorage.getItem('navoryxCart')){localStorage.removeItem('navoryxCart');localStorage.removeItem('navoryxShipping');}
        localStorage.removeItem('navoryxPaymentCart');
      }
    }catch(e){title.textContent='Acompanhamento do pedido';message.textContent=e.name==='TimeoutError'?'A consulta demorou. Tente atualizar em instantes.':e.message;icon.textContent='⏳';}
    finally{busy=false;button.disabled=false;}
  }
  button.addEventListener('click',update);update();
})();
