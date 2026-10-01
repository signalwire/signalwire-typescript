/**
 * Behavioural proof that every `client.<resource>` accessor on RestClient is
 * reachable at runtime and routes to the real REST path.
 *
 * RestClient declares NONE of these members itself — they are declared and
 * wired by the generated `_GeneratedResourceTree` base it extends
 * (src/rest/namespaces/_client_tree_generated.ts, RULES §8). That indirection
 * is invisible to a source-only reader, so this suite pins it behaviourally:
 * for each of the 22 accessors (16 flat resources + 6 namespace containers) it
 * makes a real call through the accessor against the shared porting-sdk mock
 * and asserts the request landed on the mock with the expected method + path
 * and matched a spec route.
 *
 * This is the regression guard for the resource tree as a whole: if a wiring
 * regression drops an accessor, or the generator stops emitting one, a call
 * here throws instead of silently reducing the client's surface.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

/**
 * One accessor under test: the property name on RestClient, a call that goes
 * through it, and the wire request that call must produce.
 *
 * `call` receives the client rather than closing over it so each case reaches
 * the accessor off the client under test.
 */
interface AccessorCase {
  /** Property name as declared on `_GeneratedResourceTree`. */
  readonly accessor: string;
  /** Reach the accessor and issue one request through it. */
  readonly call: (c: RestClient) => Promise<unknown>;
  readonly method: string;
  readonly path: string;
}

// --- The 16 flat resources -----------------------------------------------

const FLAT_RESOURCES: readonly AccessorCase[] = [
  {
    accessor: 'addresses',
    call: (c) => c.addresses.list(),
    method: 'GET',
    path: '/api/relay/rest/addresses',
  },
  {
    accessor: 'calling',
    call: (c) => c.calling.play('call-uuid', [{ type: 'silence', params: { duration: 1 } }]),
    method: 'POST',
    path: '/api/calling/calls',
  },
  {
    accessor: 'chat',
    call: (c) => c.chat.createToken(3600, { 'room-1': { read: true, write: true } }),
    method: 'POST',
    path: '/api/chat/tokens',
  },
  {
    accessor: 'importedNumbers',
    call: (c) => c.importedNumbers.create('+15551230000', 'longcode'),
    method: 'POST',
    path: '/api/relay/rest/imported_phone_numbers',
  },
  {
    accessor: 'lookup',
    call: (c) => c.lookup.phoneNumber('+15551230000'),
    method: 'GET',
    path: '/api/relay/rest/lookup/phone_number/+15551230000',
  },
  {
    accessor: 'messages',
    call: (c) => c.messages.create('+15551230000', '+15559990000', { body: 'hi' }),
    method: 'POST',
    path: '/api/messaging/messages',
  },
  {
    accessor: 'mfa',
    call: (c) => c.mfa.sms('+15551230000'),
    method: 'POST',
    path: '/api/relay/rest/mfa/sms',
  },
  {
    accessor: 'numberGroups',
    call: (c) => c.numberGroups.list(),
    method: 'GET',
    path: '/api/relay/rest/number_groups',
  },
  {
    accessor: 'phoneNumbers',
    call: (c) => c.phoneNumbers.list(),
    method: 'GET',
    path: '/api/relay/rest/phone_numbers',
  },
  {
    accessor: 'projects',
    call: (c) => c.projects.list(),
    method: 'GET',
    path: '/api/projects',
  },
  {
    accessor: 'pubsub',
    call: (c) => c.pubsub.createToken(3600, { 'ch-1': { read: true, write: true } }),
    method: 'POST',
    path: '/api/pubsub/tokens',
  },
  {
    accessor: 'queues',
    call: (c) => c.queues.list(),
    method: 'GET',
    path: '/api/relay/rest/queues',
  },
  {
    accessor: 'recordings',
    call: (c) => c.recordings.list(),
    method: 'GET',
    path: '/api/relay/rest/recordings',
  },
  {
    accessor: 'shortCodes',
    call: (c) => c.shortCodes.list(),
    method: 'GET',
    path: '/api/relay/rest/short_codes',
  },
  {
    accessor: 'sipProfile',
    call: (c) => c.sipProfile.get(),
    method: 'GET',
    path: '/api/relay/rest/sip_profile',
  },
  {
    accessor: 'verifiedCallers',
    call: (c) => c.verifiedCallers.list(),
    method: 'GET',
    path: '/api/relay/rest/verified_caller_ids',
  },
] as const;

// --- The 6 namespace containers ------------------------------------------

const NAMESPACES: readonly AccessorCase[] = [
  {
    accessor: 'datasphere',
    call: (c) => c.datasphere.documents.list(),
    method: 'GET',
    path: '/api/datasphere/documents',
  },
  {
    accessor: 'fabric',
    call: (c) => c.fabric.aiAgents.list(),
    method: 'GET',
    path: '/api/fabric/resources/ai_agents',
  },
  {
    accessor: 'logs',
    call: (c) => c.logs.voice.list(),
    method: 'GET',
    path: '/api/voice/logs',
  },
  {
    accessor: 'project',
    call: (c) => c.project.tokens.create('tok', []),
    method: 'POST',
    path: '/api/project/tokens',
  },
  {
    accessor: 'registry',
    call: (c) => c.registry.brands.list(),
    method: 'GET',
    path: '/api/relay/rest/registry/beta/brands',
  },
  {
    accessor: 'video',
    call: (c) => c.video.rooms.list(),
    method: 'GET',
    path: '/api/video/rooms',
  },
] as const;

async function assertReaches(c: AccessorCase): Promise<void> {
  const accessed = (client as unknown as Record<string, unknown>)[c.accessor];
  expect(accessed, `client.${c.accessor} is not defined`).toBeDefined();

  await c.call(client);

  const last = await mock.last();
  expect(last.method).toBe(c.method);
  expect(last.path).toBe(c.path);
  expect(
    last.matched_route,
    `client.${c.accessor} produced ${last.method} ${last.path}, which matched no spec route`,
  ).not.toBeNull();
}

describe('RestClient resource tree (inherited from _GeneratedResourceTree)', () => {
  describe('flat resources', () => {
    for (const c of FLAT_RESOURCES) {
      it(`client.${c.accessor} is reachable and hits ${c.method} ${c.path}`, async () => {
        await assertReaches(c);
      });
    }
  });

  describe('namespace containers', () => {
    for (const c of NAMESPACES) {
      it(`client.${c.accessor} is reachable and hits ${c.method} ${c.path}`, async () => {
        await assertReaches(c);
      });
    }
  });

  it('exposes exactly the 22 generated accessors, all non-null', () => {
    const expected = [...FLAT_RESOURCES, ...NAMESPACES].map((c) => c.accessor).sort();
    expect(expected.length).toBe(22);

    const record = client as unknown as Record<string, unknown>;
    for (const name of expected) {
      expect(record[name], `client.${name} is missing`).toBeDefined();
      expect(record[name], `client.${name} is null`).not.toBeNull();
    }
  });
});
