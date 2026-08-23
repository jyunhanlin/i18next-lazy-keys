import { serializeForScript } from './serialize'

describe('serializeForScript', () => {
  it('cannot close a <script> tag and still parses back', () => {
    const lineSeparator = String.fromCharCode(0x2028)
    const value = { a: `</script><b>${lineSeparator}x` }
    const out = serializeForScript(value)
    expect(out).not.toContain('</')
    expect(out).not.toContain(lineSeparator)
    expect(JSON.parse(out)).toEqual(value)
  })
})
