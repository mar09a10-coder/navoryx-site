'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','acompanhar-pedido.js'),'utf8');
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
function element(){return {hidden:true,disabled:false,textContent:'',children:[],events:{},addEventListener(k,f){this.events[k]=f;},replaceChildren(){this.children=[];},appendChild(c){this.children.push(c);}};}
async function page(order) {
 const nodes=Object.fromEntries(['statusTitle','statusMessage','statusIcon','orderTracking','refreshOrder','cancelOrder','trackLaterLink','copyTrackingLink'].map(k=>[k,element()]));
 const memory=new Map([['navoryxCart','novo carrinho']]),calls=[],state={order};
 const context={URLSearchParams,AbortSignal,Date,JSON,document:{getElementById:k=>nodes[k],createElement:element},
 window:{location:{search:'?pedido='+'a'.repeat(64),href:'https://navoryx-site.onrender.com/retorno.html?pedido='+'a'.repeat(64),origin:'https://navoryx-site.onrender.com'},history:{replaceState(){}}},
 localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
 fetch:async(url,options)=>{calls.push({url,options});if(options.method==='POST'){if(state.error)throw state.error;state.order={...state.order,order_status:'cancelled',can_cancel:false};}return {ok:true,json:async()=>state.order};}};
 vm.runInNewContext(source,context);await settle();return {nodes,memory,calls,state};
}
const order={id:'11111111-1111-4111-8111-111111111111',payment_status:'pending',order_status:'waiting',can_cancel:true,tracking:[]};
test('cliente cancela sem popup; carrinho atual permanece e botão desaparece',async()=>{
 const p=await page(order);assert.equal(p.nodes.cancelOrder.hidden,false);
 p.nodes.cancelOrder.events.click();await settle();
 assert.equal(p.calls[1].options.method,'POST');assert.equal(JSON.parse(p.calls[1].options.body).confirmed,true);
 assert.equal(p.nodes.statusTitle.textContent,'Pedido cancelado');assert.equal(p.nodes.cancelOrder.hidden,true);assert.equal(p.memory.get('navoryxCart'),'novo carrinho');
});
test('link para rastrear depois preserva o token do pedido',async()=>{
 const p=await page(order);assert.match(p.nodes.trackLaterLink.href,/rastrear\.html\?pedido=a{64}$/);assert.equal(p.nodes.copyTrackingLink.hidden,false);
});
test('pedido pago e pagamento em análise não mostram cancelamento; pagamento aprovado conserva um novo carrinho',async()=>{
 for(const status of ['approved','in_process']) {const p=await page({...order,payment_status:status,can_cancel:false});assert.equal(p.nodes.cancelOrder.hidden,true);assert.equal(p.memory.get('navoryxCart'),'novo carrinho');}
});
test('timeout de cancelamento não exibe sucesso nem trava a consulta',async()=>{
 const p=await page(order);p.state.error=Object.assign(Error('timeout'),{name:'TimeoutError'});p.nodes.cancelOrder.events.click();await settle();
 assert.equal(p.nodes.statusTitle.textContent,'Aguardando pagamento');assert.match(p.nodes.statusMessage.textContent,/conferir o resultado/);assert.equal(p.nodes.refreshOrder.disabled,false);
});
