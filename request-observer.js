(() => {
  'use strict';
  const nativeFetch = window.fetch;
  let deletionTemplate = null;
  function publishNative(raw, status) {
    let data;
    try { data = JSON.parse(raw.replace(/^for \(;;\);/, '')); } catch {}
    const success = status >= 200 && status < 300 && !data?.errors?.length && data?.data?.xdt_delete_media_note?.__typename === 'XDTMediaNoteDeleteResponse';
    document.documentElement.setAttribute('data-local-repost-result', JSON.stringify({ at: Date.now(), success, status, reason: success ? undefined : 'A resposta da remoção nativa não confirmou sucesso.' }));
  }
  function capture(url, options, params) {
    if (params?.get('fb_api_req_friendly_name') !== 'usePolarisDeleteMediaRepostMutation') return false;
    const target = new URL(url, location.href);
    if (target.origin !== location.origin || target.pathname !== '/api/graphql') return false;
    deletionTemplate = { url: target.href, options: { ...options, headers: new Headers(options.headers) }, body: params.toString() };
    document.documentElement.setAttribute('data-local-repost-api-ready', 'true');
    return true;
  }
  const xhrType = window.XMLHttpRequest;
  if (xhrType) {
    const originalOpen = xhrType.prototype.open, originalSend = xhrType.prototype.send, originalHeader = xhrType.prototype.setRequestHeader;
    const requests = new WeakMap();
    xhrType.prototype.open = function (method, url, ...rest) { requests.set(this, { method, url, headers: {} }); return originalOpen.call(this, method, url, ...rest); };
    xhrType.prototype.setRequestHeader = function (key, value) { const request = requests.get(this); if (request) request.headers[key] = value; return originalHeader.call(this, key, value); };
    xhrType.prototype.send = function (body) {
      const request = requests.get(this);
      const params = typeof body === 'string' || body instanceof URLSearchParams ? new URLSearchParams(body) : null;
      if (request && capture(request.url, { method: request.method, headers: request.headers }, params)) {
        this.addEventListener('loadend', () => {
          try { publishNative(this.responseText, this.status); }
          catch { publishNative('', this.status); }
        }, { once: true });
      }
      return originalSend.call(this, body);
    };
  }
  document.documentElement.setAttribute('data-local-repost-api-ready', 'false');
  let cancelled = false, busy = false;
  document.addEventListener('local-repost-api-stop', () => { cancelled = true; });
  async function apiFetch(url, options) {
    for (;;) {
      if (cancelled) throw new Error('Interrompido pelo botão Parar.');
      const response = await nativeFetch(url, options);
      let explicitLimit = false;
      if (response.status === 200) {
        try {
          const data = JSON.parse((await response.clone().text()).replace(/^for \(;;\);/, ''));
          explicitLimit = data.errors?.some(error => /rate.?limit|too many requests/i.test(error.message || '')) || false;
        } catch {}
      }
      if (response.status !== 429 && !explicitLimit) return response;
      const header = response.headers?.get('retry-after');
      const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.max(0, (Date.parse(header) - Date.now()) / 1000) : 0;
      const retryAt = Date.now() + Math.max(30000, Number.isFinite(seconds) ? seconds * 1000 : 0);
      document.documentElement.setAttribute('data-local-repost-result', JSON.stringify({ at: Date.now(), waiting: true, retryAt }));
      while (Date.now() < retryAt) { if (cancelled) throw new Error('Interrompido pelo botão Parar.'); await new Promise(resolve => setTimeout(resolve, 250)); }
    }
  }
  window.fetch = async function (...args) {
    const body = args[1]?.body;
    const params = typeof body === 'string' || body instanceof URLSearchParams ? new URLSearchParams(body) : null;
    if (params?.get('fb_api_req_friendly_name') === 'usePolarisDeleteMediaRepostMutation') {
      const target = new URL(typeof args[0] === 'string' ? args[0] : args[0]?.url, location.href);
      if (target.origin === location.origin && target.pathname === '/api/graphql') {
        deletionTemplate = { url: target.href, options: { ...args[1], headers: new Headers(args[1]?.headers) }, body: params.toString() };
        document.documentElement.setAttribute('data-local-repost-api-ready', 'true');
      }
    }
    const result = await nativeFetch.apply(this, args);
    if (typeof body === 'string' || body instanceof URLSearchParams) {
      const params = new URLSearchParams(body);
      if (params.get('fb_api_req_friendly_name') === 'usePolarisDeleteMediaRepostMutation') {
        result.clone().text().then(raw => {
          let data;
          try { data = JSON.parse(raw.replace(/^for \(;;\);/, '')); } catch {}
          const success = result.ok && !data?.errors?.length && data?.data?.xdt_delete_media_note?.__typename === 'XDTMediaNoteDeleteResponse';
          // Only a result flag crosses into the helper; no headers, tokens or body.
          document.documentElement.setAttribute('data-local-repost-result', JSON.stringify({ at: Date.now(), success, status: result.status }));
        }).catch(() => {});
      }
    }
    return result;
  };
  document.addEventListener('local-repost-api-delete', async () => {
    if (busy) return;
    const finish = (success, status, reason, fatal = false, fallback = false) => document.documentElement.setAttribute('data-local-repost-result', JSON.stringify({ at: Date.now(), success, status, reason, fatal, fallback }));
    if (!deletionTemplate) { finish(false, 0, 'API não preparada: remova um repost pelo botão normal nesta mesma aba e volte sem F5.', true); return; }
    if (!/^\/(p|reel)\/[^/]+\/?$/.test(location.pathname)) { finish(false, 0, 'A página atual não é um vídeo/post individual.'); return; }
    busy = true; cancelled = false;
    try {
      const page = await apiFetch(location.href, { credentials: 'same-origin' });
      if (!page.ok) throw new Error(`Não carregou os dados do post: HTTP ${page.status}`);
      const html = await page.text();
      const shortcode = location.pathname.split('/')[2];
      const profile = Array.from(document.querySelectorAll('a[href]')).find(el => !el.closest('main') && /Foto do perfil de|profile picture/i.test(el.getAttribute('aria-label') || el.querySelector('img')?.getAttribute('alt') || ''));
      const viewerUsername = profile?.getAttribute('href')?.match(/^\/([^/]+)\/$/)?.[1];
      let noteId;
      try { noteId = window.localRepostNoteFromHtml(html, shortcode, viewerUsername); }
      catch (error) {
        if (/não contêm media_note|identificar o usuário atual/.test(error.message)) { finish(false, 0, error.message, false, true); return; }
        throw error;
      }
      if (!noteId) throw new Error('Este vídeo já está sem repost nos dados do servidor. Item ignorado.');
      const body = new URLSearchParams(deletionTemplate.body);
      const variables = JSON.parse(body.get('variables'));
      variables.input.note_id = noteId;
      variables.input.client_mutation_id = String(Date.now());
      body.set('variables', JSON.stringify(variables));
      const response = await apiFetch(deletionTemplate.url, { ...deletionTemplate.options, body: body.toString(), credentials: 'same-origin' });
      const data = JSON.parse((await response.text()).replace(/^for \(;;\);/, ''));
      const success = response.ok && !data.errors?.length && data.data?.xdt_delete_media_note?.__typename === 'XDTMediaNoteDeleteResponse';
      if (!success) { finish(false, response.status, 'A API recusou ou não confirmou a remoção.'); return; }
      const verification = await apiFetch(location.href, { credentials: 'same-origin', cache: 'no-store' });
      if (!verification.ok) throw new Error('A remoção respondeu, mas não foi possível conferir novamente o post.');
      const fresh = await verification.text();
      if (window.localRepostNoteFromHtml(fresh, shortcode, viewerUsername) !== null) throw new Error('O repost continuou nos dados após a remoção. Parado sem repetir.');
      finish(true, response.status);
    } catch (error) { finish(false, 0, error.message); }
    finally { busy = false; }
  });
})();
