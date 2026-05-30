// Vitest global setup: registers @testing-library/jest-dom matchers with
// Vitest's `expect` and tears down the DOM between tests so each test starts
// from a clean slate.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
