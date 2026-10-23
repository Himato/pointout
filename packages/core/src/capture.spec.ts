import { afterEach, describe, expect, it } from 'vitest';
import { captureElement } from './capture';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('captureElement', () => {
  it('reads the text a reader sees, not style or script source', () => {
    document.body.innerHTML = `
      <main><style>.card { color: red }</style>
        <h1>Revenue</h1>   <script>window.x = 1</script><p>Up  3%</p></main>`;

    const { text } = captureElement(document.querySelector('main')!, null, '/');

    expect(text).toBe('Revenue Up 3%');
  });
});
