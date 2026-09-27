import { ComingNext } from '@/components/ui/ComingNext';

export default function Page() {
  return (
    <ComingNext
      title={'Lead time'}
      description={'How fares change with how early you book'}
      includes={['Route × booking-window heatmap (missing cells hatched)', 'Fare curve by days before departure', 'Booking-curve weights']}
    />
  );
}
