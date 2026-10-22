import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Select } from './Select'

const OPTIONS = [
  { value: 'Oxygen', label: 'Oxygen' },
  { value: 'Nitrogen', label: 'Nitrogen' },
  { value: 'Argon', label: 'Argon', disabled: true },
  { value: 'Hydrogen', label: 'Hydrogen' },
]

function Harness() {
  const [v, setV] = useState<string>()
  return (
    <>
      <Select aria-label="Gas type" value={v} onChange={setV} options={OPTIONS} placeholder="Choose a gas" />
      <output>{v ?? 'none'}</output>
    </>
  )
}

describe('Select', () => {
  it('opens a listbox, skips disabled options with the keyboard, and commits with Enter', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('combobox', { name: 'Gas type' })
    expect(trigger).toHaveTextContent('Choose a gas')

    trigger.focus()
    await user.keyboard('{ArrowDown}')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('option')).toHaveLength(4)

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}') // Oxygen -> Nitrogen -> (Argon disabled) Hydrogen
    expect(screen.getByText('Hydrogen', { selector: 'output' })).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it('selects with a click, closes on Escape, and jumps by typing', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('combobox', { name: 'Gas type' })

    await user.click(trigger)
    await user.click(screen.getByRole('option', { name: 'Nitrogen' }))
    expect(screen.getByText('Nitrogen', { selector: 'output' })).toBeInTheDocument()

    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('h') // typeahead while closed
    expect(screen.getByText('Hydrogen', { selector: 'output' })).toBeInTheDocument()
  })

  it('closes after a click selection even when wrapped in a <label> (Rows per page)', async () => {
    const user = userEvent.setup()
    function Labelled() {
      const [v, setV] = useState(10)
      const sizes = [10, 20, 50].map((s) => ({ value: s, label: String(s) }))
      return (
        <label>
          <span>Rows</span>
          <Select aria-label="Rows per page" value={v} onChange={setV} options={sizes} />
        </label>
      )
    }
    render(<Labelled />)
    const trigger = screen.getByRole('combobox', { name: 'Rows per page' })

    for (const size of ['20', '50', '10']) {
      await user.click(trigger)
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      await user.click(screen.getByRole('option', { name: size }))
      expect(trigger).toHaveTextContent(size)
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByRole('listbox', { hidden: true })).not.toBeVisible()
    }
  })
})
