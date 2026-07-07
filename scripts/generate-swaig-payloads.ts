/**
 * generate-swaig-payloads.ts — typed SWAIG wire-payload + response-action config
 * type generator (SWAIG_PIPELINE §4), from the vendored porting-sdk/swaig-specs/
 * (the AUTHORITATIVE mod_openai engine specs).
 *
 * Emits two committed modules:
 *   - src/SwaigContracts.generated.ts — the READ-side payloads a handler RECEIVES:
 *     SwaigRequest (from swaig-request.yaml) + the PostPrompt tree (post-prompt.yaml).
 *   - src/SwaigActions.generated.ts — the typed response-action CONFIG surface
 *     (<Verb>Action per object-shaped action value in swaig-response.yaml).
 *
 * Run: `npx tsx scripts/generate-swaig-payloads.ts` (`--check` = the
 * GEN-FRESH-SWAIG gate: exit non-zero if either committed file is stale).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import {
  CHECK,
  OpenApiDoc,
  Schema,
  emitFile,
  finalizeCheck,
  formatTs,
  objectBody,
  pascal,
  resolvePortingSdk,
  tsName,
  tsType,
} from './_gen-common.js';

/**
 * The typed SWAIG wire payloads (SWAIG_PIPELINE §4), from the vendored
 * porting-sdk/swaig-specs/*.yaml — the AUTHORITATIVE mod_openai engine specs (not
 * the non-authoritative swml-webhooks derivative). Mirrors the Python reference
 * (`generate_swaig_request` + `generate_post_prompt` in
 * generate_python_rest_types.py): `swaig-request.yaml` → the `SwaigRequest` the
 * function handler RECEIVES, `post-prompt.yaml` → the full `PostPrompt` payload
 * tree the post-prompt/onSummary callback RECEIVES.
 *
 * Both are READ-side payloads, so they are OPEN-SHAPED: every field is optional
 * (the engine sends conditionals only when their precondition holds — the spec's
 * `required:` list is intentionally ignored, exactly as the Python emitter drops
 * it under TypedDict `total=False`) and every named type carries a top-level
 * `[key: string]: unknown` index signature so unmodeled server keys round-trip.
 * There is NO `extras` write door — these are received, never built.
 *
 * Both specs emit into ONE module so the cross-spec `SwaigRequest` ref (used by
 * `PostPromptSwaigLogEntry.post_data`) resolves locally (Python re-imports it
 * across modules; TS co-locates).
 */
function swaigDeclaration(name: string, schema: Schema): string {
  // Open-shaped READ payload: drop `required` (all fields optional) and force the
  // top-level open index signature. `objectBody(topLevel=true)` emits the index
  // signature only on `additionalProperties: true`, so set it for object schemas.
  const doc = schema.description ? `/** ${schema.description.split('\n')[0]} */\n` : '';
  const isObject =
    (schema.type === 'object' || (!schema.type && schema.properties)) &&
    !schema.oneOf &&
    !schema.anyOf &&
    !schema.allOf;
  if (isObject && schema.properties) {
    const open: Schema = { ...schema, required: [], additionalProperties: true };
    return `${doc}export interface ${tsName(name)} ${objectBody(open, 0, true, name)}\n`;
  }
  // oneOf/anyOf union (PostPromptCallLogEntry) / non-object → a type alias.
  return `${doc}export type ${tsName(name)} = ${tsType(schema, 0)};\n`;
}

async function generateSwaigContracts(
  requestSpecPath: string,
  postPromptSpecPath: string,
  outPath: string,
): Promise<number> {
  const reqDoc = yaml.load(fs.readFileSync(requestSpecPath, 'utf-8')) as OpenApiDoc;
  const ppDoc = yaml.load(fs.readFileSync(postPromptSpecPath, 'utf-8')) as OpenApiDoc;
  const decls: string[] = [];

  // --- swaig-request.yaml → SwaigRequest (+ the inline `argument` lifted to a
  // named SwaigArgument), mirroring generate_swaig_request. ---
  const reqSchema = reqDoc.components?.schemas?.SwaigRequest;
  if (!reqSchema) throw new Error('swaig-request.yaml: missing components.schemas.SwaigRequest');
  const reqProps = reqSchema.properties ?? {};
  const outProps: Record<string, Schema> = {};
  for (const [pname, pschema] of Object.entries(reqProps)) {
    if (pname === 'argument' && pschema.properties) {
      decls.push(
        swaigDeclaration('SwaigArgument', { type: 'object', properties: pschema.properties }),
      );
      outProps[pname] = { $ref: '#/components/schemas/SwaigArgument' };
    } else {
      outProps[pname] = pschema;
    }
  }
  decls.push(swaigDeclaration('SwaigRequest', { type: 'object', properties: outProps }));

  // --- post-prompt.yaml → the PostPrompt tree (one decl per component schema),
  // mirroring generate_post_prompt. SwaigRequest is already declared above, so
  // its in-tree ref (PostPromptSwaigLogEntry.post_data) resolves locally. ---
  const ppSchemas = ppDoc.components?.schemas ?? {};
  for (const [pname, pschema] of Object.entries(ppSchemas)) {
    if (pname === 'SwaigRequest') continue; // declared from the request spec above
    decls.push(swaigDeclaration(pname, pschema));
  }

  const header =
    `// AUTO-GENERATED from porting-sdk/swaig-specs/{swaig-request,post-prompt}.yaml — DO NOT EDIT.\n` +
    `// Regenerate with: npx tsx scripts/generate-swaig-payloads.ts\n//\n` +
    `// The typed SWAIG wire payloads (SWAIG_PIPELINE §4) from the AUTHORITATIVE\n` +
    `// mod_openai engine specs: SwaigRequest is the body a SWAIG function handler\n` +
    `// RECEIVES; the PostPrompt tree is the call-end summary payload the\n` +
    `// post-prompt / onSummary callback RECEIVES. Open-shaped READ payloads — every\n` +
    `// field optional, every named type carries a [key: string]: unknown tail so\n` +
    `// unmodeled server keys round-trip. Held to the same lint bar as hand-written\n` +
    `// source (no rule suppressions, no loose types).\n\n`;
  const formatted = await formatTs(header + decls.join('\n'), outPath);
  emitFile(outPath, formatted);
  return decls.length;
}

// ---- SWAIG response-action config types (swaig-response.yaml) ---------------

/**
 * The typed SWAIG response-action CONFIG surface, mirroring the Python reference's
 * `generate_swaig_actions` (swaig_actions_generated.py). For each action under
 * `SwaigAction.properties`, an object-shaped value (a bare object, or the object
 * branches of a oneOf) is lifted into a `<Verb>Action` interface — the typed config a
 * FunctionResult action builder accepts (e.g. `TransferAction`, `PlaybackBgAction`).
 * Only the TYPE surface is emitted here; the ergonomic builder methods live on
 * FunctionResult. Emitted into one module so cross-action refs resolve locally.
 */
async function generateSwaigActions(specPath: string, outPath: string): Promise<number> {
  const doc = yaml.load(fs.readFileSync(specPath, 'utf-8')) as OpenApiDoc;
  const actions = doc.components?.schemas?.SwaigAction?.properties;
  if (!actions) throw new Error('swaig-response.yaml: missing SwaigAction.properties');

  const decls: string[] = [];
  const isObj = (s: Schema | undefined): boolean => !!s && s.type === 'object' && !!s.properties;

  // Lift each action's object-shaped value(s) into named `<Verb>Action` interfaces.
  // Matches the Python emitter: a bare object → one interface; the object branches of
  // a oneOf → `<Verb>Action`, `<Verb>Action2`, … (scalar/const/array branches are not
  // named types). Names collide-free with the SWML verb types (same PascalCase(verb)).
  for (const verb of Object.keys(actions).sort()) {
    const schema = actions[verb]!;
    const branches = schema.oneOf ?? (isObj(schema) ? [schema] : []);
    let objIdx = 0;
    for (const b of branches) {
      if (!isObj(b)) continue;
      objIdx += 1;
      const name = `${pascal(verb)}Action${objIdx === 1 ? '' : String(objIdx)}`;
      decls.push(swaigDeclaration(name, { type: 'object', properties: b.properties }));
    }
  }

  const header =
    `// AUTO-GENERATED from porting-sdk/swaig-specs/swaig-response.yaml — DO NOT EDIT.\n` +
    `// Regenerate with: npx tsx scripts/generate-swaig-payloads.ts\n//\n` +
    `// The typed SWAIG response-action CONFIG types (one <Verb>Action per object-shaped\n` +
    `// action value). The ergonomic builder methods live on FunctionResult; these are the\n` +
    `// shapes those methods accept. Held to the same lint bar as hand source.\n\n`;
  const formatted = await formatTs(header + decls.join('\n'), outPath);
  emitFile(outPath, formatted);
  return decls.length;
}

async function main(): Promise<void> {
  const psdk = resolvePortingSdk();
  // Fail-soft: porting-sdk is only adjacent in dev/CI (not in a published
  // consumer's node_modules). The generated files are committed, so when the spec
  // source isn't resolvable we skip regeneration rather than erroring.
  if (!psdk) {
    if (CHECK) {
      console.error(
        'generate-swaig-payloads --check: porting-sdk not found — cannot verify generated-type ' +
          'freshness (set $PORTING_SDK or clone adjacent).',
      );
      process.exit(2);
    }
    console.log(
      'generate-swaig-payloads: porting-sdk not found (set $PORTING_SDK or clone adjacent) — ' +
        'skipping; using committed src/Swaig*.generated.ts.',
    );
    return;
  }
  const verb = CHECK ? 'checked' : 'generated';

  // Typed SWAIG wire payloads (SWAIG_PIPELINE §4) from the vendored swaig-specs/
  // (the authoritative mod_openai engine specs); skipped cleanly if the swaig-specs
  // aren't present in the resolved porting-sdk.
  const swaigReqSpec = path.join(psdk, 'swaig-specs', 'swaig-request.yaml');
  const postPromptSpec = path.join(psdk, 'swaig-specs', 'post-prompt.yaml');
  if (fs.existsSync(swaigReqSpec) && fs.existsSync(postPromptSpec)) {
    const swaigOut = 'src/SwaigContracts.generated.ts';
    const n = await generateSwaigContracts(swaigReqSpec, postPromptSpec, swaigOut);
    console.log(`${verb} ${swaigOut} (${n} types)`);
  } else {
    console.log(
      `skipped SWAIG contracts (no swaig-specs at ${path.join(psdk, 'swaig-specs')}; ` +
        `using committed src/SwaigContracts.generated.ts).`,
    );
  }

  // Typed SWAIG response-action CONFIG types (from swaig-response.yaml).
  const swaigRespSpec = path.join(psdk, 'swaig-specs', 'swaig-response.yaml');
  if (fs.existsSync(swaigRespSpec)) {
    const swaigActionsOut = 'src/SwaigActions.generated.ts';
    const n = await generateSwaigActions(swaigRespSpec, swaigActionsOut);
    console.log(`${verb} ${swaigActionsOut} (${n} types)`);
  } else {
    console.log(
      `skipped SWAIG action contracts (no swaig-response.yaml; ` +
        `using committed src/SwaigActions.generated.ts).`,
    );
  }

  finalizeCheck('npx tsx scripts/generate-swaig-payloads.ts');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? `generate-swaig-payloads: ${err.message}` : err);
  process.exit(1);
});
