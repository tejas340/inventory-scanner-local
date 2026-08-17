// Dashboard reliability patch.
// Loaded before app.js so it can transparently recover if /api/dashboard fails.
(function () {
  const originalFetch = window.fetch.bind(window);

  async function buildDashboardFallback(request, init) {
    const headers = new Headers(init?.headers || (request instanceof Request ? request.headers : undefined));
    const demoMode = headers.get('X-Demo-Mode') === '1';
    const suffix = demoMode ? '?demo=1' : '';

    const [productsResponse, historyResponse] = await Promise.all([
      originalFetch(`/api/products${suffix}`, { headers }),
      originalFetch(`/api/history?limit=8${demoMode ? '&demo=1' : ''}`, { headers })
    ]);

    if (!productsResponse.ok || !historyResponse.ok) return null;

    const productsData = await productsResponse.json();
    const historyData = await historyResponse.json();
    const products = productsData.products || [];
    const lowStock = products.filter((product) =>
      Number(product.low_stock_level) > 0 && Number(product.quantity) <= Number(product.low_stock_level)
    );

    const stats = {
      total_products: products.length,
      total_units: products.reduce((sum, product) => sum + Number(product.quantity || 0), 0),
      low_stock_count: lowStock.length,
      out_of_stock_count: products.filter((product) => Number(product.quantity) === 0).length,
      attention_count: products.filter((product) => ['Damaged', 'Expired', 'Check Needed'].includes(product.quality)).length
    };

    return new Response(JSON.stringify({
      stats,
      lowStock: lowStock.slice(0, 8),
      recentHistory: (historyData.history || []).slice(0, 8)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  window.fetch = async function patchedFetch(input, init = {}) {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    let pathname = '';
    try {
      pathname = new URL(requestUrl, window.location.origin).pathname;
    } catch {}

    if (pathname !== '/api/dashboard') {
      return originalFetch(input, init);
    }

    try {
      const response = await originalFetch(input, init);
      if (response.ok) return response;

      const fallback = await buildDashboardFallback(input, init);
      return fallback || response;
    } catch (error) {
      const fallback = await buildDashboardFallback(input, init);
      if (fallback) return fallback;
      throw error;
    }
  };

  // Old iPhone Home Screen installs can keep stale app-shell caches.
  // This app always needs the Mac server anyway, so remove old caches/workers.
  window.addEventListener('load', async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith('inventory-scanner-')).map((key) => caches.delete(key)));
      }
    } catch {}
  });
})();
