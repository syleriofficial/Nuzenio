// Nuzenio 2.0 — fresh Cloudflare Worker (no retired code reused).
const LIMIT=24;
const CATEGORIES=["india","politics","business","technology","sports","entertainment","education","world"];
const STATES=["bihar","delhi","uttar-pradesh","maharashtra","rajasthan","west-bengal","karnataka","tamil-nadu","madhya-pradesh","gujarat","jharkhand"];
export function escapeHtml(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
export function safeUrl(value,domain){
 try{
  const u=new URL(value),h=u.hostname.toLowerCase(),d=String(domain).toLowerCase().replace(/^www\./,"");
  if(u.protocol!=="https:"||u.username||u.password||(u.port&&u.port!=="443"))return null;
  if(!/^[a-z0-9.-]+$/.test(h)||!h.includes(".")||h.includes("..")||h.endsWith(".local")||h.endsWith(".internal")||h.endsWith(".invalid")||h.endsWith(".test"))return null;
  if(h!==(d)&&h!=="www."+d&&!h.endsWith("."+d))return null;
  if(/^\d+(\.\d+){3}$/.test(h))return null;
  u.hash="";return u.toString();
 }catch{return null;}
}
function decodeEntities(v){return String(v).replace(/&(?:amp|lt|gt|quot|apos|#39);/gi,c=>({"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'","&#39;":"'"}[c.toLowerCase()]));}
function tag(segment,name){const m=segment.match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i"));return m?decodeEntities(m[1].replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g,"$1").replace(/<[^>]+>/g,"")).trim():"";}
export function headlineFromRSS(xml,domain){
 if(typeof xml!=="string"||xml.length>1_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))return [];
 const matches=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,60);
 const out=[];
 for(const m of matches){
  const title=tag(m[1],"title").slice(0,240),url=safeUrl(tag(m[1],"link"),domain);
  if(!title||!url)continue;
  const date=tag(m[1],"pubDate"),parsed=Date.parse(date);
  out.push({title,url,published_at:Number.isFinite(parsed)?new Date(parsed).toISOString():new Date().toISOString()});
 }
 return out;
}
function headers(type="text/html; charset=utf-8"){
 return {"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","x-frame-options":"DENY","content-security-policy":"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'","permissions-policy":"camera=(),microphone=(),geolocation=()"};
}
function page(body,title="Nuzenio",lang="hi",noindex=true){
 const nav=[["",lang==="hi"?"मुख्य खबरें":"Top Stories"],["/category/politics",lang==="hi"?"राजनीति":"Politics"],["/category/business",lang==="hi"?"बिज़नेस":"Business"],["/category/technology",lang==="hi"?"टेक्नोलॉजी":"Technology"],["/category/sports",lang==="hi"?"खेल":"Sports"],["/originals",lang==="hi"?"हमारी खबरें":"Originals"]].map(([p,t])=>'<a href="/'+lang+p+'">'+escapeHtml(t)+'</a>').join("");
 return '<!doctype html><html lang="'+lang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="India news discovery. Stories from permitted sources and original Nuzenio reporting."><meta name="robots" content="'+(noindex?"noindex,nofollow":"index,follow")+'"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"><title>'+escapeHtml(title)+' | Nuzenio</title></head><body><header class="header"><div class="container header-inner"><a class="brand" href="/'+lang+'"><span>N</span>uzenio</a><nav class="nav" aria-label="News sections">'+nav+'</nav><a class="language" href="/'+(lang==="hi"?"en":"hi")+'">'+(lang==="hi"?"English":"हिंदी")+'</a></div></header><main class="container">'+body+'</main><footer class="footer"><div class="container">Nuzenio · India-first news discovery <a href="/'+lang+'/about">About</a><a href="/'+lang+'/editorial">Editorial</a><a href="/'+lang+'/contact">Contact</a></div></footer></body></html>';
}
function safeInput(v,max=200){return typeof v==="string"?v.trim().slice(0,max):"";}
const query=(db,sql,...args)=>db.prepare(sql).bind(...args);
function validRights(s){return s?.rights_status==="approved"&&s.active===1&&s.allow_title===1&&s.allow_link===1&&!!s.rights_evidence&&!!s.rights_checked_at&&(!s.rights_expires_at||s.rights_expires_at>new Date().toISOString());}
function sourceCard(n,lang){const link=safeUrl(n.url,n.domain);if(!link)return "";return '<article class="article"><div class="meta"><span class="pill">'+escapeHtml(n.category||"India")+'</span><span>'+escapeHtml(n.name)+'</span><span>'+escapeHtml((n.published_at||"").slice(0,16).replace("T"," "))+'</span></div><h3>'+escapeHtml(n.title)+'</h3><a class="link" href="'+escapeHtml(link)+'" target="_blank" rel="noopener noreferrer nofollow">'+(lang==="hi"?"मूल स्रोत पर पढ़ें ↗":"Read at original source ↗")+'</a></article>';}
function originalCard(n,lang){return '<article class="article"><div class="meta"><span class="pill">NUZENIO ORIGINAL</span><span>'+escapeHtml(n.author)+'</span></div><h3>'+escapeHtml(n.title)+'</h3><a class="link" href="/'+lang+'/original/'+encodeURIComponent(n.slug)+'">'+(lang==="hi"?"पूरा लेख पढ़ें →":"Read original article →")+'</a></article>';}
function intro(lang,title,sub){return '<section class="hero"><div class="eyebrow">NUZENIO · INDIA FIRST</div><h1>'+escapeHtml(title)+'</h1><p>'+escapeHtml(sub)+'</p></section>';}
function empty(lang){return '<div class="empty">'+(lang==="hi"?"इस अनुभाग में अभी कोई अधिकृत खबर नहीं है।":"No verified, authorized news is available in this section yet.")+'</div>';}
function newsPage(lang,rows,originals,opts={}){
 const title=opts.title||(lang==="hi"?"भारत की खबरें, एक जगह।":"India in focus.");
 const cards=[...originals.map(x=>originalCard(x,lang)),...rows.map(x=>sourceCard(x,lang))].filter(Boolean);
 const body=intro(lang,title,lang==="hi"?"स्रोत स्पष्ट। तथ्य महत्वपूर्ण। खबरों को पढ़ें और मूल प्रकाशक तक पहुँचें।":"Trusted attribution. Clear sources. One place to discover the stories that matter.")+
 '<div class="toolbar"><h2>'+(lang==="hi"?"ताज़ा खबरें":"Latest coverage")+'</h2><form action="/'+lang+'/search" method="get"><input name="q" maxlength="80" placeholder="'+(lang==="hi"?"खबर खोजें":"Search news")+'"><button type="submit">'+(lang==="hi"?"खोजें":"Search")+'</button></form></div><section class="feed">'+(cards.join("")||empty(lang))+'</section>';
 return page(body,title,lang,true);
}
function from64(v){return Uint8Array.from(atob(v.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));}
async function adminEmail(req,env){
 const team=String(env.ACCESS_TEAM_DOMAIN||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
 const aud=env.ACCESS_AUD,allow=String(env.ADMIN_EMAILS||"").toLowerCase().split(",").map(x=>x.trim()).filter(Boolean);
 if(!/^[a-z0-9.-]+\.cloudflareaccess\.com$/.test(team)||!aud||!allow.length)return null;
 const token=req.headers.get("cf-access-jwt-assertion");if(!token)return null;
 const parts=token.split(".");if(parts.length!==3)return null;
 let h,p;
 try{h=JSON.parse(new TextDecoder().decode(from64(parts[0])));p=JSON.parse(new TextDecoder().decode(from64(parts[1])));}catch{return null;}
 if(h.alg!=="RS256"||!h.kid||p.iss!=="https://"+team||!Array.isArray(p.aud)||!p.aud.includes(aud)||!Number.isFinite(p.exp)||p.exp*1000<=Date.now()||(p.nbf&&p.nbf*1000>Date.now())||!allow.includes(String(p.email||"").toLowerCase()))return null;
 try{
  const resp=await fetch("https://"+team+"/cdn-cgi/access/certs",{redirect:"error",signal:AbortSignal.timeout(4000)});if(!resp.ok)return null;
  const keys=(await resp.json()).keys||[],jwk=keys.find(k=>k.kid===h.kid&&k.kty==="RSA");if(!jwk)return null;
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const good=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,from64(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  return good?String(p.email).toLowerCase():null;
 }catch{return null;}
}
async function admin(req,env,url){
 const email=await adminEmail(req,env);if(!email)return new Response("Forbidden: Cloudflare Access required",{status:403,headers:headers("text/plain")});
 if(url.pathname==="/admin"&&req.method==="GET"){
  const body='<section class="hero"><div class="eyebrow">PRIVATE EDITORIAL WORKSPACE</div><h1>Nuzenio Originals</h1><p>All articles start as drafts. Nothing is published automatically.</p></section><form class="admin-form" id="article-form"><label>Headline<input name="title" required maxlength="180"></label><label>Slug<input name="slug" required pattern="[a-z0-9-]{5,100}" maxlength="100"></label><label>Author<input name="author" required></label><label>Language<select name="language"><option value="hi">Hindi</option><option value="en">English</option></select></label><label>Body<textarea name="body" required minlength="120" rows="10"></textarea></label><button type="submit">Save draft</button></form><div id="status" role="status" class="status"></div><p class="muted">Publish an approved draft through the restricted admin API only.</p><script defer src="/admin.js"></script>';
  return new Response(page(body,"Editorial workspace","en",true),{headers:headers()});
 }
 if(req.method!=="POST"||req.headers.get("origin")!==url.origin||(req.headers.get("content-type")||"").split(";")[0].trim()!=="application/json")return new Response('{"error":"JSON POST and same origin required"}',{status:405,headers:headers("application/json")});
 const raw=await req.text();if(raw.length>35000)return new Response('{"error":"Too large"}',{status:413,headers:headers("application/json")});
 let data;try{data=JSON.parse(raw);}catch{return new Response('{"error":"Invalid JSON"}',{status:400,headers:headers("application/json")});}
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:headers("application/json")});
 if(url.pathname==="/api/admin/articles"){
  const title=safeInput(data.title,180),slug=safeInput(data.slug,100),author=safeInput(data.author,100),body=safeInput(data.body,30000),lang=data.language;
  if(!title||!author||body.length<120||!/^[-a-z0-9]{5,100}$/.test(slug)||!["hi","en"].includes(lang))return json({error:"Invalid article"},400);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  try{await query(env.DB,"INSERT INTO originals(id,slug,language,title,body,author,updated_at) VALUES (?,?,?,?,?,?,?)",id,slug,lang,title,body,author,now).run();}catch{return json({error:"Slug already exists"},409);}
  await query(env.DB,"INSERT INTO audit_log(id,actor,action,target_id,happened_at) VALUES(?,?,?,?,?)",crypto.randomUUID(),email,"create_draft",id,now).run();
  return json({ok:true,id,status:"draft"},201);
 }
 const action=url.pathname.match(/^\/api\/admin\/articles\/([0-9a-f-]{36})\/(publish|unpublish)$/);
 if(action){
  const now=new Date().toISOString(),status=action[2]==="publish"?"published":"draft";
  const result=await query(env.DB,"UPDATE originals SET status=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,?) ELSE published_at END,updated_at=? WHERE id=?",status,status,now,now,action[1]).run();
  if(!result.meta?.changes)return json({error:"Not found"},404);
  await query(env.DB,"INSERT INTO audit_log(id,actor,action,target_id,happened_at) VALUES(?,?,?,?,?)",crypto.randomUUID(),email,status,action[1],now).run();
  return json({ok:true,status});
 }
 return json({error:"Unknown admin endpoint"},404);
}
async function render(req,env){
 const url=new URL(req.url),path=url.pathname.replace(/\/$/,"")||"/";
 if(["/styles.css","/admin.js","/favicon.svg"].includes(path))return env.ASSETS.fetch(req);
 if(path==="/")return Response.redirect(url.origin+"/hi",302);
 if(path==="/robots.txt"){const blocked=env.ENABLE_INDEXING!=="true";return new Response(blocked?"User-agent: *\nDisallow: /\n":"User-agent: *\nDisallow: /admin\nDisallow: /api/admin\n",{headers:headers("text/plain")});}
 if(!env.DB)return new Response("D1 database not configured",{status:503,headers:headers("text/plain")});
 if(path==="/admin"||path.startsWith("/api/admin/"))return admin(req,env,url);
 if(path==="/sitemap.xml")return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',{headers:headers("application/xml")});
 const m=path.match(/^\/(hi|en)(?:\/(.*))?$/);if(!m)return new Response("Not found",{status:404,headers:headers("text/plain")});
 const lang=m[1],route=m[2]||"",parts=route.split("/"),mode=parts[0];
 if(["about","editorial","contact"].includes(mode)){
  const desc={about:"India-first news discovery with clear original-publisher links.",editorial:"Sources are approved only with documented commercial reuse permission. All original articles require manual publishing.",contact:"Operator contact details must be configured before launch."};
  return new Response(page(intro(lang,mode,desc[mode]),mode,lang,true),{headers:headers()});
 }
 if(mode==="original"&&parts[1]){
  const story=await query(env.DB,"SELECT * FROM originals WHERE language=? AND slug=? AND status='published'",lang,parts[1]).first();
  if(!story)return new Response("Not found",{status:404,headers:headers("text/plain")});
  const content=intro(lang,story.title,story.author)+'<article class="original-body">'+escapeHtml(story.body)+'</article>';
  return new Response(page(content,story.title,lang,env.ENABLE_INDEXING!=="true"),{headers:headers()});
 }
 const where=["n.language=?","s.rights_status='approved'","s.active=1","s.allow_title=1","s.allow_link=1","s.rights_evidence<>''","s.rights_checked_at<>''","(s.rights_expires_at='' OR s.rights_expires_at>?)"];
 const args=[lang,new Date().toISOString()];let title="";
 if(mode==="category"&&CATEGORIES.includes(parts[1])){where.push("n.category=?");args.push(parts[1]);title=parts[1];}
 else if(mode==="state"&&STATES.includes(parts[1])){where.push("n.state=?");args.push(parts[1]);title=parts[1];}
 else if(mode==="search"){const q=safeInput(url.searchParams.get("q"),80).replace(/[%_\\]/g,"");if(q){where.push("n.title LIKE ?");args.push("%"+q+"%");}title=q||"Search";}
 else if(mode&&mode!=="originals"&&mode!=="latest")return new Response("Not found",{status:404,headers:headers("text/plain")});
 let rows=[],originals=[];
 if(mode!=="originals"){rows=(await query(env.DB,"SELECT n.*,s.name,s.domain FROM news_items n JOIN sources s ON s.id=n.source_id WHERE "+where.join(" AND ")+" ORDER BY n.published_at DESC LIMIT "+LIMIT,...args).all()).results||[];}
 if(!mode||mode==="originals"||mode==="latest"){originals=(await query(env.DB,"SELECT id,slug,title,author,language,published_at FROM originals WHERE status='published' AND language=? ORDER BY published_at DESC LIMIT 12",lang).all()).results||[];}
 return new Response(newsPage(lang,rows,originals,{title}),{headers:headers()});
}
async function scheduled(env){
 if(!env.DB)return;
 const sources=(await query(env.DB,"SELECT * FROM sources WHERE active=1 AND rights_status='approved' AND allow_title=1 AND allow_link=1 AND rights_evidence<>'' AND rights_checked_at<>'' AND (rights_expires_at='' OR rights_expires_at>?) ORDER BY COALESCE(last_fetched_at,'') ASC LIMIT 3",new Date().toISOString()).all()).results||[];
 for(const s of sources){
  if(!validRights(s)||!safeUrl(s.feed_url,s.domain))continue;
  try{
   const r=await fetch(s.feed_url,{redirect:"error",headers:{"accept":"application/rss+xml, application/xml, text/xml","user-agent":"Nuzenio/2.0 (authorized feed reader)"},signal:AbortSignal.timeout(6000)});
   if(!r.ok||Number(r.headers.get("content-length")||0)>1_000_000)continue;
   const type=r.headers.get("content-type")||"";if(!/xml|rss/i.test(type))continue;
   const xml=await r.text();if(xml.length>1_000_000)continue;
   const items=headlineFromRSS(xml,s.domain);for(const item of items){
    await query(env.DB,"INSERT OR IGNORE INTO news_items(id,source_id,title,url,published_at,language,category,state) VALUES(?,?,?,?,?,?,?,?)",crypto.randomUUID(),s.id,item.title,item.url,item.published_at,s.language,s.category,s.state||"").run();
   }
   await query(env.DB,"UPDATE sources SET last_fetched_at=? WHERE id=?",new Date().toISOString(),s.id).run();
  }catch(e){console.warn("feed refresh failed",String(e?.message||e).slice(0,80));}
 }
}
export default {
 async fetch(req,env){try{return await render(req,env);}catch(e){console.error("Nuzenio error",String(e?.message||e).slice(0,100));return new Response("Temporarily unavailable",{status:500,headers:headers("text/plain")});}},
 async scheduled(_controller,env,ctx){ctx.waitUntil(scheduled(env));}
};
