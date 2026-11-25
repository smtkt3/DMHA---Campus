import type { CollectionConfig } from 'payload'

export const Assessments: CollectionConfig = {
  slug: 'assessments',
  admin: {
    useAsTitle: 'subject',
  },
  fields: [
    { name: 'student', type: 'relationship', relationTo: 'students' as never, required: true },
    { name: 'term', type: 'text', required: true },
    { name: 'subject', type: 'text', required: true },
    { name: 'score', type: 'number', min: 0, max: 100, required: true },
    { name: 'grade', type: 'text', required: true },
    { name: 'teacherRemarks', type: 'text' },
  ],
}
