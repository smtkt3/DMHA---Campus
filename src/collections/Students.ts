import type { CollectionConfig } from 'payload'

export const Students: CollectionConfig = {
  slug: 'students',
  admin: {
    useAsTitle: 'fullName',
  },
  fields: [
    { name: 'fullName', type: 'text', required: true },
    { name: 'className', type: 'text', required: true },
    { name: 'section', type: 'text', required: true },
    { name: 'rollNumber', type: 'text', required: true },
    { name: 'guardian', type: 'relationship', relationTo: 'guardians' as never, required: true },
    { name: 'busRoute', type: 'text' },
    { name: 'bloodGroup', type: 'text' },
  ],
}
