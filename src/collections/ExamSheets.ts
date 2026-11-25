import type { CollectionConfig } from 'payload'

export const ExamSheets: CollectionConfig = {
  slug: 'exam-sheets',
  admin: {
    useAsTitle: 'examTitle',
  },
  fields: [
    { name: 'student', type: 'relationship', relationTo: 'students' as never, required: true },
    { name: 'subject', type: 'text', required: true },
    { name: 'examTitle', type: 'text', required: true },
    { name: 'marksObtained', type: 'number', required: true },
    { name: 'totalMarks', type: 'number', required: true, defaultValue: 50 },
    {
      name: 'captureMethod',
      type: 'select',
      options: ['Upload', 'Scan', 'Camera Photo'],
      defaultValue: 'Scan',
    },
    { name: 'scriptFile', type: 'upload', relationTo: 'media' as never },
    { name: 'teacherRemarks', type: 'textarea' },
    { name: 'guardianReviewed', type: 'checkbox', defaultValue: false },
    { name: 'recheckRequested', type: 'checkbox', defaultValue: false },
    { name: 'adminVerified', type: 'checkbox', defaultValue: false },
  ],
}
