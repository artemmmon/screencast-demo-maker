// Browser-only example: no VS Code, no Terminal (config.surfaces is ["browser"]).
//
//   node <plugin>/skills/demo-film/scripts/director.mjs examples/minimal-web --dry
export const order = ['s1', 's2'];
export const browser = order;

export default function scenes(stage) {
  const { sleep, record, stop, cue, shot, web, config, dry } = stage;
  const p = () => web.page;

  return {
    async s1() {
      await web.open(config.web.baseUrl);          // pre-roll: navigation happens before recording
      await record('s1');
      await cue('s1-01', () => web.glideTo(p().getByRole('heading', { name: 'Tiny Tasks' }), 1000));
      await cue('s1-02', async ms => {
        await sleep(ms * 0.2);
        await web.glideTo(p().getByText('done').first(), 900);
        await sleep(ms * 0.2);
        await web.glideTo(p().getByText('done').nth(1), 700);
      });
      if (dry) shot('dry-s1');
      await stop();
    },

    async s2() {
      await web.open(config.web.baseUrl);
      await record('s2');
      await cue('s2-01', () => web.clickOn(p().getByRole('button', { name: 'Details' }), 1000));
      await cue('s2-02', () => web.glideTo(p().locator('#details'), 900));
      if (dry) shot('dry-s2');
      await stop();
    },
  };
}
