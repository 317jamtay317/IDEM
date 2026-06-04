import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldLimitsScreen } from './FieldLimitsScreen'
import type { ProductionField, ProductionFieldsApi } from '../productionFieldsApi'
import type { ProductionFieldLimitsApi } from '../productionFieldLimitsApi'

/** jsdom lacks matchMedia; return a benign stub so any breakpoint hook resolves. */
function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

function field(
  overrides: Partial<ProductionField> & Pick<ProductionField, 'propertyName' | 'friendlyName'>,
): ProductionField {
  return {
    id: overrides.propertyName,
    description: null,
    dataType: 'Decimal',
    category: null,
    isSummary: true,
    displayOrder: 0,
    isActive: true,
    ...overrides,
  }
}

function makeApis() {
  const fieldsApi = {
    list: vi.fn(() =>
      Promise.resolve([
        field({ propertyName: 'HotMix', friendlyName: 'Hot Mix', dataType: 'Decimal', displayOrder: 0 }),
        field({ propertyName: 'ColdMix', friendlyName: 'Cold Mix', dataType: 'Decimal', displayOrder: 1 }),
        field({ propertyName: 'TruckCount', friendlyName: 'Truck Count', dataType: 'Integer', displayOrder: 2 }),
        field({ propertyName: 'IsOperated', friendlyName: 'Plant Ran', dataType: 'Boolean', displayOrder: 3 }),
        field({ propertyName: 'InspectionDate', friendlyName: 'Inspection', dataType: 'Date', displayOrder: 4 }),
      ]),
    ),
  } as unknown as ProductionFieldsApi

  const limitsApi = {
    list: vi.fn(() => Promise.resolve([{ propertyName: 'HotMix', lowLimit: 0, highLimit: 200, unit: 'Tons' }])),
    set: vi.fn((_t: string | null, propertyName: string, input: object) =>
      Promise.resolve({ propertyName, ...input }),
    ),
  } as unknown as ProductionFieldLimitsApi

  return { fieldsApi, limitsApi }
}

function renderScreen(apis: ReturnType<typeof makeApis>) {
  return render(
    <FieldLimitsScreen accessToken="tok" fieldsApi={apis.fieldsApi} limitsApi={apis.limitsApi} />,
  )
}

beforeEach(() => stubMatchMedia())
afterEach(() => vi.unstubAllGlobals())

describe('FieldLimitsScreen', () => {
  it('lists numeric fields with their configured limits and excludes non-numeric fields', async () => {
    const apis = makeApis()
    renderScreen(apis)

    await waitFor(() => expect(apis.limitsApi.list).toHaveBeenCalledWith('tok'))

    const grid = await screen.findByRole('table', { name: /field limits/i })
    expect(within(grid).getByText('Hot Mix')).toBeInTheDocument()
    expect(within(grid).getByText('Cold Mix')).toBeInTheDocument()
    expect(within(grid).getByText('Truck Count')).toBeInTheDocument()
    // Non-numeric fields cannot carry a numeric range, so they are not offered a limit.
    expect(within(grid).queryByText('Plant Ran')).not.toBeInTheDocument()
    expect(within(grid).queryByText('Inspection')).not.toBeInTheDocument()
    // The configured HotMix high bound is shown.
    expect(within(grid).getByText('200')).toBeInTheDocument()
  })

  it('sets a field limit and reflects the saved values', async () => {
    const apis = makeApis()
    const user = userEvent.setup()
    renderScreen(apis)

    const grid = await screen.findByRole('table', { name: /field limits/i })
    const coldMixRow = within(grid).getByText('Cold Mix').closest('tr') as HTMLElement
    await user.click(within(coldMixRow).getByRole('button', { name: /edit|set/i }))

    await user.clear(screen.getByLabelText('Low limit'))
    await user.type(screen.getByLabelText('Low limit'), '1')
    await user.clear(screen.getByLabelText('High limit'))
    await user.type(screen.getByLabelText('High limit'), '5')
    await user.selectOptions(screen.getByLabelText('Unit'), 'Percentage')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(apis.limitsApi.set).toHaveBeenCalledWith('tok', 'ColdMix', {
        lowLimit: 1,
        highLimit: 5,
        unit: 'Percentage',
      }),
    )
    expect(await screen.findByText(/saved cold mix/i)).toBeInTheDocument()
  })

  it('blocks a limit whose high bound is below its low bound (I-D25)', async () => {
    const apis = makeApis()
    const user = userEvent.setup()
    renderScreen(apis)

    const grid = await screen.findByRole('table', { name: /field limits/i })
    const coldMixRow = within(grid).getByText('Cold Mix').closest('tr') as HTMLElement
    await user.click(within(coldMixRow).getByRole('button', { name: /edit|set/i }))

    await user.clear(screen.getByLabelText('Low limit'))
    await user.type(screen.getByLabelText('Low limit'), '5')
    await user.clear(screen.getByLabelText('High limit'))
    await user.type(screen.getByLabelText('High limit'), '1')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(apis.limitsApi.set).not.toHaveBeenCalled()
    expect(within(grid).getByText(/high limit must be/i)).toBeInTheDocument()
  })
})
