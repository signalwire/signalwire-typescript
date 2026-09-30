/**
 * Advanced DataMap Example
 *
 * Demonstrates advanced DataMap patterns: expression tools, a webhook with
 * error keys and a fallback output, a foreach over a list in the response,
 * `${ENV.*}` expansion with a prefix allowlist, and an expression with a
 * nomatch output.
 *
 * Where a template reads the arguments depends on the stage: a webhook's
 * URL and the expressions read `${args.word}`, while a webhook's output and
 * foreach read the webhook's response, with the arguments under `input`
 * (`${input.args.word}`).
 * Run: npx tsx examples/advanced-datamap.ts
 */

import { AgentBase, DataMap, FunctionResult, createExpressionTool } from '@signalwire/sdk';

export const agent = new AgentBase({
  name: 'advanced-datamap-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a helpful assistant with tools for greeting detection, dictionary lookup, ' +
    'news headlines, and service status. Use the appropriate tool based on the user request.',
);

// Pattern 1: Expression-based tool (no HTTP call)
// Detects simple greetings and responds appropriately. The platform matches
// a pattern case-insensitively unless it is written '/pattern/'; the lc:
// helper also lowercases the text, so the pattern reads as lowercase.
const greetingTool = createExpressionTool({
  name: 'detect_greeting',
  patterns: {
    '${lc:args.text}': [
      '(hello|hi|hey|good morning|good afternoon)',
      new FunctionResult('The user greeted with: ${args.text}. Respond warmly.'),
    ],
  },
  parameters: {
    text: { type: 'string', description: 'The text to analyze', required: true },
  },
});
agent.registerSwaigFunction(greetingTool.toSwaigFunction());

// Pattern 2: GET webhook with error keys and a fallback output.
// The dictionary API returns an array for a word it knows, and an object
// with a "title" key when the word isn't found, so errorKeys(['title'])
// treats that response as a failure and the fallback output answers.
const definitionTool = new DataMap('lookup_definition')
  .purpose('Look up the definition of a word in the dictionary')
  .parameter('word', 'string', 'The word to look up', { required: true })
  .webhook('GET', 'https://api.dictionaryapi.dev/api/v2/entries/en/${enc:args.word}')
  .output(
    new FunctionResult('Definition of ${input.args.word}: The word was found in the dictionary.'),
  )
  .errorKeys(['title'])
  .fallbackOutput(new FunctionResult('Could not find a definition for that word.'));

agent.registerSwaigFunction(definitionTool.toSwaigFunction());

// Pattern 3: DataMap with foreach to iterate over list results.
// input_key is the path to the array in the response ("articles"), not a
// template.
const newsTool = new DataMap('get_news')
  .purpose('Get the latest news headlines')
  .parameter('topic', 'string', 'News topic to search for')
  .webhook(
    'GET',
    'https://newsapi.org/v2/everything?q=${enc:args.topic}&pageSize=3&apiKey=${ENV.SW_NEWS_API_KEY}',
  )
  .foreach({
    input_key: 'articles',
    output_key: 'headlines',
    append: '- ${this.title}: ${this.description}\n',
    max: 5,
  })
  .output(new FunctionResult('Latest news on ${input.args.topic}:\n${headlines}'))
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
    '${lc:args.service}',
    '(api|web|database)',
    new FunctionResult('The ${args.service} service is currently operational.'),
    new FunctionResult(
      'Unknown service "${args.service}". Available services: api, web, database.',
    ),
  );

agent.registerSwaigFunction(statusChecker.toSwaigFunction());

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.serve();
