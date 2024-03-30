import { describe, expect, test } from 'vitest'
import { INVALID, parseLength, parseRatio } from '../src/parse'

describe('parseLength', () => {
  test('parses a number', () => {
    expect(parseLength(100, 200)).toBe(100)
  })
  test('parses a number string', () => {
    expect(parseLength('100', 200)).toBe(100)
  })
  test('parses decimal number string', () => {
    expect(parseLength('100.5', 200)).toBe(100.5)
  })
  test('parses negative number string', () => {
    expect(parseLength('-100', 200)).toBe(-100)
  })
  test('parses negative decimal number string', () => {
    expect(parseLength('-100.5', 200)).toBe(-100.5)
  })
  test('parses a percentage string', () => {
    expect(parseLength('50%', 200)).toBe(100)
  })
  test('parses a percentage string with decimal', () => {
    expect(parseLength('50.5%', 200)).toBe(101)
  })
  test('parses a percentage string with negative value', () => {
    expect(parseLength('-50%', 200)).toBe(-100)
  })
  test('parses a percentage string with negative decimal value', () => {
    expect(parseLength('-50.5%', 200)).toBe(-101)
  })
  test('parses a pixel string', () => {
    expect(parseLength('100px', 200)).toBe(100)
  })
  test('parses a pixel string with decimal', () => {
    expect(parseLength('100.5px', 200)).toBe(100.5)
  })
  test('parses a pixel string with negative value', () => {
    expect(parseLength('-100px', 200)).toBe(-100)
  })
  test('parses a pixel string with negative decimal value', () => {
    expect(parseLength('-100.5px', 200)).toBe(-100.5)
  })
  test('treats unknown units as INVALID', () => {
    expect(parseLength('100em', 200)).toBe(INVALID)
  })
  test('treats invalid strings as INVALID', () => {
    expect(parseLength('foo', 200)).toBe(INVALID)
  })
})

describe('parseRatio', () => {
  test('parses a number', () => {
    expect(parseRatio(1)).toBe(1)
  })
  test('parses a number string', () => {
    expect(parseRatio('1')).toBe(1)
  })
  test('parses a ratio string', () => {
    expect(parseRatio('16/9')).toBe(16 / 9)
  })
  test('treats invalid strings as INVALID', () => {
    expect(parseRatio('foo')).toBe(INVALID)
  })
  test('treats divide by zero as INVALID', () => {
    expect(parseRatio('16/0')).toBe(INVALID)
  })
})
