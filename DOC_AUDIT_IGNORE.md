# DOC_AUDIT_IGNORE.md

Identifiers that the porting-sdk `audit_docs.py` tool would otherwise flag as
unresolved references in this SDK's documentation and examples. Every line
has the form:

    <identifier>: <rationale>

Lines starting with `#` are comments and are ignored by the audit tool.

The audit is stricter about genuine phantom APIs than this ignore list —
anything called on an SDK object that doesn't exist is a bug to fix, not a
line to add here. This file is for **external** identifiers only:

- JavaScript / Node.js / browser / DOM stdlib calls
- Hono (the HTTP framework the SDK uses internally, referenced in docs)
- Third-party SDKs referenced in skill-integration examples
- Python-syntax fenced code blocks in reference docs (see "Legacy Python
  reference docs" section for the tracking rationale)

---

## JavaScript / Node.js stdlib

toISOString: Date.prototype.toISOString() — JavaScript built-in
toLocaleString: Date.prototype.toLocaleString() — JavaScript built-in
toLowerCase: String.prototype.toLowerCase() — JavaScript built-in
toUpperCase: String.prototype.toUpperCase() — JavaScript built-in
toFixed: Number.prototype.toFixed() — JavaScript built-in
trim: String.prototype.trim() — JavaScript built-in
floor: Math.floor() — JavaScript built-in
round: Math.round() — JavaScript built-in
random: Math.random() — JavaScript built-in
includes: Array.prototype.includes() / String.prototype.includes() — JavaScript built-in
entries: Object.entries() / Map.prototype.entries() — JavaScript built-in
digest: SubtleCrypto.digest() — Web Crypto API built-in
exit: process.exit() — Node.js built-in
uptime: process.uptime() — Node.js built-in
memoryUsage: process.memoryUsage() — Node.js built-in
createServer: https.createServer() / http.createServer() — Node.js built-in

## Hono (HTTP framework)

use: Hono app.use(middleware) — Hono framework method; not on SDK classes

## Legacy Python reference docs

The following identifiers appear only inside ```python fenced code blocks in
doc files that were copied from the Python SDK reference and have not yet
been translated to TypeScript. These are not phantom APIs — they are the
correct names in the Python SDK. A follow-up PR will rewrite these doc files
in TypeScript; until then, the audit ignores the Python names.

Affected doc files:
  - docs/cloud_functions_guide.md, docs/llm_parameters.md,
    docs/mcp_gateway_reference.md, docs/sdk_features.md,
    docs/skills_parameter_schema.md, docs/swml_service_guide.md,
    docs/third_party_skills.md, docs/web_service.md
  - relay/docs/*.md (all files)
  - rest/docs/*.md (all files except phone-binding.md)

Thread: Python threading.Thread — Python stdlib, referenced in python-syntax doc example
__init__: Python class constructor syntax — referenced in python-syntax doc example
_test_api_connection: Python custom internal method in python-syntax doc example
abspath: Python os.path.abspath — Python stdlib, referenced in python-syntax doc example
basicConfig: Python logging.basicConfig — Python stdlib, referenced in python-syntax doc example
setLevel: Python logging.setLevel — Python stdlib, referenced in python-syntax doc example
handle_serverless_request: Python SDK serverless entry point — referenced in python-syntax doc
include_router: Python FastAPI APIRouter.include_router — referenced in python-syntax doc
register_customer_route: Python SDK example custom method — referenced in python-syntax doc
register_product_route: Python SDK example custom method — referenced in python-syntax doc
from_payload: Python SDK classmethod — referenced in python-syntax doc
pass_: Python SDK Call.pass_() — referenced in python-syntax doc
enable_record_call: Python SDK example — referenced in python-syntax doc
build_document: Python SDK SWMLService method — referenced in python-syntax doc
build_voicemail_document: Python SDK SWMLService method — referenced in python-syntax doc

# Python snake_case API names referenced in python-syntax doc blocks
add_action: Python snake_case form of a TS method — referenced in python-syntax doc block
add_answer_verb: Python snake_case form of addAnswerVerb — referenced in python-syntax doc block
add_context: Python snake_case form of addContext — referenced in python-syntax doc block
add_directory: Python snake_case form of addDirectory (WebService) — referenced in python-syntax doc block
add_gather_question: Python snake_case form of addGatherQuestion — referenced in python-syntax doc block
add_hints: Python snake_case form of addHints — referenced in python-syntax doc block
add_internal_filler: Python snake_case API — referenced in python-syntax doc block
add_language: Python snake_case form of addLanguage — referenced in python-syntax doc block
add_membership: Python snake_case form of addMembership — referenced in python-syntax doc block
add_post_ai_verb: Python snake_case form of addPostAiVerb — referenced in python-syntax doc block
add_pre_answer_verb: Python snake_case form of addPreAnswerVerb — referenced in python-syntax doc block
add_pronunciation: Python snake_case form of addPronunciation — referenced in python-syntax doc block
add_section: Python snake_case form of addSection — referenced in python-syntax doc block
add_skill: Python snake_case form of addSkill — referenced in python-syntax doc block
add_step: Python snake_case form of addStep — referenced in python-syntax doc block
add_verb: Python snake_case form of addVerb — referenced in python-syntax doc block
add_verb_to_section: Python snake_case form of addVerbToSection — referenced in python-syntax doc block
ai_hold: Python snake_case form of aiHold — referenced in python-syntax doc block
ai_message: Python snake_case form of aiMessage — referenced in python-syntax doc block
ai_stop: Python snake_case form of aiStop — referenced in python-syntax doc block
ai_unhold: Python snake_case form of aiUnhold — referenced in python-syntax doc block
as_router: Python snake_case form of asRouter — referenced in python-syntax doc block
assign_domain_application: Python snake_case form of assignDomainApplication — referenced in python-syntax doc block
bind_digit: Python snake_case form of bindDigit — referenced in python-syntax doc block
clear_digit_bindings: Python snake_case form of clearDigitBindings — referenced in python-syntax doc block
collect_start_input_timers: Python snake_case form of collectStartInputTimers — referenced in python-syntax doc block
collect_stop: Python snake_case form of collectStop — referenced in python-syntax doc block
create_campaign: Python snake_case form of createCampaign — referenced in python-syntax doc block
create_embed_token: Python snake_case form of createEmbedToken — referenced in python-syntax doc block
create_guest_token: Python snake_case form of createGuestToken — referenced in python-syntax doc block
create_invite_token: Python snake_case form of createInviteToken — referenced in python-syntax doc block
create_order: Python snake_case form of createOrder — referenced in python-syntax doc block
create_sip_endpoint: Python snake_case form of createSipEndpoint — referenced in python-syntax doc block
create_stream: Python snake_case form of createStream — referenced in python-syntax doc block
create_subscriber_token: Python snake_case form of createSubscriberToken — referenced in python-syntax doc block
create_token: Python snake_case form of createToken — referenced in python-syntax doc block
define_contexts: Python snake_case form of defineContexts — referenced in python-syntax doc block
define_tool: Python snake_case form of defineTool — referenced in python-syntax doc block
delete_chunk: Python snake_case form of deleteChunk — referenced in python-syntax doc block
delete_media: Python snake_case form of deleteMedia — referenced in python-syntax doc block
delete_membership: Python snake_case form of deleteMembership — referenced in python-syntax doc block
delete_recording: Python snake_case form of deleteRecording — referenced in python-syntax doc block
delete_sip_endpoint: Python snake_case form of deleteSipEndpoint — referenced in python-syntax doc block
denoise_stop: Python snake_case form of denoiseStop — referenced in python-syntax doc block
deploy_version: Python snake_case form of deployVersion — referenced in python-syntax doc block
dequeue_member: Python snake_case form of dequeueMember — referenced in python-syntax doc block
detect_stop: Python snake_case form of detectStop — referenced in python-syntax doc block
fallback_output: Python snake_case form of fallbackOutput — referenced in python-syntax doc block
get_chunk: Python snake_case form of getChunk — referenced in python-syntax doc block
get_document: Python snake_case form of getDocument — referenced in python-syntax doc block
get_full_url: Python snake_case form of getFullUrl — referenced in python-syntax doc block
get_media: Python snake_case form of getMedia — referenced in python-syntax doc block
get_member: Python snake_case form of getMember — referenced in python-syntax doc block
get_membership: Python snake_case form of getMembership — referenced in python-syntax doc block
get_next_member: Python snake_case form of getNextMember — referenced in python-syntax doc block
get_parameter_schema: Python snake_case form of getParameterSchema — referenced in python-syntax doc block
get_participant: Python snake_case form of getParticipant — referenced in python-syntax doc block
get_recording: Python snake_case form of getRecording — referenced in python-syntax doc block
get_sip_endpoint: Python snake_case form of getSipEndpoint — referenced in python-syntax doc block
has_skill: Python snake_case form of hasSkill — referenced in python-syntax doc block
import_number: Python snake_case form of importNumber — referenced in python-syntax doc block
leave_conference: Python snake_case form of leaveConference — referenced in python-syntax doc block
leave_room: Python snake_case form of leaveRoom — referenced in python-syntax doc block
list_addresses: Python snake_case form of listAddresses — referenced in python-syntax doc block
list_all_skill_sources: Python snake_case form of listAllSkillSources — referenced in python-syntax doc block
list_available_countries: Python snake_case form of listAvailableCountries — referenced in python-syntax doc block
list_campaigns: Python snake_case form of listCampaigns — referenced in python-syntax doc block
list_chunks: Python snake_case form of listChunks — referenced in python-syntax doc block
list_conference_tokens: Python snake_case form of listConferenceTokens — referenced in python-syntax doc block
list_events: Python snake_case form of listEvents — referenced in python-syntax doc block
list_media: Python snake_case form of listMedia — referenced in python-syntax doc block
list_members: Python snake_case form of listMembers — referenced in python-syntax doc block
list_memberships: Python snake_case form of listMemberships — referenced in python-syntax doc block
list_numbers: Python snake_case form of listNumbers — referenced in python-syntax doc block
list_orders: Python snake_case form of listOrders — referenced in python-syntax doc block
list_participants: Python snake_case form of listParticipants — referenced in python-syntax doc block
list_recordings: Python snake_case form of listRecordings — referenced in python-syntax doc block
list_sip_endpoints: Python snake_case form of listSipEndpoints — referenced in python-syntax doc block
list_streams: Python snake_case form of listStreams — referenced in python-syntax doc block
list_versions: Python snake_case form of listVersions — referenced in python-syntax doc block
phone_number: Python snake_case form of phoneNumber — referenced in python-syntax doc block
play_and_collect: Python snake_case form of playAndCollect — referenced in python-syntax doc block
play_pause: Python snake_case form of playPause — referenced in python-syntax doc block
play_resume: Python snake_case form of playResume — referenced in python-syntax doc block
play_stop: Python snake_case form of playStop — referenced in python-syntax doc block
play_volume: Python snake_case form of playVolume — referenced in python-syntax doc block
prompt_add_section: Python snake_case form of promptAddSection — referenced in python-syntax doc block
queue_enter: Python snake_case form of queueEnter — referenced in python-syntax doc block
queue_leave: Python snake_case form of queueLeave — referenced in python-syntax doc block
receive_fax_stop: Python snake_case form of receiveFaxStop — referenced in python-syntax doc block
record_pause: Python snake_case form of recordPause — referenced in python-syntax doc block
record_resume: Python snake_case form of recordResume — referenced in python-syntax doc block
record_stop: Python snake_case form of recordStop — referenced in python-syntax doc block
redial_verification: Python snake_case form of redialVerification — referenced in python-syntax doc block
refresh_subscriber_token: Python snake_case form of refreshSubscriberToken — referenced in python-syntax doc block
register_routing_callback: Python snake_case form of registerRoutingCallback — referenced in python-syntax doc block
register_swaig_function: Python snake_case form of registerSwaigFunction — referenced in python-syntax doc block
register_verb_handler: Python snake_case form of registerVerbHandler — referenced in python-syntax doc block
remove_directory: Python snake_case form of removeDirectory (WebService) — referenced in python-syntax doc block
remove_participant: Python snake_case form of removeParticipant — referenced in python-syntax doc block
reset_document: Python snake_case form of resetDocument — referenced in python-syntax doc block
search_local: Python snake_case form of searchLocal — referenced in python-syntax doc block
search_toll_free: Python snake_case form of searchTollFree — referenced in python-syntax doc block
send_fax_stop: Python snake_case form of sendFaxStop — referenced in python-syntax doc block
send_message: Python snake_case form of sendMessage — referenced in python-syntax doc block
set_dynamic_config_callback: Python snake_case form of setDynamicConfigCallback — referenced in python-syntax doc block
set_functions: Python snake_case form of setFunctions — referenced in python-syntax doc block
set_gather_info: Python snake_case form of setGatherInfo — referenced in python-syntax doc block
set_global_data: Python snake_case form of setGlobalData — referenced in python-syntax doc block
set_native_functions: Python snake_case form of setNativeFunctions — referenced in python-syntax doc block
set_params: Python snake_case form of setParams — referenced in python-syntax doc block
set_post_prompt_llm_params: Python snake_case form of setPostPromptLlmParams — referenced in python-syntax doc block
set_prompt_llm_params: Python snake_case form of setPromptLlmParams — referenced in python-syntax doc block
set_step_criteria: Python snake_case form of setStepCriteria — referenced in python-syntax doc block
set_text: Python snake_case form of setText — referenced in python-syntax doc block
set_valid_steps: Python snake_case form of setValidSteps — referenced in python-syntax doc block
start_recording: Python snake_case form of startRecording — referenced in python-syntax doc block
start_stream: Python snake_case form of startStream — referenced in python-syntax doc block
stop_stream: Python snake_case form of stopStream — referenced in python-syntax doc block
stream_stop: Python snake_case form of streamStop — referenced in python-syntax doc block
submit_verification: Python snake_case form of submitVerification — referenced in python-syntax doc block
swml_change_step: Python snake_case form of swmlChangeStep — referenced in python-syntax doc block
tap_stop: Python snake_case form of tapStop — referenced in python-syntax doc block
to_dict: Python snake_case form of toDict — referenced in python-syntax doc block
to_swaig_function: Python snake_case form of toSwaigFunction — referenced in python-syntax doc block
transcribe_stop: Python snake_case form of transcribeStop — referenced in python-syntax doc block
update_global_data: Python snake_case form of updateGlobalData — referenced in python-syntax doc block
update_participant: Python snake_case form of updateParticipant — referenced in python-syntax doc block
update_recording: Python snake_case form of updateRecording — referenced in python-syntax doc block
update_sip_endpoint: Python snake_case form of updateSipEndpoint — referenced in python-syntax doc block
validate_packages: Python snake_case form of validatePackages — referenced in python-syntax doc block
wait_for: Python snake_case form of waitFor — referenced in python-syntax doc block
wait_for_ended: Python snake_case form of waitForEnded — referenced in python-syntax doc block
