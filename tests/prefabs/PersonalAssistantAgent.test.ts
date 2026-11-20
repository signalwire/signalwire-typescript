/**
 * PersonalAssistantAgent: screens callers and puts them through with a
 * whisper, or takes a message.
 */

import { Messages } from '../../src/operations/messages.js';
import { PersonalAssistantAgent } from '../../src/prefabs/index.js';
import { CallSimulator } from '../../src/testing/CallSimulator.js';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML */
type Json = Record<string, any>;
const said = (args: Record<string, unknown>) => ({ ...args, data_supplied_by_user: true });

function assistant(available = true, extra: Record<string, unknown> = {}): PersonalAssistantAgent {
  return new PersonalAssistantAgent({
    role: "You answer Ann Lee's phone.",
    owner: 'Ann',
    reach: '+15550100001',
    available: () => available,
    messages: new Messages({ save: () => null }),
    suppressLogs: true,
    ...extra,
  });
}

const swmlOf = (actions: unknown[]): Json =>
  (actions as Json[]).find((a) => 'SWML' in a)!['SWML'] as Json;

describe('PersonalAssistantAgent', () => {
  it('asks who and why before putting through', async () => {
    const out = await new CallSimulator(assistant()).call('put_through', said({}));
    expect((out.toolPrompt ?? '').startsWith("Ask them: Who's calling? What's it about?")).toBe(
      true,
    );
  });

  it('rings them with the whisper', async () => {
    const sim = new CallSimulator(
      assistant(true, { whisperVoice: 'rime.spore', whisperLanguage: 'en-US' }),
    );
    const out = await sim.call(
      'put_through',
      said({ name: 'Bo', reason: 'the ${secret} contract' }),
    );
    expect(out.response).toBe('Done. Seeing whether Ann can take it.');
    expect(out.toolPrompt).toBe("Tell them you'll see if Ann can take it, and say nothing more.");
    const main = swmlOf(out.actions)['sections']['main'];
    const connect = main[0]['connect'];
    expect(connect['to']).toBe('+15550100001');
    expect(connect['timeout']).toBe(20);
    expect('from' in connect).toBe(false);
    const prompt = connect['confirm'][0]['prompt'];
    expect(prompt['play']).toBe(
      'say:Bo is calling about the secret} contract. Press 1 to take the call.',
    );
    expect([prompt['say_voice'], prompt['say_language'], prompt['initial_timeout']]).toEqual([
      'rime.spore',
      'en-US',
      15,
    ]);
    const refuse = connect['confirm'][1]['switch'];
    expect(refuse['variable']).toBe('prompt_value');
    expect(refuse['default']).toEqual([{ hangup: {} }]);
    const after = main[1]['switch'];
    expect(after['case']).toEqual({ connected: [{ hangup: {} }] });
    expect(after['default'][0]['set']['ai_response']).toBe(
      "Ann didn't take the call (${connect_failed_reason}). Tell them, and offer to take a message with " +
        'take_message.',
    );
  });

  it("offers a message when they aren't taking calls", async () => {
    const out = await new CallSimulator(assistant(false)).call(
      'put_through',
      said({ name: 'Bo', reason: 'lunch' }),
    );
    expect(out.response).toBe("Ann isn't taking calls now.");
    expect(out.toolPrompt).toBe('Tell them, and offer to take a message with take_message.');
    expect((out.actions as Json[]).some((a) => 'SWML' in a)).toBe(false);
  });

  it('takes another accept key', async () => {
    const sim = new CallSimulator(
      assistant(true, {
        acceptKey: '5',
        assistantWording: { whisper: 'Llama {name} por {reason}. Pulse {key} para atender.' },
      }),
    );
    const out = await sim.call('put_through', said({ name: 'Bo', reason: 'el contrato' }));
    const connect = swmlOf(out.actions)['sections']['main'][0]['connect'];
    expect(connect['confirm'][0]['prompt']['play']).toBe(
      'say:Llama Bo por el contrato. Pulse 5 para atender.',
    );
    expect(Object.keys(connect['confirm'][1]['switch']['case'])).toEqual(['5']);
    expect(() => assistant(true, { acceptKey: '12' })).toThrow(/one key/);
  });
});
