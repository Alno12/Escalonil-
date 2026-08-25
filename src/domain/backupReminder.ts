/**
 * Lembrete de backup.
 *
 * O app não tem servidor: os plantões existem apenas no IndexedDB do aparelho.
 * Limpar os dados do site, trocar de celular ou desinstalar apaga tudo, sem
 * recuperação possível. Este é o único aviso que o usuário recebe — por isso
 * ele existe, mas só aparece quando há algo real a perder.
 */
import type { LocalDate } from '@/db/types'
import { daysBetween, toLocalDate } from './datetime'

/** A partir de quantos dias sem exportar o aviso aparece. */
export const BACKUP_REMINDER_DAYS = 30

export interface BackupStatus {
  /** 'never' = nunca exportou; 'due' = passou do prazo; 'ok' = recente. */
  level: 'never' | 'due' | 'ok'
  /** Dias desde o último backup; null quando nunca houve. */
  days: number | null
  /** Data do último backup no formato local, ou null. */
  date: LocalDate | null
}

export function backupStatus(
  lastBackupAt: string | null,
  today: LocalDate,
): BackupStatus {
  if (!lastBackupAt) return { level: 'never', days: null, date: null }

  const parsed = new Date(lastBackupAt)
  if (Number.isNaN(parsed.getTime())) return { level: 'never', days: null, date: null }

  const date = toLocalDate(parsed)
  const days = Math.max(0, daysBetween(date, today))
  return { level: days >= BACKUP_REMINDER_DAYS ? 'due' : 'ok', days, date }
}

/**
 * O aviso só vale a pena com plantões cadastrados — não faz sentido cobrar
 * backup de um app vazio.
 */
export function shouldRemindBackup(status: BackupStatus, shiftCount: number): boolean {
  return shiftCount > 0 && status.level !== 'ok'
}

/** Texto curto do estado, para Configurações. */
export function describeBackupStatus(status: BackupStatus): string {
  if (status.level === 'never') return 'Você ainda não fez nenhum backup.'
  if (status.days === 0) return 'Último backup: hoje.'
  if (status.days === 1) return 'Último backup: ontem.'
  return `Último backup: há ${status.days} dias.`
}
