import { describe, it, expect } from 'vitest';

describe('サンプルテスト', () => {
  it('1 + 1 は 2', () => {
    expect(1 + 1).toBe(2);
  });

  it('配列に要素が含まれる', () => {
    const fruits = ['apple', 'banana', 'orange'];
    expect(fruits).toContain('banana');
  });
});
