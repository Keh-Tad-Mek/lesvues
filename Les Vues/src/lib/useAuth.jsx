import { authClient } from "./auth-client";

export const useAuth = () => {
    const { data: session, isPending, error } = authClient.useSession()

    return {
		isAuthenticated: !!session,
		session,
		isPending,
		error,
		user: session?.user
    }
}