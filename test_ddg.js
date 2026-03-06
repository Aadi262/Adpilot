'use strict';
require('dotenv').config();
const https = require('https');

// Test lite.duckduckgo.com
function testLite(keyword) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(keyword);
    const options = {
      hostname: 'lite.duckduckgo.com',
      path: `/lite/?q=${q}`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
      },
    };
    https.get(options, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        console.log('lite status:', r.statusCode, '| length:', d.length);
        // Extract links
        const links = d.match(/href="https?:\/\/[^"]+"/g) || [];
        console.log('links found:', links.length);
        links.slice(0, 5).forEach((l, i) => console.log('  ' + (i+1) + '.', l.substring(6, 80)));
        resolve(d);
      });
    }).on('error', e => { console.error('error:', e.message); resolve(null); });
  });
}

testLite('site speed test tool');
