import assert from 'node:assert/strict'
import test from 'node:test'
import { formatRating } from '../src/lib/rating-format.ts'

test('formats integer ratings without a decimal', () => {
  assert.equal(formatRating(5), '5')
  assert.equal(formatRating(4), '4')
})

test('preserves one decimal for fractional ratings', () => {
  assert.equal(formatRating(4.5), '4.5')
  assert.equal(formatRating(4.8), '4.8')
})

test('clamps invalid display values safely', () => {
  assert.equal(formatRating(6), '5')
  assert.equal(formatRating(-1), '0')
  assert.equal(formatRating(undefined), '0')
})
