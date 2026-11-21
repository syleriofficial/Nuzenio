import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../apps/editorial-api/src/worker.js";
import { validateDraft, reviewReady } from "../apps/editorial-api/src/validation.js";
import { studioHtml, studioCss } from "../apps/editorial-api/src/studio-assets.js";
import { studioClient } from "../apps/editorial-api/src/studio-client.js";

const origin = "https://editor.nuzenio.com";
const owner = "editor@example.com";
const validNews = {
  kind:"news",slug:"test-editorial-report",
  title:"यह पूरी तरह काल्पनिक परीक्षण के लिए लेख का शीर्षक है",
  description:"यह संपादकीय API के व्यवहार को जाँचने के लिए बनाया गया एक काल्पनिक विवरण है।",
  category:"desh",author:"Nuzenio Desk",
  body:"यह एक परीक्षण के लिए पर्याप्त लंबाई वाला समाचार पाठ है। किसी असली घटना, व्यक्ति या संगठन के बारे में इससे कोई दावा नहीं किया जाता है।",
  image:"",imageAlt:"",imageCredit:"",imageRights:"",sourceUrls:[],
};
const authorised = async () => ({ok:true,email:owner});

class FakeDB {
  constructor(){this.rows=new Map();this.audit=[];}
  prepare(sql) {
    const db=this;
    return {
      bind(...args) {
        return {
          sql,args,
          first: async () => db.perform(sql,args,"first"),
          all: async () => db.perform(sql,args,"all"),
          run: async () => db.perform(sql,args,"run"),
        };
      }
    };
  }
  async batch(items){return Promise.all(items.map(s=>this.perform(s.sql,s.args,"run")));}
  perform(sql,args,mode){
    if(sql.startsWith("INSERT INTO private_drafts")) {
      const [id,email,kind,slug,title,category,body,created,updated]=args;
      if([...this.rows.values()].some(r=>r.owner_email===email&&r.kind===kind&&r.slug===slug))throw Error("UNIQUE constraint failed");
      this.rows.set(id,{id,owner_email:email,kind,slug,title,category,status:"draft",
        content_json:body,version:1,created_at:created,updated_at:updated});
      return {meta:{changes:1}};
    }
    if(sql.startsWith("INSERT INTO private_audit")){
      this.audit.push({args});return {meta:{changes:1}};
    }
    if(sql.startsWith("UPDATE private_drafts SET slug=")){
      const [slug,title,category,body,updated,id,email,version]=args;
      const row=this.rows.get(id);
      if(!row||row.owner_email!==email||row.version!==version||row.status!=="draft")return {meta:{changes:0}};
      Object.assign(row,{slug,title,category,content_json:body,updated_at:updated,version:version+1});
      return {meta:{changes:1}};
    }
    if(sql.startsWith("UPDATE private_drafts SET status=")){
      const [status,updated,id,email,from,version]=args;
      const row=this.rows.get(id);
      if(!row||row.owner_email!==email||row.version!==version||row.status!==from)return {meta:{changes:0}};
      Object.assign(row,{status,updated_at:updated,version:version+1});
      return {meta:{changes:1}};
    }
    if(sql.includes("FROM private_drafts WHERE id=? AND owner_email=?")){
      const [id,email]=args;
      const r=this.rows.get(id);
      return r?.owner_email===email?{...r}:null;
    }
    if(sql.includes("FROM private_drafts WHERE owner_email=?")){
      const [email]=args;
      return {results:[...this.rows.values()].filter(r=>r.owner_email===email).map(r=>({...r}))};
    }
    if(sql.includes("FROM private_audit"))return {results:[]};
    throw new Error("Fake DB SQL not implemented: "+sql);
  }
}
function env(db=new FakeDB()){
  return {
    EDITOR_ENABLED:"true",DB:db,ADMIN_ORIGIN:origin,
    TEAM_DOMAIN:"https://my-test-team.cloudflareaccess.com",
    POLICY_AUD:"01234567890123456789",OWNER_EMAIL:owner,
  };
}
function req(path,method="GET",body,extra={}) {
  const headers={...extra};
  if(body!==undefined) {
    headers["Content-Type"]="application/json";
    headers.Origin ??= origin;
  }
  return new Request(origin+path,{
    method,headers,body:body===undefined?undefined:JSON.stringify(body),
  });
}
async function call(path,method,body,e,auth=authorised,extra={}){
  const response=await handleRequest(req(path,method,body,extra),e,auth);
  const data=await response.json();
  return {response,data};
}
test("fail-closed on missing settings and disabled editor", async ()=>{
  const a=env();a.EDITOR_ENABLED="false";
  assert.equal((await call("/api/me","GET",undefined,a)).response.status,503);
  const b=env();b.POLICY_AUD="REPLACE_WITH_AUD";
  assert.equal((await call("/api/me","GET",undefined,b)).response.status,503);
  const c=env();c.DB=null;
  assert.equal((await call("/api/me","GET",undefined,c)).response.status,503);
  const d=env();d.TEAM_DOMAIN="https://evil.invalid";
  assert.equal((await call("/api/me","GET",undefined,d)).response.status,503);
});
test("rejects wrong host, missing JWT, non-owner and forged Origin", async()=>{
  const settings=env();
  const wrong=await handleRequest(new Request("https://unprotected.workers.dev/api/me"),settings,authorised);
  assert.equal(wrong.status,404);
  const noToken=await handleRequest(req("/api/me"),settings);
  assert.equal(noToken.status,401);
  const stranger=async()=>({ok:false,status:403});
  assert.equal((await call("/api/me","GET",undefined,settings,stranger)).response.status,403);
  assert.equal((await call("/api/drafts","POST",validNews,settings,authorised,{Origin:"https://attacker.invalid"})).response.status,403);
  const noOrigin=new Request(origin+"/api/drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(validNews)});
  assert.equal((await handleRequest(noOrigin,settings,authorised)).status,403);
});
test("validates private drafts, no approval status can be set in body",()=>{
  assert.equal(validateDraft({...validNews,status:"approved"}).value.status,undefined);
  assert.equal(validateDraft({...validNews,slug:"../secret"}).ok,false);
  assert.equal(validateDraft({...validNews,sourceUrls:["javascript:alert(1)"]}).ok,false);
  assert.equal(validateDraft({...validNews,image:"https://other.example/remote.jpg"}).ok,false);
  assert.equal(reviewReady(validNews),false);
});
test("draft -> review -> manual release, no publish endpoints and concurrency checks",async()=>{
  const settings=env();
  let res=await call("/api/drafts","POST",validNews,settings);
  assert.equal(res.response.status,201,JSON.stringify(res.data));
  assert.equal(res.data.status,"draft");
  const id=res.data.id;
  assert.match(id,/^[0-9a-f-]{36}$/);
  res=await call("/api/drafts/"+id,"GET",undefined,settings);
  assert.equal(res.response.status,200);
  assert.equal(res.data.content.status,undefined);
  res=await call("/api/drafts/"+id+"/review","POST",{version:1},settings);
  assert.equal(res.response.status,422);
  res=await call("/api/drafts/"+id,"PUT",{...validNews,version:1,sourceUrls:["https://example.org/fixture"]},settings);
  assert.equal(res.response.status,200,JSON.stringify(res.data));
  assert.equal(res.data.version,2);
  res=await call("/api/drafts/"+id,"PUT",{...validNews,version:1},settings);
  assert.equal(res.response.status,409);
  res=await call("/api/drafts/"+id+"/review","POST",{version:2},settings);
  assert.equal(res.response.status,200,JSON.stringify(res.data));
  assert.equal(res.data.status,"in_review");
  res=await call("/api/drafts/"+id,"PUT",{...validNews,version:3},settings);
  assert.equal(res.response.status,409);
  res=await call("/api/drafts/"+id+"/approve","POST",{version:3},settings);
  assert.equal(res.response.status,422);
  res=await call("/api/drafts/"+id+"/approve","POST",{
    version:3,confirmation:"APPROVE FOR MANUAL RELEASE",
    factsChecked:true,imageRightsChecked:true,
  },settings);
  assert.equal(res.response.status,200,JSON.stringify(res.data));
  assert.equal(res.data.status,"approved_for_manual_release");
  assert.equal(res.data.published,false);
  res=await call("/api/drafts","GET",undefined,settings);
  assert.equal(res.data.items.length,1);
  assert.equal(res.data.items[0].status,"approved_for_manual_release");
  const unknown=await call("/api/publish","POST",{id},settings);
  assert.equal(unknown.response.status,404);
});
test("private staging UI only available after Access identity check",async()=>{
 const settings=env();
 const res=await handleRequest(req("/studio/"),settings,authorised);
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/PRIVATE EDITORIAL STUDIO/);
 assert.match(res.headers.get("Content-Security-Policy"),/connect-src 'self'/);
 assert.equal((await handleRequest(req("/studio/"),settings)).status,401);
 assert.equal((await handleRequest(req("/studio/app.js"),settings,authorised)).status,200);
 assert.equal((await handleRequest(req("/studio/app.css"),settings,authorised)).status,200);
 assert.match(studioClient,/fetch\(/);
 assert.match(studioHtml,/कोई स्वचालित प्रकाशन नहीं/);
 assert.ok(studioCss.length>1000);
});
test("request limits and JSON Content-Type are enforced",async()=>{
 const settings=env();
 let response=await handleRequest(
  new Request(origin+"/api/drafts",{method:"POST",headers:{Origin:origin,"Content-Type":"text/plain"},body:"test"}),
  settings,authorised);
 assert.equal(response.status,415);
 response=await handleRequest(
  new Request(origin+"/api/drafts",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:"{"}),
  settings,authorised);
 assert.equal(response.status,400);
 const large=JSON.stringify({...validNews,body:"a".repeat(70000)});
 response=await handleRequest(
  new Request(origin+"/api/drafts",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:large}),
  settings,authorised);
 assert.equal(response.status,413);
});
