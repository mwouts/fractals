const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const workerCode=html.slice(html.indexOf('function cpuWorker()'),html.indexOf('const workerURL='));
function render(s,index,w,h,extra={}){
 const frames=[],box={performance,postMessage:d=>frames.push(d)};
 vm.createContext(box);vm.runInContext(workerCode+'cpuWorker()',box);
 box.onmessage({data:{w,h,index,s,...extra}});return frames;
}
const base={m:[-.5,0,3.6],j:[0,0,3.6],c:[-.12,.74],p:['#171f52','#b77bf1','#79f2bd'],t:28,i:512,degree:3,memory:-.5,nc:'flow'};
for(const family of ['mandelbrot','ship','multibrot','phoenix','newton'])for(const index of [0,1]){
 const s={...base,family},w=97,h=73;
 const expected=render(s,index,w,h).at(-1),frames=render(s,index,w,h,{progressive:true});
 assert.deepEqual(frames.map(f=>f.step),[64,32,16,8,4,2,1]);
 assert.deepEqual(Buffer.from(frames.at(-1).pixels),Buffer.from(expected.pixels));
 assert.equal(frames.at(-1).completed,w*h,'Each pixel calculated once across all passes');
 for(const frame of frames)for(let y=0;y<frame.h;y++)for(let x=0;x<frame.w;x++){
  const off=(y*frame.w+x)*4,ref=(y*frame.step*w+x*frame.step)*4;
  assert.deepEqual(Buffer.from(frame.pixels.subarray(off,off+4)),Buffer.from(expected.pixels.subarray(ref,ref+4)),'Preview uses final pixel coordinates and iteration limit');
 }
}
// Exercise actual renderer cache mapping and invalidation with a synchronous worker double.
const requests=[],jobs=[],timers=new Map();let timer=0,frameLimit=Infinity;
const ctx={putImageData(){},drawImage(){}},canvas={width:97,height:73,closest:()=>null,getContext:()=>ctx,setAttribute(){},removeAttribute(){}};
const box={performance,workerURL:'test',ImageData:class{},tr:k=>k,setTimeout(fn){timers.set(++timer,fn);return timer},clearTimeout:id=>timers.delete(id),document:{createElement:()=>({getContext:()=>ctx})},Worker:class{
 constructor(){jobs.push(this)}terminate(){}postMessage(d){requests.push(d);const frames=render(d.s,d.index,d.w,d.h,d);this.frames=frames;for(const f of frames.slice(0,frameLimit))this.onmessage({data:f})}
}};
vm.createContext(box);vm.runInContext(html.slice(html.indexOf('function cpuRenderer('),html.indexOf('function renderer(')),box);
(async()=>{
 const r=box.cpuRenderer(canvas),s={...base,family:'mandelbrot',m:[-.5,.123,3.6]};
 await r.draw(0,s);assert.equal(jobs.at(-1).frames.at(-1).completed,97*73);
 await r.draw(0,s);assert.equal(jobs.at(-1).frames.at(-1).completed,0);
 for(const [dx,dy] of [[4,-3],[-5,2]]){
  const moved={...s,m:[s.m[0]+dx*s.m[2]/97,s.m[1]-dy*s.m[2]/97,s.m[2]]};
  await r.draw(0,moved);
  const result=jobs.at(-1).frames.at(-1);
  // The prior viewport is s for the first pan; use a fresh full render to check the image.
  const expected=render(moved,0,97,73).at(-1);
  assert.deepEqual(Buffer.from(result.pixels),Buffer.from(expected.pixels));
  if(dx===4)assert.equal(result.completed,97*73-(97-4)*(73-3));
 }
 const fractional={...s,m:[s.m[0]+.5*s.m[2]/97,s.m[1],s.m[2]]};await r.draw(0,fractional);assert.equal(jobs.at(-1).frames.at(-1).completed,97*73);
 await r.draw(0,{...fractional,i:1024});assert.equal(jobs.at(-1).frames.at(-1).completed,97*73);
 // Preserve only delivered samples if a progressive render is interrupted.
 frameLimit=3;const pending=r.draw(0,{...s,i:2048});const partial=jobs.at(-1).frames.slice(0,3).at(-1);
 r.dispose();assert.equal(await pending,false);
 frameLimit=Infinity;await r.draw(0,{...s,i:2048});
 assert.equal(jobs.at(-1).frames.at(-1).completed,97*73-partial.w*partial.h);
 r.dispose();console.log('PASS: nested full-iteration previews, no duplicate calculations, pan reuse, fractional pan and settings invalidation');
})().catch(e=>{console.error(e);process.exitCode=1});
