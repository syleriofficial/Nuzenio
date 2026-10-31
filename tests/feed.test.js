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
