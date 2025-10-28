'use client'

import Link from 'next/link'

export default function ReportsPage() {
  const reports = [
    {
      title: 'Revenue Report',
      description: 'View revenue by period, client, and job type. Track paid vs outstanding invoices.',
      icon: '💰',
      href: '/dashboard/reports/revenue',
      color: 'bg-green-50 border-green-200',
    },
    {
      title: 'Time Tracking Report',
      description: 'Analyze hours logged, labor costs, and billing amounts by team member and job.',
      icon: '⏱️',
      href: '/dashboard/reports/time-tracking',
      color: 'bg-blue-50 border-blue-200',
    },
    {
      title: 'Team Performance',
      description: 'Track jobs completed, revenue generated, and performance metrics per team member.',
      icon: '👥',
      href: '/dashboard/reports/team-performance',
      color: 'bg-purple-50 border-purple-200',
    },
    {
      title: 'Expense Report',
      description: 'View expenses by category, team member, and job. Track reimbursements.',
      icon: '💳',
      href: '/dashboard/reports/expenses',
      color: 'bg-orange-50 border-orange-200',
    },
  ]

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="mt-2 text-gray-600">
          View detailed insights into your business performance, team productivity, and financials.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {reports.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className={`block rounded-lg border-2 p-6 transition-all hover:shadow-lg ${report.color}`}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">{report.icon}</div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{report.title}</h2>
                <p className="mt-2 text-sm text-gray-600">{report.description}</p>
                <div className="mt-4 text-sm font-medium text-blue-600">
                  View Report →
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-lg bg-blue-50 p-6">
        <h3 className="font-semibold text-blue-900">💡 Quick Tips</h3>
        <ul className="mt-3 space-y-2 text-sm text-blue-800">
          <li>• Use date filters to analyze specific time periods</li>
          <li>• Export reports to CSV for further analysis in spreadsheets</li>
          <li>• Compare performance across different team members and jobs</li>
          <li>• Track profit margins by analyzing labor costs vs billing amounts</li>
        </ul>
      </div>
    </div>
  )
}
