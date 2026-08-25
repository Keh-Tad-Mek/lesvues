import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
    baseURL: "", // Empty - uses same origin
	fetchOptions: {
		credentials: 'include',
	},
    plugins: [
        emailOTPClient()
    ]
});
