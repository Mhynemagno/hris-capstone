type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

function requirePublicEnvironmentValue(name: string): string {
  const value =
    name === "NEXT_PUBLIC_SUPABASE_URL"
      ? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
      : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  return {
    url: requirePublicEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requirePublicEnvironmentValue(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
  };
}
