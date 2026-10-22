// Business rules from the requirement. Shared by the UI (client-side
// validation, which actions to offer) and the mock API (server-side checks).

export const STATUSES = ['Empty', 'Filled', 'Delivered', 'InMaintenance', 'Retired'] as const
export type CylinderStatus = (typeof STATUSES)[number]

export const GAS_TYPES = ['Oxygen', 'Nitrogen', 'Argon', 'Carbon Dioxide', 'Acetylene', 'Hydrogen'] as const
export type GasType = (typeof GAS_TYPES)[number]

export const TRANSITIONS: Record<CylinderStatus, readonly CylinderStatus[]> = {
  Empty: ['Filled', 'InMaintenance', 'Retired'],
  Filled: ['Delivered', 'InMaintenance', 'Retired'],
  Delivered: ['Empty'],
  InMaintenance: ['Empty', 'Retired'],
  Retired: [],
}

export const STATUS_LABEL: Record<CylinderStatus, string> = {
  Empty: 'Empty',
  Filled: 'Filled',
  Delivered: 'Delivered',
  InMaintenance: 'In maintenance',
  Retired: 'Retired',
}

export const STATUS_DESCRIPTION: Record<CylinderStatus, string> = {
  Empty: 'Back at the plant, ready to be filled or inspected.',
  Filled: 'Filled with gas and ready to ship.',
  Delivered: 'With a customer. The receiving party is recorded.',
  InMaintenance: 'Being inspected or repaired.',
  Retired: 'Taken out of service for good. No further changes.',
}

// Verb used on action buttons, e.g. "Mark as filled".
export const STATUS_ACTION: Record<CylinderStatus, string> = {
  Empty: 'Mark as returned empty',
  Filled: 'Mark as filled',
  Delivered: 'Deliver to customer',
  InMaintenance: 'Send to maintenance',
  Retired: 'Retire cylinder',
}

// The usual move from each status (the Empty -> Filled -> Delivered -> Empty loop).
// Listed first and styled as primary on the detail page.
export const PRIMARY_NEXT: Partial<Record<CylinderStatus, CylinderStatus>> = {
  Empty: 'Filled',
  Filled: 'Delivered',
  Delivered: 'Empty',
  InMaintenance: 'Empty',
}

export const CUSTOMER_NAME_MAX = 120
export const SERIAL_PATTERN = /^CYL-\d{6}$/

export const isStatus = (v: unknown): v is CylinderStatus =>
  typeof v === 'string' && (STATUSES as readonly string[]).includes(v)

export const canTransition = (from: CylinderStatus, to: CylinderStatus) => TRANSITIONS[from].includes(to)

export const normalizeSerial = (v: string | null | undefined) => (v ?? '').trim().toUpperCase()

export const matchGasType = (v: string | null | undefined): GasType | undefined =>
  GAS_TYPES.find((g) => g.toLowerCase() === (v ?? '').trim().toLowerCase())

export type FieldErrors = Partial<Record<string, string>>

export function validateCylinderInput(input: { serialNumber?: string; gasType?: string }): FieldErrors {
  const errors: FieldErrors = {}
  const serial = normalizeSerial(input.serialNumber)
  if (!serial) errors.serialNumber = 'Serial number is required.'
  else if (!SERIAL_PATTERN.test(serial)) errors.serialNumber = "Use 'CYL-' followed by 6 digits, e.g. CYL-012345."
  if (!input.gasType?.trim()) errors.gasType = 'Choose a gas type.'
  else if (!matchGasType(input.gasType)) errors.gasType = `Gas type must be one of: ${GAS_TYPES.join(', ')}.`
  return errors
}

export function validateCustomerName(name: string | undefined): string | undefined {
  const v = (name ?? '').trim()
  if (!v) return 'Customer name is required when delivering a cylinder.'
  if (v.length > CUSTOMER_NAME_MAX) return `Customer name must be at most ${CUSTOMER_NAME_MAX} characters.`
  return undefined
}
