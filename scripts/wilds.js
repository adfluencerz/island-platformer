// `npm run wilds`: works out the home farm's trees and rocks again
// (shared/wilds.js) and writes them to shared/homewilds.js, where a farm
// played alone and a farm's room both read them. Run it after changing how
// they are placed; the test checks the file is up to date.
import { writeFileSync } from 'node:fs';
import { growWilds, wildsToWire } from '../shared/wilds.js';

export const homeWildsSource = () => `// The home farm's trees and rocks, as shared/wilds.js places them (written
// by \`npm run wilds\`: don't edit by hand). In the form WELCOME carries them.
export const HOME_WILDS = ${JSON.stringify(wildsToWire(growWilds('home')))};
`;

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL('../shared/homewilds.js', import.meta.url), homeWildsSource());
  console.log('wrote shared/homewilds.js');
}
