// U+2028 / U+2029 are valid inside JSON strings but terminate a JavaScript string literal.
const LINE_SEPARATOR = String.fromCharCode(0x2028)
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029)

/**
 * JSON safe to inline inside a `<script>`: escapes `<` (so `</script>` cannot close the tag)
 * and the two line terminators JSON allows but JavaScript string literals do not. Runs on: both.
 */
export const serializeForScript = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .split(LINE_SEPARATOR)
    .join('\\u2028')
    .split(PARAGRAPH_SEPARATOR)
    .join('\\u2029')
