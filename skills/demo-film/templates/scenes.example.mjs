// Starting point for <workDir>/scenes.mjs. See reference/scenes-api.md for the full API,
// and your project's demo skill (`*-demo`), if any, for a finished example.

// FILMING order — not playback order. The video is concatenated in `config.order`.
export const order = ['s1', 's2', 's3'];
export const browser = ['s3'];          // scenes that need Chrome; they film last

export default function scenes(stage) {
  const { sleep, record, stop, cue, shot, code, term, web, config, dry } = stage;
  const p = () => web.page;

  return {
    // A file scene: jump section to section while the line plays.
    async s1() {
      code.open('README.md', 1); await sleep(1500);     // pre-roll, not recorded
      await record('s1');
      await cue('s1-01', () => code.open('README.md', 12));
      await cue('s1-02', async ms => { await sleep(ms * 0.5); code.open('README.md', 40); });
      await stop();
    },

    // A terminal scene: the command starts first, the line narrates it while it runs.
    async s2() {
      term.run(`cd ${config.projectRoot} && clear`); term.front(); await sleep(1500);
      await record('s2');
      term.run('npm test');
      await cue('s2-01', async ms => { await sleep(ms * 0.7); code.open('package.json', 1); });
      await sleep(1200);
      await stop();
    },

    // A browser scene: navigate, then move the pointer deliberately. Never click
    // anything in config.neverClick — hover it instead.
    async s3() {
      await web.open(config.web.baseUrl);
      await record('s3');
      await cue('s3-01', async () => {
        await web.glideTo(p().getByRole('heading').first(), 1200);
      });
      await cue('s3-02', async ms => {
        await web.clickOn(p().getByRole('button', { name: 'Details' }), 800);
        await sleep(ms * 0.4);
        await web.scrollBy('main', 240);
      });
      if (dry) shot('dry-s3');
      await stop();
    },
  };
}
