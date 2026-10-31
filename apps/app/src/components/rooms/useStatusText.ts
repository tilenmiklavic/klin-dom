import { useTranslation } from 'react-i18next';
import type { RoomStatus } from '../../rooms/status';

/** The status line of a room ("1 overdue", "Next: Sun", "All fresh"). */
export function useStatusText() {
  const { t } = useTranslation();
  return (s: RoomStatus) =>
    s.kind === 'overdue'
      ? t('roomsTab.overdue', { count: s.count })
      : s.kind === 'dueToday'
        ? t('roomsTab.dueToday', { count: s.count })
        : s.kind === 'next'
          ? t('roomsTab.next', { day: s.day })
          : t('roomsTab.fresh');
}
