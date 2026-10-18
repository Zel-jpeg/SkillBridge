import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml } from './escapeHtml.js'
test('map text encodes markup and attributes without dropping data or numeric zero', () => {
  assert.equal(escapeHtml('<img src="x" onerror=\'fixture\'> &'), '&lt;img src=&quot;x&quot; onerror=&#39;fixture&#39;&gt; &amp;')
  assert.equal(escapeHtml(0), '0')
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml('Synthetic Ñ Agency'), 'Synthetic Ñ Agency')
})
