// region: fred
/**
 * Fred: a Wikipedia knowledge bot
 *
 * An agent that searches Wikipedia and shares facts about Wikipedia itself,
 * with a friendly, curious persona.
 *
 * Run: npx tsx fred.ts
 */

// region: imports
import { pathToFileURL } from 'node:url';

import { AgentBase, FunctionResult, WikipediaSearchSkill } from '@signalwire/sdk';
// endregion: imports

// region: facts
/** Facts about Wikipedia, by category, for the share_fun_fact tool. */
const FACTS = {
  statistics: [
    'Wikipedia has over 6 million articles in English alone!',
    'Wikipedia is available in more than 300 languages!',
    'Wikipedia receives over 18 billion page views per month!',
    'There are over 100,000 active Wikipedia contributors!',
  ],
  history: [
    'Wikipedia was launched on January 15, 2001!',
    "The first Wikipedia article was about the letter 'U'!",
    "Wikipedia's name comes from 'wiki' (Hawaiian for 'quick') and 'encyclopedia'!",
    'Jimmy Wales and Larry Sanger founded Wikipedia!',
  ],
  records: [
    'The most edited Wikipedia page is about George W. Bush!',
    'The longest Wikipedia article is about California Proposition 8!',
    'Wikipedia is the 7th most visited website in the world!',
    "The Wikipedia article on 'List of Pokemon' is one of the most viewed!",
  ],
};
// endregion: facts

/** Fred, a Wikipedia assistant with a friendly persona. */
export class FredTheWikiBot extends AgentBase {
  constructor() {
    super({ name: 'Fred', route: '/fred' });

    // region: personality
    // Set up Fred's personality with the Prompt Object Model
    this.promptAddSection('Personality', {
      body:
        'You are Fred, a friendly and knowledgeable assistant who loves learning and ' +
        "sharing information from Wikipedia. You're enthusiastic about facts and always " +
        'eager to help people discover new things.',
    });
    // endregion: personality

    // region: goal
    this.promptAddSection('Goal', {
      body:
        'Help users find reliable factual information by searching Wikipedia. ' +
        'Make learning fun and engaging.',
    });

    this.promptAddSection('Instructions', {
      bullets: [
        'Introduce yourself as Fred when greeting users',
        'Use the search_wiki function whenever users ask about factual topics',
        'Be enthusiastic about sharing knowledge',
        'Search before you say Wikipedia has nothing on a topic, even one that sounds made up',
        "If Wikipedia doesn't have information, suggest alternative search terms",
        'Make learning conversational and enjoyable',
        'Add interesting context or follow-up questions to engage users',
      ],
    });
    // endregion: goal

    // region: voice
    // Configure Fred's voice
    this.addLanguage({
      name: 'English',
      code: 'en-US',
      voice: 'rime.bolt', // A friendly, energetic voice for Fred
      speechFillers: [
        'Hmm, let me think...',
        "Oh, that's interesting...",
        'Great question!',
        'Let me see...',
      ],
    });
    // endregion: voice

    // region: hints
    // Add hints for better speech recognition
    this.addHints([
      'Wikipedia',
      'Fred',
      'tell me about',
      'what is',
      'who is',
      'search for',
      'look up',
    ]);
    // endregion: hints

    // region: params
    // Set conversation parameters
    this.setParams({
      ai_model: 'gpt-4.1-nano', // The model that runs the conversation
      wait_for_user: true, // The caller speaks first
      end_of_speech_timeout: 1000, // Milliseconds of silence that end the caller's turn
      ai_volume: 7, // Voice volume adjustment (-50 to 50, default 0)
      local_tz: 'America/New_York', // Time zone for time-related functions
    });
    // endregion: params

    // region: global-data
    // Add some context about Fred
    this.setGlobalData({
      assistant_name: 'Fred',
      specialty: 'Wikipedia knowledge',
      personality_traits: ['friendly', 'curious', 'enthusiastic', 'helpful'],
    });
    // endregion: global-data
  }

  // region: fun-fact
  /** Register Fred's own tool. The SDK calls this once, the first time it needs the tools. */
  protected override defineTools(): void {
    this.defineTool({
      name: 'share_fun_fact',
      description: 'Share an interesting fact about Wikipedia itself',
      parameters: {
        category: {
          type: 'string',
          description: 'Type of fact to share',
          enum: ['statistics', 'history', 'records', 'random'],
        },
      },
      handler: (args) => {
        // The model may leave the category out, so default to random
        const category = args.category ?? 'random';

        // The enum guides the model but doesn't bind it: random, or any
        // category Fred doesn't have, draws from every fact
        const known = category !== 'random' && Object.hasOwn(FACTS, category);
        const factList = known ? FACTS[category] : Object.values(FACTS).flat();
        const fact = factList[Math.floor(Math.random() * factList.length)];

        // Say what kind of fact it is, so the model can introduce it
        if (known) {
          return new FunctionResult(`Here's a ${category} fact about Wikipedia: ${fact}`);
        }
        return new FunctionResult(`Here's a fun Wikipedia fact: ${fact}`);
      },
    });
  }
  // endregion: fun-fact
}

// region: create
/** Build Fred, then add the Wikipedia search skill, which loads asynchronously. */
export async function createFred(): Promise<FredTheWikiBot> {
  const fred = new FredTheWikiBot();

  // Add the Wikipedia search skill with custom configuration
  await fred.addSkill(
    new WikipediaSearchSkill({
      num_results: 2, // Get up to 2 articles for broader coverage
      no_results_message:
        "Oh, I couldn't find anything about '{query}' on Wikipedia. " +
        'Maybe try different keywords or let me know if you meant something else!',
      swaig_fields: {
        fillers: {
          'en-US': [
            'Let me look that up on Wikipedia for you...',
            'Searching Wikipedia for that information...',
            'One moment, checking Wikipedia...',
            'Let me find that in the encyclopedia...',
          ],
        },
      },
    }),
  );

  return fred;
}
// endregion: create

// region: main
// swaig-test imports this file, and finds Fred through this export
export const fred = await createFred();

// Print the banner and start the server only when this file is the program
// that runs, not when another program imports it
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [username, password] = fred.getBasicAuthCredentials();

  console.log('='.repeat(60));
  console.log('Fred: a Wikipedia knowledge bot');
  console.log('='.repeat(60));
  console.log();
  console.log('Fred searches Wikipedia and shares facts about Wikipedia itself.');
  console.log();
  console.log('Questions to try:');
  console.log('  - Tell me about Albert Einstein');
  console.log('  - What is quantum physics?');
  console.log('  - Who was Marie Curie?');
  console.log('  - Search for information about the solar system');
  console.log('  - Can you share a fun fact?');
  console.log();
  console.log(`Fred is available at: http://localhost:${fred.port}/fred`);
  console.log(`Basic Auth: ${username}:${password}`);
  console.log();
  console.log('Starting Fred. Press Ctrl+C to stop.');
  console.log('='.repeat(60));

  await fred.run();
}
// endregion: main
// endregion: fred
