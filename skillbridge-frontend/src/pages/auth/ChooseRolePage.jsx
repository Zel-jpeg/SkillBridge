import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function ChooseRolePage() {
  const navigate = useNavigate()
  const [role, setRole] = useState('student')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')
    setMessage('')
    const token = sessionStorage.getItem('sb_google_token')
    if (!token) {
      setError('Google session expired. Please sign in again.')
      return
    }
    setLoading(true)
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/auth/register-role/`,
        { token, role }
      )
      if (res.data?.ok) {
        if (role === 'instructor') {
          setMessage('Instructor request submitted. Please wait for admin approval.')
        } else {
          setMessage('Student account submitted. Please wait until an instructor enrolls you.')
        }
        sessionStorage.removeItem('sb_google_token')
      }
    } catch (err) {
      const code = err.response?.data?.error
      if (code === 'not_dnsc') setError('Only @dnsc.edu.ph accounts are allowed.')
      else setError('Unable to submit role right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Choose your account role</h1>
        <p className="text-sm text-gray-500">
          Your DNSC email is valid. Tell us if you are a student or instructor.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setRole('student')}
            className={`px-3 py-2 rounded-xl text-sm font-medium border ${role === 'student' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600'}`}
          >
            Student
          </button>
          <button
            onClick={() => setRole('instructor')}
            className={`px-3 py-2 rounded-xl text-sm font-medium border ${role === 'instructor' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600'}`}
          >
            Instructor
          </button>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {message && <p className="text-xs text-green-700">{message}</p>}

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => navigate('/login')}
            className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium"
          >
            Back to login
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-60"
          >
            {loading ? 'Submitting...' : 'Submit role'}
          </button>
        </div>
      </div>
    </div>
  )
}
