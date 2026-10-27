const {open}=require('./lib');const path=require('path');
exports.toReview=async function(pg,csv,acct,filter){
 await pg.locator('#fileIn').setInputFiles(path.resolve(__dirname,csv));await pg.waitForTimeout(400);
 await pg.locator('#up-files select').first().selectOption({label:acct});await pg.waitForTimeout(200);
 await pg.locator('[data-c=run]').click();await pg.waitForTimeout(1500);
 if(filter)await pg.locator('#rv-top [data-c=flt]',{hasText:filter}).first().click();await pg.waitForTimeout(300)};
