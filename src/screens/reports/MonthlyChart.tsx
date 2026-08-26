import { useState } from "react";
import type { MonthBucket } from "@/domain/reports";
import { formatMonthYear, monthNames } from "@/domain/datetime";
import { formatMoney, formatMoneyCompact, formatNumber } from "@/domain/money";
import { Icon } from "@/components/ui/Icon";

type Metric = "expected" | "hours" | "shifts";

const METRICS: { value: Metric; label: string }[] = [
  { value: "expected", label: "Valor" },
  { value: "hours", label: "Horas" },
  { value: "shifts", label: "Plantões" },
];

/** Quantas linhas de grade além do zero. */
const GRID_STEPS = 3;

/**
 * Evolução mês a mês, em CSS puro — nenhuma biblioteca de gráficos no bundle.
 *
 * A altura é o previsto e a parte cheia é o já recebido; nas outras métricas a
 * barra é inteira, porque "hora recebida" não existe. Tocar numa barra troca a
 * leitura do topo — é ela que diz de que mês é a barra, já que doze rótulos
 * completos não cabem na largura de um iPhone.
 */
export function MonthlyChart({ data }: { data: MonthBucket[] }) {
  const [metric, setMetric] = useState<Metric>("expected");
  const [selected, setSelected] = useState(data.length - 1);

  const index = Math.min(selected, data.length - 1);
  const bucket = data[index];
  const before = index > 0 ? data[index - 1] : undefined;

  const values = data.map((b) => b[metric]);
  const max = niceMax(Math.max(...values, 0));
  const ticks = Array.from(
    { length: GRID_STEPS + 1 },
    (_, i) => (max / GRID_STEPS) * (GRID_STEPS - i),
  );

  const delta = trend(bucket[metric], before?.[metric]);

  return (
    <div className="chart">
      <div className="seg" role="group" aria-label="Métrica do gráfico">
        {METRICS.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={m.value === metric}
            className={`seg__item ${m.value === metric ? "is-active" : ""}`}
            onClick={() => setMetric(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="chart__read" aria-live="polite">
        <div>
          <p className="chart__read-month">
            {formatMonthYear(`${bucket.month}-01`)}
          </p>
          <p className="chart__read-value num">
            {formatMetric(bucket[metric], metric)}
          </p>
          <p className="chart__read-sub num">{subtitle(bucket, metric)}</p>
        </div>
        {delta !== null && (
          <span
            className={`trend trend--${
              metric !== "expected" ? "flat" : delta > 0 ? "up" : "down"
            }`}
          >
            <Icon
              name={delta > 0 ? "arrowUp" : "arrowDown"}
              size={13}
              strokeWidth={2.6}
            />
            {formatNumber(Math.abs(delta))}%
          </span>
        )}
      </div>

      <div className="chart__figure">
        <div className="chart__plot">
          <div className="chart__grid" aria-hidden="true">
            {ticks.map((tick) => (
              <div key={tick} className="chart__grid-line">
                <span className="chart__grid-tag num">
                  {formatTick(tick, metric)}
                </span>
              </div>
            ))}
          </div>

          <div className="chart__bars">
            {data.map((b, i) => {
              const value = b[metric];
              const height = max > 0 ? (value / max) * 100 : 0;
              const fill =
                metric === "expected" && b.expected > 0
                  ? Math.min(100, (b.received / b.expected) * 100)
                  : 100;
              return (
                <button
                  key={b.month}
                  type="button"
                  aria-pressed={i === index}
                  aria-label={`${formatMonthYear(`${b.month}-01`)}: ${formatMetric(value, metric)}`}
                  className={`chart__col ${i === index ? "is-selected" : ""}`}
                  onClick={() => setSelected(i)}
                >
                  <span className="chart__track">
                    {value > 0 && (
                      <span
                        className="chart__bar"
                        style={{ height: `${Math.max(2, height)}%` }}
                      >
                        <span
                          className="chart__bar-fill"
                          style={{ height: `${fill}%` }}
                        />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="chart__axis num" aria-hidden="true">
          {data.map((b, i) => (
            <span key={b.month} className={i === index ? "is-selected" : ""}>
              {monthNames[Number(b.month.slice(5, 7)) - 1]
                .charAt(0)
                .toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      {metric === "expected" && (
        <div className="chart__legend">
          <span className="chart__legend-item">
            <span
              className="chart__swatch chart__swatch--expected"
              aria-hidden="true"
            />
            Previsto
          </span>
          <span className="chart__legend-item">
            <span
              className="chart__swatch chart__swatch--received"
              aria-hidden="true"
            />
            Recebido
          </span>
        </div>
      )}
    </div>
  );
}

function formatMetric(value: number, metric: Metric): string {
  if (metric === "expected") return formatMoney(value);
  if (metric === "hours") return `${formatNumber(value)}h`;
  return String(value);
}

/** Rótulo do eixo: curto o bastante para caber ao lado das barras. */
function formatTick(value: number, metric: Metric): string {
  if (metric !== "expected") return formatNumber(value);
  return value >= 1000
    ? `${formatNumber(value / 1000)} mil`
    : formatNumber(value);
}

function subtitle(bucket: MonthBucket, metric: Metric): string {
  const shifts = `${bucket.shifts} ${bucket.shifts === 1 ? "plantão" : "plantões"}`;
  if (metric === "expected") {
    return `${formatMoneyCompact(bucket.received)} recebidos · ${shifts} · ${formatNumber(bucket.hours)}h`;
  }
  if (metric === "hours")
    return `${shifts} · ${formatMoneyCompact(bucket.expected)}`;
  return `${formatNumber(bucket.hours)}h · ${formatMoneyCompact(bucket.expected)}`;
}

/** Variação percentual para o mês anterior, arredondada. `null` se não dá para comparar. */
function trend(value: number, previous: number | undefined): number | null {
  if (previous === undefined || previous <= 0 || value <= 0) return null;
  const delta = Math.round(((value - previous) / previous) * 100);
  return delta === 0 ? null : delta;
}

/**
 * Teto do eixo que cai num número redondo e é divisível pelas linhas de grade —
 * sem isso o rótulo do meio sairia "R$ 7.133".
 */
function niceMax(value: number): number {
  if (value <= 0) return GRID_STEPS;
  const step = value / GRID_STEPS;
  const pow = 10 ** Math.floor(Math.log10(step));
  const nice =
    [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => step <= m * pow) ?? 10;
  return nice * pow * GRID_STEPS;
}
