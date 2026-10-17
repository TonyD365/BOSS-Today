import fs from 'fs'
const { users, section } = JSON.parse(fs.readFileSync('tokens.json','utf8'))
const B='http://localhost:3300'
const call=async(who,m,p,b)=>{const h={'Content-Type':'application/json',Origin:B};if(who)h.Cookie=`payload-token=${users[who].token}`;const r=await fetch(B+p,{method:m,headers:h,body:b?JSON.stringify(b):undefined});return{status:r.status,body:await r.json().catch(()=>null)}}
const PAY='<img src=x onerror=alert(1)>'
const para=t=>({root:{type:'root',version:1,direction:'ltr',format:'',indent:0,children:[{type:'paragraph',version:1,direction:'ltr',format:'',indent:0,textFormat:0,children:[{type:'text',version:1,text:t,format:0,detail:0,mode:'normal',style:''}]}]}})
// reporter creates story with XSS in every text field
let r=await call('r1','POST','/api/articles?draft=true',{title:'XSS '+PAY,summary:'sum '+PAY,guestByline:'by '+PAY,section,authors:[users.r1.id],content:para('body '+PAY),_status:'draft'})
const id=r.body?.doc?.id; console.log('create:',r.status,'id',id)
await call('r1','POST',`/api/articles/${id}/workflow`,{action:'submit'})
await call('editor','POST',`/api/articles/${id}/workflow`,{action:'approve'})
// publish an issue containing it
r=await call('issuer','POST','/api/issues?draft=true',{title:'XSS issue',volume:9,number:9,date:new Date().toISOString(),_status:'draft'})
const iss=r.body.doc.id
const rev=await call('issuer','GET',`/api/issues/${iss}/review`)
for(const s of rev.body.stories) await call('issuer','POST',`/api/issues/${iss}/check`,{article:s.id,updatedAt:s.updatedAt,action:'checked'})
r=await call('issuer','POST',`/api/issues/${iss}/publish`,{structureChecked:true,declaration:true})
console.log('publish issue:',r.status)
const ex=await fetch(`${B}/api/site-export?part=articles&page=1`,{headers:{Authorization:'Bearer test-export-token-secret-value'}}).then(x=>x.json())
console.log('story in export:', (ex.docs||[]).some(d=>d.id===id))
