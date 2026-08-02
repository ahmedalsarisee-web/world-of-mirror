import {useEffect, useState} from 'react';
import {
  isAdminLiveMonitoringEnabled,
  subscribeAdminLiveMonitoringEnabled,
} from '@app/utils/adminLiveMonitoringGate';

export function useAdminLiveMonitoringEnabled(): boolean {
  const [enabled, setEnabled] = useState(isAdminLiveMonitoringEnabled);

  useEffect(() => subscribeAdminLiveMonitoringEnabled(() => setEnabled(true)), []);

  return enabled;
}
