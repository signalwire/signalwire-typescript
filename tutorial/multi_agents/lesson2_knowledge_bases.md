# Lesson 2: Adding Intelligence with Knowledge Bases

This lesson gives Morgan, the sales agent from Lesson 1, a search tool over a Markdown knowledge base. With it, Morgan can look up builds, prices and compatibility rules instead of relying only on the prompt.

## Table of Contents

1. [How the search works](#how-the-search-works)
2. [Creating knowledge bases](#creating-knowledge-bases)
3. [Loading the knowledge base](#loading-the-knowledge-base)
4. [Adding search to your agent](#adding-search-to-your-agent)
5. [Testing knowledge queries](#testing-knowledge-queries)
6. [Using a vector index](#using-a-vector-index)
7. [Best practices](#best-practices)
8. [Summary](#summary)

---

## How the search works

The `native_vector_search` skill adds a search tool to an agent. In the TypeScript SDK it searches in one of two modes:

- **In memory**: you pass the documents in the skill's `documents` option. The skill indexes them when the agent starts, and ranks them by keyword relevance (TF-IDF blended with keyword overlap). It needs no other package or service.
- **Remote**: you pass a `remote_url`, and the skill sends each query to a search server that serves a vector index. The server does the ranking.

This lesson uses the in-memory mode, so it runs with nothing but the SDK. The mode has limits you should know about:

- It matches words, not meanings. A query that shares no words with a section can't find it, even when the section answers it.
- Common words such as "the" and "for" are ignored, and so is punctuation. `$1500` matches the `1500` in "Mid-Range Gaming Build ($1500-$2000)".
- A document scores higher when the query's words make up more of it. A short section that names a part can outrank the section about that part.
- The index lives in the agent's memory, and the agent rebuilds it at every start. That suits a knowledge base of a few hundred sections, not a document library.

[Using a vector index](#using-a-vector-index) covers the remote mode, for when you need matching by meaning or a larger corpus.

## Creating knowledge bases

A knowledge base is a Markdown file. This tutorial has two, `sales_knowledge.md` and `support_knowledge.md`.

### The structure of sales_knowledge.md

The sales knowledge base groups its sections under a consistent heading structure. This excerpt shows the first two sections:

```markdown
# PC Builder Pro Sales Knowledge Base

## Gaming PC Builds

### Budget Gaming Build ($800-$1000)
- **CPU**: AMD Ryzen 5 5600X or Intel Core i5-12400F
- **GPU**: NVIDIA RTX 4060 or AMD RX 7600
- **RAM**: 16GB DDR4 3200MHz (2x8GB)
- **Storage**: 500GB NVMe SSD

### Mid-Range Gaming Build ($1500-$2000)
- **CPU**: AMD Ryzen 7 7700X or Intel Core i5-13600K
- **GPU**: NVIDIA RTX 4070 or AMD RX 7800 XT
```

These habits make a knowledge base easier to search:

1. **Use clear headings**: each `###` section becomes one search result, so give each one topic.
2. **Be specific**: include model numbers, prices and specifications, the words callers say.
3. **Structure consistently**: similar sections should follow similar patterns.
4. **Update regularly**: the agent reads the file at startup, so restart it after an edit.

## Loading the knowledge base

The skill indexes whatever documents you give it, and each document comes back whole as one result. A whole file as one document would return the entire file for every query, so split it into sections first.

### Step 1: Split the file into sections

Create `tutorial/multi_agents/knowledge.ts` with a function that reads a Markdown file and returns one document per `###` section:

<!-- snippet: no-compile a region of tutorial/multi_agents/knowledge.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/knowledge.ts#loader -->
```typescript
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

/** One searchable section of a knowledge base file. */
export interface KnowledgeDocument {
  id: string;
  text: string;
  metadata: { filename: string; section: string };
}

/**
 * Read a Markdown file and return one document per `###` section. Each
 * document starts with its `##` and `###` headings, so a result read on its
 * own still says what it's about. A heading with no text under it adds no document.
 */
export function loadKnowledge(path: string): KnowledgeDocument[] {
  const filename = basename(path);
  const docs: KnowledgeDocument[] = [];
  let chapter = '';
  let heading = '';
  let body: string[] = [];

  const flush = (): void => {
    const text = body.join('\n').trim();
    const section = heading && chapter ? `${chapter} > ${heading}` : heading || chapter;
    if (section && text) {
      docs.push({
        id: `${filename}#${docs.length + 1}`,
        text: `${section}\n${text}`,
        metadata: { filename, section },
      });
    }
    body = [];
  };

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!match) {
      body.push(line);
      continue;
    }
    flush();
    const [, hashes, title] = match;
    if (hashes !== '###') chapter = hashes === '##' ? title!.trim() : '';
    heading = hashes === '###' ? title!.trim() : '';
  }
  flush();
  return docs;
}
```

The documents have the shape the skill expects: an `id`, the `text` to search, and `metadata`. The skill shows `metadata.filename` and `metadata.section` in each result. `sales_knowledge.md` becomes 18 documents, and `support_knowledge.md` becomes 19.

## Adding search to your agent

`sales_agent_with_search.ts` starts from Lesson 1's agent. It has a new name, and the changes in this section.

### Step 2: Create the agent

Create the agent, and import the search skill and the loader with it:

<!-- snippet: no-compile a region of tutorial/multi_agents/sales_agent_with_search.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/sales_agent_with_search.ts#construct -->
```typescript
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AgentBase, NativeVectorSearchSkill } from '@signalwire/sdk';
import { loadKnowledge } from './knowledge.js';

export const agent = new AgentBase({
  name: 'PC Builder Sales Agent - Morgan (Enhanced)',
  route: '/',
  host: '0.0.0.0',
});
```

The `AI Role`, `Your Expertise` and `Voice Instructions` sections, and the voice, are the same as in Lesson 1.

### Step 3: Update the workflow

Replace the `Your Tasks` section with one that tells Morgan to search:

<!-- snippet: no-compile a region of tutorial/multi_agents/sales_agent_with_search.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/sales_agent_with_search.ts#tasks -->
```typescript
// Define the sales workflow with search integration
agent.promptAddSection('Your Tasks', {
  body: 'Complete sales process workflow with passion and expertise:',
  bullets: [
    'Greet customers warmly and introduce yourself',
    'Understand their specific PC building requirements',
    'Ask about budget, intended use, and preferences',
    'Use search_sales_knowledge to find relevant product information',
    'Provide knowledgeable recommendations based on search results',
    'Share your enthusiasm for PC building',
    'Offer to explain technical details when helpful',
  ],
});
```

### Step 4: Say when to use the tool

Add two sections that tell Morgan when to search, and how to use what it finds:

<!-- snippet: no-compile a region of tutorial/multi_agents/sales_agent_with_search.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/sales_agent_with_search.ts#tools-section -->
```typescript
// Tool usage instructions
agent.promptAddSection('Tools Available', {
  body: 'Use these tools to assist customers:',
  bullets: [
    'search_sales_knowledge: Find current product information and build recommendations',
    'Search when customers ask about specific budgets or use cases',
    'Use search results to provide accurate, up-to-date information',
  ],
});

// Important guidelines
agent.promptAddSection('Important', {
  body: 'Key guidelines for using knowledge search:',
  bullets: [
    'Always search when customers mention specific budgets',
    'Search for compatibility information when needed',
    'Use search results to support your recommendations',
    "Acknowledge when searching: 'Let me find the perfect options for you'",
  ],
});
```

### Step 5: Add the search skill

Load the knowledge base and add the skill, after the language:

<!-- snippet: no-compile a region of tutorial/multi_agents/sales_agent_with_search.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/sales_agent_with_search.ts#search-skill -->
```typescript
// Load the knowledge base, one document per section, and add the search tool
const salesKnowledge = fileURLToPath(new URL('./sales_knowledge.md', import.meta.url));

await agent.addSkill(
  new NativeVectorSearchSkill({
    tool_name: 'search_sales_knowledge',
    description: 'Search sales and product information',
    documents: loadKnowledge(salesKnowledge),
    count: 3,
  }),
);
```

These options configure the tool:

- `tool_name`: the tool's name, which the prompt refers to. The default is `search_knowledge`.
- `description`: what the model reads to decide when to call the tool
- `documents`: the documents to index in memory
- `count`: how many results a search returns unless the model asks for another number, from 1 to 20. The default is 5.

The path is built from `import.meta.url`, so the file is found wherever you run the agent from. `addSkill()` returns a promise, because a skill's setup can do asynchronous work, so the file awaits it at the top level.

The skill also adds a `Knowledge Search` section to the prompt. It tells the model it can search "local document indexes using the search_sales_knowledge tool over 18 indexed document(s)". The last part of the file starts the server, as in Lesson 1.

## Testing knowledge queries

Test the tool with `swaig-test` before you call the agent.

### Method 1: Use swaig-test

List the agent's tools:

```bash
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/sales_agent_with_search.ts --list-tools
```

The skill registered one tool, with a required `query` and an optional `count`:

```text
Available SWAIG functions:
  search_sales_knowledge - Search sales and product information (LOCAL webhook)
    Parameters:
      query (string) (required): Search query or question
      count (integer [default: 3]): Number of results to return (default: 3)
```

Call the tool with a query. Everything after `--exec search_sales_knowledge` is an argument to the tool. Quote the query in single quotes, so the shell doesn't expand `$1500`:

```bash
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/sales_agent_with_search.ts \
  --exec search_sales_knowledge --query 'gaming PC under $1500'
```

The build in that price range ranks first. This output is shortened after the first result:

```text
RESULT:
Response: Found 3 relevant results for 'gaming PC under $1500':

**Result 1** (from sales_knowledge.md, section: Gaming PC Builds > Mid-Range Gaming Build ($1500-$2000), relevance: 0.31)
Gaming PC Builds > Mid-Range Gaming Build ($1500-$2000)
- **CPU**: AMD Ryzen 7 7700X or Intel Core i5-13600K
- **GPU**: NVIDIA RTX 4070 or AMD RX 7800 XT
- **RAM**: 32GB DDR5 5600MHz (2x16GB)
- **Storage**: 1TB NVMe Gen4 SSD
- **PSU**: 750W 80+ Gold
- **Case**: Mid-tower with RGB and tempered glass
- **Motherboard**: X670 (AMD) or Z790 (Intel)
```

The model receives this text as the tool's result, and answers the caller from it.

### Method 2: See where keyword ranking falls short

Search for a part by name, and ask for two results:

```bash
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/sales_agent_with_search.ts \
  --exec search_sales_knowledge --query "RTX 4090" --count 2
```

The power supply table ranks first. It names the RTX 4090 in a short section, so the query's words make up more of it than of the enthusiast build:

```text
RESULT:
Response: Found 2 relevant results for 'RTX 4090':

**Result 1** (from sales_knowledge.md, section: Component Compatibility Guide > Power Supply Requirements, relevance: 0.45)
Component Compatibility Guide > Power Supply Requirements
- **RTX 4060/RX 7600**: 550W minimum
- **RTX 4070/RX 7800 XT**: 650W minimum
- **RTX 4080/RX 7900 XTX**: 750W minimum
- **RTX 4090**: 850W minimum (1000W recommended)
- Always add 20% headroom for efficiency and upgrades

**Result 2** (from sales_knowledge.md, section: Gaming PC Builds > Enthusiast Gaming Build ($4000+), relevance: 0.37)
Gaming PC Builds > Enthusiast Gaming Build ($4000+)
- **CPU**: AMD Ryzen 9 7950X or Intel Core i9-13900K
- **GPU**: NVIDIA RTX 4090
```

A query in words the file doesn't use finds nothing. The query `inexpensive rig` returns `No information found for 'inexpensive rig'`, although the budget build answers it. The `count` of 3 gives the model more than one section to work from, which covers the first case. The second needs a vector index, or a knowledge base written in your callers' words.

### Method 3: Test by calling the agent

When you call the agent, try these requests:

- "I need a gaming PC for around $1000"
- "What's the best build for video editing?"
- "How big a power supply does an RTX 4090 need?"

## Using a vector index

A vector index compares the meaning of a query with the meaning of each section. It can match a query to a section that uses different words. The TypeScript SDK doesn't build or read vector indexes itself. It queries a search server over HTTP with the skill's remote mode.

The Python SDK's search service is one such server: it builds `.swsearch` vector indexes from your documents with `sw-search`, and serves them. Point the skill at it with `remote_url`, and name the index with `index_name`:

<!-- snippet: no-run needs a search server listening at search.example.com -->
```typescript
import { AgentBase, NativeVectorSearchSkill } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'Morgan', route: '/' });

await agent.addSkill(
  new NativeVectorSearchSkill({
    tool_name: 'search_sales_knowledge',
    description: 'Search sales and product information',
    remote_url: 'https://user:password@search.example.com',
    index_name: 'sales',
    count: 3,
  }),
);
```

When the skill loads, it checks that the server's `/health` answers 200, and the add fails otherwise. Credentials in the URL are sent as basic auth. The URL must not resolve to a private or internal address unless `SWML_ALLOW_PRIVATE_URLS` is set. For the full list of options, see [native_vector_search](../../docs/skills-guide.md#native_vector_search) in the skills guide.

## Best practices

These practices apply to both modes.

### Knowledge base design

Keep the knowledge base current and consistent:

- Include specific model numbers and prices
- Keep each section on one topic, and short enough to read aloud in pieces
- Use the same terms throughout, and the terms your callers use
- Remove outdated information instead of adding a correction elsewhere

### Search integration

The prompt shapes how the agent uses results. These patterns help:

1. **Acknowledge the search**: "Let me find the best options in your budget."
2. **Handle no results**: "I don't have specific information about that, but based on similar builds..."
3. **Combine results**: "Based on our current recommendations, I found three options."

### Performance

These habits keep searches fast and results useful:

1. **Focused knowledge bases**: one per domain, as this tutorial does for sales and support
2. **A small result count**: 3 to 5 results give the model enough without a long tool result
3. **Startup indexing**: the in-memory index is built once, when the agent starts
4. **A size limit**: `max_content_length` caps the characters in a tool result, shared by its results, 32768 by default

## Summary

This lesson gave Morgan a searchable product knowledge base. The main points:

- `native_vector_search` searches documents in memory, or a remote vector index
- The in-memory mode ranks by keywords, and returns each document whole, so split files into sections
- `swaig-test --exec` calls the search tool without a server
- The prompt tells the model when to search, and the skill adds its own instructions

### Practice exercises

Try these before you move on:

1. **Create a knowledge base**: write a Markdown file about PC accessories (monitors, keyboards, mice), and load it into a second search tool.
2. **Adjust the result count**: try `count` values of 1 and 5, and compare the answers.
3. **Refine the search**: update the prompt to ask clarifying questions before searching.
4. **Test edge cases**: see how the agent handles a query with no good match.

### Troubleshooting

These problems come up most often in this lesson:

- **`No documents are loaded for searching`**: the `documents` array was empty. Check the path to the knowledge file.
- **`ENOENT` at startup**: the knowledge file doesn't exist at the path. Build the path from `import.meta.url`, as the lesson does.
- **Results that miss the obvious section**: the query and the section share no words. Add the missing terms to the knowledge base, or use a vector index.

### Next steps

Next, host Morgan with a triage agent and a support agent, and transfer calls between them. Continue with [Lesson 3: Building Multi-Agent Systems](lesson3_multi_agent_systems.md).

---

[Previous: Lesson 1 - Creating Your First Agent](lesson1_first_agent.md) | [Tutorial Overview](README.md) | [Next: Lesson 3 - Building Multi-Agent Systems](lesson3_multi_agent_systems.md)
