import { Scenario } from '@/types/pramaan'

export const scenarios: Record<Scenario, { name: string }> = {
  normal: { name: 'Normal' },
  proxy: { name: 'Proxy' },
  'low-bandwidth': { name: 'Low Bandwidth' },
}
