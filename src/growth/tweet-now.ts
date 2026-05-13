import { postTweetWithCTA } from './twitter-poster.js';

const tweet = `I built 6 Claude Code skills for investment analysis — options flow scanner, stop-loss alerts, daily briefings. Open source.

The scanner caught XLI P/C at 5.32 (normal: 0.5-1.2). 98% of CEG call volume was lottery tickets.

github.com/tellmefrankie/ai-investment-skills`;

postTweetWithCTA(tweet).then(ok => {
  console.log('Tweet result:', ok);
  process.exit(0);
}).catch(e => {
  console.error('Tweet error:', e);
  process.exit(1);
});
