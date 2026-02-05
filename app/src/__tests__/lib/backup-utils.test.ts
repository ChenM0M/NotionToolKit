import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadBlob, getBackupFilename } from '@/lib/backup-utils'

describe('backup-utils', () => {
  describe('downloadBlob', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should create download link and trigger click', () => {
      const mockBlob = new Blob(['test content'], { type: 'text/plain' })
      const mockAppendChild = vi.spyOn(document.body, 'appendChild')
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild')

      downloadBlob(mockBlob, 'test.txt')

      expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(mockAppendChild).toHaveBeenCalled()
      expect(mockRemoveChild).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })
  })

  describe('getBackupFilename', () => {
    it('should generate filename with default prefix', () => {
      const filename = getBackupFilename()
      expect(filename).toMatch(/^notion-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.zip$/)
    })

    it('should generate filename with custom prefix', () => {
      const filename = getBackupFilename('my-backup')
      expect(filename).toMatch(/^my-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.zip$/)
    })

    it('should include current timestamp', () => {
      const before = new Date()
      const filename = getBackupFilename()
      const after = new Date()

      // Extract timestamp from filename
      const match = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/)
      expect(match).toBeTruthy()

      // Convert filename timestamp to a parseable ISO-like format
      // YYYY-MM-DDTHH-MM-SS -> YYYY-MM-DDTHH:MM:SS
      const isoTimestamp = match![1].replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3')
      // getBackupFilename uses toISOString() (UTC), so parse as UTC.
      const fileDate = new Date(`${isoTimestamp}Z`)
      expect(Number.isNaN(fileDate.getTime())).toBe(false)

      // File date should be between before and after
      expect(fileDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
      expect(fileDate.getTime()).toBeLessThanOrEqual(after.getTime() + 1000)
    })
  })
})
