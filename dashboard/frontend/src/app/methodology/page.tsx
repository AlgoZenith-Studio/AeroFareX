import { ComingNext } from '@/components/ui/ComingNext';

export default function Page() {
  return (
    <ComingNext
      title={'Methodology'}
      description={'How AeroFareX turns fares into an index'}
      includes={['Plain-language explanation', 'Formulas: Jevons, chained Laspeyres, booking curve, hedonic, attribution', 'Methodology version and vintage history']}
    />
  );
}
