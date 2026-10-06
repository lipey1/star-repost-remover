window.createRepostPanel = () => {
  const style = document.createElement('style');
  style.textContent = `
    #local-repost-helper{position:fixed;right:20px;top:20px;z-index:2147483647;width:min(360px,calc(100vw - 32px));box-sizing:border-box;background:#191b1e;color:#f3f3f5;border:1px solid #34373d;border-radius:18px;font:13px/1.5 Inter,system-ui,sans-serif;box-shadow:0 16px 48px #0005;overflow:hidden}
    #local-repost-helper *{box-sizing:border-box}
    #local-repost-helper .rh-header{display:flex;gap:12px;align-items:center;padding:20px 20px 16px;border-bottom:1px solid #2e3137}
    #local-repost-helper .rh-header img{width:42px;height:42px;object-fit:cover;border-radius:12px}
    #local-repost-helper strong{font-size:17px;letter-spacing:-.35px;color:#fafafa}
    #local-repost-helper .rh-subtitle{margin:2px 0 0;color:#a5aab4;font-size:12px}
    #local-repost-helper .rh-body{padding:18px 20px 0}
    #local-repost-helper label{display:block;color:#d8dae1;font-size:12px;font-weight:600;margin-bottom:7px}
    #local-repost-helper select{appearance:auto;width:100%;min-height:44px;border:1px solid #383b43;border-radius:10px;padding:0 12px;background:#202327;color:#f3f3f5;font:inherit;cursor:pointer}
    #local-repost-helper details{color:#a5aab4;font-size:12px;margin:12px 0}
    #local-repost-helper summary{cursor:pointer;color:#bbb2ff}
    #local-repost-helper details p{margin:8px 0}
    #local-repost-helper .rh-status{margin:16px 0;color:#e4e5eb;min-height:40px;overflow-wrap:anywhere}
    #local-repost-helper .rh-actions{display:flex;gap:8px;margin:12px 0 18px}
    #local-repost-helper button{font:600 13px system-ui;cursor:pointer;border:1px solid #363940;border-radius:10px;min-height:42px;color:#ececf2;background:#22252a;padding:0 14px;transition:background .16s,transform .16s}
    #local-repost-helper button:first-child{background:#7465ed;border-color:#7465ed;color:white;flex:1}
    #local-repost-helper button:hover:not(:disabled){background:#30343b}
    #local-repost-helper button:first-child:hover:not(:disabled){background:#8576ff}
    #local-repost-helper button:active:not(:disabled){transform:translateY(1px)}
    #local-repost-helper button:disabled{opacity:.45;cursor:default}
    #local-repost-helper :is(button,select,summary):focus-visible{outline:2px solid #b5aaff;outline-offset:3px}
    #local-repost-helper .rh-console-title{display:flex;justify-content:space-between;padding:11px 20px;background:#15171a;border-top:1px solid #30333a;color:#cdd0d9;font-size:12px;font-weight:600}
    #local-repost-helper .rh-console-title span{font-weight:400;color:#9096a3}
    #local-repost-helper .rh-console{height:180px;overflow:auto;background:#111316;padding:10px 12px;font:11px/1.65 ui-monospace,Consolas,monospace;scrollbar-width:thin;scrollbar-color:#45414e #111316}
    #local-repost-helper .rh-log{display:grid;grid-template-columns:52px 1fr;gap:8px;padding:4px 0;color:#b7bdca;overflow-wrap:anywhere}
    #local-repost-helper .rh-log time{color:#727b8b}
    #local-repost-helper .rh-log[data-level=error]{color:#f3a4af}
    #local-repost-helper .rh-log[data-level=warn]{color:#eac78b}
    #local-repost-helper .rh-log[data-level=success]{color:#a4d7be}
    @media(max-height:600px){#local-repost-helper{max-height:calc(100dvh - 32px);overflow:auto}.rh-console{max-height:120px}}
    @media(max-width:420px){#local-repost-helper{right:16px;top:16px}}
  `;
  const panel = document.createElement('section'); panel.id = 'local-repost-helper'; panel.setAttribute('aria-label', 'Star Repost Remover');
  const header = document.createElement('header'); header.className = 'rh-header';
  const icon = document.createElement('img'); icon.src = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('icon.png') : 'icon.png'; icon.alt = '';
  const title = document.createElement('div'); const heading = document.createElement('strong'); heading.textContent = 'Star Repost Remover';
  const subtitle = document.createElement('p'); subtitle.className = 'rh-subtitle'; subtitle.textContent = 'Limpeza de republicados'; title.append(heading, subtitle); header.append(icon, title);
  const body = document.createElement('div'); body.className = 'rh-body';
  const label = document.createElement('label'); label.textContent = 'Modo de remoção'; label.htmlFor = 'rh-mode';
  const mode = document.createElement('select'); mode.id = 'rh-mode';
  for (const [value, text] of [['api','Individual — entra nos vídeos'],['all','Lotes de 100']]) { const option = document.createElement('option'); option.value=value; option.textContent=text; mode.append(option); }
  const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent='Como a execução funciona';
  const policy = document.createElement('p'); policy.textContent='Uma chamada por vez, sem pausa fixa após sucesso. Erros comuns são ignorados. Rate limit: espera 30s e tenta o mesmo item novamente; respeita Retry-After maior. Parar cancela a espera.'; details.append(summary,policy);
  const status = document.createElement('p'); status.className='rh-status'; status.textContent='Pronto para iniciar.';
  const lastError = document.createElement('p'); lastError.hidden=true;
  const actions = document.createElement('div'); actions.className='rh-actions';
  const start = document.createElement('button'); start.textContent='Iniciar remoção';
  const stop = document.createElement('button'); stop.textContent='Parar'; stop.disabled=true; actions.append(start,stop);
  body.append(label,mode,details,status,actions,lastError);
  const consoleTitle = document.createElement('div'); consoleTitle.className='rh-console-title'; consoleTitle.textContent='Console';
  const counter = document.createElement('span'); counter.textContent='0 eventos'; consoleTitle.append(counter);
  const consoleView = document.createElement('div'); consoleView.className='rh-console'; consoleView.setAttribute('role','log'); consoleView.setAttribute('aria-label','Eventos da execução'); consoleView.setAttribute('aria-live','polite'); consoleView.setAttribute('tabindex','0');
  panel.append(header,body,consoleTitle,consoleView); document.head.append(style); document.body.append(panel);
  let previous='', previousAt=0;
  function log(message, level) {
    const clean=message.replace(/^Último erro:\s*/, '');
    if (!clean || clean===previous) return;
    const now=Date.now();
    if (/esperando|selecionados|Rate limit/i.test(clean) && /esperando|selecionados|Rate limit/i.test(previous) && now-previousAt<3000) return;
    previous=clean; previousAt=now;
    const follow=consoleView.scrollHeight-consoleView.scrollTop-consoleView.clientHeight<40;
    const row=document.createElement('div'); row.className='rh-log';
    const normalized=clean.replace(/\b0\s+(?:itens?\s+)?(?:ignorados?|erros?|falhas?)\b/gi,'');
    const summary=/remoções confirmadas|respostas individuais confirmadas/i.test(clean);
    const failures=clean.match(/\b([1-9]\d*)\s+(?:itens?\s+)?(?:ignorados?|erros?|falhas?)\b/i);
    row.dataset.level=level || (summary ? (failures?'warn':'success') : /rate limit|interrompido|parando/i.test(normalized)?'warn':/erro|falh|ignorado|esgotado|não .*captur|recus/i.test(normalized)?'error':/confirmad|finalizado/i.test(normalized)?'success':'info');
    const time=document.createElement('time'); time.textContent=new Date().toLocaleTimeString('pt-BR',{hour12:false}); const content=document.createElement('span'); content.textContent=clean; row.append(time,content); consoleView.append(row);
    while(consoleView.childElementCount>200) consoleView.firstElementChild.remove();
    counter.textContent=`${consoleView.childElementCount} eventos`; if(follow) consoleView.scrollTop=consoleView.scrollHeight;
  }
  const statusObserver=new MutationObserver(()=>log(status.textContent)); statusObserver.observe(status,{childList:true,characterData:true,subtree:true});
  const errorObserver=new MutationObserver(()=>log(lastError.textContent,'error')); errorObserver.observe(lastError,{childList:true,characterData:true,subtree:true});
  function resetLogs(){statusObserver.takeRecords();errorObserver.takeRecords();consoleView.replaceChildren();counter.textContent='0 eventos';previous='';previousAt=0;}
  log('Pronto. Escolha o modo e inicie a remoção.');
  return {panel,status,lastError,start,stop,mode,log,resetLogs};
};
