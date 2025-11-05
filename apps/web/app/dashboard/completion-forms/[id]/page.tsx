'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Question {
  id: string
  question_text: string
  field_type: string
  is_required: boolean
  question_order: number
  answer_options: Array<{ id: string; text: string; value: string; option_order: number }> | null
  validation_rules: any
  help_text: string | null
}

interface Group {
  id: string
  group_name: string
  group_description: string | null
  group_order: number
  questions: Question[]
}

interface Template {
  id: string
  name: string
  description: string | null
  is_global: boolean
  is_active: boolean
  groups: Group[]
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text Input',
  textarea: 'Long Text',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  date: 'Date',
  datepicker: 'Date Picker',
  checkbox: 'Checkbox',
  radio: 'Radio Buttons',
  dropdown: 'Dropdown',
  multi_checkbox: 'Multiple Choice',
  checkboxlist: 'Checklist',
  file: 'File Upload',
}

export default function TemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (params.id) {
      fetchTemplate(params.id as string)
    }
  }, [params.id])

  const fetchTemplate = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/completion-forms/templates/${id}`)
      if (!response.ok) throw new Error('Failed to fetch template')
      const data = await response.json()
      setTemplate(data)
    } catch (err: any) {
      console.error('Failed to fetch template:', err)
      setError(err.message || 'Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-red-600">{error || 'Template not found'}</p>
        <button
          onClick={() => router.push('/dashboard/completion-forms')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ← Back to Templates
        </button>
      </div>
    )
  }

  // Find questions with missing answer options
  const questionsNeedingAnswers = template.groups.flatMap(group =>
    group.questions.filter(q =>
      ['radio', 'dropdown', 'multi_checkbox', 'checkboxlist'].includes(q.field_type) &&
      (!q.answer_options || q.answer_options.length === 0)
    )
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/completion-forms')}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{template.name}</h1>
            {template.is_global && (
              <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">Global</span>
            )}
            {template.is_active ? (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">Active</span>
            ) : (
              <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">Inactive</span>
            )}
          </div>
          {template.description && (
            <p className="text-gray-600">{template.description}</p>
          )}
        </div>
      </div>

      {/* Warning if questions need answers */}
      {questionsNeedingAnswers.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-500 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> {questionsNeedingAnswers.length} question(s) are missing answer options.
                These questions will not work properly in the mobile app until answer options are added.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Sections</h3>
            <span className="text-2xl">📁</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{template.groups.length}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Questions</h3>
            <span className="text-2xl">❓</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {template.groups.reduce((sum, g) => sum + g.questions.length, 0)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Required Questions</h3>
            <span className="text-2xl">✓</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {template.groups.reduce((sum, g) => sum + g.questions.filter(q => q.is_required).length, 0)}
          </div>
        </div>
      </div>

      {/* Groups and Questions */}
      <div className="space-y-6">
        {template.groups.map((group) => (
          <div key={group.id} className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <span className="text-gray-500 font-normal">Section {group.group_order}:</span>
                    {group.group_name}
                  </h2>
                  {group.group_description && (
                    <p className="text-gray-600 mt-2">{group.group_description}</p>
                  )}
                </div>
                <span className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded">
                  {group.questions.length} questions
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {group.questions.map((question) => {
                const needsAnswers = ['radio', 'dropdown', 'multi_checkbox', 'checkboxlist'].includes(question.field_type) &&
                  (!question.answer_options || question.answer_options.length === 0)

                return (
                  <div
                    key={question.id}
                    className={`border rounded-lg p-4 ${needsAnswers ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm text-gray-500">Q{question.question_order}</span>
                          <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                            {FIELD_TYPE_LABELS[question.field_type] || question.field_type}
                          </span>
                          {question.is_required && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Required</span>
                          )}
                          {needsAnswers && (
                            <span className="px-2 py-1 text-xs bg-red-500 text-white rounded flex items-center gap-1">
                              ⚠️ Missing Answers
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-gray-900">{question.question_text}</p>
                        {question.help_text && (
                          <p className="text-sm text-gray-600 mt-1">{question.help_text}</p>
                        )}
                      </div>
                    </div>

                    {/* Answer Options */}
                    {question.answer_options && question.answer_options.length > 0 && (
                      <div className="mt-3 p-3 bg-gray-100 rounded">
                        <p className="text-sm font-medium mb-2">Answer Options:</p>
                        <ul className="space-y-1">
                          {question.answer_options.map((option, idx) => (
                            <li key={option.id} className="text-sm flex items-center gap-2">
                              <span className="text-gray-500">{idx + 1}.</span>
                              <span>{option.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Warning for missing answer options */}
                    {needsAnswers && (
                      <div className="mt-3 bg-red-100 border border-red-300 rounded p-3">
                        <p className="text-sm text-red-700">
                          <strong>⚠️ Warning:</strong> This {FIELD_TYPE_LABELS[question.field_type] || question.field_type} question requires answer options to function properly.
                          Please add answer options in the database or contact support.
                        </p>
                      </div>
                    )}

                    {/* Validation Rules */}
                    {question.validation_rules && (
                      <div className="mt-2 text-sm text-gray-600">
                        Validation: {JSON.stringify(question.validation_rules)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
