// Narration markup used in the script:
//   *idea word*   -> tag 'em'   (mint STIX italic)
//   **key term**  -> tag 'key'  (bold)
//   [[Name]]      -> tag 'name' (bold, a proper name)
// Returns the plain sentence (for the voice) and the tagged words (for captions).

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\[[^\]]+\]\])/g;

export const parseMarkup = (text) => {
  const words = [];
  let plain = '';
  for (const part of text.split(TOKEN)) {
    if (!part) continue;
    let tag = '';
    let body = part;
    if (part.startsWith('**') && part.endsWith('**')) {
      tag = 'key';
      body = part.slice(2, -2);
    } else if (part.startsWith('[[') && part.endsWith(']]')) {
      tag = 'name';
      body = part.slice(2, -2);
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      tag = 'em';
      body = part.slice(1, -1);
    }
    plain += body;
    for (const w of body.split(/\s+/).filter(Boolean)) words.push({text: w, tag});
  }
  // Punctuation that follows a tagged span belongs to the last word, untagged.
  const merged = [];
  for (const w of words) {
    if (merged.length && /^[.,;:!?)\]”’]+$/.test(w.text)) merged[merged.length - 1].text += w.text;
    else merged.push(w);
  }
  return {plain: plain.replace(/\s+/g, ' ').trim(), words: merged};
};

// Normalise a word for matching against aligner output.
export const norm = (w) =>
  w
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%µ.]+/g, '')
    .replace(/\.$/, '');
