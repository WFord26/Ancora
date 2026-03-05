import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-4">Ancora</h1>
          <p className="text-xl text-muted-foreground">
            Retainer Management Application
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Phase 1 - Foundation
          </p>
        </div>
        
        <div className="mt-8">
          <Link 
            href="/auth/signin"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Sign In
          </Link>
        </div>
        
        <div className="mt-8 text-sm text-muted-foreground">
          <p className="mb-2">Test Accounts:</p>
          <div className="space-y-1">
            <p>Admin: admin@example.com / admin123</p>
            <p>Staff: staff@example.com / staff123</p>
          </div>
        </div>
      </div>
    </main>
  )
}
