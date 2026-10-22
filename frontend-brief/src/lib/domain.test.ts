import { describe, expect, it } from 'vitest'
import { STATUSES, canTransition, normalizeSerial, validateCustomerName, validateCylinderInput } from './domain'

describe('lifecycle rules', () => {
  it('allows exactly the transitions in the brief', () => {
    const allowed = STATUSES.flatMap((from) => STATUSES.filter((to) => canTransition(from, to)).map((to) => `${from}>${to}`))
    expect(allowed.sort()).toEqual(
      [
        'Empty>Filled', 'Empty>InMaintenance', 'Empty>Retired',
        'Filled>Delivered', 'Filled>InMaintenance', 'Filled>Retired',
        'Delivered>Empty',
        'InMaintenance>Empty', 'InMaintenance>Retired',
      ].sort(),
    )
  })

  it('treats Retired as final', () => {
    STATUSES.forEach((to) => expect(canTransition('Retired', to)).toBe(false))
  })
})

describe('input validation', () => {
  it('normalises serials to upper case and checks the CYL-###### format', () => {
    expect(normalizeSerial('  cyl-012345 ')).toBe('CYL-012345')
    expect(validateCylinderInput({ serialNumber: 'cyl-012345', gasType: 'oxygen' })).toEqual({})
    expect(validateCylinderInput({ serialNumber: 'CYL-12345', gasType: 'Oxygen' }).serialNumber).toMatch(/6 digits/)
    expect(validateCylinderInput({ serialNumber: 'CYL-012345', gasType: 'Helium' }).gasType).toMatch(/must be one of/)
  })

  it('requires a customer name of at most 120 characters', () => {
    expect(validateCustomerName('   ')).toMatch(/required/)
    expect(validateCustomerName('x'.repeat(121))).toMatch(/120/)
    expect(validateCustomerName("PT Sinar O'Brien Medika")).toBeUndefined()
  })
})
