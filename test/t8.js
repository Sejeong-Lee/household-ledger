const {open,rows,calls,check,summary}=require('./lib');const path=require('path');
async function run(init,month){
 const pg=await open({init});
 await pg.locator('#fileIn').setInputFiles(path.resolve(__dirname,'inr.csv'));await pg.waitForTimeout(400);
 await pg.locator('#up-files select').first().selectOption({label:'Indian CC · Ankit'});
 if(month){const mi=pg.locator('#up-files input[type=month]');await mi.fill(month);await mi.dispatchEvent('change');await mi.dispatchEvent('input')}
 await pg.waitForTimeout(300);
 await pg.locator('[data-c=run]').click();await pg.waitForTimeout(1500);
 await pg.locator('#rv-top [data-c=flt]',{hasText:'Ankit'}).first().click();await pg.waitForTimeout(200);
 for(const el of await pg.locator('#rv-list .tx [data-c=ok]').all())await el.click();await pg.waitForTimeout(300);
 const why=await pg.$$eval('#rv-list .why',e=>e.map(x=>x.innerText));
 await pg.locator('#foot [data-c=save]').click();await pg.waitForTimeout(1000);
 const sr=(await calls(pg,'saveRows'))[0];const banner=(await pg.locator('#banner').innerText().catch(()=>'')).replace(/\n+/g,' ');
 return {pg,why,rs:sr?sr.args[0]:[],banner,meta:sr&&sr.args[1]}}
(async()=>{
 let r=await run("window.__noFx=true");
 console.log('F1 banner:',JSON.stringify(r.banner));
 check('F1 no fx for a past month: save blocked with a one-sentence banner, nothing written',r.rs.length===0&&/No exchange rate for INR in 2026-09\. Add it in Settings/.test(r.banner),r.banner);
 await r.pg.close2();
 r=await run("");
 console.log('F2 why:',r.why.map(w=>w.slice(-40)).join(' / '),'| saved:',JSON.stringify(r.rs.map(x=>[x[3],x[4],x[5],x[16]])));
 check('F2 month-end rate: sgd = orig × 0.01331 (13.31 / 33.28), final',r.rs.length===2&&Math.abs(r.rs[0][3]-13.31)<0.006&&Math.abs(r.rs[1][3]-33.28)<0.006&&r.rs.every(x=>x[16]==='final'&&x[4]==='INR'),JSON.stringify(r.rs.map(x=>[x[3],x[16]])));
 check('F2 runs meta carries account+month',r.meta&&r.meta.account==='Indian CC'&&r.meta.month==='2026-09',JSON.stringify(r.meta));
 await r.pg.close2();
 r=await run("","2026-10");
 console.log('F3 why:',r.why.map(w=>w.slice(-50)).join(' / '),'| saved:',JSON.stringify(r.rs.map(x=>[x[3],x[4],x[5],x[16],x[13]])),'| banner:',r.banner);
 check('F3 current month: provisional with live rate 0.01345076 (13.45 / 33.63)',r.rs.length===2&&Math.abs(r.rs[0][3]-13.45)<0.006&&Math.abs(r.rs[1][3]-33.63)<0.006&&r.rs.every(x=>x[16]==='provisional'),JSON.stringify(r.rs.map(x=>[x[3],x[16]])));
 check('F3 row month is 2026-10',r.rs.every(x=>x[13]==="'2026-10"),JSON.stringify(r.rs.map(x=>x[13])));
 console.log('ERRS',JSON.stringify(r.pg.errs));summary();await r.pg.close2();})();
