/**
 * Standard Trade Types
 *
 * Predefined trade types with JobTypeIds that organizations can select from.
 * Each organization can customize the rates for these standard types.
 */

export interface StandardTradeType {
  jobTypeId: number
  name: string
  description: string
  defaultHourlyRate: number
  defaultEmployeeCost: number
}

export const STANDARD_TRADE_TYPES: StandardTradeType[] = [
  {
    jobTypeId: 12070,
    name: 'Air Conditioning',
    description: 'Air conditioning installation, repair, and maintenance',
    defaultHourlyRate: 95,
    defaultEmployeeCost: 120,
  },
  {
    jobTypeId: 12022,
    name: 'Antennas',
    description: 'Antenna installation and repair services',
    defaultHourlyRate: 85,
    defaultEmployeeCost: 110,
  },
  {
    jobTypeId: 3300,
    name: 'Appliance Repair',
    description: 'Household appliance repair and maintenance',
    defaultHourlyRate: 95,
    defaultEmployeeCost: 120,
  },
  {
    jobTypeId: 3700,
    name: 'Bricklaying',
    description: 'Bricklaying and masonry services',
    defaultHourlyRate: 70,
    defaultEmployeeCost: 95,
  },
  {
    jobTypeId: 12051,
    name: 'Cabinet Making',
    description: 'Custom cabinet design and installation',
    defaultHourlyRate: 85,
    defaultEmployeeCost: 110,
  },
  {
    jobTypeId: 3900,
    name: 'Carpentry',
    description: 'General carpentry and woodworking services',
    defaultHourlyRate: 85,
    defaultEmployeeCost: 110,
  },
  {
    jobTypeId: 12033,
    name: 'Carpet Cleaning',
    description: 'Professional carpet cleaning services',
    defaultHourlyRate: 50,
    defaultEmployeeCost: 70,
  },
  {
    jobTypeId: 4000,
    name: 'Carpet Laying',
    description: 'Carpet installation and repair',
    defaultHourlyRate: 70,
    defaultEmployeeCost: 95,
  },
  {
    jobTypeId: 4100,
    name: 'Cleaning',
    description: 'General cleaning services',
    defaultHourlyRate: 45,
    defaultEmployeeCost: 65,
  },
  {
    jobTypeId: 4700,
    name: 'Electrical',
    description: 'Licensed electrical services',
    defaultHourlyRate: 85,
    defaultEmployeeCost: 110,
  },
  {
    jobTypeId: 4800,
    name: 'Fencing',
    description: 'Fence installation and repair',
    defaultHourlyRate: 75,
    defaultEmployeeCost: 90,
  },
  {
    jobTypeId: 12064,
    name: 'Glazing',
    description: 'Window and glass installation services',
    defaultHourlyRate: 95,
    defaultEmployeeCost: 120,
  },
  {
    jobTypeId: 6500,
    name: 'Handyman',
    description: 'General handyman and maintenance services',
    defaultHourlyRate: 60,
    defaultEmployeeCost: 85,
  },
  {
    jobTypeId: 6000,
    name: 'Landscaping',
    description: 'Landscape design and maintenance',
    defaultHourlyRate: 60,
    defaultEmployeeCost: 75,
  },
  {
    jobTypeId: 6100,
    name: 'Lawn Mowing',
    description: 'Lawn mowing and garden maintenance',
    defaultHourlyRate: 45,
    defaultEmployeeCost: 55,
  },
  {
    jobTypeId: 7200,
    name: 'Locksmithing',
    description: 'Lock installation and security services',
    defaultHourlyRate: 95,
    defaultEmployeeCost: 120,
  },
  {
    jobTypeId: 7500,
    name: 'Painting',
    description: 'Interior and exterior painting services',
    defaultHourlyRate: 55,
    defaultEmployeeCost: 70,
  },
  {
    jobTypeId: 10600,
    name: 'Pest Control',
    description: 'Pest inspection and treatment services',
    defaultHourlyRate: 85,
    defaultEmployeeCost: 110,
  },
  {
    jobTypeId: 7900,
    name: 'Plastering',
    description: 'Plastering and rendering services',
    defaultHourlyRate: 55,
    defaultEmployeeCost: 70,
  },
  {
    jobTypeId: 2600,
    name: 'Plumbing',
    description: 'Licensed plumbing services',
    defaultHourlyRate: 85,
    defaultEmployeeCost: 110,
  },
  {
    jobTypeId: 8300,
    name: 'Roofing',
    description: 'Roof installation, repair, and maintenance',
    defaultHourlyRate: 85,
    defaultEmployeeCost: 110,
  },
  {
    jobTypeId: 9400,
    name: 'Tiling',
    description: 'Floor and wall tiling services',
    defaultHourlyRate: 60,
    defaultEmployeeCost: 85,
  },
]

// Helper function to get a trade type by JobTypeId
export function getStandardTradeType(jobTypeId: number): StandardTradeType | undefined {
  return STANDARD_TRADE_TYPES.find(t => t.jobTypeId === jobTypeId)
}

// Helper function to get trade type name by JobTypeId
export function getTradeTypeName(jobTypeId: number): string {
  return STANDARD_TRADE_TYPES.find(t => t.jobTypeId === jobTypeId)?.name || 'Unknown Trade'
}
