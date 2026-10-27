const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const L=path.resolve(__dirname,'node_modules');
exports.open=async function(opts={}){
 const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:844}});
 pg.errs=[];pg.on('pageerror',e=>pg.errs.push('PAGEERR '+e.message));
 pg.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED/.test(m.text()))pg.errs.push('CONSOLE '+m.text())});
 await pg.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
  if(/pdf\.worker/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(L+'/pdfjs-dist/build/pdf.worker.min.js')});
  if(/pdf\.min\.js/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(L+'/pdfjs-dist/build/pdf.min.js')});
  if(/xlsx/.test(u))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(L+'/xlsx/dist/xlsx.full.min.js')});return r.abort()});
 if(opts.init)await pg.addInitScript(opts.init);
 await pg.goto('file://'+path.resolve(__dirname,'test.html'));await pg.waitForTimeout(500);
 pg.close2=()=>b.close();return pg};
exports.rows=pg=>pg.$$eval('#rv-list .tx',els=>els.map(e=>({desc:e.querySelector('b')?.innerText,amt:e.querySelector('.txa')?.innerText,tags:[...e.querySelectorAll('.tag')].map(t=>t.innerText).join(' / '),why:e.querySelector('.why')?.innerText,cls:e.className,dot:e.querySelector('.dot')?.getAttribute('style')})));
exports.calls=(pg,fn)=>pg.evaluate(f=>window.__calls.filter(c=>!f||c.fn===f),fn);
let pass=0,fail=0;exports.check=(name,ok,detail)=>{ok?pass++:fail++;console.log((ok?'PASS ':'FAIL ')+name+(ok?'':'  → '+detail))};
exports.summary=()=>console.log(`\n${pass} passed, ${fail} failed`);
