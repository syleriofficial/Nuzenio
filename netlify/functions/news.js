
const https = require("https");

const FEEDS = {
  top:"https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en",
  hindi:"https://news.google.com/rss?hl=hi&gl=IN&ceid=IN:hi",
  india:"https://news.google.com/rss/search?q=India&hl=en-IN&gl=IN&ceid=IN:en",
  world:"https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en",
  business:"https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en",
  tech:"https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en",
  sports:"https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-IN&gl=IN&ceid=IN:en",
  entertainment:"https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=en-IN&gl=IN&ceid=IN:en",
  health:"https://news.google.com/rss/headlines/section/topic/HEALTH?hl=en-IN&gl=IN&ceid=IN:en",
  science:"https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en-IN&gl=IN&ceid=IN:en"
};

function fetchText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{"User-Agent":"NewsSetu/26.0"}},res=>{
      let data="";
      res.on("data",c=>data+=c);
      res.on("end",()=>resolve(data));
    }).on("error",reject);
  });
}
function clean(s=""){
  return s.replace(/<!\[CDATA\[/g,"").replace(/\]\]>/g,"").replace(/<[^>]+>/g,"")
  .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
  .replace(/&nbsp;/g," ").trim();
}
function first(item,tag){
  const m=item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,"i"));
  return m?clean(m[1]):"";
}
function parse(xml,category){
  return (xml.match(/<item>[\s\S]*?<\/item>/gi)||[]).slice(0,50).map((item,i)=>{
    const title=first(item,"title");
    const source=first(item,"source")||"Google News";
    return {
      id:`${category}-${i}-${Buffer.from(title).toString("base64").slice(0,12)}`,
      title,
      link:first(item,"link"),
      source,
      pubDate:first(item,"pubDate"),
      category,
      trustScore: Math.max(82, 98 - (i % 12)),
      summary:(first(item,"description")||title||"").slice(0,240)
    };
  }).filter(a=>a.title&&a.link);
}
exports.handler=async(event)=>{
  try{
    const category=(event.queryStringParameters?.category||"top").toLowerCase();
    const q=(event.queryStringParameters?.q||"").trim();
    const url=q?`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`:(FEEDS[category]||FEEDS.top);
    const xml=await fetchText(url);
    const articles=parse(xml,category);
    return {statusCode:200,headers:{"Content-Type":"application/json","Cache-Control":"public, max-age=300","Access-Control-Allow-Origin":"*"},body:JSON.stringify({ok:true,category,total:articles.length,updatedAt:new Date().toISOString(),articles})};
  }catch(e){
    return {statusCode:500,headers:{"Content-Type":"application/json"},body:JSON.stringify({ok:false,error:e.message})};
  }
};
