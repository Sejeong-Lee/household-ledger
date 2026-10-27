const vm=require('vm'),fs=require('fs');
const src=fs.readFileSync(__dirname+'/../src/Code.gs','utf8');
let pass=0,fail=0;const check=(n,ok,d)=>{ok?pass++:fail++;console.log((ok?'PASS ':'FAIL ')+n+(ok?'':'  → '+d))};
function mkEnv(o={}){
 const book={};const trig=[];let fetches=[];let nowMs=o.now||Date.parse('2026-10-26T04:00:00Z');
 const unq=v=>typeof v==='string'&&v[0]==="'"?v.slice(1):v;
 class Sheet{constructor(n,rows){this.n=n;this.d=rows.map(r=>r.slice());this.f={}}
  getLastRow(){return this.d.length}getLastColumn(){return this.d.reduce((m,r)=>Math.max(m,r.length),0)}
  getRange(r,c,nr=1,nc=1){const s=this;return{getValues:()=>{const out=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){const v=(s.d[r-1+i]||[])[c-1+j];row.push(v===undefined?'':v)}out.push(row)}return out},
   setValues:v=>{v.forEach((row,i)=>row.forEach((x,j)=>{const R=r-1+i;while(s.d.length<=R)s.d.push([]);while(s.d[R].length<c-1+j)s.d[R].push('');s.d[R][c-1+j]=unq(x)}))},
   setValue:x=>{const R=r-1;while(s.d.length<=R)s.d.push([]);while(s.d[R].length<c)s.d[R].push('');s.d[R][c-1]=unq(x)},
   getValue:()=>{const v=(s.d[r-1]||[])[c-1];if(s.f[r+','+c]&&o.fxLive){const k=s.f[r+','+c];return o.fxLive[k.match(/CURRENCY:(\w{3})SGD/)[1]]??'#N/A'}return v===undefined?'':v},
   getFormula:()=>s.f[r+','+c]||'',setFormula:f=>{s.f[r+','+c]=f;while(s.d.length<r)s.d.push([]);}}}
  setFrozenRows(){}deleteRow(i){this.d.splice(i-1,1)}}
 for(const [k,v] of Object.entries(o.book))book[k]=new Sheet(k,v);
 const ctx={console,Math,JSON,Number,String,Object,Array,isFinite,parseFloat,Date:class extends Date{constructor(...a){a.length?super(...a):super(nowMs)}static now(){return nowMs}},
  SpreadsheetApp:{openById:()=>({getSheetByName:n=>book[n]||null,insertSheet:n=>book[n]=new Sheet(n,[])}),flush(){}},
  Utilities:{formatDate:(d,tz,f)=>{const t=new Date(d.getTime()+8*3600e3).toISOString();const [Y,M,D]=[t.slice(0,4),t.slice(5,7),t.slice(8,10)];return f==='yyyy-MM'?`${Y}-${M}`:f==='yyyy-MM-dd'?`${Y}-${M}-${D}`:f==='d'?String(+D):f==='yyyy-MM-dd HH:mm'?`${Y}-${M}-${D} ${t.slice(11,16)}`:`${Y}-${M}-${D}T${t.slice(11,19)}`},sleep(){}},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  Session:{getActiveUser:()=>({getEmail:()=>o.email??'cyzhzzang@gmail.com'})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='ANTHROPIC_API_KEY'?'sk-test':null,setProperties(){},deleteProperty(){}})},
  UrlFetchApp:{fetch:(u,opt)=>{fetches.push(JSON.parse(opt.payload));return{getResponseCode:()=>200,getContentText:()=>JSON.stringify({content:[{type:'text',text:'[]'}],usage:{input_tokens:900,output_tokens:120}})}}},
  ScriptApp:{getProjectTriggers:()=>trig,deleteTrigger:t=>trig.splice(trig.indexOf(t),1),newTrigger:h=>{const t={h,getHandlerFunction:()=>h};const b={timeBased:()=>b,atHour:()=>b,nearMinute:()=>b,everyDays:()=>b,inTimezone:()=>b,after:()=>b,create:()=>{trig.push(t);return t}};return b}},
  HtmlService:{}};
 vm.createContext(ctx);vm.runInContext(src,ctx);return{ctx,book,fetches,trig,setNow:v=>nowMs=v}}
const SET=[['key','value','note'],['user_cyzhzzang@gmail.com','Sejeong'],['model_classify','claude-haiku-5-5'],['api_cap_usd','5'],['price_haiku_in','0.1'],['price_haiku_out','0.5']];
const RUNS=()=>[['run_at','type','range_covered','rows_added','rows_updated','by','notes']];
const TXH=['id','date','desc','sgd','cur','orig','account','card','owner','share','cat','sub','memo','month','source','posted','status','mcc','channel','ref'];
const RULES=[['key','cat','sub','share','memo','set_by','set_at','conf','note'],['re:^BUS/MRT','RIDE','Public transport','Owner','','seed','2026-10-26','high','x']];
(async()=>{
 // 1 access control
 let e=mkEnv({email:'stranger@x.com',book:{settings:SET,runs:RUNS(),rules:RULES}});
 let err;try{e.ctx.getBootstrap()}catch(x){err=x.message}
 check('unregistered Google account is rejected with a clear sentence',/not set up for this app/.test(err||''),err);
 // 2 cap guard + usage logging
 e=mkEnv({book:{settings:SET,runs:RUNS(),rules:RULES}});
 const r=e.ctx.callClaude('claude-haiku-5-5','sys','hello',100);
 check('callClaude sends the requested model & key, returns usage',e.fetches.length===1&&e.fetches[0].model==='claude-haiku-5-5'&&r.usage.input_tokens===900,JSON.stringify(e.fetches));
 const run=e.book.runs.d[1];console.log('   usage row:',JSON.stringify(run));
 check('usage row: type api_usage, 900/120 tokens, cost_usd=0.00015',run[1]==='api_usage'&&run[3]===900&&run[4]===120&&/cost_usd=0.00015/.test(run[6]),JSON.stringify(run));
 check('usage row records who (email) and month',run[5]==='cyzhzzang@gmail.com'&&String(run[2])==='2026-10',JSON.stringify(run));
 e=mkEnv({book:{settings:SET,runs:[...RUNS(),['x','api_usage',"2026-10",1,1,'a','model=m; cost_usd=5.0001']],rules:RULES}});
 err=null;try{e.ctx.callClaude('claude-haiku-5-5','s','h')}catch(x){err=x.message}
 check('over monthly cap: blocked BEFORE calling the API (no spend)',/limit reached/.test(err||'')&&e.fetches.length===0,err+' fetches='+e.fetches.length);
 e=mkEnv({book:{settings:SET,runs:[...RUNS(),['x','api_usage',"2026-09",1,1,'a','model=m; cost_usd=9']],rules:RULES}});
 err=null;try{e.ctx.callClaude('claude-haiku-5-5','s','h')}catch(x){err=x.message}
 check("last month's spend does not block this month",!err&&e.fetches.length===1,err);
 // 3 rules
 e=mkEnv({book:{settings:SET,runs:RUNS(),rules:RULES}});
 e.ctx.saveRule({key:'GRAB TRIP',cat:'RIDE',sub:'Taxi',share:'Owner',conf:'high'});
 e.ctx.saveRule({key:'GRAB TRIP',cat:'RIDE',sub:'Taxi',share:'Shared',conf:'high'});
 const rl=e.book.rules.d;console.log('   rules rows:',rl.length);
 check('saveRule upserts by exact key (no duplicate row), preset row untouched',rl.length===3&&rl[2][3]==='Shared'&&rl[1][0]==='re:^BUS/MRT'&&rl[1][5]==='seed',JSON.stringify(rl));
 check('saveRule writes 9 columns incl. set_by=email, set_at, conf',rl[2].length===9&&rl[2][5]==='cyzhzzang@gmail.com'&&/^2026-10-26T/.test(rl[2][6])&&rl[2][7]==='high',JSON.stringify(rl[2]));
 err=null;try{e.ctx.deleteRule('re:^BUS/MRT')}catch(x){err=x.message}
 check('deleteRule refuses preset (seed) rows',/Preset/.test(err||'')&&e.book.rules.d.length===3,err);
 check('deleteRule removes a learned rule',e.ctx.deleteRule('GRAB TRIP').ok&&e.book.rules.d.length===2,'');
 // 4 saveRows + reprice
 const row=(id,m,cur,orig,sgd,src,st)=>[id,m+'-05','D',sgd,cur,orig,'Indian CC','','Ankit','Shared','EAT','Dine out','',m,src,'',st,'','',''];
 e=mkEnv({book:{settings:SET,runs:RUNS(),rules:RULES,transactions:[TXH,
   row('A','2026-10','INR',1000,13.45,'ledger-v2','provisional'),row('B','2026-10','INR',2000,26.9,'ledger-v2','deleted'),
   row('C','2026-10','INR',1000,13.45,'ledger','final'),row('D','2026-10','SGD',10,10,'ledger-v2','provisional'),row('E','2026-09','INR',1000,13.31,'ledger-v2','provisional')],
   fx:[['month','currency','rate_to_sgd','note']]}});
 err=null;try{e.ctx.saveRows([[1,2,3]],{})}catch(x){err=x.message}
 check('saveRows rejects rows that are not 20 columns',/Bad row length/.test(err||''),err);
 const sv=e.ctx.saveRows([row('N1','2026-10','SGD',5,5,'ledger-v2','final')],{account:'OCBC',month:'2026-10',file:'a.csv'});
 check('saveRows appends and logs the upload in runs',sv.saved===1&&e.book.transactions.d.length===7&&e.book.runs.d.some(r=>/statement upload/.test(r[1])&&/OCBC/.test(r[6])&&/cyzhzzang/.test(r[6])),JSON.stringify(e.book.runs.d));
 err=null;try{e.ctx.saveFx('2026-10','INR',0)}catch(x){err=x.message}
 check('saveFx rejects a non-positive rate',/Invalid exchange rate/.test(err||''),err);
 const fr=e.ctx.saveFx('2026-10','INR',0.0135);const T=e.book.transactions.d;
 console.log('   reprice:',JSON.stringify(fr),JSON.stringify([T[1][3],T[1][16],T[2][3],T[2][16],T[3][3],T[3][16],T[4][3],T[5][3],T[5][16]]));
 check('manual month-end rate re-prices ledger-v2 foreign rows and makes provisional → final',T[1][3]===13.5&&T[1][16]==='final',JSON.stringify(T[1]));
 check('…but not deleted rows, legacy source rows, SGD rows, or other months',T[2][3]===26.9&&T[2][16]==='deleted'&&T[3][3]===13.45&&T[4][3]===10&&T[5][3]===13.31&&T[5][16]==='provisional',JSON.stringify([T[2],T[3],T[4],T[5]]));
 check('fx row stored as text month with note "manual"',e.book.fx.d.length===2&&e.book.fx.d[1][0]==='2026-10'&&/manual/.test(e.book.fx.d[1][3]),JSON.stringify(e.book.fx.d));
 // 5 fx daily job
 const live={KRW:0.00097,INR:0.01345,USD:1.28};
 e=mkEnv({fxLive:live,now:Date.parse('2026-10-30T15:30:00Z'),book:{settings:SET,runs:RUNS(),rules:RULES,transactions:[TXH,row('A','2026-10','INR',1000,13.45,'ledger-v2','provisional')],fx:[['month','currency','rate_to_sgd','note']]}});
 e.ctx.fxDailyJob_();
 check('daily job does nothing when tomorrow is not the 1st (Oct 30 23:30 SGT)',e.book.fx.d.length===1,JSON.stringify(e.book.fx.d));
 e.setNow(Date.parse('2026-10-31T15:30:00Z'));e.ctx.fxDailyJob_();
 console.log('   fx rows:',JSON.stringify(e.book.fx.d.slice(1)));
 check('on the last day: stores KRW/INR/USD for 2026-10 (auto GOOGLEFINANCE) and re-prices',e.book.fx.d.length===4&&e.book.fx.d.every((r,i)=>i===0||r[0]==='2026-10'&&/auto GOOGLEFINANCE/.test(r[3]))&&e.book.transactions.d[1][3]===13.45&&e.book.transactions.d[1][16]==='final',JSON.stringify(e.book.fx.d)+JSON.stringify(e.book.transactions.d[1]));
 e=mkEnv({fxLive:{KRW:0.00097,INR:'#N/A',USD:1.28},now:Date.parse('2026-10-31T15:30:00Z'),book:{settings:SET,runs:RUNS(),rules:RULES,transactions:[TXH],fx:[['month','currency','rate_to_sgd','note']]}});
 e.ctx.fxDailyJob_();
 check('an error value for one currency schedules one retry trigger and stores the others',e.trig.some(t=>t.h==='fxRetryJob_')&&e.book.fx.d.length===3,JSON.stringify([e.trig.map(t=>t.h),e.book.fx.d]));
 e.ctx.fxRetryJob_ && (()=>{})();
 console.log(`\n${pass} passed, ${fail} failed`);})();
