import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface OnboardingDraft {
  name: string;
  setName(name: string): void;
  timezone: string;
  /** Chosen room keys with how many of each (1..5). */
  rooms: Record<string, number>;
  setRooms(rooms: Record<string, number>): void;
  /** Task keys the user unticked on the review screen. */
  excluded: string[];
  setExcluded(keys: string[]): void;
}

const DraftContext = createContext<OnboardingDraft | null>(null);

/** Holds the create-a-home answers across the create, rooms and review screens. */
export function OnboardingDraftProvider({ defaultName, children }: { defaultName: string; children: ReactNode }) {
  const [name, setName] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Record<string, number>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const value = useMemo<OnboardingDraft>(
    () => ({
      name: name ?? defaultName,
      setName,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      rooms,
      setRooms,
      excluded,
      setExcluded,
    }),
    [name, defaultName, rooms, excluded],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useOnboardingDraft(): OnboardingDraft {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useOnboardingDraft must be used inside the onboarding layout');
  return ctx;
}
