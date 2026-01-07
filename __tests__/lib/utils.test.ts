import { cn } from '@/lib/utils'

describe('cn', () => {
    it('should merge class names correctly', () => {
        expect(cn('c-1', 'c-2')).toBe('c-1 c-2')
    })

    it('should handle conditional classes', () => {
        expect(cn('c-1', true && 'c-2', false && 'c-3')).toBe('c-1 c-2')
    })

    it('should merge tailwind classes using tailwind-merge', () => {
        expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })
})
