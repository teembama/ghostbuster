// frontend/src/app/page.tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-2xl text-center space-y-8 p-8">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-foreground tracking-tight">
            👻 GhostBuster
          </h1>
          <p className="text-2xl text-muted-foreground font-semibold">
            AI-Powered Payroll Fraud Detection
          </p>
        </div>
        
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Detect ghost workers, prevent fraudulent payments, and secure your payroll system 
          with advanced AI analysis.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link 
            href="/upload"
            className="inline-flex items-center justify-center px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-semibold text-lg"
          >
            Start Analysis →
          </Link>
          
          <Link 
            href="/cases"
            className="inline-flex items-center justify-center px-8 py-3 border border-border rounded-lg hover:bg-accent transition font-semibold text-lg"
          >
            View Cases
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border mt-8">
          <div className="space-y-2">
            <div className="text-3xl">🔍</div>
            <div className="font-semibold">AI Detection</div>
            <div className="text-sm text-muted-foreground">Advanced fraud analysis</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">💰</div>
            <div className="font-semibold">Squad Payments</div>
            <div className="text-sm text-muted-foreground">Secure disbursements</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">📊</div>
            <div className="font-semibold">Analytics</div>
            <div className="text-sm text-muted-foreground">Detailed insights</div>
          </div>
        </div>
      </div>
    </div>
  );
}