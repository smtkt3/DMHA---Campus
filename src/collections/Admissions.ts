import type { CollectionConfig } from 'payload'

export const Admissions: CollectionConfig = {
  slug: 'admissions',
  admin: {
    useAsTitle: 'applicantName',
  },
  fields: [
    { name: 'applicationCode', type: 'text', required: true, unique: true },
    { name: 'applicantName', type: 'text', required: true },
    { name: 'applyingClass', type: 'text', required: true },
    { name: 'previousSchool', type: 'text' },
    { name: 'guardianName', type: 'text', required: true },
    { name: 'guardianPhone', type: 'text', required: true },
    { name: 'guardianEmail', type: 'email' },
    {
      name: 'stage',
      type: 'select',
      options: ['applied', 'test_scheduled', 'interview', 'approved', 'enrolled', 'waitlisted'],
      defaultValue: 'applied',
    },
    { name: 'testScore', type: 'number' },
    { name: 'admissionFeePaid', type: 'checkbox', defaultValue: false },
    { name: 'notes', type: 'textarea' },
  ],
}
