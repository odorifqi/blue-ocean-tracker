import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, EmptyState } from '../ds'
import { useDocumentTitle } from '../lib/hooks'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="page">
      <div className="card">
        <EmptyState icon={<Compass size={22} />} title="Page not found" description="This address doesn’t exist." action={<Link to="/"><Button>Go to cylinders</Button></Link>} />
      </div>
    </div>
  )
}
