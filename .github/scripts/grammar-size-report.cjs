// Renders the grammar size comparison that is posted on pull requests.
//
// The comment workflow runs with write access and reads measurements made by
// pull request code, so every value is validated here before it is rendered.

const MARKER = '<!-- grammar-size-report -->';

const METRICS = [
  { key: 'parser_c_bytes', label: '`src/parser.c`', bytes: true },
  { key: 'library_bytes', label: 'Compiled library', bytes: true },
  { key: 'states', label: 'Parse states' },
  { key: 'large_states', label: 'Large states' },
  { key: 'symbols', label: 'Symbols' },
  { key: 'tokens', label: 'Tokens' },
  { key: 'external_tokens', label: 'External tokens' },
  { key: 'fields', label: 'Fields' },
  { key: 'production_ids', label: 'Production IDs' },
];

function validate(metrics, side) {
  const clean = {};
  for (const { key } of METRICS) {
    const value = metrics?.[key];
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${side} measurement has an invalid ${key}: ${JSON.stringify(value)}`);
    }
    clean[key] = value;
  }
  const cli = String(metrics?.cli ?? '');
  clean.cli = /^[\w .()+-]{1,80}$/.test(cli) ? cli : 'unknown';
  return clean;
}

function formatValue(value, bytes) {
  if (!bytes) return value.toLocaleString('en-US');
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MB`;
  return `${(value / 1e3).toFixed(1)} KB`;
}

function formatChange(base, head, bytes) {
  const delta = head - base;
  if (delta === 0) return 'no change';
  const sign = delta > 0 ? '+' : '−';
  const amount = formatValue(Math.abs(delta), bytes);
  if (base === 0) return `${sign}${amount}`;
  const percent = (Math.abs(delta) / base) * 100;
  return `${sign}${amount} (${sign}${percent.toFixed(percent < 10 ? 2 : 1)}%)`;
}

function render(rawBase, rawHead, { baseSha = '', headSha = '' } = {}) {
  const base = validate(rawBase, 'Base');
  const head = validate(rawHead, 'Pull request');
  const changed = METRICS.some(({ key }) => base[key] !== head[key]);

  const parserDelta = head.parser_c_bytes - base.parser_c_bytes;
  let summary;
  if (!changed) {
    summary = 'This pull request does not change the size of the generated parser.';
  } else if (parserDelta === 0) {
    summary = 'This pull request does not change the size of `src/parser.c`, but other measurements changed.';
  } else {
    const verb = parserDelta > 0 ? 'grows' : 'shrinks';
    summary =
      `This pull request ${verb} \`src/parser.c\` by ` +
      `${formatChange(base.parser_c_bytes, head.parser_c_bytes, true).slice(1)}, ` +
      `from ${formatValue(base.parser_c_bytes, true)} to ${formatValue(head.parser_c_bytes, true)}.`;
  }

  const rows = METRICS.map(({ key, label, bytes }) =>
    `| ${label} | ${formatValue(base[key], bytes)} | ${formatValue(head[key], bytes)} | ${formatChange(base[key], head[key], bytes)} |`);

  const sha = value => (/^[0-9a-f]{7,40}$/.test(value) ? `\`${value.slice(0, 7)}\`` : 'unknown');
  const cli = base.cli === head.cli ? base.cli : `${base.cli} / ${head.cli}`;

  const markdown = [
    MARKER,
    '## Grammar size',
    '',
    summary,
    '',
    '| Measurement | Base | This PR | Change |',
    '| --- | ---: | ---: | ---: |',
    ...rows,
    '',
    `Base ${sha(baseSha)} and this PR ${sha(headSha)}, generated and built with ${cli} on Linux.`,
  ].join('\n');

  return { markdown, changed };
}

module.exports = { MARKER, render };
