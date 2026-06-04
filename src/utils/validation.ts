import {z} from 'zod';
import dayjs from 'dayjs';

const numericField = (message: string) =>
  z.union([z.string(), z.number()]).transform((v) => {
    const n = typeof v === 'string' ? Number(v) : v;
    return n;
  }).pipe(z.number({message}));

export const transactionSchema = z.object({
  amount: numericField('Amount must be greater than 0').pipe(z.number().positive('Amount must be greater than 0')),
  note: z.string().optional(),
});

export type TransactionFormValues = z.input<typeof transactionSchema>;
export type TransactionSchemaType = z.output<typeof transactionSchema>;

export const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'employee']),
});

export type UserFormValues = z.input<typeof userSchema>;
export type UserSchemaType = z.output<typeof userSchema>;

const attendanceDateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'attendanceRecordInvalidDate');

const attendanceTimeField = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, 'attendanceRecordInvalidTime');

export const attendanceRecordSchema = z.object({
  type: z.enum(['check_in', 'check_out']),
  date: attendanceDateField,
  time: attendanceTimeField,
  note: z.string().optional(),
});

export const attendanceHoursResetRecordSchema = z.object({
  date: attendanceDateField,
  time: attendanceTimeField,
  resetHours: numericField('attendanceRecordInvalidHours').pipe(
    z.number().min(0, 'attendanceRecordInvalidHours'),
  ),
  note: z.string().optional(),
});

export type AttendanceRecordFormValues = z.input<typeof attendanceRecordSchema>;
export type AttendanceHoursResetRecordFormValues = z.input<typeof attendanceHoursResetRecordSchema>;

export const attendanceDayEditSchema = z
  .object({
    date: attendanceDateField,
    checkInTime: attendanceTimeField,
    checkOutTime: z.string().trim(),
    note: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.checkOutTime) {
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(data.checkOutTime)) {
      ctx.addIssue({
        code: 'custom',
        message: 'attendanceRecordInvalidTime',
        path: ['checkOutTime'],
      });
      return;
    }
    const checkIn = dayjs(`${data.date}T${data.checkInTime}:00`);
    const checkOut = dayjs(`${data.date}T${data.checkOutTime}:00`);
    if (!checkOut.isAfter(checkIn)) {
      ctx.addIssue({
        code: 'custom',
        message: 'attendanceCheckOutBeforeCheckIn',
        path: ['checkOutTime'],
      });
    }
  });

export type AttendanceDayEditFormValues = z.input<typeof attendanceDayEditSchema>;
