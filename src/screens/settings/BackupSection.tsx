import { useRef, useState } from 'react'
import { Card, SectionHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAppData } from '@/state/appDataContext'
import { useToast } from '@/state/toastContext'
import { saveSettings } from '@/data/repository'
import { backupStatus, describeBackupStatus } from '@/domain/backupReminder'
import {
  backupFileName,
  buildBackup,
  buildShiftsCsv,
  CSV_BOM,
  csvFileName,
  describeBackup,
  parseBackup,
  restoreBackup,
  saveFile,
  type BackupFile,
} from '@/data/backup'
import { sortByStart } from '@/domain/summary'

/** Backup, restauração e exportação CSV (§32–§35). */
export function BackupSection() {
  const { views, shifts, settings, today } = useAppData()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [busy, setBusy] = useState(false)
  const status = backupStatus(settings.lastBackupAt, today)

  async function exportJson() {
    setBusy(true)
    try {
      const backup = await buildBackup()
      await saveFile(backupFileName(), JSON.stringify(backup, null, 2), 'application/json')
      // Só marca depois que o arquivo foi realmente entregue.
      await saveSettings({ lastBackupAt: new Date().toISOString() })
      toast.success('Backup criado')
    } catch {
      toast.error('Não foi possível gerar o backup.')
    } finally {
      setBusy(false)
    }
  }

  async function exportCsv() {
    setBusy(true)
    try {
      const csv = CSV_BOM + buildShiftsCsv(sortByStart(views, 'desc'))
      await saveFile(csvFileName(), csv, 'text/csv;charset=utf-8')
      toast.success('CSV exportado')
    } catch {
      toast.error('Não foi possível exportar o CSV.')
    } finally {
      setBusy(false)
    }
  }

  async function onFileChosen(file: File) {
    try {
      setPending(parseBackup(await file.text()))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Arquivo inválido.')
    }
  }

  async function confirmImport() {
    if (!pending) return
    setBusy(true)
    try {
      await restoreBackup(pending)
      toast.success('Backup restaurado')
    } catch {
      toast.error('Não foi possível restaurar o backup.')
    } finally {
      setPending(null)
      setBusy(false)
    }
  }

  return (
    <section aria-label="Backup e exportação">
      <SectionHeader title="Backup" hint="Seus dados ficam só neste aparelho" />
      <Card>
        <p className={`settings-note ${status.level !== 'ok' && shifts.length > 0 ? 'settings-note--warning' : ''}`}>
          <Icon name={status.level === 'ok' ? 'check' : 'info'} size={16} />
          <span>
            {shifts.length > 0 ? `${describeBackupStatus(status)} ` : ''}
            Sem servidor não existe recuperação automática: exporte de tempos em tempos e guarde
            o arquivo em um lugar seguro.
          </span>
        </p>

        <div className="settings-actions">
          <Button variant="primary" size="lg" block icon="download" disabled={busy} onClick={() => void exportJson()}>
            Exportar backup
          </Button>
          <Button
            variant="secondary"
            size="lg"
            block
            icon="upload"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            Importar backup
          </Button>
          <Button
            variant="secondary"
            size="lg"
            block
            icon="note"
            disabled={busy || shifts.length === 0}
            onClick={() => void exportCsv()}
          >
            Exportar CSV
          </Button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            // Zera o valor para permitir escolher o mesmo arquivo de novo.
            e.target.value = ''
            if (file) void onFileChosen(file)
          }}
        />
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title="Substituir todos os dados?"
        message={
          pending
            ? `O backup contém ${describeBackup(pending)}. Todos os dados atuais deste aparelho serão apagados e substituídos. Esta ação não poderá ser desfeita.`
            : ''
        }
        confirmLabel="Substituir dados"
        cancelLabel="Cancelar"
        destructive
        onConfirm={() => void confirmImport()}
        onCancel={() => setPending(null)}
      />
    </section>
  )
}
