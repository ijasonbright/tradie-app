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

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Long Text (Description)' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Single Checkbox' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multi_checkbox', label: 'Multiple Choice' },
  { value: 'checkboxlist', label: 'Checklist' },
  { value: 'file', label: 'File Upload' },
]

export default function FormEditorPage() {
  const params = useParams()
  const router = useRouter()
  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)

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

  const updateQuestion = async (groupId: string, questionId: string, updates: Partial<Question>) => {
    if (!template) return

    try {
      setSaving(true)

      const response = await fetch(`/api/completion-forms/questions/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error('Failed to update question')

      // Update local state
      setTemplate({
        ...template,
        groups: template.groups.map(group =>
          group.id === groupId
            ? {
                ...group,
                questions: group.questions.map(q =>
                  q.id === questionId ? { ...q, ...updates } : q
                ),
              }
            : group
        ),
      })

      setEditingQuestion(null)
    } catch (err: any) {
      console.error('Failed to update question:', err)
      alert('Failed to save changes: ' + err.message)
    } finally {
      setSaving(false)
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
          onClick={() => router.push('/dashboard/form-builder')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ← Back to Form Builder
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/form-builder')}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Edit Form: {template.name}</h1>
          <p className="text-gray-600 mt-1">
            Click on any question to edit its properties
          </p>
        </div>
      </div>

      {/* Groups and Questions */}
      <div className="space-y-6">
        {template.groups.map((group) => (
          <div key={group.id} className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900">
                Section {group.group_order}: {group.group_name}
              </h2>
              {group.group_description && (
                <p className="text-gray-600 mt-1">{group.group_description}</p>
              )}
            </div>

            <div className="p-6 space-y-4">
              {group.questions.map((question) => {
                const isEditing = editingQuestion === question.id
                const needsAnswers = ['radio', 'dropdown', 'multi_checkbox', 'checkboxlist'].includes(question.field_type)

                return (
                  <div
                    key={question.id}
                    className={`border rounded-lg p-4 ${
                      isEditing ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {!isEditing ? (
                      /* View Mode */
                      <div
                        className="cursor-pointer"
                        onClick={() => setEditingQuestion(question.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm text-gray-500">Q{question.question_order}</span>
                              <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                                {FIELD_TYPES.find(ft => ft.value === question.field_type)?.label || question.field_type}
                              </span>
                              {question.is_required && (
                                <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Required</span>
                              )}
                            </div>
                            <p className="font-medium text-gray-900">{question.question_text}</p>
                            {question.help_text && (
                              <p className="text-sm text-gray-600 mt-1">{question.help_text}</p>
                            )}
                          </div>
                          <button className="text-blue-600 hover:text-blue-700 text-sm px-3 py-1 border border-blue-600 rounded">
                            Edit
                          </button>
                        </div>

                        {needsAnswers && question.answer_options && question.answer_options.length > 0 && (
                          <div className="mt-2 text-sm text-gray-600">
                            {question.answer_options.length} answer options
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Edit Mode */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-gray-900">Edit Question {question.question_order}</h3>
                          <button
                            onClick={() => setEditingQuestion(null)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            ✕ Cancel
                          </button>
                        </div>

                        {/* Question Text */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Question Text
                          </label>
                          <textarea
                            defaultValue={question.question_text}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={2}
                            id={`question-text-${question.id}`}
                          />
                        </div>

                        {/* Field Type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Field Type
                          </label>
                          <select
                            defaultValue={question.field_type}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            id={`field-type-${question.id}`}
                          >
                            {FIELD_TYPES.map(ft => (
                              <option key={ft.value} value={ft.value}>
                                {ft.label}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            Use "Long Text (Description)" for descriptive text that doesn't need an answer
                          </p>
                        </div>

                        {/* Required Toggle */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            defaultChecked={question.is_required}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            id={`required-${question.id}`}
                          />
                          <label htmlFor={`required-${question.id}`} className="text-sm font-medium text-gray-700">
                            Required field
                          </label>
                        </div>

                        {/* Help Text */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Help Text (optional)
                          </label>
                          <input
                            type="text"
                            defaultValue={question.help_text || ''}
                            placeholder="Additional guidance for this question"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            id={`help-text-${question.id}`}
                          />
                        </div>

                        {/* Save Button */}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => {
                              const questionText = (document.getElementById(`question-text-${question.id}`) as HTMLTextAreaElement).value
                              const fieldType = (document.getElementById(`field-type-${question.id}`) as HTMLSelectElement).value
                              const isRequired = (document.getElementById(`required-${question.id}`) as HTMLInputElement).checked
                              const helpText = (document.getElementById(`help-text-${question.id}`) as HTMLInputElement).value

                              updateQuestion(group.id, question.id, {
                                question_text: questionText,
                                field_type: fieldType,
                                is_required: isRequired,
                                help_text: helpText || null,
                              })
                            }}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            onClick={() => setEditingQuestion(null)}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
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
