// Capitalise the first letter of every word in a part name, leaving the rest
// as typed so abbreviations survive ("cabin AC filter" -> "Cabin AC Filter").
// A word starts at the beginning or after anything that isn't a letter, digit
// or apostrophe — so "(h4)" -> "(H4)", but "driver's" and "4wd" are left alone.
// Mirrors inventory/text.py on the server; keep the two in step.
const WORD_START = /(^|[^A-Za-z0-9'’])([a-z])/g;

export const titleCaseName = (text) =>
  (text || "").replace(WORD_START, (_, before, letter) => before + letter.toUpperCase());

// Capitalise the first letter of each sentence — at the start, after . ! or ?
// and a space, and at the start of each new line. Nothing else changes, so
// abbreviations and the rest of the wording stay as typed.
const SENTENCE_START = /(^\s*|[.!?]\s+|\n\s*)([a-z])/g;

export const sentenceCase = (text) =>
  (text || "").replace(SENTENCE_START, (_, before, letter) => before + letter.toUpperCase());

/**
 * An input/textarea onChange that applies `transform` (titleCaseName,
 * sentenceCase) to what's typed and hands the result to `setValue`. A case
 * change never alters the length, so the caret is put back where it was —
 * otherwise React's re-render would throw it to the end mid-edit.
 */
export const caseOnChange = (transform, setValue) => (e) => {
  const input = e.target;
  const { selectionStart, selectionEnd } = input;
  const value = transform(input.value);
  setValue(value);
  if (value !== input.value) {
    requestAnimationFrame(() => {
      if (document.activeElement === input) input.setSelectionRange(selectionStart, selectionEnd);
    });
  }
};
