import { create } from "zustand";

export interface CallParticipant {
  displayName: string;
}

interface CallParticipantsState {
  /** Участники по URL комнаты (актуализируются, пока модалка этого звонка открыта). */
  participantsByUrl: Record<string, CallParticipant[]>;
  setParticipants: (meetingUrl: string, participants: CallParticipant[]) => void;
  clearParticipants: (meetingUrl: string) => void;
  getParticipants: (meetingUrl: string) => CallParticipant[];
}

export const useCallParticipantsStore = create<CallParticipantsState>((set, get) => ({
  participantsByUrl: {},
  setParticipants(meetingUrl, participants) {
    set((state) => ({
      participantsByUrl: {
        ...state.participantsByUrl,
        [meetingUrl]: participants,
      },
    }));
  },
  clearParticipants(meetingUrl) {
    set((state) => {
      const next = { ...state.participantsByUrl };
      delete next[meetingUrl];
      return { participantsByUrl: next };
    });
  },
  getParticipants(meetingUrl) {
    return get().participantsByUrl[meetingUrl] ?? [];
  },
}));
