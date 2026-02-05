import { describe, it, expect } from 'vitest'
import {
  buildPageTree,
  getPagePath,
  sanitizePathSegment,
  getDescendantIds,
  findPageInTree,
  flattenTreeWithPaths,
} from '@/lib/notion-tree'
import type { NotionPageInfo } from '@/app/api/notion/search/route'

// Mock data
const mockPages: NotionPageInfo[] = [
  {
    id: 'page-1',
    title: 'Root Page 1',
    parent: { type: 'workspace' },
    lastEdited: '2024-01-01T00:00:00Z',
    isDatabase: false,
  },
  {
    id: 'page-2',
    title: 'Root Page 2',
    parent: { type: 'workspace' },
    lastEdited: '2024-01-02T00:00:00Z',
    isDatabase: false,
  },
  {
    id: 'page-3',
    title: 'Child of Page 1',
    parent: { type: 'page_id', id: 'page-1' },
    lastEdited: '2024-01-03T00:00:00Z',
    isDatabase: false,
  },
  {
    id: 'page-4',
    title: 'Grandchild',
    parent: { type: 'page_id', id: 'page-3' },
    lastEdited: '2024-01-04T00:00:00Z',
    isDatabase: false,
  },
  {
    id: 'db-1',
    title: 'Database',
    parent: { type: 'page_id', id: 'page-1' },
    lastEdited: '2024-01-05T00:00:00Z',
    isDatabase: true,
  },
]

describe('notion-tree', () => {
  describe('buildPageTree', () => {
    it('should build a tree from flat page list', () => {
      const tree = buildPageTree(mockPages)

      expect(tree).toHaveLength(2) // Two root pages
      expect(tree[0].title).toBe('Root Page 1')
      expect(tree[1].title).toBe('Root Page 2')
    })

    it('should correctly nest children', () => {
      const tree = buildPageTree(mockPages)
      const rootPage1 = tree.find((p) => p.id === 'page-1')

      expect(rootPage1).toBeDefined()
      expect(rootPage1!.children).toHaveLength(2) // Child page and database
    })

    it('should handle deeply nested pages', () => {
      const tree = buildPageTree(mockPages)
      const rootPage1 = tree.find((p) => p.id === 'page-1')
      const childPage = rootPage1!.children.find((p) => p.id === 'page-3')

      expect(childPage).toBeDefined()
      expect(childPage!.children).toHaveLength(1)
      expect(childPage!.children[0].id).toBe('page-4')
    })

    it('should return empty array for empty input', () => {
      const tree = buildPageTree([])
      expect(tree).toEqual([])
    })

    it('should treat orphan pages as roots', () => {
      const orphanPages: NotionPageInfo[] = [
        {
          id: 'orphan',
          title: 'Orphan',
          parent: { type: 'page_id', id: 'non-existent' },
          lastEdited: '2024-01-01T00:00:00Z',
          isDatabase: false,
        },
      ]
      const tree = buildPageTree(orphanPages)

      expect(tree).toHaveLength(1)
      expect(tree[0].id).toBe('orphan')
    })
  })

  describe('getPagePath', () => {
    it('should return path for root page', () => {
      const path = getPagePath('page-1', mockPages)
      expect(path).toEqual(['Root Page 1'])
    })

    it('should return full path for nested page', () => {
      const path = getPagePath('page-4', mockPages)
      expect(path).toEqual(['Root Page 1', 'Child of Page 1', 'Grandchild'])
    })

    it('should return empty array for non-existent page', () => {
      const path = getPagePath('non-existent', mockPages)
      expect(path).toEqual([])
    })
  })

  describe('sanitizePathSegment', () => {
    it('should remove invalid characters', () => {
      expect(sanitizePathSegment('file<>:"/\\|?*name')).toBe('file-name')
    })

    it('should collapse multiple spaces', () => {
      expect(sanitizePathSegment('hello   world')).toBe('hello world')
    })

    it('should collapse multiple dashes', () => {
      expect(sanitizePathSegment('hello---world')).toBe('hello-world')
    })

    it('should trim leading/trailing dashes', () => {
      expect(sanitizePathSegment('-hello-world-')).toBe('hello-world')
    })

    it('should return "untitled" for empty string', () => {
      expect(sanitizePathSegment('')).toBe('untitled')
    })

    it('should truncate long names', () => {
      const longName = 'a'.repeat(150)
      expect(sanitizePathSegment(longName).length).toBeLessThanOrEqual(100)
    })
  })

  describe('getDescendantIds', () => {
    it('should return all descendant IDs', () => {
      const tree = buildPageTree(mockPages)
      const rootPage1 = tree.find((p) => p.id === 'page-1')!
      const descendants = getDescendantIds(rootPage1)

      expect(descendants).toContain('page-3')
      expect(descendants).toContain('page-4')
      expect(descendants).toContain('db-1')
      expect(descendants).toHaveLength(3)
    })

    it('should return empty array for leaf node', () => {
      const tree = buildPageTree(mockPages)
      const rootPage2 = tree.find((p) => p.id === 'page-2')!
      const descendants = getDescendantIds(rootPage2)

      expect(descendants).toEqual([])
    })
  })

  describe('findPageInTree', () => {
    it('should find root page', () => {
      const tree = buildPageTree(mockPages)
      const found = findPageInTree(tree, 'page-1')

      expect(found).toBeDefined()
      expect(found!.id).toBe('page-1')
    })

    it('should find nested page', () => {
      const tree = buildPageTree(mockPages)
      const found = findPageInTree(tree, 'page-4')

      expect(found).toBeDefined()
      expect(found!.id).toBe('page-4')
    })

    it('should return null for non-existent page', () => {
      const tree = buildPageTree(mockPages)
      const found = findPageInTree(tree, 'non-existent')

      expect(found).toBeNull()
    })
  })

  describe('flattenTreeWithPaths', () => {
    it('should flatten tree with correct paths', () => {
      const tree = buildPageTree(mockPages)
      const flattened = flattenTreeWithPaths(tree)

      expect(flattened.length).toBe(5) // All pages

      const grandchild = flattened.find((item) => item.page.id === 'page-4')
      expect(grandchild).toBeDefined()
      expect(grandchild!.path).toEqual([
        'Root Page 1',
        'Child of Page 1',
        'Grandchild',
      ])
    })
  })
})
