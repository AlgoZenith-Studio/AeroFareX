import { ComingNext } from '@/components/ui/ComingNext';

export default function Page() {
  return (
    <ComingNext
      title={'Routes'}
      description={'The five DGCA trunk routes, advertised against total fare'}
      includes={['Route table with passenger weights, fares, hidden extra and sparklines', 'Links to each route’s detail page']}
    />
  );
}
