import type { CollectionConfig } from 'payload'

export const Guardians: CollectionConfig = {
  slug: 'guardians',
  admin: {
    useAsTitle: 'fullName',
  },
  fields: [
    { name: 'fullName', type: 'text', required: true },
    { name: 'relation', type: 'select', options: ['Father', 'Mother', 'Legal Guardian'], defaultValue: 'Father' },
    { name: 'phone', type: 'text', required: true },
    { name: 'email', type: 'email' },
    { name: 'smsAlertsEnabled', type: 'checkbox', defaultValue: true },
  ],
}
