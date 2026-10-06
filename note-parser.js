(() => {
  'use strict';
  window.localRepostNoteFromHtml = (html, shortcode, viewerUsername) => {
    const found = new Set();
    let matchedPost = false;
    const viewerId = html.match(/"USER_ID"\s*:\s*"(\d+)"/)?.[1];
    if ((!viewerId || viewerId === '0') && !viewerUsername) throw new Error('Não foi possível identificar o usuário atual nos dados do servidor.');
    function collectNotes(value, mediaIds) {
      if (!value || typeof value !== 'object') return;
      if (value.media_note && ((viewerId && viewerId !== '0' && String(value.media_note.user_id) === viewerId) || (viewerUsername && value.media_note.user?.username === viewerUsername))) {
        const note = value.media_note;
        if (note.media_id != null && !mediaIds.has(String(note.media_id).split('_')[0])) return;
        const id = note.id;
        if (typeof id === 'string' && /^\d+$/.test(id)) found.add(id);
        else if (typeof id === 'number' && Number.isSafeInteger(id)) found.add(String(id));
        else throw new Error('O repost do vídeo não forneceu um ID válido.');
      }
      for (const child of Object.values(value)) collectNotes(child, mediaIds);
    }
    function walk(value) {
      if (!value || typeof value !== 'object') return;
      if (value.code === shortcode && (Object.prototype.hasOwnProperty.call(value, 'media_note') || Object.prototype.hasOwnProperty.call(value, 'floating_context_items'))) {
        matchedPost = true;
        const mediaIds = new Set([value.id, value.pk].filter(id => id != null).map(id => String(id).split('_')[0]));
        collectNotes(value, mediaIds);
      }
      for (const child of Object.values(value)) walk(child);
    }
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
      let data;
      try { data = JSON.parse(match[1]); } catch { continue; }
      walk(data);
    }
    if (!matchedPost) throw new Error('Os dados do servidor não contêm media_note para este vídeo. Não vou usar IDs de outros posts.');
    if (found.size > 1) throw new Error('O servidor forneceu IDs diferentes para o mesmo vídeo.');
    return found.size ? [...found][0] : null;
  };
})();
