import './authBackground.css'

export default function AuthBackground({ children }) {
  return <main className="sb-auth-page">
    <picture className="sb-auth-background" aria-hidden="true">
      <source media="(max-width: 767px)" srcSet="/images/dnsc-campus-small.webp" type="image/webp" />
      <img src="/images/dnsc-campus.webp" width="1920" height="1230" alt="" decoding="async" fetchPriority="low" />
    </picture>
    <div className="sb-auth-overlay" aria-hidden="true" />
    <div className="sb-auth-content">{children}</div>
  </main>
}
