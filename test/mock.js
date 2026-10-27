(function(){
window.__calls=[];
const T=(a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q)=>[a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,"","",""];
const SETTINGS=[["key","value","note"],["ratio_ankit","0.6"],["model_extract","claude-haiku-5-5"],["model_retry","claude-sonnet-5-5"],["model_classify","claude-haiku-5-5"],["api_cap_usd","5"],["user_cyzhzzang@gmail.com","Sejeong"],["user_ankit.walcott@gmail.com","Ankit"],["fx_live_KRW","0.0009663879"],["fx_live_INR","0.01345076"],["fx_live_USD","1.28006"],["income_sejeong","8057.4"]];
const ACCTS=[["name","owner","currency","sign","kind","collection","notes"],["DBS CC (Ankit)","Ankit","SGD","auto","card","statement"],["OCBC","Ankit","SGD","auto","bank","statement"],["Indian CC","Ankit","INR","auto","card","statement"],["Citi CC","Sejeong","SGD","auto","card","alert"],["HSBC CC","Sejeong","SGD","auto","card","alert"],["Hyundai CC","Sejeong","KRW","auto","card","statement"],["DBS SA (Sejeong)","Sejeong","SGD","auto","bank","statement"],["DBS Joint","Joint","SGD","auto","bank","statement"]];
const RULES=[["key","cat","sub","share","memo","set_by","set_at","conf","note"],
["re:^BUS/MRT","RIDE","Public transport","Owner","","seed","2026-10-26","high","x"],
["re:대출\\s?이자|신용대출","INVEST","Interest","Excluded","","seed","2026-10-26","high","x"],
["re:^GRAB\\*\\s*A-","RIDE","Taxi","","","seed","2026-10-26","mid","x"],
["re:^GRAB\\*\\s*\\d-","EAT","Dine out","","","seed","2026-10-26","mid","x"],
["re:SINGAPORE ?AIR|^SIA_|AIRLINES|AIRWAYS|AIRASIA|SCOOT|JETSTAR|항공|FREQUENT FLYER","ENJOY","Travel","Shared","","seed","2026-10-26","mid","x"],
["re:AGODA|BOOKING\\.COM|AIRBNB|TRIP\\.COM|EXPEDIA|KLOOK","ENJOY","Travel","Shared","","seed","2026-10-26","mid","x"]];
const H=["id","date","desc","sgd","cur","orig","account","card","owner","share","cat","sub","memo","month","source","posted","status","mcc","channel","ref"];
const hist=[];let n=1;
const add=(d,desc,amt,acct,own,share,cat,sub,memo)=>hist.push(["L"+String(n++).padStart(5,"0"),d,desc,amt,"SGD",amt,acct,"",own,share,cat,sub,memo||"",d.slice(0,7),"ledger","","final","","",""]);
for(const d of ["2026-06-03","2026-07-04","2026-08-05"]) add(d,"COLD STORAGE 1234 SG",21.5,"DBS CC (Ankit)","Ankit","Shared","EAT","Grocery");
add("2026-08-10","SMP**SODENG KOREAN",17,"DBS CC (Ankit)","Ankit","Shared","EAT","Dine out");
for(const [d,m] of [["2026-07-02",""],["2026-07-09",""],["2026-08-01","Refunded"],["2026-08-03",""]]) add(d,"SHOPEE SG MP SINGAPORE SG",20,"Citi CC","Sejeong","Personal - Sejeong","WEAR","Shopping",m);
const STATE={rules:RULES.slice(),saved:[]};
const API={
  getBootstrap:()=>{if(window.__failBoot)throw new Error(window.__failBoot);return {email:"cyzhzzang@gmail.com",name:"Sejeong",accounts:ACCTS,settings:SETTINGS,fx:window.__noFx?[["month","currency","rate_to_sgd","note"]]:[["month","currency","rate_to_sgd","note"],["2026-09","INR",0.01331,"Month-end"],["2026-09","KRW",0.00094,"Month-end"],["2026-08","KRW",0.0009294,"Month-end"]],rules:STATE.rules,transactions:[H,...hist],usage:{month:"2026-10",cost:0.012,calls:3,cap:5}}},
  getUsage:()=>({month:"2026-10",cost:0.012,calls:3,cap:5}),
  saveRows:(rows,meta)=>{STATE.saved.push(...rows);return {saved:rows.length,firstRow:5}},
  saveRule:(r)=>{const row=[r.key,r.cat,r.sub,r.share||"",r.memo||"","cyzhzzang@gmail.com","now",r.conf||"high",r.note||""];const i=STATE.rules.findIndex((x,j)=>j&&x[0]===r.key);if(i>0)STATE.rules[i]=row;else STATE.rules.push(row);return {ok:true}},
  deleteRule:(k)=>{const i=STATE.rules.findIndex((x,j)=>j&&x[0]===k);if(i>0&&STATE.rules[i][5]==="seed")throw new Error("Preset rules can only be changed in the rules tab.");if(i>0)STATE.rules.splice(i,1);return {ok:true}},
  logUsage:()=>({month:"2026-10",cost:0.013,calls:4,cap:5}),
  saveSetting:()=>({ok:true}),saveFx:()=>({ok:true,repriced:0}),deleteRow:()=>({ok:true}),
  callClaude:(model,system,content)=>{
    if(window.__failClaude)throw new Error(window.__failClaude);
    if(Array.isArray(content)&&content.some(b=>b.type==="image"))return {text:JSON.stringify({source:"HSBC",total:{out:30,in:0},rows:[{date:"2026-09-12",desc:"TEST ROW A",amount:10,dir:"out",cur:"SGD"},{date:"2026-09-13",desc:"TEST ROW B",amount:20,dir:"out",cur:"SGD"}]}),usage:{input_tokens:5200,output_tokens:150},model};
    const txt=typeof content==="string"?content:JSON.stringify(content);
    const out=[];for(const m of txt.matchAll(/^(\d+) \| ([^|]+) \|/gm)){const d=m[2];out.push(/SODENG|KOREAN/i.test(d)?{id:+m[1],cat:"EAT",sub:"Dine out",share:"Shared",memo:"Korean meal",conf:0.9,why:"Korean restaurant"}:{id:+m[1],cat:"WEAR",sub:"Shopping",share:"Personal - Ankit",memo:"",conf:0.5,why:"Unknown shop"})}
    return {text:JSON.stringify(out),usage:{input_tokens:900,output_tokens:120},model};
  }
};
window.__state=STATE;
window.google={script:{run:new Proxy({},{get:(_,k)=>{
  if(k==="withSuccessHandler"||k==="withFailureHandler"){return function(){return mk(k==="withSuccessHandler"?arguments[0]:null,k==="withFailureHandler"?arguments[0]:null)}}
  return undefined}})}};
function mk(ok,no){return new Proxy({},{get:(_,k)=>{
  if(k==="withSuccessHandler")return f=>mk(f,no);if(k==="withFailureHandler")return f=>mk(ok,f);
  return (...a)=>{window.__calls.push({fn:k,args:a});setTimeout(()=>{try{const r=API[k](...a);ok&&ok(r)}catch(e){no&&no(e)}},20)}}})}

})();
