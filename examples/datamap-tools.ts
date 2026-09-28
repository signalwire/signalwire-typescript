/**
 * DataMap Tools Example
 *
 * Two tools that call external APIs without a webhook endpoint of your own.
 * The SignalWire platform makes each request and expands the output
 * template from the data_map definition. A webhook's JSON response is read
 * from the root of the template data (`${current_condition[0].temp_F}`),
 * with no `response.` prefix.
 * Run: npx tsx examples/datamap-tools.ts
 * Test: npx tsx src/cli/swaig-test.ts examples/datamap-tools.ts --exec get_weather --city London
 */

import { AgentBase, DataMap, FunctionResult, createSimpleApiTool } from '../src/index.js';

export const agent = new AgentBase({
  name: 'weather-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText('You are a weather assistant. Help users check the weather in any city.');

// Method 1: build a DataMap with the builder methods
const weatherTool = new DataMap('get_weather')
  .purpose('Get current weather for a city')
  .parameter('city', 'string', 'The city name', { required: true })
  .webhook('GET', 'https://wttr.in/${lc:enc:args.city}?format=j1')
  .output(
    new FunctionResult(
      'Weather in ${args.city}: ${current_condition[0].temp_F}°F, ${current_condition[0].weatherDesc[0].value}',
    ),
  )
  .fallbackOutput(new FunctionResult('Sorry, I could not fetch the weather for that city.'));

agent.registerSwaigFunction(weatherTool.toSwaigFunction());

// Method 2: the createSimpleApiTool helper, for one GET request and one output
const jokeTool = createSimpleApiTool({
  name: 'get_joke',
  url: 'https://official-joke-api.appspot.com/random_joke',
  responseTemplate: 'Here is a joke: ${setup} ... ${punchline}',
});

agent.registerSwaigFunction(jokeTool.toSwaigFunction());

agent.serve();
