import test from 'node:test';
import assert from 'node:assert/strict';
import {escapeHtml,safeUrl,headlineFromRSS} from '../src/worker.js';
test('escape HTML from publisher titles',()=>assert.equal(escapeHtml('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;'));
test('require valid publisher domain',()=>{assert.equal(safeUrl('http://site.com','site.com'),null);assert.equal(safeUrl('https://evil.com/x','site.com'),null);assert.ok(safeUrl('https://news.site.com/story','site.com'));});
test('reject dangerous XML and handle allowed simple RSS',()=>{assert.deepEqual(headlineFromRSS('<!DOCTYPE xml><rss></rss>','site.com'),[]);const x=headlineFromRSS('<rss><channel><item><title>Example</title><link>https://site.com/a</link></item></channel></rss>','site.com');assert.equal(x[0].title,'Example');});
