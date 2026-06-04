import { z } from "zod";

export const mobileLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  device_id: z.string().trim().min(1).optional(),
  app_version: z.string().trim().min(1).optional(),
});

export type MobileLoginInput = z.infer<typeof mobileLoginSchema>;
