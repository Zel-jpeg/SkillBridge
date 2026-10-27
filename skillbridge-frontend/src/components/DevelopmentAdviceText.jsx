export default function DevelopmentAdviceText({ item, className = '' }) {
  return <>
    <p className={`break-words ${className}`}>{item.message}</p>
    {item.topics.length > 0 && <p className={`mt-2 break-words [overflow-wrap:anywhere] ${className}`}><strong>Suggested review topics: </strong>{item.topics.join(', ')}.</p>}
  </>
}
