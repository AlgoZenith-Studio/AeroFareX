import { ComingNext } from '@/components/ui/ComingNext';

export default function Page() {
  return (
    <ComingNext
      title={'Source health'}
      description={'Is the collector working right now?'}
      includes={['Live circuit state per source', 'Run log for each collection slot', 'Recent failures']}
    />
  );
}
