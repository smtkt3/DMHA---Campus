import type { CollectionConfig } from 'payload'

export const Notices: CollectionConfig = {
  slug: 'notices',
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: ['academic', 'event', 'urgent', 'transport'],
    },
    {
      name: 'audience',
      type: 'select',
      required: true,
      options: ['All', 'Guardians', 'Students', 'Teachers'],
      defaultValue: 'All',
    },
  ],
}
