import { pathToFileURL } from 'node:url';

import { coreBanner } from '@vidur/core';

export function serverBanner(): string {
  return `vidur gateway — ${coreBanner()}`;
}

// Entry point is intentionally side-effect free for now; the WSS gateway lands in a later task.
const invokedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (invokedDirectly) {
  console.log(serverBanner());
}
