import { ComingNext } from '@/components/ui/ComingNext';

export default function Page() {
  return (
    <ComingNext
      title={'Attribution'}
      description={'Why the index moved, broken down so every part adds up'}
      includes={['Waterfall by route, carrier, window, fee type or driver', 'Reconciliation check with a warning if the parts don’t add up', 'Contribution table']}
    />
  );
}
