import type { CollectionConfig } from 'payload'

export const Quizzes: CollectionConfig = {
  slug: 'quizzes',
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'subject', type: 'text', required: true },
    { name: 'className', type: 'text', required: true },
    { name: 'teacherName', type: 'text', required: true },
    { name: 'durationMins', type: 'number', required: true, defaultValue: 15 },
    { name: 'passPercentage', type: 'number', required: true, defaultValue: 60 },
    {
      name: 'status',
      type: 'select',
      options: ['published', 'closed'],
      defaultValue: 'published',
    },
    { name: 'questionsJson', type: 'textarea' },
  ],
}
