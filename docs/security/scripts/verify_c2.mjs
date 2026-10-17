import fs from 'fs'
const { users, section } = JSON.parse(fs.readFileSync('tokens.json', 'utf8'))
const B = 'http://localhost:3300'
const call = async (who, method, path, body) => {
  const headers = { 'Content-Type': 'application/json', Origin: B }
  if (who) headers.Cookie = `payload-token=${users[who].token}`
  const r = await fetch(B + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) }
}
// 1. r1 creates own draft
const para = { root: { type:'root', version:1, direction:'ltr', format:'', indent:0, children:[{type:'paragraph',version:1,direction:'ltr',format:'',indent:0,textFormat:0,children:[{type:'text',version:1,text:'pentest body',format:0,detail:0,mode:'normal',style:''}]}] } }
let r = await call('r1', 'POST', '/api/articles?draft=true', { title:'PENTEST fresh draft', summary:'x', section, authors:[users.r1.id], content: para, _status:'draft' })
console.log('create draft:', r.status, 'id=', r.body?.doc?.id, 'status=', r.body?.doc?._status, 'workflow=', r.body?.doc?.workflow)
const id = r.body?.doc?.id
if (!id) { console.log('could not create; body:', JSON.stringify(r.body).slice(0,300)); process.exit() }
// 2. confirm it is a draft, not live
let doc = (await call('super','GET',`/api/articles/${id}?draft=true`)).body
console.log('before attack: _status=', doc._status, 'workflow=', doc.workflow)
// 3. r1 attempts to publish own draft directly
r = await call('r1', 'PATCH', `/api/articles/${id}`, { _status:'published' })
console.log('r1 PATCH _status=published ->', r.status, JSON.stringify(r.body?.errors?.[0]?.message ?? r.body?.message ?? '').slice(0,160))
// 4. read back
doc = (await call('super','GET',`/api/articles/${id}?draft=true`)).body
console.log('after attack: _status=', doc._status, 'workflow=', doc.workflow)
const live = (await call('super','GET',`/api/articles/${id}`)).body  // non-draft read = published version
console.log('published version readable:', live?.id ? `yes (_status=${live._status})` : 'no')
// 5. does it reach the public export?
const ex = await fetch(`${B}/api/site-export?part=articles&page=1`, { headers: { Authorization: 'Bearer test-export-token-secret-value' } }).then(x=>x.json())
const inExport = (ex.docs||[]).some(d=>d.id===id)
console.log('in public site-export:', inExport)
// 6. try via ?draft=true query param variant
r = await call('r1', 'PATCH', `/api/articles/${id}?draft=true`, { _status:'published' })
console.log('r1 PATCH ?draft=true _status=published ->', r.status)
doc = (await call('super','GET',`/api/articles/${id}?draft=true`)).body
console.log('after draft-param attempt: _status=', doc._status)
