/**
 * The shallow closed-key check and anyOf/oneOf-shaped verb configs.
 *
 * `verbTopLevelPropertyNames` used to test `body['type'] !== 'object'` on the
 * verb's config node and return null otherwise. A union node (`{ anyOf: [...] }`)
 * carries no `type` of its own, so that test failed and the resolver bailed — and
 * the caller reads null as "no key-set to enforce" and answers valid for ANY key.
 * The check did not report a problem; it stopped checking and reported success,
 * which is strictly worse than failing.
 *
 * This was live against the SHIPPED schema.json, not contingent on a re-vendor:
 * five verbs there are union-shaped — connect and play (oneOf of $refs), send_sms
 * (anyOf of $refs), sleep (anyOf of object / integer / SWMLVar), and unset (anyOf
 * of string / array). Four of the five have object branches whose keys are
 * perfectly enumerable, and the shallow check accepted arbitrary keys for all four.
 *
 * The semantic: a config satisfying a union satisfies SOME branch, so the known
 * keys are the UNION of the object branches' keys. Non-object branches contribute
 * nothing — they constrain the config to not be an object at all, a different
 * question. `unset` has no object branch, so it correctly stays disengaged.
 */
import { describe, it, expect } from 'vitest';
import { SchemaUtils } from '../src/SchemaUtils';

/** Reach the private resolver without loosening its visibility. */
type Introspectable = {
  verbTopLevelPropertyNames(verbName: string): Set<string> | null;
};
const introspect = (su: SchemaUtils): Introspectable => su as unknown as Introspectable;

/**
 * The verb configs the shipped schema expresses as an anyOf/oneOf, with one key
 * the resolved union must contain, the total key count, and a legitimate config
 * that must keep passing.
 */
const unionShapedVerbs: Array<{
  verb: string;
  wantKey: string;
  wantCount: number;
  legit: Record<string, unknown>;
}> = [
  { verb: 'sleep', wantKey: 'duration', wantCount: 1, legit: { duration: 5000 } },
  { verb: 'play', wantKey: 'url', wantCount: 8, legit: { url: 'https://example.test/a.mp3' } },
  {
    verb: 'send_sms',
    wantKey: 'body',
    wantCount: 6,
    legit: { to_number: '+15551110000', from_number: '+15552220000', body: 'hi' },
  },
  { verb: 'connect', wantKey: 'to', wantCount: 22, legit: { to: 'sip:alice@example.test' } },
];

describe('closed-key resolution over anyOf/oneOf verb configs', () => {
  // The direct negative control: before the fix every one of these resolved to
  // null, i.e. the closed-key check was disengaged on them.
  it.each(unionShapedVerbs)(
    'resolves a key set for the union-shaped verb $verb',
    ({ verb, wantKey, wantCount }) => {
      const known = introspect(new SchemaUtils()).verbTopLevelPropertyNames(verb);
      expect(
        known,
        `${verb}: closed-key check DISENGAGED on a union-shaped config; it must ` +
          `resolve to the union of the object branches' keys`,
      ).not.toBeNull();
      expect(known!.has(wantKey), `${verb}: resolved key set is missing '${wantKey}'`).toBe(true);
      expect(known!.size).toBe(wantCount);
    },
  );

  // Forbidden-key direction: a key present in no branch must be rejected. Every
  // one of these was ACCEPTED by the resolver before the fix.
  it.each(unionShapedVerbs)('rejects a key present in no branch of $verb', ({ verb }) => {
    const known = introspect(new SchemaUtils()).verbTopLevelPropertyNames(verb);
    expect(known).not.toBeNull();
    expect(
      known!.has('zzz_not_a_real_key'),
      `${verb}: a key present in no branch is in the known set`,
    ).toBe(false);
  });

  // The same direction end to end through the public validateVerb path.
  //
  // `connect` is deliberately absent from this list, and its absence is a
  // FINDING rather than an exemption: Ajv cannot compile the connect verb at
  // all. connect's `result` reaches $defs/SWMLAction, whose `SWML` property is
  // `{"$ref": "SWMLObject.json"}` — an external file that is not in the bundled
  // schema's `$defs`. Ajv resolves refs eagerly and throws
  // "can't resolve reference SWMLObject.json from id #", getVerbValidator
  // swallows that in its catch and returns null, and validateVerb silently falls
  // back to validateVerbLightweight — which finds no top-level `required` on a
  // union node and passes ANY config. So connect is unvalidated on this path for
  // a reason that has nothing to do with the union resolution fixed here, and
  // fixing it means resolving or vendoring SWMLObject.json (the schema
  // artifact), not changing this resolver. Go does not share the symptom: it
  // compiles the whole document with santhosh-tekuri, which tolerates the
  // unresolved ref, and it rejects the same forbidden key.
  it.each(unionShapedVerbs.filter((t) => t.verb !== 'connect'))(
    'validateVerb rejects a key present in no branch of $verb',
    ({ verb, legit }) => {
      const res = new SchemaUtils().validateVerb(verb, { ...legit, zzz_not_a_real_key: 1 });
      expect(res.valid, `${verb}: a key present in no branch was ACCEPTED`).toBe(false);
    },
  );

  // The other direction — the fix must not start rejecting valid documents. A
  // branch union computed as an INTERSECTION would fail here, since a key valid
  // in one branch is absent from the others.
  it.each(unionShapedVerbs)('keeps accepting a legitimate $verb config', ({ verb, legit }) => {
    const known = introspect(new SchemaUtils()).verbTopLevelPropertyNames(verb);
    expect(known).not.toBeNull();
    for (const k of Object.keys(legit)) {
      expect(known!.has(k), `${verb}: legitimate key '${k}' fell out of the union`).toBe(true);
    }
    expect(new SchemaUtils().validateVerb(verb, legit).valid).toBe(true);
  });

  // Shapes that genuinely have no closed key-set, pinned so the fix is not read
  // as "always enforce something":
  //   set   — an OPEN object (unevaluatedProperties:{} with no `not`, zero
  //           declared properties): a free-form variable bag by design.
  //   unset — a union with no object branch (string | array of string).
  //   cond / label / return — array / string / untyped, not objects at all.
  it.each(['set', 'unset', 'cond', 'label', 'return'])(
    'leaves %s disengaged rather than inventing a key set',
    (verb) => {
      expect(introspect(new SchemaUtils()).verbTopLevelPropertyNames(verb)).toBeNull();
    },
  );

  // Guards the shape the resolver already handled — a single $ref (ai ->
  // AIObject) — since the fix rewrote that path into the shared recursive one.
  it('still follows a single $ref (ai -> AIObject)', () => {
    const known = introspect(new SchemaUtils()).verbTopLevelPropertyNames('ai');
    expect(known).not.toBeNull();
    for (const want of ['prompt', 'params', 'SWAIG']) {
      expect(known!.has(want), `ai: resolved key set is missing '${want}'`).toBe(true);
    }
  });
});
