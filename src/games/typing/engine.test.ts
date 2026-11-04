import test from 'node:test';
import assert from 'node:assert/strict';
import { submitWord, type Word } from './engine';
const words: Word[] = [{ text: 'type', x: 300, y: 100, speed: 25 }, { text: 'type', x: 450, y: 200, speed: 28 }, { text: 'rot', x: 400, y: 300, speed: 25 }];
test('a complete word removes one match and scores using the current pace', () => {
  const result = submitWord(words, ' TYPE ', 30);
  assert.equal(result.points, 5);
  assert.equal(result.matched, 'type');
  assert.deepEqual(result.words, words.slice(1));
  assert.equal(words.length, 3);
});
test('partial or unknown words do not remove words or cost points', () => {
  for (const input of ['', 'ty', 'missing']) {
    const result = submitWord(words, input, 25);
    assert.equal(result.points, 0);
    assert.equal(result.matched, null);
    assert.deepEqual(result.words, words);
  }
});
