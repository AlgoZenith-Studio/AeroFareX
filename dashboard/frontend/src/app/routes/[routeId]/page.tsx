import { ComingNext } from '@/components/ui/ComingNext';

const ROUTE_IDS = ['DEL-BOM', 'DEL-BLR', 'BOM-BLR', 'DEL-CCU', 'BLR-HYD'];

/** Static export: one page per route in the basket. */
export function generateStaticParams() {
  return ROUTE_IDS.map((routeId) => ({ routeId }));
}

export default async function Page({ params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = await params;
  return (
    <ComingNext
      title={routeId}
      description="Route detail"
      includes={['Base vs total fare with the hidden-fee gap shaded', 'Fee composition by day', 'Fares by carrier', 'Observation table with the audit drawer (analysts)']}
    />
  );
}
