import { describe, expect, it } from 'vitest'
import {
  BACKUP_REMINDER_DAYS,
  backupStatus,
  describeBackupStatus,
  shouldRemindBackup,
} from '../backupReminder'

const TODAY = '2026-08-25'
// Meio-dia local evita que o fuso jogue a data para o dia anterior/seguinte.
const at = (date: string) => new Date(`${date}T12:00:00`).toISOString()

describe('backupStatus', () => {
  it('marca como "nunca" quando não há registro', () => {
    expect(backupStatus(null, TODAY)).toEqual({ level: 'never', days: null, date: null })
  })

  it('marca como "nunca" quando a data é inválida', () => {
    expect(backupStatus('não é data', TODAY).level).toBe('never')
  })

  it('considera recente um backup dentro do prazo', () => {
    const status = backupStatus(at('2026-08-20'), TODAY)
    expect(status.level).toBe('ok')
    expect(status.days).toBe(5)
  })

  it('considera vencido no dia em que completa o prazo', () => {
    const status = backupStatus(at('2026-07-26'), TODAY)
    expect(status.days).toBe(BACKUP_REMINDER_DAYS)
    expect(status.level).toBe('due')
  })

  it('ainda está ok um dia antes de vencer', () => {
    expect(backupStatus(at('2026-07-27'), TODAY).level).toBe('ok')
  })

  it('nunca devolve dias negativos', () => {
    expect(backupStatus(at('2026-09-10'), TODAY).days).toBe(0)
  })
})

describe('shouldRemindBackup', () => {
  it('não cobra backup de um app vazio', () => {
    expect(shouldRemindBackup(backupStatus(null, TODAY), 0)).toBe(false)
  })

  it('cobra quando há plantões e nunca houve backup', () => {
    expect(shouldRemindBackup(backupStatus(null, TODAY), 3)).toBe(true)
  })

  it('não cobra quando o backup está em dia', () => {
    expect(shouldRemindBackup(backupStatus(at('2026-08-24'), TODAY), 10)).toBe(false)
  })

  it('cobra quando passou do prazo', () => {
    expect(shouldRemindBackup(backupStatus(at('2026-06-01'), TODAY), 10)).toBe(true)
  })
})

describe('describeBackupStatus', () => {
  it('usa linguagem natural para os casos próximos', () => {
    expect(describeBackupStatus(backupStatus(null, TODAY))).toMatch(/ainda não fez/i)
    expect(describeBackupStatus(backupStatus(at(TODAY), TODAY))).toMatch(/hoje/i)
    expect(describeBackupStatus(backupStatus(at('2026-08-24'), TODAY))).toMatch(/ontem/i)
    expect(describeBackupStatus(backupStatus(at('2026-08-15'), TODAY))).toMatch(/há 10 dias/i)
  })
})
