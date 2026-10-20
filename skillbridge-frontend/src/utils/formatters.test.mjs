import test from 'node:test'
import assert from 'node:assert/strict'
import { givenNamesForGreeting } from './formatters.js'

test('student greeting keeps all given names and excludes one-word surname', () => {
  assert.equal(givenNamesForGreeting('David Rey Bali-os', 'bali-os.davidrey@dnsc.edu.ph'), 'David Rey')
})

test('student greeting excludes a multiword surname', () => {
  assert.equal(givenNamesForGreeting('David Rey Dela Cerna', 'delacerna.davidrey@dnsc.edu.ph'), 'David Rey')
})

test('student greeting handles one given name and normalized Unicode', () => {
  assert.equal(givenNamesForGreeting('Azel Villanueva', 'villanueva.azel@dnsc.edu.ph'), 'Azel')
  assert.equal(givenNamesForGreeting('Juan José Dela Cruz', 'delacruz.juanjose@dnsc.edu.ph'), 'Juan José')
})

test('student greeting safely falls back when an edited email does not identify given names', () => {
  assert.equal(givenNamesForGreeting('David Rey Bali-os', 'controlled@dnsc.edu.ph'), 'David')
  assert.equal(givenNamesForGreeting('', ''), 'Student')
})
