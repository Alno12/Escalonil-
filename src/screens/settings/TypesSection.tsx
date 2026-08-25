import { useState } from 'react'
import { Card, SectionHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { TextInput } from '@/components/ui/Field'
import { useAppData } from '@/state/appDataContext'
import { useToast } from '@/state/toastContext'
import { saveSettings } from '@/data/repository'

/** Tipos de plantão sugeridos no cadastro (§14). */
export function TypesSection() {
  const { settings } = useAppData()
  const toast = useToast()
  const [draft, setDraft] = useState('')

  async function add() {
    const name = draft.trim()
    if (!name) return
    if (settings.shiftTypes.some((t) => t.toLowerCase() === name.toLowerCase())) {
      toast.error('Esse tipo já existe.')
      return
    }
    await saveSettings({ shiftTypes: [...settings.shiftTypes, name] })
    setDraft('')
    toast.success('Tipo adicionado')
  }

  async function remove(type: string) {
    await saveSettings({ shiftTypes: settings.shiftTypes.filter((t) => t !== type) })
  }

  return (
    <section aria-label="Tipos de plantão">
      <SectionHeader title="Tipos de plantão" hint="Aparecem como sugestão no cadastro" />
      <Card>
        <div className="type-chips">
          {settings.shiftTypes.map((type) => (
            <span key={type} className="type-chip">
              {type}
              <button
                type="button"
                onClick={() => void remove(type)}
                aria-label={`Remover ${type}`}
              >
                <Icon name="close" size={13} />
              </button>
            </span>
          ))}
          {settings.shiftTypes.length === 0 && (
            <p className="settings-empty settings-empty--inline">Nenhum tipo cadastrado.</p>
          )}
        </div>

        <div className="type-add">
          <TextInput
            value={draft}
            placeholder="Novo tipo"
            aria-label="Novo tipo de plantão"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add()
            }}
          />
          <Button variant="secondary" icon="plus" onClick={() => void add()} aria-label="Adicionar tipo" />
        </div>
      </Card>
    </section>
  )
}
