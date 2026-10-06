const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
async function run(rejected = false, remains = false) {
  let listener, result, submitted, calls = 0;
  const reply = data => ({ ok: true, status: 200, text: async () => JSON.stringify(data), clone() { return this; } });
  const native = async (url, options) => {
    calls++;
    if (calls === 1) return reply({ data: { xdt_delete_media_note: { __typename: 'XDTMediaNoteDeleteResponse' } } });
    if (calls === 2) return { ok: true, text: async () => '<script type="application/json">{"USER_ID":"77","code":"abc","media_note":{"user_id":"77","id":"123"}}</script>' };
    if (calls === 3) {
      submitted = JSON.parse(new URLSearchParams(options.body).get('variables')).input;
      return reply(rejected ? { errors: [{ message: 'refused' }] } : { data: { xdt_delete_media_note: { __typename: 'XDTMediaNoteDeleteResponse' } } });
    }
    return { ok: true, text: async () => `<script type="application/json">${JSON.stringify({ USER_ID: '77', code: 'abc', media_note: remains ? { user_id: '77', id: '123' } : null })}</script>` };
  };
  const ctx = {
    window: { fetch: native }, location: { href: 'https://www.instagram.com/p/abc/', origin: 'https://www.instagram.com', pathname: '/p/abc/' },
    document: { querySelectorAll: () => [], addEventListener: (_, fn) => { listener = fn; }, documentElement: { setAttribute: (_, value) => { result = JSON.parse(value); } } },
    URL, URLSearchParams, Headers, Date,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/note-parser.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/request-observer.js', 'utf8'), ctx);
  await ctx.window.fetch('/api/graphql', { method: 'POST', body: new URLSearchParams({ fb_api_req_friendly_name: 'usePolarisDeleteMediaRepostMutation', variables: JSON.stringify({ input: { actor_id: '77', note_id: 'old' } }) }).toString() });
  await listener();
  assert.equal(submitted.note_id, '123');
  assert.equal(submitted.actor_id, '77');
  assert.equal(result.success, !rejected && !remains);
  assert.equal(calls, rejected ? 3 : 4);
}
(async () => { await run(); await run(true); await run(false, true); console.log('PASS: correct note ID, GraphQL rejection, persistence failure'); })().catch(error => { console.error(error); process.exitCode = 1; });
