(() => {
  'use strict';
  if (document.getElementById('local-repost-helper')) return;
  const { panel, status, lastError, start, stop, mode, log, resetLogs } = window.createRepostPanel();
  const JOB_KEY = 'star-repost-running-job';
  let previousJob;
  try { previousJob = JSON.parse(sessionStorage.getItem(JOB_KEY) || 'null'); } catch {}
  const onList = location.pathname.replace(/\/$/, '') === '/your_activity/interactions/reposts';
  if (!onList) {
    mode.disabled = true;
    start.textContent = 'Voltar aos republicados';
    status.textContent = previousJob ? `A navegação recarregou a página e interrompeu a execução. Última contagem: ${previousJob.total || 0} remoções confirmadas. Volte à lista para iniciar novamente.` : 'Abra a página de republicados para iniciar a remoção.';
    log('A execução não continua após um carregamento completo de página. Nenhuma remoção será repetida automaticamente.', 'warn');
    start.onclick = () => { sessionStorage.removeItem(JOB_KEY); location.assign('/your_activity/interactions/reposts'); };
    return;
  }
  let running = false, stopped = false, total = 0, individualVideo = false;
  const saveJob = () => sessionStorage.setItem(JOB_KEY, JSON.stringify({ total, mode: mode.value, updatedAt: Date.now() }));
  if (previousJob) log(`Execução interrompida por recarregamento. Última contagem: ${previousJob.total || 0}. Clique em Iniciar para uma nova execução.`, 'warn');
  const panelGuard = new MutationObserver(() => {
    if (running && !panel.isConnected && document.body) document.body.append(panel);
  });
  panelGuard.observe(document.documentElement, { childList: true, subtree: true });
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const text = el => (el.innerText || el.textContent || '').trim();
  const scope = () => document.querySelector('main article') || document.querySelector('main');
  const controls = root => Array.from(root.querySelectorAll('button,[role="button"],a,span,div')).filter(el => !panel.contains(el) && visible(el));
  function exactControl(root, names) {
    const matches = controls(root).filter(el => names.includes(text(el)));
    return matches.find(el => el.matches('button,[role="button"]') && !matches.some(other => other !== el && el.contains(other) && other.matches('button,[role="button"]')))
      || matches.find(el => !matches.some(other => other !== el && el.contains(other)));
  }
  function guard() {
    if (stopped) throw new Error('Interrompido pelo botão Parar.');
    if (individualVideo) {
      if (!/^\/(p|reel)\/[^/]+\/?$/.test(location.pathname)) throw new Error('Página individual inesperada. Parado.');
      if (mode.value !== 'api' && document.visibilityState !== 'visible') throw new Error('A aba perdeu o foco. Parado.');
      const warnings = Array.from(document.querySelectorAll('[role="alert"],[role="dialog"]')).filter(visible).map(text).join(' ');
      if (/try again|tente novamente|restricted|bloquead|restriç|too many|something went wrong|algo deu errado/i.test(warnings)) throw new Error('Instagram mostrou erro. Parado sem repetir.');
      return document.querySelector('main') || document.body;
    }
    if (location.pathname.replace(/\/$/, '') !== '/your_activity/interactions/reposts') throw new Error('Página mudou. Nenhuma outra categoria será modificada.');
    if (mode.value !== 'api' && document.visibilityState !== 'visible') throw new Error('A aba perdeu o foco. Volte a esta página e inicie novamente.');
    const root = scope();
    if (!root) throw new Error('Página de republicados não encontrada.');
    const selectedTab = root.querySelector('[role="tab"][aria-selected="true"]');
    if (!selectedTab || !/^(Reposts|Republicações)$/i.test(text(selectedTab))) throw new Error('A categoria selecionada não é Reposts.');
    const warnings = Array.from(document.querySelectorAll('[role="alert"],[role="dialog"]')).filter(visible).map(text).join(' ');
    if (/tente novamente|try again|bloquead|restriç|restricted|too many|limite|algo deu errado|something went wrong/i.test(warnings)) throw new Error('Instagram mostrou erro ou restrição. Parado, sem tentativas automáticas.');
    return root;
  }
  async function waitFor(read, timeout = 60000, interval = 300, stage = 'atualização da página') {
    const end = Date.now() + timeout;
    while (Date.now() < end) { guard(); const result = read(); if (result) return result; await sleep(interval); }
    throw new Error(`Tempo esgotado: ${stage}. Parado para conferir esta etapa.`);
  }
  const selectedCount = root => {
    const match = text(root).match(/(\d+)\s+(?:itens? selecionados?|items? selected)/i);
    return match ? Number(match[1]) : 0;
  };
  const toggles = root => Array.from(root.querySelectorAll('[aria-label="Alternar caixa de seleção"],[aria-label="Toggle checkbox"]')).filter(visible);
  function isSelected(toggle) {
    const checked = toggle.getAttribute('aria-checked');
    if (checked === 'true' || checked === 'false') return checked === 'true';
    const masks = Array.from(toggle.querySelectorAll('[style]')).map(el => getComputedStyle(el).maskImage).join(' ');
    if (masks.includes('circle-check__filled')) return true;
    if (masks.includes('circle__outline')) return false;
    throw new Error('Estado da caixa de seleção desconhecido. Parado sem excluir.');
  }
  async function selectNext() {
    const root = guard(), before = selectedCount(root);
    const next = toggles(root).find(toggle => !isSelected(toggle));
    if (!next) return false;
    cardFor(next).click();
    let divergentSince = null;
    await waitFor(() => {
      const current = selectedCount(guard());
      if (current !== before && current !== before + 1) {
        divergentSince ??= Date.now();
        if (Date.now() - divergentSince >= 2000) throw new Error('O contador de seleção divergiu por 2 segundos. Parado sem excluir.');
      } else divergentSince = null;
      return current === before + 1;
    }, 60000, 50);
    return true;
  }
  async function waitForItems() {
    status.textContent = `${total} removidos; esperando os republicados carregarem (até 60 segundos).`;
    const deadline = Date.now() + 60000;
    let lastCount = -1, stableSince = Date.now();
    while (Date.now() < deadline) {
      const root = guard();
      const items = toggles(root);
      if (items.length !== lastCount) { lastCount = items.length; stableSince = Date.now(); }
      if (items.length >= 10 || (items.length > 0 && Date.now() - stableSince >= 10000)) return items.slice(0, 10);
      // Ask the actual scroll container for more items instead of reloading the page.
      await scrollListDown(root, items);
      await sleep(1000);
    }
    if (lastCount > 0) return toggles(guard()).slice(0, 10);
    throw new Error('Nenhum republicado carregou em 60 segundos. Parado sem repetir exclusões.');
  }
  function cardFor(toggle) {
    let el = toggle.parentElement;
    while (el && el !== scope()) {
      if (el.getAttribute('role') === 'button' && /compartilhado em|shared on/i.test(el.getAttribute('aria-label') || '') && getComputedStyle(el).pointerEvents !== 'none') return el;
      el = el.parentElement;
    }
    throw new Error('Estrutura do cartão mudou. Não vou clicar por aproximação.');
  }
  async function scrollListDown(root, items, alreadyCards = false) {
    const anchor = items.length ? (alreadyCards ? items[items.length - 1] : cardFor(items[items.length - 1])) : root.querySelector('[role="progressbar"]');
    let container = anchor?.parentElement;
    while (container && container !== document.body) {
      if (/(auto|scroll)/.test(getComputedStyle(container).overflowY) && container.scrollHeight > container.clientHeight) break;
      container = container.parentElement;
    }
    const scroller = container && container !== document.body ? container : document.scrollingElement;
    if (!scroller) return;
    const bottom = scroller.scrollHeight - scroller.clientHeight;
    // Move the scrollbar again even when already at the bottom, so lazy loading
    // can observe another real scroll after the previous request completes.
    if (scroller.scrollTop >= bottom - 2) {
      scroller.scrollTop = Math.max(0, bottom - 80);
      await sleep(80);
      guard();
    }
    scroller.scrollTop = Math.min(bottom, scroller.scrollTop + Math.max(400, scroller.clientHeight * 0.8));
  }
  async function selectEverything() {
    let count = 0, lastNew = Date.now(), loadingSince = null;
    await waitFor(() => toggles(guard()).length);
    for (;;) {
      const root = guard();
      if (selectedCount(root) !== count) await waitFor(() => selectedCount(guard()) === count, 2000, 50);
      const items = toggles(root);
      const next = items.find(toggle => !isSelected(toggle));
      if (next) {
        await selectNext();
        count++; lastNew = Date.now(); loadingSince = null;
        status.textContent = `${total} removidos; ${count}/100 selecionados neste lote.`;
        if (count >= 100) return count;
        continue;
      }
      await scrollListDown(root, items);
      const loading = Array.from(root.querySelectorAll('[role="progressbar"],[aria-busy="true"]')).some(visible);
      if (loading) {
        loadingSince ??= Date.now(); lastNew = Date.now();
        if (Date.now() - loadingSince >= 60000) throw new Error('Carregamento travado. Seleção preservada, sem excluir.');
      } else {
        loadingSince = null;
        if (Date.now() - lastNew >= 60000 && items.length) return count;
        if (Date.now() - lastNew >= 60000) throw new Error('A lista não reapareceu em 60 segundos. Seleção preservada, sem excluir.');
      }
      status.textContent = `${count}/100 selecionados; descendo a lista e esperando novos itens (até 60s sem novidades).`;
      await sleep(600);
    }
  }
  stop.onclick = () => { stopped = true; document.dispatchEvent(new Event('local-repost-api-stop')); status.textContent = 'Parando. A seleção atual ficará na tela.'; };
  function individualCards(root) {
    const seen = new Set();
    return Array.from(root.querySelectorAll('[role="button"][aria-label]')).filter(el => {
      if (!visible(el) || !/compartilhado em|shared on/i.test(el.getAttribute('aria-label'))) return false;
      const src = el.querySelector('img')?.getAttribute('src');
      if (!src) return false;
      const key = new URL(src, location.href).pathname;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  function individualClickTarget(card) {
    let target = card;
    while (target && target !== scope() && getComputedStyle(target).pointerEvents === 'none') target = target.parentElement;
    if (!target || target === scope()) throw new Error('Não encontrou o elemento clicável do cartão.');
    return target;
  }
  async function individualLoop() {
    const processed = new Set();
    let skipped = 0;
    for (;;) {
      const root = guard();
      if (exactControl(root, ['Cancelar', 'Cancel'])) throw new Error('Cancele a seleção antes de usar o modo individual.');
      const cards = individualCards(root);
      const identity = card => {
        const src = card.querySelector('img')?.getAttribute('src');
        if (!src) throw new Error('Cartão sem identificador visual. Parado.');
        return new URL(src, location.href).pathname;
      };
      const card = cards.find(el => !processed.has(identity(el)));
      if (!card) {
        let until = Date.now() + 60000;
        let appeared = false;
        while (Date.now() < until) {
          guard();
          const currentCards = individualCards(scope());
          if (currentCards.some(el => !processed.has(identity(el)))) { appeared = true; break; }
          if (Array.from(scope().querySelectorAll('[role="progressbar"],[aria-busy="true"]')).some(visible)) until = Date.now() + 60000;
          if (/nenhum repost|nenhuma republicação|no reposts/i.test(text(scope()))) break;
          status.textContent = `${total} respostas individuais confirmadas; descendo e esperando novos cartões.`;
          await scrollListDown(scope(), currentCards, true);
          await sleep(600);
        }
        if (appeared) continue;
        status.textContent = skipped ? `Finalizado: ${total} remoções confirmadas; ${skipped} itens com erro ficaram ignorados. Não apareceram mais itens novos.` : `Finalizado: ${total} remoções confirmadas. Não apareceram mais itens após percorrer a lista e esperar 60s.`;
        return;
      }
      const key = identity(card);
      saveJob();
      let opened = false, attempt = 0;
      while (!opened) {
        guard();
        const freshCard = individualCards(scope()).find(el => identity(el) === key);
        if (!freshCard) {
          log('O cartão mudou ou saiu da lista. Buscando o próximo disponível.', 'warn');
          break;
        }
        attempt++;
        status.textContent = `Abrindo vídeo — tentativa ${attempt}. ${total} remoções confirmadas.`;
        const target = individualClickTarget(freshCard);
        target.scrollIntoView({ block: 'center', behavior: 'auto' });
        target.click();
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          if (stopped) throw new Error('Interrompido pelo botão Parar.');
          if (/^\/(p|reel)\/[^/]+\/?$/.test(location.pathname)) { opened = true; break; }
          if (location.pathname.replace(/\/$/, '') !== '/your_activity/interactions/reposts') throw new Error('Página mudou para uma rota inesperada.');
          await sleep(100);
        }
        if (!opened) {
          individualVideo = false;
          status.textContent = 'Vídeo não abriu em 30s. Buscando o cartão atualizado e tentando novamente…';
          await sleep(500);
        }
      }
      if (!opened) continue;
      individualVideo = true;
      const bubble = () => Array.from(document.querySelectorAll('button,[role="button"]')).find(el => visible(el) && el.querySelector('svg[aria-label="Repostar"][height="22"],svg[aria-label="Repost"][height="22"]'));
      const prepareApi = mode.value === 'api' && document.documentElement.getAttribute('data-local-repost-api-ready') !== 'true';
      if (mode.value !== 'api' || prepareApi) await waitFor(() => bubble(), 15000, 100, 'identificar o balão de repost existente');
      const findRepost = () => Array.from(document.querySelectorAll('button,[role="button"]')).find(el => visible(el) && el.querySelector('svg[aria-label="Repostar"][height="24"],svg[aria-label="Repost"][height="24"]') && !el.querySelector('svg[aria-label="Repostar"][height="22"],svg[aria-label="Repost"][height="22"]'));
      const repost = findRepost();
      if ((mode.value !== 'api' || prepareApi) && !repost) throw new Error('Botão individual não encontrado. Parado.');
      document.documentElement.removeAttribute('data-local-repost-result');
      const sentAt = Date.now();
      if (prepareApi) {
        status.textContent = 'Preparando a API automaticamente com a primeira remoção pelo botão do Instagram…';
        repost.click();
      }
      else if (mode.value === 'api') document.dispatchEvent(new Event('local-repost-api-delete'));
      else repost.click();
      let succeeded = true;
      let usedNativeFallback = false;
      let responseDeadline = Date.now() + 30000;
      for (;;) {
        guard();
        const raw = document.documentElement.getAttribute('data-local-repost-result');
        if (!raw) {
          status.textContent = prepareApi ? 'Primeiro repost: esperando capturar a resposta nativa (fetch/XHR)…' : 'API: esperando a resposta da remoção…';
          if (Date.now() > responseDeadline) throw new Error(prepareApi ? 'O botão foi acionado, mas a resposta nativa não foi capturada em 30s (fetch/XHR). Confira a preparação.' : 'A API não forneceu resultado em 30s.');
          await sleep(100); continue;
        }
        const result = JSON.parse(raw);
        if (result.at < sentAt) { await sleep(100); continue; }
        if (result.waiting) { status.textContent = `Rate limit: esperando ${Math.max(0, Math.ceil((result.retryAt - Date.now()) / 1000))}s antes de tentar novamente.`; await sleep(500); continue; }
        if (result.fallback && !usedNativeFallback) {
          status.textContent = 'ID ausente: esperando o vídeo carregar o controle individual…';
          const fallbackButton = await waitFor(() => bubble() && findRepost(), 20000, 100, 'carregar o botão individual para o fallback');
          usedNativeFallback = true;
          document.documentElement.removeAttribute('data-local-repost-result');
          status.textContent = 'ID indisponível na resposta: removendo este item pelo botão individual do Instagram…';
          responseDeadline = Date.now() + 30000;
          fallbackButton.click();
          continue;
        }
        if (!result.success) {
          const reason = result.reason || `HTTP ${result.status}`;
          lastError.textContent = `Último erro: ${reason}`;
          sessionStorage.setItem('local-repost-last-error', reason);
          if (result.fatal) throw new Error(reason);
          if (mode.value !== 'api') throw new Error(result.reason || `Instagram não confirmou a remoção (HTTP ${result.status}).`);
          succeeded = false; skipped++;
          status.textContent = `Item ignorado: ${result.reason || `HTTP ${result.status}`}. ${skipped} erros nesta execução.`;
          console.warn('[Star Repost Remover] Item ignorado:', result.reason || `HTTP ${result.status}`);
        }
        break;
      }
      // The native mutation response is authoritative for this step. Background
      // tabs can keep the old bubble rendered after the request has succeeded.
      if (mode.value !== 'api') await waitFor(() => !bubble(), 15000, 100, 'confirmar desaparecimento do balão após remover');
      if (prepareApi && document.documentElement.getAttribute('data-local-repost-api-ready') !== 'true') throw new Error('A primeira remoção não forneceu o modelo da API. Parado para conferir o transporte da requisição.');
      if (succeeded) total++;
      saveJob();
      processed.add(key);
      status.textContent = `${total} remoções confirmadas; ${skipped} itens ignorados. Voltando à lista.`;
      history.back();
      const returnDeadline = Date.now() + 30000;
      while (location.pathname.replace(/\/$/, '') !== '/your_activity/interactions/reposts') {
        if (stopped || Date.now() >= returnDeadline) throw new Error('Não voltou à lista. Parado.');
        await sleep(100);
      }
      individualVideo = false;
      await waitFor(() => exactControl(guard(), ['Selecionar', 'Select']), 60000, 300, 'carregar a lista depois de voltar do vídeo');
      if (mode.value !== 'api') await sleep(1500);
    }
  }
  start.onclick = async () => {
    if (running) return;
    resetLogs();
    lastError.textContent = '';
    sessionStorage.removeItem('local-repost-last-error');
    document.documentElement.removeAttribute('data-local-repost-result');
    total = 0;
    status.textContent = 'Iniciando nova execução…';
    const all = mode.value === 'all';
    running = true; stopped = false; start.disabled = true; stop.disabled = false; mode.disabled = true;
    saveJob();
    try {
      if (mode.value === 'individual' || mode.value === 'api') { await individualLoop(); return; }
      for (;;) {
        let root = guard();
        if (document.querySelector('[role="dialog"]')) throw new Error('Feche o diálogo já aberto antes de iniciar.');
        if (selectedCount(root)) throw new Error('Já há itens selecionados. Cancele a seleção antes de iniciar.');
        await waitFor(() => exactControl(guard(), ['Selecionar', 'Select']) || /nenhum repost|nenhuma republicação|no reposts/i.test(text(guard())));
        root = guard();
        const select = exactControl(root, ['Selecionar', 'Select']);
        if (!select) {
          if (/nenhum repost|nenhuma republicação|no reposts/i.test(text(root))) { status.textContent = `Lista vazia. ${total} remoções confirmadas nesta execução.`; break; }
          throw new Error('Botão Selecionar não encontrado. Confira carregamento e filtros; a lista não foi considerada vazia.');
        }
        select.click();
        const items = all ? [] : await waitForItems();
        const allCount = all ? await selectEverything() : 0;
        for (let index = 0; index < items.length; index++) {
          if (!await selectNext()) throw new Error('Faltaram cartões para selecionar. Parado sem excluir.');
        }
        root = guard(); const count = selectedCount(root);
        if (count !== (all ? allCount : items.length) || !count) throw new Error('Quantidade selecionada inesperada. Nenhuma exclusão executada.');
        const remove = exactControl(root, ['Excluir', 'Delete']);
        if (!remove) throw new Error('Botão Excluir não encontrado.');
        remove.click();
        const dialog = await waitFor(() => Array.from(document.querySelectorAll('[role="dialog"]')).find(el => visible(el) && /repost|republica/i.test(text(el))));
        status.textContent = `${total} removidos. Removendo lote de ${count} republicados.`;
        guard();
        const confirmDelete = exactControl(dialog, ['Excluir', 'Delete']);
        if (!confirmDelete) throw new Error('Confirmação Excluir não encontrada.');
        confirmDelete.click();
        await waitFor(() => !dialog.isConnected && selectedCount(guard()) === 0);
        await waitFor(() => exactControl(guard(), ['Selecionar', 'Select']) || /nenhum repost|nenhuma republicação|no reposts/i.test(text(guard())));
        status.textContent = `O Instagram fechou o lote de ${count}, mas a remoção não foi verificada. Use o modo individual; não vou contar estes itens como removidos.`;
        break;
      }
    } catch (error) {
      status.textContent = `${total} respostas individuais confirmadas. ${error.message}`;
      lastError.textContent = `Último erro: ${error.message}`;
      sessionStorage.setItem('local-repost-last-error', error.message);
    }
    finally {
      sessionStorage.removeItem(JOB_KEY);
      document.dispatchEvent(new Event('local-repost-api-stop'));
      if (individualVideo && /^\/(p|reel)\/[^/]+\/?$/.test(location.pathname)) history.back();
      individualVideo = false;
      running = false; start.disabled = false; stop.disabled = true; mode.disabled = false;
    }
  };
})();
