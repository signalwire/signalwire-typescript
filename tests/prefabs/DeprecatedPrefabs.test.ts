/**
 * ConciergeAgent, ReceptionistAgent and FAQBotAgent warn, once, naming their
 * replacements.
 */

import { _resetDeprecationWarnings } from '../../src/prefabs/deprecated.js';
import { ConciergeAgent, FAQBotAgent, ReceptionistAgent } from '../../src/prefabs/index.js';

describe('deprecated prefabs', () => {
  beforeEach(() => _resetDeprecationWarnings());

  it('each warns and names its replacement', () => {
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
    try {
      new ConciergeAgent({ venueName: 'Inn', services: ['spa'], amenities: {} });
      new ReceptionistAgent({
        departments: [{ name: 'sales', description: 'buying', number: '+15550100001' }],
      });
      new FAQBotAgent({ faqs: [{ question: 'Hours?', answer: '9 to 5.' }] });
      new FAQBotAgent({ faqs: [{ question: 'Hours?', answer: '9 to 5.' }] });
      const messages = warn.mock.calls.map((c) => String(c[0]));
      expect(messages).toHaveLength(3); // once each
      expect(messages[0]).toMatch(/^ConciergeAgent is deprecated: .*Use FrontDeskAgent/);
      expect(messages[1]).toMatch(/^ReceptionistAgent is deprecated: use FrontDeskAgent/);
      expect(messages[2]).toMatch(/^FAQBotAgent is deprecated: use InfoBotKnowledge/);
      expect(warn.mock.calls[0]![1]).toMatchObject({ type: 'DeprecationWarning' });
    } finally {
      warn.mockRestore();
    }
  });
});
