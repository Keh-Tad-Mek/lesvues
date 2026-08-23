import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_API_URL,
    fetchOptions: {
        credentials: "include",
    },
    plugins: [
        emailOTPClient()
    ]
});