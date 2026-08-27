/**
 * Built-in skill names as a typed, compile-time-checked closed set.
 *
 * The 19 names below are exactly the `SKILL_NAME` declared by each built-in
 * skill class in `src/skills/builtin/` (the same set
 * {@link registerBuiltinSkills} locks into the global `SkillRegistry`).
 *
 * {@link AgentBase.addSkillByName} and {@link AgentBase.hasSkill} accept this
 * union OR any string (`SkillName | (string & {})`):
 *
 *   - The union gives editor autocompletion for the built-ins and makes a typo
 *     (`'datetiem'`) a **compile-time** error rather than a runtime/server
 *     failure.
 *   - The `string & {}` arm widens the parameter back to `string` at the type
 *     level, so it still accepts custom / third-party skill names AND keeps
 *     consistency with the Python SDK (whose `add_skill` / `has_skill` take a
 *     bare `str`). It is a no-op at runtime — TypeScript erases types, so the
 *     value passed on the wire is the identical string either way.
 *
 * @example
 * ```ts
 * import { AgentBase } from '@signalwire/sdk';
 * const agent = new AgentBase({ name: 'demo', route: '/' });
 * await agent.addSkillByName('datetime');      // autocompleted built-in
 * agent.hasSkill('datetime');                  // true
 * await agent.addSkillByName('my_custom_one'); // open set: custom names OK
 * // await agent.addSkillByName('datetiem');   // ✗ compile error (typo)
 * ```
 */
export type SkillName =
  | 'api_ninjas_trivia'
  | 'ask_claude'
  | 'claude_skills'
  | 'custom_skills'
  | 'datasphere'
  | 'datasphere_serverless'
  | 'datetime'
  | 'google_maps'
  | 'info_gatherer'
  | 'joke'
  | 'math'
  | 'mcp_gateway'
  | 'native_vector_search'
  | 'play_background_file'
  | 'spider'
  | 'swml_transfer'
  | 'weather_api'
  | 'web_search'
  | 'wikipedia_search';

/**
 * A skill-name parameter: one of the typed built-in {@link SkillName} values
 * (autocompleted + typo-checked) or any other string (custom / third-party
 * skills, and consistency with Python's bare `str`).
 *
 * The `(string & {})` arm preserves string literal autocompletion for the
 * union members while still widening to accept arbitrary strings; it is purely
 * a type-level annotation and has no runtime effect.
 */
export type SkillNameOrString = SkillName | (string & {});
