/* A stand-in for @anthropic-ai/sdk, written into a test's own node_modules: it keeps every request it is
   sent and answers with whatever the test put in globalThis.__claude.reply (an object → the JSON text Claude
   would give back; a function → called with the request; an Error class name → thrown). No network. */
import fs from 'node:fs';
export function fakeAnthropic(TMP) {
  const dir = TMP + '/node_modules/@anthropic-ai/sdk';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + '/index.js', `
class APIError extends Error { constructor(status, m){ super(m||'api'); this.status=status; } }
class AuthenticationError extends APIError {}
class PermissionDeniedError extends APIError {}
class RateLimitError extends APIError {}
class APIConnectionError extends APIError {}
const G = globalThis.__claude = globalThis.__claude || { calls: [], made: [], reply: { tasks: [], note: '' } };
export default class Anthropic {
  constructor(o){ G.made.push(o||{}); const self=this;
    this.beta = { messages: { create: async function(req){
      G.calls.push(JSON.parse(JSON.stringify(req)));
      let r = typeof G.reply === 'function' ? G.reply(req) : G.reply;
      if (r === 'auth') throw new AuthenticationError(401);
      if (r === 'rate') throw new RateLimitError(429);
      if (r === 'timeout') throw new APIConnectionError(undefined, 'timed out');
      if (r === 'refusal') return { stop_reason: 'refusal', content: [] };
      return { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(r) }] };
    } } };
  }
}
Anthropic.APIError=APIError; Anthropic.AuthenticationError=AuthenticationError; Anthropic.PermissionDeniedError=PermissionDeniedError;
Anthropic.RateLimitError=RateLimitError; Anthropic.APIConnectionError=APIConnectionError;`);
  fs.writeFileSync(dir + '/package.json', JSON.stringify({ name: '@anthropic-ai/sdk', version: '0.0.0', type: 'module', main: 'index.js' }));
  return (globalThis.__claude = globalThis.__claude || { calls: [], made: [], reply: { tasks: [], note: '' } });
}
