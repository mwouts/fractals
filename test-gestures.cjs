const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const code=html.slice(html.indexOf('canvases.forEach((c,i)=>{\n const k='),html.indexOf('function fullLabels()'));
function setup(native=true,width=600,height=500){
 const state={m:[0,0,3.6],j:[0,0,3.6],c:[.2,.3],family:'mandelbrot'},nodes={cross:{style:{}},stat0:{},stat1:{}},transforms=[];
 const ctx={save(){},restore(){},fillRect(){},setTransform(...v){transforms.push(v)},drawImage(){}};
 const planes=[0,1].map(i=>({r:{left:100+i*700,top:50,width,height},handlers:{},getBoundingClientRect(){return this.r},append(){},addEventListener(t,f){this.handlers[t]=f}}));
 nodes.cross.parentElement=planes[0];
 const canvases=planes.map(p=>({width,height,closest:()=>p,getBoundingClientRect:()=>p.r,getContext:()=>ctx,setPointerCapture(){},addEventListener(){},classList:{remove(){},toggle(){}}}));
 const sandbox={state,canvases,window:native?{ontouchstart:null}:{},document:{createElement:()=>({style:{},getContext:()=>ctx})},activeGestures:new Set(),renderers:[{dispose(){}},{dispose(){}}],lastRender:['',''],$:id=>nodes[id],flushHistory(){},locale:()=> 'en',change(){},draw(){},notice(){},zoom(){}};
 vm.createContext(sandbox);const cross=html.slice(html.indexOf('function updateCross()'),html.indexOf('function draw()'));const coordinates=html.slice(html.indexOf('function position('),html.indexOf('function point('));vm.runInContext(cross+coordinates+code,sandbox);
 const t=(id,x,y)=>({identifier:id,clientX:x,clientY:y});
 const send=(i,type,current,changed)=>planes[i].handlers[type]({target:{closest:()=>null},touches:current,changedTouches:changed,cancelable:true,preventDefault(){}});
 return {state,nodes,sandbox,send,t,canvases,transforms};
}
for(const i of [0,1]){
 const {state,nodes,sandbox,send,t}=setup(),k=i?'j':'m',offset=i*700;
 const start=[t(1,300+offset,300),t(2,500+offset,300)],end=[t(1,200+offset,300),t(2,600+offset,300)];
 send(i,'touchstart',[start[0]],[start[0]]);send(i,'touchstart',start,[start[1]]);send(i,'touchmove',end,end);
 assert.equal(state[k][2],1.8);assert.equal(state[k][0],0);assert.deepEqual(state.c,[.2,.3]);
 if(i===0){assert.ok(Math.abs(parseFloat(nodes.cross.style.left)-(50+.2/1.8*100))<1e-10);assert.ok(Math.abs(parseFloat(nodes.cross.style.top)-30)<1e-10)}
 send(i,'touchend',[end[0]],[end[1]]);send(i,'touchend',[],[end[0]]);
 assert.equal(state[k][2],1.8);assert.deepEqual(state.c,[.2,.3]);assert.equal(sandbox.activeGestures.size,0);
 // Off-center pinch, then pan with the remaining finger.
 send(i,'touchstart',start,start);const wide=[start[0],t(2,700+offset,300)];send(i,'touchmove',wide,wide);send(i,'touchend',[wide[0]],[wide[1]]);
 const moved=t(1,360+offset,350);send(i,'touchmove',[moved],[moved]);send(i,'touchend',[],[moved]);
 assert.ok(Math.abs(state[k][0]+.24)<1e-12);assert.ok(Math.abs(state[k][1]-.075)<1e-12);assert.deepEqual(state.c,[.2,.3]);
 send(i,'touchstart',start,start);send(i,'touchcancel',[],start);assert.equal(sandbox.activeGestures.size,0);
}
for(const i of [0,1]){
 const {state,canvases}=setup(),c=canvases[i],offset=i*700,k=i?'j':'m';
 const e=(x,y,shiftKey=false)=>({pointerType:'mouse',isPrimary:true,button:0,pointerId:1,clientX:x+offset,clientY:y,shiftKey});
 c.onpointerdown(e(250,175));c.onpointermove(e(550,425));c.onpointerup(e(550,425));assert.equal(state[k][2],1.8);assert.equal(state[k][0],0);assert.deepEqual(state.c,[.2,.3]);
 c.onpointerdown(e(300,300,true));c.onpointermove(e(360,350,true));c.onpointerup(e(360,350,true));assert.ok(Math.abs(state[k][0]+.18)<1e-12);assert.ok(Math.abs(state[k][1]-.15)<1e-12);
}
{
 const {state,nodes,send,t}=setup(true,390,844);
 const start=[t(1,180,400),t(2,340,400)],end=[t(1,140,500),t(2,380,500)];
 send(0,'touchstart',start,start);send(0,'touchmove',end,end);send(0,'touchend',[],end);
 assert.equal(state.m[2],2.4);
 assert.ok(Math.abs(state.m[1]-326.4/390)<1e-12);
 assert.ok(Math.abs(parseFloat(nodes.cross.style.top)-(50-(.3-state.m[1])/(2.4*844/390)*100))<1e-10);
}
console.log('PASS: both panels pinch and release, off-center anchor, remaining-finger pan, cancellation, actual pin coordinates, mouse rectangle and Shift-pan');
