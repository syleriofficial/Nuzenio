const CATEGORIES=new Set(["desh","duniya","tech-ai","vigyan","entertainment","video"]);
const IMAGE=/^\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:avif|jpg|jpeg|png|webp|svg)$/i;
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const trim=v=>typeof v==="string"?v.trim():"";
const valid=(v,min,max)=>Array.from(v).length>=min&&Array.from(v).length<=max;
export function validSources(sources){
 return Array.isArray(sources)&&sources.length<=20&&sources.every(src=>{
  if(typeof src!=="string"||src.length>2048)return false;
  try{const u=new URL(src);return ["https:","http:"].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password&&!/\s/.test(src);}
  catch{return false;}
 });
}
export function validateDraft(input){
 if(!input||typeof input!=="object"||Array.isArray(input))return {ok:false,error:"invalid_body"};
 const kind=trim(input.kind);
 if(!["news","stories"].includes(kind))return {ok:false,error:"invalid_kind"};
 const p={
  kind,slug:trim(input.slug).toLowerCase(),title:trim(input.title),
  description:trim(input.description),category:trim(input.category),
  author:trim(input.author),body:trim(input.body),
  image:trim(input.image),imageAlt:trim(input.imageAlt),
  imageRights:trim(input.imageRights),imageCredit:trim(input.imageCredit),
  sourceUrls:Array.isArray(input.sourceUrls)?input.sourceUrls.map(trim):[],
 };
 if(!SLUG.test(p.slug)||p.slug.length>90)return {ok:false,error:"invalid_slug"};
 if(!valid(p.title,10,180)||!valid(p.description,25,320))return {ok:false,error:"invalid_text"};
 if(!CATEGORIES.has(p.category))return {ok:false,error:"invalid_category"};
 if(!validSources(p.sourceUrls))return {ok:false,error:"invalid_sources"};
 if(p.image&&!IMAGE.test(p.image))return {ok:false,error:"invalid_image"};
 if(kind==="news"){
  if(!valid(p.author,2,120)||!valid(p.body,60,40000))return {ok:false,error:"invalid_article"};
 }else{
  if(!IMAGE.test(p.image)||!valid(p.imageAlt,5,240)||!valid(p.imageRights,5,600))return {ok:false,error:"invalid_story_image"};
  if(!Array.isArray(input.slides)||input.slides.length<5||input.slides.length>8)return {ok:false,error:"invalid_slides"};
  p.slides=input.slides.map(s=>({title:trim(s?.title),text:trim(s?.text)}));
  if(p.slides.some(s=>!valid(s.title,4,130)||!valid(s.text,12,450)))return {ok:false,error:"invalid_slide_text"};
 }
 if(p.image&&(!valid(p.imageAlt,5,240)||!valid(p.imageRights,5,600)))return {ok:false,error:"invalid_image_rights"};
 return {ok:true,value:p};
}
export function reviewReady(draft){
 return draft.sourceUrls?.length>0&&validSources(draft.sourceUrls)
  &&(!draft.image||(draft.imageAlt&&draft.imageRights))
  &&(draft.kind!=="stories"||(draft.image&&draft.imageAlt&&draft.imageRights));
}
