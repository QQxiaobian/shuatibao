import { scopedStorage } from '@lark-apaas/client-toolkit-lite';

const PARTICIPANT_KEY = 'quiz_bank_participant_name';

export function getParticipantName(): string {
  return (scopedStorage.getItem(PARTICIPANT_KEY) || '').trim();
}

export function setParticipantName(name: string): string {
  const value = name.trim().slice(0, 30);
  scopedStorage.setItem(PARTICIPANT_KEY, value);
  return value;
}
