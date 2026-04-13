import { z } from "zod";

const MonthDay = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

const BirthdayEntry = z.object({
	name: z.string().min(1),
	date: MonthDay,
});

export const BirthdayConfig = z.object({
	birthdays: z.array(BirthdayEntry).min(1),
});

export type BirthdayConfig = z.infer<typeof BirthdayConfig>;
