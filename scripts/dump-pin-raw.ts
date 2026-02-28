#!/usr/bin/env npx tsx
/**
 * Dump raw v3GetPinQuery data for a Pinterest pin to find AI-related fields.
 *
 * Usage: npx tsx scripts/dump-pin-raw.ts <pin-id-or-url>
 * Example: npx tsx scripts/dump-pin-raw.ts 911908624572626221
 * Example: npx tsx scripts/dump-pin-raw.ts https://de.pinterest.com/pin/911908624572626221/
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
];

async function dumpPinRaw(pinIdOrUrl: string) {
  // Extract pin ID from URL if needed
  let pinId = pinIdOrUrl;
  const urlMatch = pinIdOrUrl.match(/\/pin\/(\d+)/);
  if (urlMatch) pinId = urlMatch[1];

  if (!/^\d+$/.test(pinId)) {
    console.error('Invalid pin ID:', pinId);
    process.exit(1);
  }

  const url = `https://www.pinterest.com/pin/${pinId}/`;
  console.log(`\nFetching: ${url}\n`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'DNT': '1',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    console.error(`HTTP Error: ${response.status}`);
    process.exit(1);
  }

  const html = await response.text();
  console.log(`Page size: ${html.length} chars\n`);

  // Extract ALL v3GetPinQuery blocks
  const v3Regex = /\{"data":\{"v3GetPinQuery":/g;
  let v3Match: RegExpExecArray | null;
  const v3Blocks: any[] = [];

  while ((v3Match = v3Regex.exec(html)) !== null) {
    const start = v3Match.index;
    let depth = 0;
    let end = start;
    for (let i = start; i < Math.min(html.length, start + 200000); i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }

    try {
      const block = JSON.parse(html.slice(start, end));
      const pinQuery = block?.data?.v3GetPinQuery;
      if (pinQuery?.data) {
        v3Blocks.push(pinQuery.data);
      }
    } catch {
      // Skip unparseable blocks
    }
  }

  if (v3Blocks.length === 0) {
    console.error('No v3GetPinQuery blocks found!');

    // Try Redux state as fallback
    const reduxMatch = html.match(/<script id="__PWS_INITIAL_PROPS__"[^>]*>(.*?)<\/script>/s)
      || html.match(/<script id="__PWS_DATA__"[^>]*>(.*?)<\/script>/s);

    if (reduxMatch) {
      try {
        const jsonData = JSON.parse(reduxMatch[1]);
        console.log('\n=== Redux State (raw) ===');
        console.log(JSON.stringify(jsonData, null, 2));
      } catch (e) {
        console.error('Failed to parse Redux state');
      }
    }
    process.exit(1);
  }

  // Merge all v3 blocks
  const merged = Object.assign({}, ...v3Blocks);

  // 1. Dump ALL top-level keys
  console.log('=== ALL TOP-LEVEL KEYS in v3GetPinQuery.data ===');
  const allKeys = Object.keys(merged).sort();
  console.log(allKeys.join('\n'));
  console.log(`\nTotal: ${allKeys.length} keys\n`);

  // 2. Search for AI-related fields (case-insensitive)
  const aiPatterns = [
    /ai/i, /gen[_\s]?ai/i, /generat/i, /modif/i, /label/i, /disclos/i,
    /classif/i, /synth/i, /iptc/i, /c2pa/i, /credential/i, /detect/i,
    /source.?type/i, /content.?type/i, /machine/i, /algorithm/i,
  ];

  console.log('=== AI-RELATED FIELDS (deep search) ===');

  function deepSearch(obj: any, path: string = '') {
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        // Check if key matches AI patterns
        for (const pattern of aiPatterns) {
          if (pattern.test(key)) {
            console.log(`  ${currentPath} = ${JSON.stringify(value)}`);
            break;
          }
        }

        // Check if string value matches AI patterns
        if (typeof value === 'string') {
          for (const pattern of aiPatterns) {
            if (pattern.test(value) && !pattern.test(key)) {
              console.log(`  ${currentPath} = ${JSON.stringify(value)}  (value match)`);
              break;
            }
          }
        }

        // Recurse into objects and arrays
        if (typeof value === 'object') {
          deepSearch(value, currentPath);
        }
      }
    }
  }

  deepSearch(merged);

  // 3. Write full JSON to file for manual inspection
  const outputFile = `/tmp/pin_${pinId}_raw.json`;
  const fs = await import('fs');
  fs.writeFileSync(outputFile, JSON.stringify(merged, null, 2));
  console.log(`\n=== Full raw JSON written to: ${outputFile} ===`);

  // 4. Also dump individual v3 blocks for comparison
  for (let i = 0; i < v3Blocks.length; i++) {
    const blockFile = `/tmp/pin_${pinId}_block_${i}.json`;
    fs.writeFileSync(blockFile, JSON.stringify(v3Blocks[i], null, 2));
    console.log(`Block ${i}: ${Object.keys(v3Blocks[i]).length} keys → ${blockFile}`);
  }
}

// Main
const arg = process.argv[2];
if (!arg) {
  console.log('Usage: npx tsx scripts/dump-pin-raw.ts <pin-id-or-url>');
  console.log('Example: npx tsx scripts/dump-pin-raw.ts 911908624572626221');
  process.exit(1);
}

dumpPinRaw(arg).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
