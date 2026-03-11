function previewBody(text) {
    return (text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
}

function withCacheBust(url) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}__ts=${Date.now()}`;
}

export async function fetchJson(url, options = {}) {
    const { cacheBust = true, ...fetchOptions } = options;
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const requestUrl = cacheBust && method === 'GET' ? withCacheBust(url) : url;

    const headers = new Headers(fetchOptions.headers || {});
    if (method === 'GET') {
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');
    }

    const response = await fetch(requestUrl, {
        ...fetchOptions,
        headers,
        cache: method === 'GET' ? 'no-store' : fetchOptions.cache,
    });
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }

    if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(
            `Expected JSON from ${url}, got "${contentType || 'unknown'}" (${previewBody(raw)})`
        );
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(`Invalid JSON from ${url}: ${error.message}`);
    }
}
