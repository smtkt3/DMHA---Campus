import type { CollectionConfig } from 'payload'

export const Attendance: CollectionConfig = {
  slug: 'attendance',
  admin: {
    useAsTitle: 'date',
  },
  fields: [
    { name: 'student', type: 'relationship', relationTo: 'students' as never, required: true },
    { name: 'date', type: 'date', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: ['present', 'late', 'absent', 'leave'],
    },
    { name: 'gateCheckInTime', type: 'text' },
    { name: 'guardianNotified', type: 'checkbox', defaultValue: false },
    { name: 'remarks', type: 'text' },
  ],
}
