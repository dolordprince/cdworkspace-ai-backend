/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare module "zulip-js" {
  const init: (config: { realm: string; username: string; apiKey: string }) => Promise<unknown>;
  export default init;
}
