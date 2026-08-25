/** Placeholder enquanto o banco carrega — evita a tela pular de vazio para cheia. */
export function Skeleton({ height = 72, radius = 'var(--radius-lg)' }: { height?: number; radius?: string }) {
  return <div className="skeleton" style={{ height, borderRadius: radius }} aria-hidden="true" />
}

export function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-label="Carregando">
      <Skeleton height={132} />
      <Skeleton height={84} />
      <Skeleton height={64} />
      <Skeleton height={64} />
    </div>
  )
}
