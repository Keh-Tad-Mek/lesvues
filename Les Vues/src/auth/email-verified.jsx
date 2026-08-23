// EmailVerifiedPage.jsx
import { useSearchParams } from 'react-router-dom';

function EmailVerifiedPage() {
	const [searchParams] = useSearchParams();
	const error = searchParams.get('error');

	if (error) {
		return <h1>❌ Verification failed</h1>;
	}

	// If no error, verification succeeded
	return <h1>✅ Email verified! You are now signed in.</h1>;
}

export default EmailVerifiedPage