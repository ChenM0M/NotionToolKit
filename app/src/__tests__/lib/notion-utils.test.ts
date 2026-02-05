import { describe, it, expect } from 'vitest'
import { getNotionPageId } from '@/lib/notion-utils'

describe('notion-utils', () => {
  describe('getNotionPageId', () => {
    it('should extract ID from standard Notion URL', () => {
      const url = 'https://www.notion.so/My-Page-Title-abc123def456789012345678901234ab'
      const id = getNotionPageId(url)
      expect(id).toBe('abc123def456789012345678901234ab')
    })

    it('should extract ID from notion.site URL', () => {
      const url = 'https://notion.site/Page-abc123def456789012345678901234ab'
      const id = getNotionPageId(url)
      expect(id).toBe('abc123def456789012345678901234ab')
    })

    it('should handle raw 32-char hex ID', () => {
      const id = getNotionPageId('abc123def456789012345678901234ab')
      expect(id).toBe('abc123def456789012345678901234ab')
    })

    it('should handle UUID with dashes', () => {
      const uuid = 'abc123de-f456-7890-1234-5678901234ab'
      const id = getNotionPageId(uuid)
      expect(id).toBe(uuid)
    })

    it('should return null for empty string', () => {
      expect(getNotionPageId('')).toBeNull()
    })

    it('should return null for invalid input', () => {
      expect(getNotionPageId('not-a-valid-id')).toBeNull()
    })

    it('should extract ID from URL with query params', () => {
      const url = 'https://www.notion.so/Page-abc123def456789012345678901234ab?v=123'
      const id = getNotionPageId(url)
      expect(id).toBe('abc123def456789012345678901234ab')
    })

    it('should handle URL with just ID in path', () => {
      const url = 'https://www.notion.so/abc123def456789012345678901234ab'
      const id = getNotionPageId(url)
      expect(id).toBe('abc123def456789012345678901234ab')
    })
  })
})
