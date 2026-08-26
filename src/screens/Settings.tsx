import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card, SectionHeader } from '@/components/ui/Card'
import { ChipGroup } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { useAppData } from '@/state/appDataContext'
import { saveSettings } from '@/data/repository'
import type { ThemePreference } from '@/db/types'
import { PreferencesSection } from './settings/PreferencesSection'
import { LocationsSection } from './settings/LocationsSection'
import { TypesSection } from './settings/TypesSection'
import { BackupSection } from './settings/BackupSection'
import { APP_VERSION } from '@/appInfo'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Automático' },
]

export function Settings() {
  const { settings, shifts } = useAppData()

  return (
    <>
      <ScreenHeader title="Ajustes" hideAdd />

      <div className="screen">
        <section aria-label="Aparência">
          <SectionHeader title="Aparência" />
          <Card>
            <ChipGroup
              ariaLabel="Tema do aplicativo"
              options={THEME_OPTIONS}
              value={settings.theme}
              onChange={(value) => void saveSettings({ theme: value as ThemePreference })}
            />
          </Card>
        </section>

        <PreferencesSection />
        <LocationsSection />
        <TypesSection />
        <BackupSection />

        <section aria-label="Sobre o aplicativo">
          <SectionHeader title="Sobre" />
          <Card>
            <div className="about">
              <div className="about__head">
                <span className="about__mark" aria-hidden="true">
                  <Icon name="chart" size={20} />
                </span>
                <div>
                  <strong>Escalonil</strong>
                  <p>Organizador de plantões · versão {APP_VERSION}</p>
                </div>
              </div>
              <ul className="about__facts">
                <li>
                  <Icon name="wallet" size={16} />
                  {shifts.length} {shifts.length === 1 ? 'plantão' : 'plantões'} no histórico
                </li>
                <li>
                  <Icon name="device" size={16} />
                  Funciona offline depois de instalado na Tela de Início
                </li>
                <li>
                  <Icon name="info" size={16} />
                  Nenhum dado sai do aparelho: sem contas, sem servidores, sem rastreadores
                </li>
              </ul>
            </div>
          </Card>
        </section>
      </div>
    </>
  )
}
