import balanceJson from '../data/balance.json' with { type: 'json' };
import cropsJson from '../data/crops.json' with { type: 'json' };
import fishJson from '../data/fish.json' with { type: 'json' };
import upgradesJson from '../data/upgrades.json' with { type: 'json' };
import { parseContent } from '../data/validate.ts';

const parsed = parseContent({
  balance: balanceJson,
  fish: fishJson,
  crops: cropsJson,
  upgrades: upgradesJson,
});

if (!parsed.ok) {
  throw new Error(`Invalid game data:\n${parsed.errors.join('\n')}`);
}

export const content = parsed.value;
