import './globals.css'

export const metadata = {
  title: 'ArrivalOps',
  description: 'Ring-powered pickup exception management: rescue the customer who is waiting but never checked in',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
