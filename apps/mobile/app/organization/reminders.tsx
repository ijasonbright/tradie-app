import { View, Text, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { apiClient } from '../../lib/api-client'
import { Button, Divider, List } from 'react-native-paper'

export default function RemindersSettingsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Invoice Reminders
  const [invoiceRemindersEnabled, setInvoiceRemindersEnabled] = useState(true)
  const [reminderDaysBeforeDue, setReminderDaysBeforeDue] = useState([7, 3, 1])
  const [reminderDaysAfterDue, setReminderDaysAfterDue] = useState([1, 7, 14])
  const [invoiceReminderMethod, setInvoiceReminderMethod] = useState<'email' | 'sms' | 'both'>('email')
  const [enableSmsEscalation, setEnableSmsEscalation] = useState(true)
  const [smsEscalationDaysOverdue, setSmsEscalationDaysOverdue] = useState(14)

  // Monthly Statements
  const [monthlyStatementsEnabled, setMonthlyStatementsEnabled] = useState(true)
  const [statementDayOfMonth, setStatementDayOfMonth] = useState(1)
  const [statementMethod, setStatementMethod] = useState<'email' | 'sms' | 'both'>('email')
  const [includeOnlyOutstanding, setIncludeOnlyOutstanding] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const settings = await apiClient.getReminderSettings()

      setInvoiceRemindersEnabled(settings.invoice_reminders_enabled)
      setReminderDaysBeforeDue(settings.reminder_days_before_due?.split(',').map((d: string) => parseInt(d.trim())) || [7, 3, 1])
      setReminderDaysAfterDue(settings.reminder_days_after_due?.split(',').map((d: string) => parseInt(d.trim())) || [1, 7, 14])
      setInvoiceReminderMethod(settings.invoice_reminder_method || 'email')
      setEnableSmsEscalation(settings.enable_sms_escalation ?? true)
      setSmsEscalationDaysOverdue(settings.sms_escalation_days_overdue || 14)

      setMonthlyStatementsEnabled(settings.monthly_statements_enabled ?? true)
      setStatementDayOfMonth(settings.statement_day_of_month || 1)
      setStatementMethod(settings.statement_method || 'email')
      setIncludeOnlyOutstanding(settings.include_only_outstanding ?? true)
    } catch (err: any) {
      console.error('Failed to fetch reminder settings:', err)
      Alert.alert('Error', 'Failed to load reminder settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      await apiClient.updateReminderSettings({
        invoiceRemindersEnabled,
        reminderDaysBeforeDue: reminderDaysBeforeDue.join(','),
        reminderDaysAfterDue: reminderDaysAfterDue.join(','),
        invoiceReminderMethod,
        enableSmsEscalation,
        smsEscalationDaysOverdue,
        monthlyStatementsEnabled,
        statementDayOfMonth,
        statementMethod,
        includeOnlyOutstanding,
      })

      Alert.alert('Success', 'Reminder settings updated successfully')
      router.back()
    } catch (err: any) {
      console.error('Failed to update settings:', err)
      Alert.alert('Error', err.message || 'Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleDayBefore = (day: number) => {
    setReminderDaysBeforeDue(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => b - a)
    )
  }

  const toggleDayAfter = (day: number) => {
    setReminderDaysAfterDue(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reminders & Statements</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Invoice Reminders Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="bell-alert" size={24} color="#2563eb" />
          <Text style={styles.sectionTitle}>Invoice Reminders</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Automatic Reminders</Text>
            <Text style={styles.settingDescription}>Send reminders for unpaid invoices</Text>
          </View>
          <Switch
            value={invoiceRemindersEnabled}
            onValueChange={setInvoiceRemindersEnabled}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={invoiceRemindersEnabled ? '#2563eb' : '#f3f4f6'}
          />
        </View>

        {invoiceRemindersEnabled && (
          <>
            <Divider style={styles.divider} />

            {/* Days Before Due */}
            <Text style={styles.subsectionTitle}>Send reminders before due date:</Text>
            <View style={styles.checkboxGroup}>
              {[14, 7, 3, 1].map(day => (
                <TouchableOpacity
                  key={`before-${day}`}
                  style={styles.checkbox}
                  onPress={() => toggleDayBefore(day)}
                >
                  <MaterialCommunityIcons
                    name={reminderDaysBeforeDue.includes(day) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={24}
                    color={reminderDaysBeforeDue.includes(day) ? '#2563eb' : '#9ca3af'}
                  />
                  <Text style={styles.checkboxLabel}>{day} day{day === 1 ? '' : 's'} before</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Divider style={styles.divider} />

            {/* Days After Due (Overdue) */}
            <Text style={styles.subsectionTitle}>Send reminders after due date:</Text>
            <View style={styles.checkboxGroup}>
              {[1, 7, 14, 30].map(day => (
                <TouchableOpacity
                  key={`after-${day}`}
                  style={styles.checkbox}
                  onPress={() => toggleDayAfter(day)}
                >
                  <MaterialCommunityIcons
                    name={reminderDaysAfterDue.includes(day) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={24}
                    color={reminderDaysAfterDue.includes(day) ? '#2563eb' : '#9ca3af'}
                  />
                  <Text style={styles.checkboxLabel}>{day} day{day === 1 ? '' : 's'} overdue</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Divider style={styles.divider} />

            {/* SMS Escalation */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>SMS Escalation</Text>
                <Text style={styles.settingDescription}>
                  Switch from email to SMS after {smsEscalationDaysOverdue} days overdue
                </Text>
              </View>
              <Switch
                value={enableSmsEscalation}
                onValueChange={setEnableSmsEscalation}
                trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                thumbColor={enableSmsEscalation ? '#2563eb' : '#f3f4f6'}
              />
            </View>

            <View style={styles.infoBox}>
              <MaterialCommunityIcons name="information" size={20} color="#2563eb" />
              <Text style={styles.infoText}>
                Reminders start with email. After {smsEscalationDaysOverdue} days overdue, they automatically switch to SMS to ensure urgent attention.
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Monthly Statements Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="file-document-multiple" size={24} color="#2563eb" />
          <Text style={styles.sectionTitle}>Monthly Statements</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Monthly Statements</Text>
            <Text style={styles.settingDescription}>Send statements to clients with outstanding invoices</Text>
          </View>
          <Switch
            value={monthlyStatementsEnabled}
            onValueChange={setMonthlyStatementsEnabled}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={monthlyStatementsEnabled ? '#2563eb' : '#f3f4f6'}
          />
        </View>

        {monthlyStatementsEnabled && (
          <>
            <Divider style={styles.divider} />

            <Text style={styles.subsectionTitle}>Send on day of month:</Text>
            <View style={styles.dayPickerContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPicker}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      statementDayOfMonth === day && styles.dayButtonSelected,
                    ]}
                    onPress={() => setStatementDayOfMonth(day)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        statementDayOfMonth === day && styles.dayButtonTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Only Clients with Outstanding Balance</Text>
                <Text style={styles.settingDescription}>
                  {includeOnlyOutstanding ? 'Only send to clients who owe money' : 'Send to all clients with invoices'}
                </Text>
              </View>
              <Switch
                value={includeOnlyOutstanding}
                onValueChange={setIncludeOnlyOutstanding}
                trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                thumbColor={includeOnlyOutstanding ? '#2563eb' : '#f3f4f6'}
              />
            </View>

            <View style={styles.infoBox}>
              <MaterialCommunityIcons name="information" size={20} color="#2563eb" />
              <Text style={styles.infoText}>
                Statements are sent via email with a PDF attachment showing all invoices and an aging report.
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
          labelStyle={styles.saveButtonLabel}
        >
          Save Settings
        </Button>

        <Button
          mode="outlined"
          onPress={() => router.push('/organization/reminder-history')}
          style={styles.historyButton}
          icon="history"
        >
          View Reminder History
        </Button>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  divider: {
    marginVertical: 16,
    backgroundColor: '#e5e7eb',
  },
  checkboxGroup: {
    gap: 12,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
  },
  dayPickerContainer: {
    marginVertical: 8,
  },
  dayPicker: {
    flexDirection: 'row',
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  dayButtonSelected: {
    backgroundColor: '#2563eb',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  dayButtonTextSelected: {
    color: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    marginLeft: 8,
    lineHeight: 18,
  },
  actions: {
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  saveButtonLabel: {
    paddingVertical: 6,
    fontSize: 16,
  },
  historyButton: {
    borderColor: '#2563eb',
    borderRadius: 8,
  },
})
