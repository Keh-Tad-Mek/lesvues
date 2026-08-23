import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthForm from '../Components/AuthForm'
import authStyles from '../Components/AuthForm.module.css' // Swapped import path
import { authClient } from '../lib/auth-client'

function calculatePasswordStrength(password) {
  const checks = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/, /.{10,}/]

  const verbalStrengthDictionary = {
    0: "Weak", 20: "Weak", 40: "Medium", 60: "Ok", 80: "Good", 100: "Strong"
  }

  let strengthValue = 0

  checks.forEach((check) => {
    if (check.test(password)) strengthValue += 20
  })

  const verbalStrengthValue = verbalStrengthDictionary[strengthValue]
  const hue = strengthValue <= 20 ? 0 : (strengthValue - 20) * 1.5
  return { strengthValue, verbalStrengthValue, hue }
}

function checkEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return { emailIsValid: emailRegex.test(email) }
}

function Signup() {
  const navigate = useNavigate()
  const timerRef = useRef(null)

  const [emailChecker, setEmailChecker] = useState("")
  const [passwordChecker, setPasswordChecker] = useState("")
  const [otpValue, setOtpValue] = useState("")
  const [emailFieldOutline, setEmailFieldOutline] = useState("none")
  const [PasswordStrengthVisibility, setPasswordStrengthVisibility] = useState("none")
  const [displayOTPField, setdisplayOTPField] = useState("none")
  const [EmailBorderColor, setEmailBorderColor] = useState("transparent")
  const [PasswordBorderColor, setPasswordBorderColor] = useState("transparent")
  const [resendTimer, setResendTimer] = useState(30)
  const [canResend, setCanResend] = useState(false)
  const { strengthValue, verbalStrengthValue, hue } = calculatePasswordStrength(passwordChecker)
  const { emailIsValid } = checkEmail(emailChecker)

  useEffect(() => {
    if (displayOTPField === "flex" && resendTimer > 0) {
      const timer = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    } else if (resendTimer === 0) {
      setCanResend(true)
    }
  }, [displayOTPField, resendTimer])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (timerRef.current) clearTimeout(timerRef.current)

    setEmailBorderColor(emailIsValid ? "transparent" : "red")
    setPasswordBorderColor(strengthValue >= 80 ? "transparent" : "red")

    timerRef.current = setTimeout(() => {
      setEmailBorderColor("transparent")
      setPasswordBorderColor("transparent")
      timerRef.current = null
    }, 5000)

    if (emailIsValid && strengthValue >= 80) {
      const fallbackName = emailChecker.split('@')[0]
      const { data, error } = await authClient.signUp.email({
        email: emailChecker,
        password: passwordChecker,
        name: fallbackName,
      })

      if (error) {
        console.error("Signup failed:", error.message)
        alert(error.message || "Failed to start signup process")
      } else {
        setdisplayOTPField("flex")
        setResendTimer(30)
        setCanResend(false)
      }
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    const { data, error } = await authClient.emailOtp.verifyEmail({
      email: emailChecker,
      otp: otpValue
    })

    if (error) {
      console.error("Verification failed:", error.message)
      alert("Invalid Code")
    } else {
      navigate("/", { replace: true })
    }
  }

  const handleResendOtp = async () => {
		if (!canResend) return

		const { data, error } = await authClient.emailOtp.sendVerificationOtp({
				email: emailChecker,
				type: "email-verification", // Same type as initial signup
			})

		if (error) {
			alert("Failed to resend code. Please try again.")
		} else {
			setResendTimer(30) // Restart countdown
			setCanResend(false)
			alert("A new verification code has been sent!")
		}
	}

  return (
    <div className={authStyles.root}>
      <AuthForm
        onSubmit={handleSubmit}
        emailValue={emailChecker}
        onEmailChange={setEmailChecker}
        emailBorderColor={EmailBorderColor}
        emailOutline={emailFieldOutline}
        onEmailFocus={() => setEmailFieldOutline("none")}
        passwordValue={passwordChecker}
        onPasswordChange={setPasswordChecker}
        passwordBorderColor={PasswordBorderColor}
        onPasswordFocus={() => setPasswordStrengthVisibility("flex")}
        onPasswordBlur={() => setPasswordStrengthVisibility("none")}
        showStrengthMeter={true}
        strengthVisibility={PasswordStrengthVisibility}
        hue={hue}
        verbalStrengthValue={verbalStrengthValue}
        strengthValue={strengthValue}
        footerText="Already signed up?"
        footerLinkText="Sign in"
        footerLinkTo="/signin"
        submitButtonText="Signup"
        displayOTPField={displayOTPField}
        otpValue={otpValue}
        onOtpChange={setOtpValue}
        onVerifyOtp={handleVerifyOtp}
        onCloseOtp={() => setdisplayOTPField("none")}
        onResendOtp={handleResendOtp}
        canResend={canResend}
        resendTimer={resendTimer}
      />
    </div>
  )
}

export default Signup