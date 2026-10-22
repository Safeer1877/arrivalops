import './globals.css'

export const metadata = {
  title: 'ArrivalOps',
  description: 'See the customer who never checked in: Ring-powered curbside rescue for small businesses',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
