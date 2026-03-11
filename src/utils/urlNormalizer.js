'use strict';

function normalizeWebsiteUrl(rawUrl, { defaultProtocol = 'https:' } = {}) {
  const value = String(rawUrl || '').trim();
  if (!value) throw new Error('URL is required');

  const withProtocol = /^[a-z]+:\/\//i.test(value)
    ? value
    : `${defaultProtocol}//${value}`;

  const parsed = new URL(withProtocol);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) URLs are supported');
  }

  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';

  if ((parsed.protocol === 'https:' && parsed.port === '443') ||
      (parsed.protocol === 'http:' && parsed.port === '80')) {
    parsed.port = '';
  }

  parsed.searchParams.sort();

  if (parsed.pathname !== '/') {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  }

  return parsed.toString();
}

function buildWebsiteCacheKey(rawUrl) {
  const normalized = normalizeWebsiteUrl(rawUrl);
  const parsed = new URL(normalized);
  const hostname = parsed.hostname.replace(/^www\./, '');
  const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
  return `${hostname}${pathname}${parsed.search}`;
}

module.exports = {
  normalizeWebsiteUrl,
  buildWebsiteCacheKey,
};
