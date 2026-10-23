/** Sign-in and sign-up are off unless NEXT_PUBLIC_AUTH_ENABLED=true. */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
