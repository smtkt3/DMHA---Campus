import type { CollectionConfig } from 'payload'

export const TeacherFeedback: CollectionConfig = {
  slug: 'teacher-feedback',
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    { name: 'student', type: 'relationship', relationTo: 'students' as never, required: true },
    { name: 'teacherName', type: 'text', required: true },
    { name: 'subject', type: 'text', required: true },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: ['praise', 'academic', 'behavior', 'attention'],
    },
    { name: 'title', type: 'text', required: true },
    { name: 'message', type: 'textarea', required: true },
    { name: 'acknowledgedByGuardian', type: 'checkbox', defaultValue: false },
    { name: 'guardianReply', type: 'textarea' },
  ],
}
