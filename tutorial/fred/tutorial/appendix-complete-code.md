# Appendix A: Complete Code and Management Script

This appendix has the complete `fred.ts`, the complete management script, the project files, and a quick start that puts them together. The code here is the same as the files in `tutorial/fred/`.

## Table of Contents

1. [Complete fred.ts](#complete-fredts)
2. [Management Script (fred.sh)](#management-script-fredsh)
3. [Project Files](#project-files)
4. [Quick Start Guide](#quick-start-guide)
5. [Directory Structure](#directory-structure)
6. [Deployment Tips](#deployment-tips)

---

## Complete fred.ts

This is the agent, with the Wikipedia skill, the fun fact function, and the code that serves it. The `// region:` comments mark the parts the lessons quote, and don't affect the code.

<!-- include: tutorial/fred/fred.ts#fred -->
```typescript
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
    'Wikipedia started as a side project of Nupedia, an encyclopedia written by experts!',
    "Wikipedia's name comes from 'wiki' (Hawaiian for 'quick') and 'encyclopedia'!",
    'Jimmy Wales and Larry Sanger founded Wikipedia!',
  ],
  records: [
    "English Wikipedia's one billionth edit was made on January 13, 2021!",
    'Steven Pruitt has made more edits to English Wikipedia than anyone else, over three million!',
    'Wikipedia is one of the most visited websites in the world!',
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
```

## Management Script (fred.sh)

The complete script starts Fred in the background, stops it, reports its status, and follows its log. `stop` waits up to five seconds for Fred to exit, then forces it.

<!-- copy of: tutorial/fred/fred.sh -->
```bash
#!/bin/bash
# Start, stop and check Fred, the Wikipedia bot

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="fred.pid"
LOG_FILE="fred.log"
FRED_SCRIPT="$SCRIPT_DIR/fred.ts"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if Fred is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        else
            # PID file exists but process is dead
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Start Fred
start_fred() {
    if is_running; then
        echo -e "${YELLOW}Fred is already running with PID: $(cat "$PID_FILE")${NC}"
        return 1
    fi

    echo -e "${GREEN}Starting Fred...${NC}"

    # Check that fred.ts exists
    if [ ! -f "$FRED_SCRIPT" ]; then
        echo -e "${RED}Error: $FRED_SCRIPT not found!${NC}"
        return 1
    fi

    # Start Fred in the background, with its output in the log file. node --import tsx
    # runs fred.ts in one process, so the PID saved here is Fred's own.
    nohup node --import tsx "$FRED_SCRIPT" > "$LOG_FILE" 2>&1 &
    PID=$!

    # Save PID to file
    echo $PID > "$PID_FILE"

    # Wait a moment to check if it started successfully
    sleep 2

    if is_running; then
        echo -e "${GREEN}Fred started${NC}"
        echo -e "   PID: $PID"
        echo -e "   Log: $LOG_FILE"
        echo -e "   URL: http://localhost:${PORT:-3000}/fred"

        # Try to extract auth credentials from log
        if [ -f "$LOG_FILE" ]; then
            AUTH=$(grep "Basic Auth:" "$LOG_FILE" | head -1)
            if [ ! -z "$AUTH" ]; then
                echo -e "   $AUTH"
            fi
        fi
    else
        echo -e "${RED}Fred failed to start${NC}"
        echo -e "   Check $LOG_FILE for errors"
        return 1
    fi
}

# Stop Fred
stop_fred() {
    if ! is_running; then
        echo -e "${YELLOW}Fred is not running${NC}"
        return 1
    fi

    PID=$(cat "$PID_FILE")
    echo -e "${GREEN}Stopping Fred (PID: $PID)...${NC}"

    # Send SIGTERM for graceful shutdown
    kill -TERM "$PID" 2>/dev/null

    # Wait up to 5 seconds for process to stop
    for i in {1..5}; do
        if ! ps -p "$PID" > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    # If still running, force kill
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}Fred didn't stop gracefully, forcing shutdown...${NC}"
        kill -9 "$PID" 2>/dev/null
    fi

    # Clean up PID file
    rm -f "$PID_FILE"

    echo -e "${GREEN}Fred stopped${NC}"
}

# Check Fred's status
status_fred() {
    if is_running; then
        PID=$(cat "$PID_FILE")
        echo -e "${GREEN}Fred is running${NC}"
        echo -e "   PID: $PID"
        echo -e "   URL: http://localhost:${PORT:-3000}/fred"

        # Show process info
        ps -p "$PID" -o pid,vsz,rss,comm

        # Show last few log lines
        if [ -f "$LOG_FILE" ]; then
            echo -e "\n${YELLOW}Recent log entries:${NC}"
            tail -5 "$LOG_FILE"
        fi
    else
        echo -e "${RED}Fred is not running${NC}"
    fi
}

# Show logs
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}Fred's logs (press Ctrl+C to exit):${NC}"
        tail -f "$LOG_FILE"
    else
        echo -e "${RED}No log file found${NC}"
    fi
}

# Main script logic
case "$1" in
    start)
        start_fred
        ;;
    stop)
        stop_fred
        ;;
    restart)
        stop_fred
        sleep 1
        start_fred
        ;;
    status)
        status_fred
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "Fred manager"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start    - Start Fred in the background"
        echo "  stop     - Stop Fred gracefully"
        echo "  restart  - Restart Fred"
        echo "  status   - Check if Fred is running"
        echo "  logs     - Follow Fred's logs"
        echo ""
        echo "Example:"
        echo "  $0 start   # Start Fred"
        echo "  $0 status  # Check status"
        echo "  $0 stop    # Stop Fred"
        ;;
esac
```

The script keeps `fred.pid` and `fred.log` in the directory you run it from, so run it from the project directory. It runs Fred with `node --import tsx`, for the reason [Lesson 6](06-running-testing.md#step-5-create-management-script) gives.

## Project Files

Two files describe the project. `package.json` lists the dependencies and the scripts:

<!-- copy of: tutorial/fred/package.json -->
```json
{
  "name": "fred-bot",
  "version": "1.0.0",
  "private": true,
  "description": "Fred, a voice agent that answers questions from Wikipedia",
  "type": "module",
  "scripts": {
    "start": "tsx fred.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=22.18.0"
  },
  "dependencies": {
    "@signalwire/sdk": "^3.2.0"
  },
  "devDependencies": {
    "@types/node": "^22.20.4",
    "tsx": "^4.23.15",
    "typescript": "^7.0.2"
  }
}
```

`tsconfig.json` holds the TypeScript settings that `npm run typecheck` and `npm run build` use:

<!-- copy of: tutorial/fred/tsconfig.json -->
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "files": ["fred.ts"]
}
```

[Lesson 2](02-setup.md#installing-the-sdk) explains both.

## Quick Start Guide

These steps take you from an empty directory to a running Fred.

### 1. Setup

Create the project and install the dependencies:

```bash
# Create project directory
mkdir fred-bot
cd fred-bot

# Create the project, as ES modules
npm init -y
npm pkg set type=module

# Install dependencies
npm install @signalwire/sdk
npm install --save-dev tsx typescript @types/node
```

### 2. Create Files

Save the code in this appendix as four files:

- `fred.ts`: the agent
- `fred.sh`: the management script
- `package.json`: the project, replacing the one `npm init` wrote
- `tsconfig.json`: the TypeScript settings

Then make the script executable, and check the types:

```bash
chmod +x fred.sh
npm run typecheck
```

### 3. Run Fred

Run Fred directly, or with the management script:

```bash
# Direct method
npx tsx fred.ts

# Or using management script
./fred.sh start
./fred.sh status
./fred.sh stop
```

### 4. Test Fred

Take the credentials from Fred's output, then test it:

```bash
# Test SWML endpoint
curl -u username:password http://localhost:3000/fred

# Test Wikipedia search
npx swaig-test fred.ts --exec search_wiki --query "Python programming"

# Test fun fact
npx swaig-test fred.ts --exec share_fun_fact --category history
```

To call a function over HTTP instead, use the URL from Fred's SWML, which carries the function's token. [Lesson 6, Step 3](06-running-testing.md#step-3-test-wikipedia-search) shows how.

### 5. Environment Variables (Optional)

Fixed credentials stay the same across restarts:

```bash
# Set fixed credentials
export SWML_BASIC_AUTH_USER="fred"
export SWML_BASIC_AUTH_PASSWORD="a-long-random-password"

# Run Fred with fixed auth
npx tsx fred.ts
```

## Directory Structure

A complete Fred project looks like this. `fred.pid` and `fred.log` appear when the management script runs Fred, and `dist/` when you run `npm run build`:

```text
fred-bot/
├── fred.ts            # The agent
├── fred.sh            # Management script
├── package.json       # The project and its dependencies
├── package-lock.json  # The exact versions npm installed
├── tsconfig.json      # TypeScript settings
├── node_modules/      # The installed packages
├── dist/fred.js       # Compiled JavaScript (created by npm run build)
├── fred.pid           # Process ID (created by fred.sh)
└── fred.log           # Log file (created by fred.sh)
```

## Deployment Tips

A production deployment needs more than a running process.

### For Production

Five practices cover most deployments:

1. **Set secrets in environment variables**: the credentials, `SIGNALWIRE_SIGNING_KEY` and `SIGNALWIRE_SWAIG_SECRET` ([Lesson 6](06-running-testing.md#production-considerations) explains each)
2. **Serve Fred over HTTPS**, behind a reverse proxy or with the SDK's TLS support
3. **Run Fred under a process manager**, such as systemd or Docker, so it restarts after a crash or a reboot
4. **Rotate the logs**
5. **Monitor health and uptime**, for example with the `/fred/health` endpoint

### Example systemd Service

In production, run the compiled JavaScript rather than `tsx`. Build it once in the project directory:

```bash
npm run build
```

This unit runs the compiled Fred from `/opt/fred-bot`, and restarts it if it stops. Node.js finds the SDK in `/opt/fred-bot/node_modules`:

```ini
[Unit]
Description=Fred Wikipedia Bot
After=network.target

[Service]
Type=simple
User=fredbot
WorkingDirectory=/opt/fred-bot
ExecStart=/usr/bin/node /opt/fred-bot/dist/fred.js
Restart=always
EnvironmentFile=/opt/fred-bot/fred.env

[Install]
WantedBy=multi-user.target
```

Set `ExecStart` to the path `which node` prints, if Node.js isn't in `/usr/bin`. Keep the secrets in `/opt/fred-bot/fred.env`, readable only by the `fredbot` user, rather than in the unit file:

```bash
SWML_BASIC_AUTH_USER=fred
SWML_BASIC_AUTH_PASSWORD=a-long-random-password
SIGNALWIRE_SIGNING_KEY=your-signing-key
SIGNALWIRE_SWAIG_SECRET=another-long-random-string
```

## Next Steps

To run Fred in a container, continue with [Appendix B: Docker Deployment](appendix-docker-deployment.md).

---

[Previous: Running and Testing](06-running-testing.md) | [Overview](README.md) | [Next: Docker Deployment](appendix-docker-deployment.md)
