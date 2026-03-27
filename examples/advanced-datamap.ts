/**
 * Advanced DataMap Example
 *
 * Demonstrates advanced DataMap patterns: expressions, foreach iteration,
 * POST webhooks with bodies, error keys, and chained data_map tools.
 * Run: npx tsx examples/advanced-datamap.ts
 */

import {
  AgentBase,
  DataMap,
  FunctionResult,
  createExpressionTool,
} from '../src/index.js';

export const agent = new AgentBase({
  name: 'advanced-datamap-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a helpful assistant with tools for language detection, stock lookup, ' +
  'and currency conversion. Use the appropriate tool based on the user request.',
);

// Pattern 1: Expression-based tool (no HTTP call)
// Detects simple greetings and responds appropriately
const greetingTool = createExpressionTool({
  name: 'detect_greeting',
  patterns: {
    '${args.text}': [
      '(?i)(hello|hi|hey|good morning|good afternoon)',
      new FunctionResult('The user greeted with: ${args.text}. Respond warmly.'),
    ],
  },
  parameters: {
    text: { type: 'string', description: 'The text to analyze', required: true },
  },
});
agent.registerSwaigFunction(greetingTool.toSwaigFunction());

// Pattern 2: POST webhook with JSON body and error keys
const translationTool = new DataMap('lookup_definition')
  .purpose('Look up the definition of a word in the dictionary')
  .parameter('word', 'string', 'The word to look up', { required: true })
  .webhook('GET', 'https://api.dictionaryapi.dev/api/v2/entries/en/${args.word}')
  .output(
    new FunctionResult(
      'Definition of ${args.word}: The word was found in the dictionary.',
    ),
  )
  .errorKeys(['title'])
  .fallbackOutput(
    new FunctionResult('Could not find a definition for that word.'),
  );

agent.registerSwaigFunction(translationTool.toSwaigFunction());

// Pattern 3: DataMap with foreach to iterate over list results
const newsTool = new DataMap('get_news')
  .purpose('Get the latest news headlines')
  .parameter('topic', 'string', 'News topic to search for')
  .webhook('GET', 'https://newsapi.org/v2/everything?q=${args.topic}&pageSize=3&apiKey=${ENV.SW_NEWS_API_KEY}')
  .foreach({
    input_key: 'response.articles',
    output_key: 'headlines',
    append: '- ${this.title}: ${this.description}',
    max: 5,
  })
  .output(new FunctionResult('Latest news on ${args.topic}:\n${headlines}'))
  .fallbackOutput(new FunctionResult('No news found for that topic.'));

// Enable env expansion for the news API key
newsTool.enableEnvExpansion(true);
newsTool.setAllowedEnvPrefixes(['SW_']);

agent.registerSwaigFunction(newsTool.toSwaigFunction());

// Pattern 4: Expression with nomatch fallback
const statusChecker = new DataMap('check_status')
  .purpose('Check the status of a service by name')
  .parameter('service', 'string', 'Service name to check', { required: true })
  .expression(
    '${args.service}',
    '(?i)(api|web|database)',
    new FunctionResult('The ${args.service} service is currently operational.'),
    new FunctionResult(
      'Unknown service "${args.service}". Available services: api, web, database.',
    ),
  );

agent.registerSwaigFunction(statusChecker.toSwaigFunction());

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
