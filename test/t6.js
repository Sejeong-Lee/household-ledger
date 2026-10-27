const {open,rows,calls,check,summary}=require('./lib');const {toReview}=require('./setup');const path=require('path');
const tx=(pg,t)=>pg.locator('#rv-list .tx',{hasText:t});
(async()=>{const pg=await open();
await toReview(pg,'sep.csv','DBS CC (Ankit) · Ankit','Ankit');
const grab=tx(pg,'GRAB');await grab.locator('[data-c=edit]').click();await grab.locator('select[data-g=share]').selectOption('Personal - Ankit');await grab.locator('input[data-g=learn]').check();await grab.locator('[data-c=ok]').click();
await tx(pg,'SODENG').locator('[data-c=ok]').click();await tx(pg,'NEWSHOP').locator('[data-c=rej]').click();await pg.locator('[data-c=approveAll]').click();await pg.waitForTimeout(300);
await pg.locator('#foot [data-c=save]').click();await pg.waitForTimeout(1200);
// A. stale review?
await pg.locator('nav button',{hasText:'Review'}).click();await pg.waitForTimeout(300);
check('Review is empty after save (no stale rows)',(await pg.locator('#rv-list .tx').count())===0&&(await pg.locator('#rv-conf .tx').count())===0,(await pg.locator('#v-review').innerText()).replace(/\n+/g,' ⏎ ').slice(0,200));
// B. Month
await pg.locator('nav button',{hasText:'Month'}).click();await pg.waitForTimeout(400);
const mt=(await pg.locator('#v-month').innerText()).replace(/\n+/g,' ⏎ ');console.log('MONTH:',mt.slice(0,600));
check('Month TOTAL = S$55.55 (card bill Excluded)',/55\.55/.test(mt),mt.slice(0,200));
check('Month shows September 2026',/Sep/i.test(mt),'');
// C. Settings
await pg.locator('nav button',{hasText:'Settings'}).click();await pg.waitForTimeout(400);
const se=(await pg.locator('#v-settings').innerText()).replace(/\n+/g,' ⏎ ');console.log('SETTINGS:',se.slice(0,700));
check('Settings shows AI usage vs cap',/0\.01/.test(se)&&/\$?5/.test(se),se.slice(0,200));
const dels=await pg.locator('[data-c=delrule]').count();console.log('delrule buttons:',dels);
check('learned rule listed',/GRAB TRIP/.test(se),'');
pg.on('dialog',d=>d.accept());
const before=await pg.evaluate(()=>window.__state.rules.length);
await pg.locator('[data-c=delrule]').first().click();await pg.waitForTimeout(500);
console.log('rules rows before/after delete:',before,await pg.evaluate(()=>window.__state.rules.length));
console.log('deleteRule call args:',JSON.stringify((await calls(pg,'deleteRule')).map(c=>c.args)));
check('seed rules never deleted',await pg.evaluate(()=>window.__state.rules.filter(r=>r[5]==='seed').length)===6,'');
// D. duplicates
await pg.locator('nav button',{hasText:'Upload'}).click();await pg.waitForTimeout(200);
await toReview(pg,'sep.csv','DBS CC (Ankit) · Ankit','Ankit');
const txt=(await pg.locator('#v-review').innerText()).replace(/\n+/g,' ⏎ ');console.log('REUPLOAD REVIEW:',txt.slice(0,700));
check('re-upload flags duplicates ("Already saved in 2026-09")',(txt.match(/Already saved in 2026-09/g)||[]).length>=5,(txt.match(/Already saved/g)||[]).length);
console.log('ERRS',JSON.stringify(pg.errs));summary();await pg.close2();})();
