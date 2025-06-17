declare module 'nspell' {
  interface NSpellOptions {
    dic?: string
    aff?: string
  }

  interface NSpell {
    correct(word: string): boolean
    suggest(word: string): string[]
  }

  function nspell(options: NSpellOptions): NSpell

  export = nspell
} 