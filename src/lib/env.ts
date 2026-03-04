import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z
    .string()
    .min(1, "NEXTAUTH_SECRET is required")
    .refine(
      (val) => val !== "change-me-in-production",
      "NEXTAUTH_SECRET must be changed from the default value in production"
    ),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
});

function validateEnv() {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    const partial = z.object({
      DATABASE_URL: envSchema.shape.DATABASE_URL,
      NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
      NEXTAUTH_URL: z.string().min(1, "NEXTAUTH_URL is required"),
    });
    const result = partial.safeParse(process.env);
    if (!result.success) {
      console.error(
        "Environment validation failed:",
        result.error.flatten().fieldErrors
      );
      throw new Error(
        "Missing required environment variables. Check .env file."
      );
    }
    return;
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Environment validation failed:",
      result.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment configuration. See errors above.");
  }
}

validateEnv();
