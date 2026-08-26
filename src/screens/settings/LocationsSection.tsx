import { useMemo, useState } from 'react'
import { Card, SectionHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAppData } from '@/state/appDataContext'
import { useToast } from '@/state/toastContext'
import { deleteLocation, renameLocation, setLocationColor } from '@/data/repository'
import { ColorPicker } from '@/components/ui/ColorPicker'
import type { LocationColor } from '@/db/types'

/** Gestão dos locais cadastrados (§52). */
export function LocationsSection() {
  const { locations, views } = useAppData()
  const toast = useToast()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [colorFor, setColorFor] = useState<string | null>(null)

  const usage = useMemo(() => {
    const map = new Map<string, number>()
    for (const view of views) {
      map.set(view.shift.locationId, (map.get(view.shift.locationId) ?? 0) + 1)
    }
    return map
  }, [views])

  async function commitRename(id: string) {
    try {
      await renameLocation(id, draft)
      toast.success('Local atualizado')
      setEditingId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível renomear.')
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await deleteLocation(pendingDelete)
      toast.success('Local excluído')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir.')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <section aria-label="Locais cadastrados">
      <SectionHeader
        title="Locais"
        hint={`${locations.length} ${locations.length === 1 ? 'local' : 'locais'} · toque na cor para trocar`}
      />
      <Card padded={false}>
        {locations.length === 0 ? (
          <p className="settings-empty">
            Os locais são criados automaticamente ao cadastrar um plantão.
          </p>
        ) : (
          <ul className="settings-list">
            {locations.map((location) => {
              const count = usage.get(location.id) ?? 0
              const editing = editingId === location.id
              return (
                <li key={location.id} className="settings-row">
                  {editing ? (
                    <>
                      <TextInput
                        value={draft}
                        autoFocus
                        aria-label="Nome do local"
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitRename(location.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                      <div className="settings-row__actions">
                        <Button variant="ghost" size="sm" onClick={() => void commitRename(location.id)}>
                          Salvar
                        </Button>
                        <Button variant="quiet" size="sm" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="settings-row__color"
                        aria-label={`Trocar a cor de ${location.name}`}
                        onClick={() => setColorFor(colorFor === location.id ? null : location.id)}
                      >
                        <span
                          className="loc-dot loc-dot--lg"
                          style={{ background: `var(--loc-${location.color})` }}
                        />
                      </button>
                      <span className="settings-row__body">
                        <span className="settings-row__title">{location.name}</span>
                        <span className="settings-row__hint">
                          {count} {count === 1 ? 'plantão' : 'plantões'}
                        </span>
                      </span>
                      <div className="settings-row__actions">
                        <Button
                          variant="quiet"
                          size="sm"
                          icon="edit"
                          aria-label={`Renomear ${location.name}`}
                          onClick={() => {
                            setDraft(location.name)
                            setEditingId(location.id)
                          }}
                        />
                        <Button
                          variant="quiet"
                          size="sm"
                          icon="trash"
                          aria-label={`Excluir ${location.name}`}
                          disabled={count > 0}
                          onClick={() => setPendingDelete(location.id)}
                        />
                      </div>
                    </>
                  )}
                  {colorFor === location.id && (
                    <div className="settings-row__palette">
                      <ColorPicker
                        value={location.color}
                        onChange={(color: LocationColor) => {
                          void setLocationColor(location.id, color)
                          setColorFor(null)
                        }}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir este local?"
        message="Ele sairá da lista de sugestões. Locais com plantões não podem ser excluídos."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
