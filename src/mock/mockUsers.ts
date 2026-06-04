import type {AppUser, EmployeeLastLocation} from '@app/types/models';
import {PRIMARY_ADMIN_EMAIL} from '@app/config/adminAccess';
import {ATTENDANCE_WORKPLACE} from '@app/constants/attendanceLocation';
import {getDefaultAdminPermissions} from '@app/utils/adminPermissions';
import {getDefaultEmployeePermissions} from '@app/utils/employeePermissions';

function seedEmployeeLocation(offsetLat: number, offsetLng: number): EmployeeLastLocation {
  return {
    latitude: ATTENDANCE_WORKPLACE.latitude + offsetLat,
    longitude: ATTENDANCE_WORKPLACE.longitude + offsetLng,
    updatedAt: new Date().toISOString(),
    accuracy: 20,
  };
}

export const MOCK_ADMIN_ID = 'mock-admin';
export const MOCK_SECONDARY_ADMIN_ID = 'mock-admin-2';
export const MOCK_EMPLOYEE_IDS = {
  abdullah: 'mock-abdullah',
  ahmed: 'mock-ahmed',
  owais: 'mock-owais',
  osama: 'mock-osama',
  sami: 'mock-sami',
} as const;

export const MOCK_LOGIN_OPTIONS: {id: string; label: string; role: AppUser['role']}[] = [
  {id: MOCK_ADMIN_ID, label: 'Primary Admin', role: 'admin'},
  {id: MOCK_SECONDARY_ADMIN_ID, label: 'Secondary Admin', role: 'admin'},
  {id: MOCK_EMPLOYEE_IDS.abdullah, label: 'Abdullah (Employee)', role: 'employee'},
  {id: MOCK_EMPLOYEE_IDS.ahmed, label: 'Ahmed (Employee)', role: 'employee'},
  {id: MOCK_EMPLOYEE_IDS.owais, label: 'Owais (Employee)', role: 'employee'},
  {id: MOCK_EMPLOYEE_IDS.osama, label: 'Osama (Employee)', role: 'employee'},
  {id: MOCK_EMPLOYEE_IDS.sami, label: 'Sami (Employee)', role: 'employee'},
];

export function createSeedUsers(): AppUser[] {
  const now = new Date().toISOString();
  const employeeDefaults = getDefaultEmployeePermissions();
  return [
    {
      id: MOCK_ADMIN_ID,
      name: 'Primary Admin',
      role: 'admin',
      balance: 1250,
      createdAt: now,
      email: PRIMARY_ADMIN_EMAIL,
      isPrimaryAdmin: true,
    },
    {
      id: MOCK_SECONDARY_ADMIN_ID,
      name: 'Secondary Admin',
      role: 'admin',
      balance: 500,
      createdAt: now,
      email: 'other.admin@example.com',
      adminPermissions: getDefaultAdminPermissions(),
    },
    {id: MOCK_EMPLOYEE_IDS.abdullah, name: 'Abdullah', role: 'employee', balance: 840, createdAt: now, permissions: {...employeeDefaults}, lastLocation: seedEmployeeLocation(0.0012, -0.0008)},
    {id: MOCK_EMPLOYEE_IDS.ahmed, name: 'Ahmed', role: 'employee', balance: 620, createdAt: now, permissions: {...employeeDefaults, finance: false}, lastLocation: seedEmployeeLocation(-0.0006, 0.0011)},
    {id: MOCK_EMPLOYEE_IDS.owais, name: 'Owais', role: 'employee', balance: 410, createdAt: now, permissions: {...employeeDefaults}},
    {id: MOCK_EMPLOYEE_IDS.osama, name: 'Osama', role: 'employee', balance: 295, createdAt: now, permissions: {...employeeDefaults}},
    {id: MOCK_EMPLOYEE_IDS.sami, name: 'Sami', role: 'employee', balance: 180, createdAt: now, permissions: {...employeeDefaults}},
  ];
}
