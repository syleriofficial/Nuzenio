import test from 'node:test';
import assert from 'node:assert/strict';
import {escapeHtml,safeUrl,headlineFromRSS} from '../src/worker.js';
test('escape HTML from publisher titles',()=>assert.equal(escapeHtml('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;'));
test('require valid publisher domain',()=>{assert.equal(safeUrl('http://site.com','site.com'),null);assert.equal(safeUrl('https://evil.com/x','site.com'),null);assert.ok(safeUrl('https://news.site.com/story','site.com'));});
test('reject dangerous XML and handle allowed simple RSS',()=>{assert.deepEqual(headlineFromRSS('<!DOCTYPE xml><rss></rss>','site.com'),[]);const x=headlineFromRSS('<rss><channel><item><title>Example</title><link>https://site.com/a</link></item></channel></rss>','site.com');assert.equal(x[0].title,'Example');});

test('exclude unsafe news links including private IP and misleading domains',()=>{
 assert.equal(safeUrl('https://127.0.0.1/x','127.0.0.1'),null);
 assert.equal(safeUrl('https://site.com.evil.com','site.com'),null);
 assert.equal(safeUrl('https://u:p@site.com/item','site.com'),null);
 assert.equal(safeUrl('javascript:alert(1)','site.com'),null);
});
test('safe headlines are plain text, not copied article bodies',()=>{
 const xml='<rss><channel><item><title><![CDATA[<b>Headline</b>]]></title><link>https://site.com/x</link><description>Do not copy this body</description></item></channel></rss>';
 const items=headlineFromRSS(xml,'site.com');
 assert.equal(items.length,1);
 assert.equal(items[0].title,'Headline');
 assert.equal(Object.hasOwn(items[0],'description'),false);
});

import worker from '../src/worker.js';
const environment={
 DB:{prepare(){return{bind(){return{async all(){return{results:[]};},async first(){return null;}};}};}},
 ASSETS:{fetch(){return new Response('asset');}},
 ENABLE_INDEXING:'false'
};
test('Hindi and English reader pages render safely without publisher content',async()=>{
 for(const lang of ['hi','en']){
  const res=await worker.fetch(new Request('https://preview.example/'+lang),environment);
  assert.equal(res.status,200);
  const html=await res.text();
  assert.match(html,/Nuzenio/);
  assert.match(html,/noindex,nofollow/);
 }
});
test('all India state pages, search and unknown routes behave correctly',async()=>{
 const state=await worker.fetch(new Request('https://preview.example/hi/state/bihar'),environment);
 assert.equal(state.status,200);
 const search=await worker.fetch(new Request('https://preview.example/en/search?q=hello'),environment);
 assert.equal(search.status,200);
 const missing=await worker.fetch(new Request('https://preview.example/nonexistent'),environment);
 assert.equal(missing.status,404);
});
test('admin is denied without a verified Cloudflare Access token',async()=>{
 const res=await worker.fetch(new Request('https://preview.example/admin'),environment);
 assert.equal(res.status,403);
});
test('robots blocks indexing before editorial launch gate',async()=>{
 const res=await worker.fetch(new Request('https://preview.example/robots.txt'),environment);
 assert.match(await res.text(),/Disallow: \//);
});
