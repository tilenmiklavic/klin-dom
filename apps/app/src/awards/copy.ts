import type { AwardKind } from '@klindom/shared';

/** i18n key for an award's display name. */
export const awardNameKey = (kind: AwardKind) => `awards.kind.${kind}`;
