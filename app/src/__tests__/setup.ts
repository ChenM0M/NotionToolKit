import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock fetch for tests
global.fetch = vi.fn()

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()
