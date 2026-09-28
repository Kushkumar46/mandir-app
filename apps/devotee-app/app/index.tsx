import { MandirFlag } from '@mandir/shared-types';
import { Redirect } from 'expo-router';

import { useFlag } from '@/features/config/flags';

export default function Index() {
  const mandirEnabled = useFlag(MandirFlag.ENABLED);
  return <Redirect href={mandirEnabled ? '/mandir' : '/profile'} />;
}
