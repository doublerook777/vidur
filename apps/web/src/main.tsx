import { render } from 'preact';

import { coreBanner } from '@vidur/core';

import { webBanner } from './index';

function App() {
  return (
    <main>
      <h1>Vidur</h1>
      <p>{webBanner()}</p>
      <p>{coreBanner()}</p>
    </main>
  );
}

const root = document.getElementById('root');
if (root) {
  render(<App />, root);
}
