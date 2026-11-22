// Headless check: runs the sim block of village.html for N days and prints a compact summary.
// Usage: node tests/sim-check.js [village.html] [seed] [days]
const fs=require('fs'),vm=require('vm');
const file=process.argv[2]||'village.html', seed=process.argv[3]||'emberfall', DAYS=+process.argv[4]||15;
const html=fs.readFileSync(file,'utf8');
const code=html.match(/<script id="sim">([\s\S]*?)<\/script>/)[1];
const ctx=vm.createContext({});
vm.runInContext(code+'\n;globalThis.API={createSim,step,diaryFor,rumorClaim,describe,TPD,BASE};',ctx);
const A=ctx.API, S=A.createSim(seed);
let hungrySamples=0,samples=0,hungerSum=0; const lastAct=S.v.map(v=>v.act), since=S.v.map(()=>0), maxStay=S.v.map(()=>0);
const t0=Date.now();
for(let i=0;i<DAYS*A.TPD;i++){
  A.step(S);
  S.v.forEach((v,k)=>{ if(v.act!==lastAct[k]){lastAct[k]=v.act;since[k]=S.tick;} else if(v.act!=='sleep') maxStay[k]=Math.max(maxStay[k],S.tick-since[k]); });
  if(i%10===0) for(const v of S.v){samples++;hungerSum+=v.need.hunger;if(v.need.hunger>80)hungrySamples++;}
}
const cnt={};for(const e of S.log)cnt[e.type]=(cnt[e.type]||0)+1;
const ops=[];S.v.forEach(v=>v.op.forEach((o,j)=>{if(j!==v.id)ops.push(o);}));
const mean=ops.reduce((a,b)=>a+b,0)/ops.length, sd=Math.sqrt(ops.reduce((a,b)=>a+(b-mean)**2,0)/ops.length);
const feudPairs=S.v.reduce((n,v)=>n+v.feud.filter(Boolean).length,0);
console.log(`seed=${seed} days=${DAYS} ticks=${S.tick} time=${Date.now()-t0}ms log=${S.log.length}`);
console.log('events',JSON.stringify(cnt));
console.log(`opinion mean=${mean.toFixed(1)} sd=${sd.toFixed(1)} min=${Math.min(...ops).toFixed(0)} max=${Math.max(...ops).toFixed(0)} feuds-now=${feudPairs}`);
const rs=Object.values(S.rumors), all=S.log.filter(e=>e.type==='rumor');
console.log(`rumors alive=${rs.length} created=${S.rumorN} passes=${all.length} believed=${all.filter(e=>e.d.believed).length} mutated=${all.filter(e=>e.d.mut.length).length}`);
const byR={};for(const e of all)(byR[e.d.rid]=byR[e.d.rid]||[]).push(e);
const top=Object.entries(byR).sort((a,b)=>b[1].length-a[1].length)[0];
if(top){const o=S.log.filter(e=>e.type!=='rumor'&&e.type!=='work');const r=S.rumors[top[0]];
  console.log(`rumor #${top[0]} (${top[1].length} passes), versions:`);
  for(const e of top[1].slice(0,6))console.log(`  v${e.d.v} day${e.day} ${S.v[e.a].name}->${S.v[e.b].name} [${e.d.mut.join('/')||'as-is'}] ${A.rumorClaim(S,e.d)} | ${e.d.believed?'believed':'doubted'}`);
  const orig=S.log[top[1][0].d&&S.log.findIndex(x=>x.type!=='rumor'&&false)]; void orig; void o; void r;}
let shown=0;
for(let day=3;day<=DAYS&&shown<1;day++){const ds=S.v.map(v=>[v,A.diaryFor(S,v.id,day)]).filter(x=>x[1]);
  if(ds.length>=2){shown=1;console.log(`day ${day} diaries:`);for(const [v,t] of ds.slice(0,2))console.log(`  ${v.name} (${v.job}, ${v.traits.join('/')}): ${t.slice(0,420)}`);}}
const tot=k=>S.v.reduce((n,v)=>n+v.inv[k],0);
console.log(`economy made=${JSON.stringify(S.stats.made)} marketCoins=${S.stats.marketCoins} sold=${S.stats.sold} coinsHeld=${S.v.reduce((n,v)=>n+v.coins,0)} (min ${Math.min(...S.v.map(v=>v.coins))}, max ${Math.max(...S.v.map(v=>v.coins))})`);
console.log(`stock grain=${tot('grain')} bread=${tot('bread')} fish=${tot('fish')} meal=${tot('meal')} avgHunger=${(hungerSum/samples).toFixed(1)} starving%=${(100*hungrySamples/samples).toFixed(1)}`);
console.log('longest non-sleep stay (ticks):',maxStay.join(','));
console.log('mem sizes:',S.v.map(v=>v.mem.length).join(','),'bel sizes:',S.v.map(v=>Object.keys(v.bel).length).join(','));
