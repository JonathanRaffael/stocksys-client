import { useState } from "react"
import { Lock, Mail, Eye, EyeOff, TrendingUp, AlertCircle, CheckCircle2, X, Headphones } from "lucide-react"
import API from "../api/axios"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)

  const isEmailValid = email.includes("@") && email.includes(".")
  const isPasswordValid = password.length >= 6

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    
    if (!email || !password) {
      setError("Please fill in all fields")
      return
    }

    if (!isEmailValid) {
      setError("Please enter a valid email address")
      return
    }

    setLoading(true)
    setError("")
    
    try {
      const res = await API.post("/auth/login", { email, password })
      localStorage.setItem("token", res.data.token)
      localStorage.setItem("user", JSON.stringify(res.data.user))
      // Show success state briefly before redirect
      await new Promise(resolve => setTimeout(resolve, 500))
      window.location.href = "/dashboard"
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid email or password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden p-4 sm:p-6 lg:p-8">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-blue-200/30 rounded-full blur-3xl -top-48 -left-48 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-purple-200/30 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute w-64 h-64 bg-indigo-200/30 rounded-full blur-3xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl sm:rounded-3xl shadow-lg shadow-blue-500/50 mb-4 transform hover:scale-105 transition-transform duration-300">
            <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-2 tracking-tight">
            PT. Hang Tong Manufactory
          </h1>
          <p className="text-xl sm:text-2xl font-semibold text-blue-600 mb-1">StockSys</p>
          <p className="text-gray-600 text-sm font-medium">Internal Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 border border-gray-100 animate-slide-up">
          <div className="mb-6 sm:mb-8 text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Employee Login</h2>
            <p className="text-gray-500 text-xs sm:text-sm">Sign in with your company credentials</p>
          </div>

          {/* Email Input */}
          <div className="mb-4 sm:mb-5">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className={`absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none transition-colors ${emailFocused ? 'text-blue-500' : 'text-gray-400'}`}>
                <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                required
                className="w-full pl-10 sm:pl-12 pr-10 sm:pr-11 py-2.5 sm:py-3.5 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white text-gray-900 placeholder:text-gray-400 font-medium"
              />
              {email && isEmailValid && (
                <div className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-green-500">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              )}
            </div>
          </div>

          {/* Password Input */}
          <div className="mb-5 sm:mb-6">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <div className={`absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none transition-colors ${passwordFocused ? 'text-blue-500' : 'text-gray-400'}`}>
                <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
                className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3.5 text-sm sm:text-base border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white text-gray-900 placeholder:text-gray-400 font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLogin(e as any)
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-gray-400 hover:text-gray-700 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
            {password && !isPasswordValid && (
              <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Password must be at least 6 characters
              </p>
            )}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-5 sm:mb-6">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <span className="ml-2 text-xs sm:text-sm text-gray-700 group-hover:text-gray-900 transition-colors font-medium">
                Remember me
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors hover:underline text-left sm:text-right"
            >
              Forgot password?
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 sm:mb-5 p-3 sm:p-4 bg-red-50 border-l-4 border-red-500 rounded-lg animate-shake">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-xs sm:text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Login Button */}
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 sm:py-4 text-sm sm:text-base rounded-xl shadow-lg shadow-blue-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:shadow-blue-500/50 transform hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Signing in...</span>
              </div>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Sign In
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            )}
          </button>

          {/* Divider */}
          <div className="relative my-5 sm:my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs sm:text-sm">
              <span className="px-3 sm:px-4 bg-white text-gray-500 font-medium">Need Help?</span>
            </div>
          </div>

          {/* IT Support Link */}
          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className="flex items-center justify-center gap-2 w-full text-center py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
          >
            <Headphones className="w-4 h-4 sm:w-5 sm:h-5" />
            Contact IT Support
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 sm:mt-8 space-y-2 sm:space-y-3 px-4">
          <p className="text-gray-700 text-xs sm:text-sm font-medium">
            © 2025 PT. Hang Tong Manufactory. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs text-gray-600">
            <span>Internal Use Only</span>
            <span>•</span>
            <span>Version 1.0</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative animate-slide-up max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <div className="text-center mb-5 sm:mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 rounded-full mb-3 sm:mb-4">
                <Headphones className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Need Help?</h3>
              <p className="text-sm sm:text-base text-gray-600">Contact IT Support for password assistance</p>
            </div>

            <div className="space-y-3 sm:space-y-4 bg-gray-50 rounded-xl p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">Email</p>
                  <a href="mailto:nathans.htm@gmail.com" className="text-sm sm:text-base text-blue-600 hover:text-blue-700 font-medium break-all">
                     nathans.htm@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">WhatsApp</p>
                  <a href="https://wa.me/6289623143027" target="_blank" rel="noopener noreferrer" className="text-sm sm:text-base text-green-600 hover:text-green-700 font-medium">
                    +62 896-2314-3027
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">Phone (Office Hours)</p>
                  <a href="tel:+6289623143027" className="text-sm sm:text-base text-orange-600 hover:text-orange-700 font-medium block">
                    +62 896-2314-3027
                  </a>
                  <p className="text-xs text-gray-500 mt-1">Mon-Fri, 8:00 AM - 5:00 PM</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowForgotModal(false)}
              className="mt-5 sm:mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 sm:py-3 text-sm sm:text-base rounded-xl transition-colors"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out 0.2s both;
        }
        .animate-shake {
          animation: shake 0.4s ease-out;
        }
      `}</style>
    </main>
  )
}