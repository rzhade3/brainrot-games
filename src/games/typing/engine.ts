export interface Word { text: string; x: number; y: number; speed: number }
export function submitWord(words: readonly Word[], buffer: string, speed: number): { words: Word[]; points: number; matched: string | null } {
  const index = words.findIndex(word => word.text === buffer.trim().toLowerCase());
  if (index < 0) return { words: [...words], points: 0, matched: null };
  return { words: words.filter((_, i) => i !== index), points: Math.round(words[index].text.length * speed / 25), matched: words[index].text };
}
