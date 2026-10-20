import { StrictMode, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastProvider, useToast } from '../../src/context/ToastContext'
import '../../src/index.css'

export function Fixture() {
  const { showToast } = useToast()
  const dialog = useRef(null)
  const nested = useRef(null)
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900 dark:bg-gray-950 dark:text-white">
    <h1>Notification browser checks</h1>
    <button onClick={() => showToast('Evaluation submitted successfully. Your responses have been saved.', 'success', 1600)}>Success</button>{' '}
    <button onClick={() => showToast('Could not save changes. Your draft is kept here. Please try again.', 'error', 1600)}>Error</button>{' '}
    <button onClick={() => showToast('A long message with an unbroken reference: ' + 'sample'.repeat(50), 'warning', 10000)}>Long</button>{' '}
    <button onClick={() => { for (let i = 0; i < 5; i++) showToast(`Queued message ${i}`, 'info', 1400) }}>Queue</button>{' '}
    <button onClick={() => dialog.current.showModal()}>Open dialog</button>{' '}
    <button onClick={() => document.documentElement.classList.toggle('dark')}>Theme</button>{' '}
    <button onClick={() => document.documentElement.requestFullscreen()}>Fullscreen</button>
    <dialog ref={dialog} className="m-auto rounded-xl bg-white p-6 dark:bg-gray-900 dark:text-white">
      <p>Enrollment dialog</p>
      <button onClick={() => showToast('Enrollment completed successfully.', 'success', 1600)}>Enroll</button>{' '}
      <button onClick={() => nested.current.showModal()}>Nested dialog</button>{' '}
      <button onClick={() => dialog.current.close()}>Close dialog</button>
    </dialog>
    <dialog ref={nested} className="m-auto rounded-xl bg-white p-6 dark:bg-gray-900 dark:text-white">
      <p>Review dialog</p><button onClick={() => nested.current.close()}>Close nested</button>
    </dialog>
  </main>
}
createRoot(document.getElementById('root')).render(<StrictMode><ToastProvider><Fixture /></ToastProvider></StrictMode>)
