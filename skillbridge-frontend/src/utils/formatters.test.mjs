import test from 'node:test'
import assert from 'node:assert/strict'
import { givenNamesForGreeting, nameFromEmail } from './formatters.js'

test('email-derived instructor suggestions capitalize every space-separated name without dropping given names', () => {
  assert.equal(nameFromEmail('reyes.juan@dnsc.edu.ph'), 'Juan Reyes')
  assert.equal(nameFromEmail(' REYES.JUAN@DNSC.EDU.PH '), 'Juan Reyes')
  assert.equal(nameFromEmail('dela_cruz.juan_jose@dnsc.edu.ph'), 'Juan Jose Dela Cruz')
  assert.equal(nameFromEmail('reyes.juan.jose@dnsc.edu.ph'), 'Juan Jose Reyes')
  assert.equal(nameFromEmail('bali-os.davidrey@dnsc.edu.ph'), 'Davidrey Bali-os')
  assert.equal(nameFromEmail('peña.josé@dnsc.edu.ph'), 'José Peña')
})

test('email name suggestions handle clearing, partial input and usernames without a surname separator', () => {
  assert.equal(nameFromEmail(''), '')
  assert.equal(nameFromEmail(null), '')
  assert.equal(nameFromEmail(), '')
  assert.equal(nameFromEmail('reyes.'), 'Reyes')
  assert.equal(nameFromEmail('mtreyes@dnsc.edu.ph'), 'Mtreyes')
})

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
