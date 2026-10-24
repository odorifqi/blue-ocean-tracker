import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, EmptyState } from '../ds'
import { useDocumentTitle } from '../lib/hooks'

/**
 * Shown in place of a page that threw while rendering, instead of React Router's
 * stack-trace screen. Moving to another page clears it.
 */
export function RouteError() {
  useDocumentTitle('Something went wrong')
  return (
    <div className="page">
      <div className="card">
        <EmptyState
          icon={<TriangleAlert size={22} />}
          title="This page couldn’t be shown"
          description="Something went wrong while showing it. Reload to try again, or go back to the cylinder list."
          action={
            <>
              <Button variant="primary" icon={<RotateCcw size={16} />} onClick={() => window.location.reload()}>Reload</Button>
              <Link to="/"><Button>Go to cylinders</Button></Link>
            </>
          }
        />
      </div>
    </div>
  )
}
