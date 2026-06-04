import { notFound } from "next/navigation";

export default function EnvTest() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <pre style={{ padding: 16 }}>
      {JSON.stringify(
        {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        },
        null,
        2
      )}
    </pre>
  );
}
