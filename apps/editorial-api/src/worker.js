import { createRemoteJWKSet, jwtVerify } from "jose";
import { validateDraft, reviewReady } from "./validation.js";
import { studioHtml, studioCss } from "./studio-assets.js";
import { studioClient } from "./studio-client.js";

const MAX_BODY_BYTES = 65536;
const JWKS_CACHE = new Map();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'",
};

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function isConfigured(env) {
  if (env?.EDITOR_ENABLED !== "true" || !env.DB?.prepare || !env.DB?.batch) return false;
  if (typeof env.POLICY_AUD !== "string" || env.POLICY_AUD.length < 12 || env.POLICY_AUD.startsWith("REPLACE")) return false;
  if (typeof env.OWNER_EMAIL !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.OWNER_EMAIL) || env.OWNER_EMAIL.endsWith(".invalid")) return false;
  try {
    const admin = new URL(env.ADMIN_ORIGIN);
    const team = new URL(env.TEAM_DOMAIN);
    return admin.protocol === "https:" && admin.origin === env.ADMIN_ORIGIN &&
      admin.pathname === "/" && !admin.username && !admin.password &&
      team.protocol === "https:" && team.origin === env.TEAM_DOMAIN &&
      team.pathname === "/" && !team.username && !team.password &&
      /^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team.hostname) &&
      !team.hostname.startsWith("your-team.");
  } catch { return false; }
}
async function verifyIdentity(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || token.length > 10000) return { ok: false, status: 401 };
  try {
    let jwks = JWKS_CACHE.get(env.TEAM_DOMAIN);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(env.TEAM_DOMAIN + "/cdn-cgi/access/certs"), {
        timeoutDuration: 3000,
        cooldownDuration: 30000,
      });
      JWKS_CACHE.set(env.TEAM_DOMAIN, jwks);
    }
    const result = await jwtVerify(token, jwks, {
      issuer: env.TEAM_DOMAIN,
      audience: env.POLICY_AUD,
      algorithms: ["RS256"],
      clockTolerance: 5,
    });
    const email = typeof result.payload.email === "string" ? result.payload.email.toLowerCase() : "";
    if (!email || email !== env.OWNER_EMAIL.toLowerCase()) return { ok:false, status:403 };
    if (typeof result.payload.sub !== "string" || !result.payload.sub) return { ok:false, status:401 };
    return { ok:true, email };
  } catch {
    return { ok: false, status: 401 };
  }
}
async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) return {ok:false,status:415};
  if (Number(request.headers.get("content-length") || 0)>MAX_BODY_BYTES) return {ok:false,status:413};
  const reader = request.body?.getReader();
  if (!reader) return {ok:false,status:400};
  let count = 0;
  const chunks=[];
  try {
    while(true){
      const next=await reader.read();
      if(next.done)break;
      count+=next.value.byteLength;
      if(count>MAX_BODY_BYTES){await reader.cancel();return {ok:false,status:413};}
      chunks.push(next.value);
    }
    const bytes=new Uint8Array(count);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
    if(!data || typeof data!=="object" || Array.isArray(data))return {ok:false,status:400};
    return {ok:true,value:data};
  } catch {return {ok:false,status:400};}
}
function sqlResultChanges(result) {return Number(result?.meta?.changes ?? 0);}
function rowResult(row) {
  return {id:row.id,kind:row.kind,slug:row.slug,title:row.title,
    category:row.category,status:row.status,version:row.version,
    createdAt:row.created_at,updatedAt:row.updated_at};
}
function cleanError(error) {
  if (/UNIQUE constraint failed/i.test(String(error))) return json(409,{error:"duplicate_slug"});
  return json(500,{error:"database_error"});
}
async function currentDraft(db, id, email) {
  return db.prepare(
    "SELECT id,owner_email,kind,slug,title,category,status,content_json,version,created_at,updated_at FROM private_drafts WHERE id=? AND owner_email=?"
  ).bind(id,email).first();
}
async function auditBatch(env, statement, draftId, actor, action, from, to, date, expectedVersion) {
  const auditId=crypto.randomUUID();
  const audit=env.DB.prepare(
    "INSERT INTO private_audit (id,draft_id,actor_email,action,previous_status,next_status,occurred_at,detail) " +
    "SELECT ?,id,?,?,?, ?,?,? FROM private_drafts WHERE id=? AND owner_email=? AND status=? AND version=?"
  ).bind(auditId,actor,action,from,to,date,"",draftId,actor,to,expectedVersion+1);
  return env.DB.batch([statement,audit]);
}
async function dispatch(request,env,email,path) {
  const method=request.method;
  const now=()=>new Date().toISOString();
  if(path==="/api/me" && method==="GET")return json(200,{email,role:"owner",publishingEnabled:false});
  if(path==="/api/drafts" && method==="GET") {
    try{
      const rows=await env.DB.prepare(
        "SELECT id,kind,slug,title,category,status,version,created_at,updated_at FROM private_drafts WHERE owner_email=? ORDER BY updated_at DESC LIMIT 100"
      ).bind(email).all();
      return json(200,{items:(rows.results || []).map(rowResult)});
    }catch(e){return cleanError(e);}
  }
  if(path==="/api/drafts" && method==="POST"){
    const body=await readJson(request);
    if(!body.ok)return json(body.status,{error:"invalid_request"});
    const value=validateDraft(body.value);
    if(!value.ok)return json(422,{error:value.error});
    const id=crypto.randomUUID(),date=now(),data=value.value;
    const auditId=crypto.randomUUID();
    try{
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO private_drafts (id,owner_email,kind,slug,title,category,status,content_json,version,created_at,updated_at) VALUES (?,?,?,?,?,?,'draft',?,1,?,?)"
        ).bind(id,email,data.kind,data.slug,data.title,data.category,JSON.stringify(data),date,date),
        env.DB.prepare(
          "INSERT INTO private_audit (id,draft_id,actor_email,action,previous_status,next_status,occurred_at,detail) VALUES (?,?,?,?,?,?,?,?)"
        ).bind(auditId,id,email,"create",null,"draft",date,"")
      ]);
      return json(201,{id,version:1,status:"draft"});
    }catch(e){return cleanError(e);}
  }
  const m=path.match(/^\/api\/drafts\/([0-9a-f-]+)(?:\/(review|return|approve|history))?$/i);
  if(!m || !UUID_RE.test(m[1]))return json(404,{error:"not_found"});
  const id=m[1],action=m[2] || "";
  let row;
  try {row=await currentDraft(env.DB,id,email);}
  catch(e){return cleanError(e);}
  if(!row)return json(404,{error:"not_found"});
  if(!action && method==="GET")return json(200,{...rowResult(row),content:JSON.parse(row.content_json)});
  if(action==="history" && method==="GET"){
    try{
      const result=await env.DB.prepare(
        "SELECT action,previous_status,next_status,occurred_at FROM private_audit WHERE draft_id=? AND actor_email=? ORDER BY occurred_at ASC LIMIT 100"
      ).bind(id,email).all();
      return json(200,{items:result.results || []});
    }catch(e){return cleanError(e);}
  }
  if(!action && method==="PUT") {
    if(row.status!=="draft")return json(409,{error:"not_editable"});
    const body=await readJson(request);
    if(!body.ok)return json(body.status,{error:"invalid_request"});
    if(!Number.isSafeInteger(body.value.version)||body.value.version!==row.version)return json(409,{error:"revision_conflict"});
    const payload=validateDraft(body.value);
    if(!payload.ok)return json(422,{error:payload.error});
    if(payload.value.kind!==row.kind)return json(409,{error:"kind_cannot_change"});
    try {
      const stamp=now();
      const st=env.DB.prepare(
        "UPDATE private_drafts SET slug=?,title=?,category=?,content_json=?,updated_at=?,version=version+1 WHERE id=? AND owner_email=? AND status='draft' AND version=?"
      ).bind(payload.value.slug,payload.value.title,payload.value.category,JSON.stringify(payload.value),stamp,id,email,row.version);
      const [result]=await auditBatch(env,st,id,email,"edit","draft","draft",stamp,row.version);
      if(sqlResultChanges(result)!==1)return json(409,{error:"revision_conflict"});
      return json(200,{id,version:row.version+1,status:"draft"});
    }catch(e){return cleanError(e);}
  }
  if(["review","return","approve"].includes(action) && method==="POST") {
    const body=await readJson(request);
    if(!body.ok)return json(body.status,{error:"invalid_request"});
    if(!Number.isSafeInteger(body.value.version)||body.value.version!==row.version)return json(409,{error:"revision_conflict"});
    const from = action==="return" ? "in_review" : action==="approve" ? "in_review" : "draft";
    const to = action==="return" ? "draft" : action==="approve" ? "approved_for_manual_release" : "in_review";
    if(row.status!==from)return json(409,{error:"invalid_transition"});
    const content=JSON.parse(row.content_json);
    if(action!=="return" && !reviewReady(content))return json(422,{error:"sources_or_rights_missing"});
    if(action==="approve" && (
      body.value.confirmation!=="APPROVE FOR MANUAL RELEASE" ||
      body.value.factsChecked!==true ||
      body.value.imageRightsChecked!==true
    ))return json(422,{error:"approval_checklist_missing"});
    try{
      const stamp=now();
      const update=env.DB.prepare(
        "UPDATE private_drafts SET status=?,updated_at=?,version=version+1 WHERE id=? AND owner_email=? AND status=? AND version=?"
      ).bind(to,stamp,id,email,from,row.version);
      const [result]=await auditBatch(env,update,id,email,action,from,to,stamp,row.version);
      if(sqlResultChanges(result)!==1)return json(409,{error:"revision_conflict"});
      return json(200,{id,status:to,version:row.version+1,published:false});
    }catch(e){return cleanError(e);}
  }
  return json(405,{error:"method_not_allowed"});
}
export async function handleRequest(request,env,authenticate=verifyIdentity){
  // Deliberately disabled unless owner explicitly configures a private Access application.
  if(!isConfigured(env))return json(503,{error:"editor_not_configured"});
  let u;
  try{u=new URL(request.url);}catch{return json(400,{error:"invalid_url"});}
  if(u.origin!==env.ADMIN_ORIGIN)return json(404,{error:"not_found"});
  const isMutating=["POST","PUT","PATCH","DELETE"].includes(request.method);
  if(isMutating && request.headers.get("Origin")!==env.ADMIN_ORIGIN) return json(403,{error:"invalid_origin"});
  const identity=await authenticate(request,env);
  if(!identity.ok)return json(identity.status || 401,{error:"unauthorized"});
  const path=u.pathname.replace(/\/+$/,"")||"/";
  if (request.method === "GET" && ["/studio","/studio/app.js","/studio/app.css"].includes(path)) {
    const body=path==="/studio"?studioHtml:path==="/studio/app.js"?studioClient:studioCss;
    const type=path==="/studio"?"text/html":path==="/studio/app.js"?"text/javascript":"text/css";
    return new Response(body,{
      status:200,
      headers:{
        ...SECURITY_HEADERS,
        "Content-Type":type+"; charset=utf-8",
        "Content-Security-Policy":"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; form-action 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      }
    });
  }
  if(!path.startsWith("/api/")) return json(404,{error:"not_found"});
  try{return await dispatch(request,env,identity.email,path);}
  catch{return json(500,{error:"unexpected_error"});}
}
export default {
  fetch(request,env){return handleRequest(request,env);}
};
