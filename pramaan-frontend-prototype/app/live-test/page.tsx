import { LiveCameraTest } from '@/components/LiveCameraTest'

export const metadata = {
  title: 'PRAMAAN — Live Camera Test',
  description:
    'Standalone real-browser face detection test. No simulated data, no demo lab, no backend.',
}

export default function LiveTestPage() {
  return <LiveCameraTest />
}