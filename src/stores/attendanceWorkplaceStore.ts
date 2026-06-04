import {create} from 'zustand';
import {DEFAULT_ATTENDANCE_WORKPLACE} from '@app/constants/attendanceLocation';
import type {AttendanceWorkplace} from '@app/types/models';

interface AttendanceWorkplaceState {
  workplace: AttendanceWorkplace | null;
  loaded: boolean;
  setWorkplace: (workplace: AttendanceWorkplace | null) => void;
  setLoaded: (loaded: boolean) => void;
}

export const useAttendanceWorkplaceStore = create<AttendanceWorkplaceState>((set) => ({
  workplace: DEFAULT_ATTENDANCE_WORKPLACE,
  loaded: false,
  setWorkplace: (workplace) => set({workplace: workplace ?? DEFAULT_ATTENDANCE_WORKPLACE}),
  setLoaded: (loaded) => set({loaded}),
}));
