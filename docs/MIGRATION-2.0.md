# Migrating to SignalWire SDK 2.0

## Package Rename

```bash
# Before
npm install signalwire-agents

# After
npm install @signalwire/sdk
```

Update your `package.json`:
```jsonc
// Before
"dependencies": {
  "signalwire-agents": "^1.0.0"
}

// After
"dependencies": {
  "@signalwire/sdk": "^2.0.0"
}
```

## Import Changes

```typescript
// Before
import { AgentBase, SwaigFunctionResult } from 'signalwire-agents';
import { SignalWireClient } from 'signalwire-agents/rest';

const client = new SignalWireClient(projectId, token, spaceUrl);
const result = new SwaigFunctionResult('Done');

// After
import { AgentBase, FunctionResult } from '@signalwire/sdk';
import { RestClient } from '@signalwire/sdk/rest';

const client = new RestClient(projectId, token, spaceUrl);
const result = new FunctionResult('Done');
```

## Class Renames

| Before | After |
|--------|-------|
| `SwaigFunctionResult` | `FunctionResult` |
| `SignalWireClient` | `RestClient` |

## Quick Migration

Find and replace in your project:
```bash
# Update package imports
find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' | \
  xargs sed -i "s/from 'signalwire-agents/from '@signalwire\/sdk/g"

# Also handle double-quote imports
find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' | \
  xargs sed -i 's/from "signalwire-agents/from "@signalwire\/sdk/g'

# Rename classes
find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' | \
  xargs sed -i 's/SwaigFunctionResult/FunctionResult/g'
find . -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' | \
  xargs sed -i 's/SignalWireClient/RestClient/g'

# Update package.json
sed -i 's/"signalwire-agents"/"@signalwire\/sdk"/g' package.json
npm install
```

## What Didn't Change

- All method names (setPromptText, defineTool, addSkill, etc.)
- All parameter shapes and types
- SWML output format
- RELAY protocol
- REST API paths
- Skills, contexts, DataMap -- all the same
