import { describe, expect, it } from 'vitest'
import {
  dayScale,
  hourScale,
  MAX_OCCURRENCES,
  nthWeekdayOf,
  nthWeekdayPhrase,
  recurrenceGroups,
  recurrenceLabel,
  recurrenceShiftHours,
  recurrenceStarts,
  sameRecurrence,
  selectedOptionId,
  type Recurrence,
} from '@/domain/recurrence'

/** Terça-feira, 19:00. */
const START = '2026-08-25T19:00'

const starts = (recurrence: Recurrence, until: string, max?: number) =>
  recurrenceStarts(START, recurrence, until, max)

describe('escalas de horas', () => {
  it('12×36 volta a cada 48 horas — sempre no mesmo horário', () => {
    expect(starts(hourScale([12, 36]), '2026-08-31')).toEqual([
      '2026-08-25T19:00',
      '2026-08-27T19:00',
      '2026-08-29T19:00',
      '2026-08-31T19:00',
    ])
  })

  it('12×24 alterna dia e noite', () => {
    expect(starts(hourScale([12, 24]), '2026-08-28')).toEqual([
      '2026-08-25T19:00',
      '2026-08-27T07:00',
      '2026-08-28T19:00',
    ])
  })

  it('24×48 volta a cada três dias', () => {
    expect(starts(hourScale([24, 48]), '2026-09-01')).toEqual([
      '2026-08-25T19:00',
      '2026-08-28T19:00',
      '2026-08-31T19:00',
    ])
  })

  it('12×24, 12×72 alterna os dois ciclos', () => {
    // 36h até o segundo, 84h até o terceiro, e recomeça.
    expect(starts(hourScale([12, 24], [12, 72]), '2026-09-05')).toEqual([
      '2026-08-25T19:00',
      '2026-08-27T07:00',
      '2026-08-30T19:00',
      '2026-09-01T07:00',
      '2026-09-04T19:00',
    ])
  })

  it('define a duração do plantão', () => {
    expect(recurrenceShiftHours(hourScale([24, 120]))).toBe(24)
    expect(recurrenceShiftHours(dayScale([5, 2]))).toBeNull()
    expect(recurrenceShiftHours({ kind: 'none' })).toBeNull()
  })
})

describe('escalas de dias', () => {
  it('5×2 dá cinco plantões seguidos e dois dias de folga', () => {
    expect(starts(dayScale([5, 2]), '2026-09-04')).toEqual([
      '2026-08-25T19:00',
      '2026-08-26T19:00',
      '2026-08-27T19:00',
      '2026-08-28T19:00',
      '2026-08-29T19:00',
      '2026-09-01T19:00',
      '2026-09-02T19:00',
      '2026-09-03T19:00',
      '2026-09-04T19:00',
    ])
  })

  it('1×1 é dia sim, dia não', () => {
    expect(starts(dayScale([1, 1]), '2026-08-29')).toEqual([
      '2026-08-25T19:00',
      '2026-08-27T19:00',
      '2026-08-29T19:00',
    ])
  })

  it('1×1, 1×3 alterna as duas folgas', () => {
    expect(starts(dayScale([1, 1], [1, 3]), '2026-09-06')).toEqual([
      '2026-08-25T19:00',
      '2026-08-27T19:00',
      '2026-08-31T19:00',
      '2026-09-02T19:00',
      '2026-09-06T19:00',
    ])
  })

  it('6×1 é a semana inteira menos um dia', () => {
    expect(starts(dayScale([6, 1]), '2026-08-31')).toHaveLength(6)
  })
})

describe('a série começa no dia marcado, mesmo no passado', () => {
  it('inclui o domingo da mesma semana quando o início é na terça', () => {
    expect(
      starts({ kind: 'weekdays', weekdays: [0], everyWeeks: 1 }, '2026-09-06'),
    ).toEqual(['2026-08-23T19:00', '2026-08-30T19:00', '2026-09-06T19:00'])
  })

  it('de segunda a sexta a partir de uma terça começa na segunda', () => {
    const dates = starts({ kind: 'weekdays', weekdays: [1, 2, 3, 4, 5], everyWeeks: 1 }, '2026-08-28')
    expect(dates[0]).toBe('2026-08-24T19:00')
    expect(dates).toHaveLength(5)
  })

  it('a cada 2 semanas pula a semana intermediária inteira', () => {
    expect(
      starts({ kind: 'weekdays', weekdays: [1, 3], everyWeeks: 2 }, '2026-09-12'),
    ).toEqual([
      '2026-08-24T19:00',
      '2026-08-26T19:00',
      '2026-09-07T19:00',
      '2026-09-09T19:00',
    ])
  })
})

describe('escalas mensais', () => {
  const firstSaturday: Recurrence = { kind: 'monthlyWeekday', nth: 1, weekday: 6 }

  it('todo mês no mesmo dia, sem escorregar em fevereiro', () => {
    expect(recurrenceStarts('2026-01-31T07:00', { kind: 'monthlyDay' }, '2026-04-30')).toEqual([
      '2026-01-31T07:00',
      '2026-02-28T07:00',
      '2026-03-31T07:00',
      '2026-04-30T07:00',
    ])
  })

  it('todo mês na mesma posição da semana', () => {
    // 01/08/2026 é o primeiro sábado de agosto.
    expect(recurrenceStarts('2026-08-01T07:00', firstSaturday, '2026-11-30')).toEqual([
      '2026-08-01T07:00',
      '2026-09-05T07:00',
      '2026-10-03T07:00',
      '2026-11-07T07:00',
    ])
  })

  it('pula os meses sem a quinta ocorrência do dia', () => {
    // 29/08/2026 é o 5º sábado de agosto. Setembro, novembro e dezembro só têm
    // quatro sábados, então ficam de fora.
    const fifthSaturday: Recurrence = { kind: 'monthlyWeekday', nth: 5, weekday: 6 }
    const dates = recurrenceStarts('2026-08-29T07:00', fifthSaturday, '2027-02-28')
    expect(dates).toEqual(['2026-08-29T07:00', '2026-10-31T07:00', '2027-01-30T07:00'])
  })

  /*
   * A EXCEÇÃO deliberada à regra central (invariante 9c): aqui a posição é
   * escolhida à mão, então a série pula para a primeira data que a satisfaz
   * a partir do dia digitado — nunca para trás.
   */
  it('pula para a próxima quando a posição já passou no mês do início', () => {
    // 26/08/2026 é quarta; o primeiro sábado de agosto (01/08) já passou.
    const dates = recurrenceStarts('2026-08-26T07:00', firstSaturday, '2026-10-31')
    expect(dates).toEqual(['2026-09-05T07:00', '2026-10-03T07:00'])
  })

  it('começa no próprio mês quando a posição ainda está por vir', () => {
    // 01/08/2026 é sábado; a primeira segunda de agosto é 03/08.
    const firstMonday: Recurrence = { kind: 'monthlyWeekday', nth: 1, weekday: 1 }
    expect(recurrenceStarts('2026-08-01T07:00', firstMonday, '2026-09-30')).toEqual([
      '2026-08-03T07:00',
      '2026-09-07T07:00',
    ])
  })

  it('começa no próprio dia quando a data já satisfaz a posição', () => {
    expect(recurrenceStarts('2026-08-01T07:00', firstSaturday, '2026-08-31')).toEqual([
      '2026-08-01T07:00',
    ])
  })
})

describe('limites', () => {
  it('nunca devolve lista vazia', () => {
    expect(starts({ kind: 'daily' }, '2020-01-01')).toEqual([START])
    expect(starts(hourScale([12, 36]), '2020-01-01')).toEqual([START])
  })

  it('respeita o teto em qualquer escala', () => {
    for (const recurrence of [
      { kind: 'daily' } as Recurrence,
      hourScale([12, 24]),
      dayScale([6, 1]),
      { kind: 'weekdays', weekdays: [0, 1, 2, 3, 4, 5, 6], everyWeeks: 1 } as Recurrence,
      { kind: 'monthlyDay' } as Recurrence,
    ]) {
      expect(starts(recurrence, '2040-01-01').length).toBeLessThanOrEqual(MAX_OCCURRENCES)
    }
  })

  it('uma escala sem folga nenhuma ainda avança', () => {
    expect(starts(dayScale([1, 0]), '2026-08-27')).toEqual([
      '2026-08-25T19:00',
      '2026-08-26T19:00',
      '2026-08-27T19:00',
    ])
  })

  it('aceita um teto menor', () => {
    expect(starts({ kind: 'daily' }, '2026-12-31', 3)).toHaveLength(3)
  })
})

describe('catálogo', () => {
  it('oferece os quatro grupos da tela', () => {
    const groups = recurrenceGroups('2026-08-25')
    // O recorrente vem primeiro: é o caso de quem tem escala fixa. As escalas
    // por ciclo ficam depois, para não empurrar o comum para baixo de 16 linhas.
    expect(groups.map((g) => g.title)).toEqual([
      undefined,
      'Escalas Recorrentes',
      'Escalas de Horas',
      'Escalas de Dias',
    ])
  })

  it('descreve o dia do mês no gênero certo', () => {
    // 01/08/2026 é sábado; 03/08/2026 é segunda-feira.
    expect(nthWeekdayPhrase({ nth: 1, weekday: 6 })).toBe('no primeiro sábado')
    expect(nthWeekdayPhrase({ nth: 1, weekday: 1 })).toBe('na primeira segunda-feira')
    expect(nthWeekdayPhrase({ nth: 3, weekday: 3 })).toBe('na terceira quarta-feira')
    // A posição vem da recorrência, não mais da data: com o plantão numa
    // quarta ainda dá para pedir o primeiro sábado.
    expect(nthWeekdayOf('2026-08-19')).toEqual({ nth: 3, weekday: 3 })
  })

  it('reconhece a escala escolhida', () => {
    expect(selectedOptionId(hourScale([12, 36]), '2026-08-25')).toBe('12x36')
    expect(selectedOptionId(dayScale([5, 2]), '2026-08-25')).toBe('5x2')
    expect(selectedOptionId({ kind: 'none' }, '2026-08-25')).toBe('none')
    // 25/08/2026 é terça: "todas as semanas" é a terça.
    expect(
      selectedOptionId({ kind: 'weekdays', weekdays: [2], everyWeeks: 1 }, '2026-08-25'),
    ).toBe('weekly')
  })

  it('marcar outros dias não tira a marca de "Todas as semanas"', () => {
    // O intervalo é que decide a casa; os dias são o ajuste dentro dela.
    expect(
      selectedOptionId({ kind: 'weekdays', weekdays: [1, 3, 5], everyWeeks: 1 }, '2026-08-25'),
    ).toBe('weekly')
    expect(
      selectedOptionId({ kind: 'weekdays', weekdays: [0, 6], everyWeeks: 2 }, '2026-08-25'),
    ).toBe('biweekly')
    // Segunda a sexta continua tendo casa própria, com nome próprio.
    expect(
      selectedOptionId({ kind: 'weekdays', weekdays: [1, 2, 3, 4, 5], everyWeeks: 1 }, '2026-08-25'),
    ).toBe('weekdays-1-5')
  })

  it('mexer na posição não tira a marca de "Todos os meses"', () => {
    // A posição é o ajuste DENTRO da linha, como os dias em "Todas as semanas".
    // 25/08/2026 é a 4ª terça: qualquer outra posição continua na mesma linha.
    expect(
      selectedOptionId({ kind: 'monthlyWeekday', nth: 4, weekday: 2 }, '2026-08-25'),
    ).toBe('monthly-weekday')
    expect(
      selectedOptionId({ kind: 'monthlyWeekday', nth: 1, weekday: 6 }, '2026-08-25'),
    ).toBe('monthly-weekday')
  })

  it('a linha Frequência mostra a posição escolhida, não a da data', () => {
    // Plantão numa terça, escala no primeiro sábado.
    expect(
      recurrenceLabel({ kind: 'monthlyWeekday', nth: 1, weekday: 6 }, '2026-08-25'),
    ).toBe('Todos os meses no primeiro sábado')
    expect(
      recurrenceLabel({ kind: 'monthlyWeekday', nth: 2, weekday: 3 }, '2026-08-25'),
    ).toBe('Todos os meses na segunda quarta-feira')
  })

  it('a linha Frequência mostra os dias escolhidos', () => {
    expect(
      recurrenceLabel({ kind: 'weekdays', weekdays: [1, 3], everyWeeks: 1 }, '2026-08-25'),
    ).toBe('Toda semana · Seg, Qua')
  })

  it('cai na linha personalizada quando não há escala pronta', () => {
    expect(selectedOptionId(hourScale([18, 30]), '2026-08-25')).toBe('hours-custom')
    expect(selectedOptionId(dayScale([4, 3]), '2026-08-25')).toBe('days-custom')
    expect(
      selectedOptionId({ kind: 'weekdays', weekdays: [1, 6], everyWeeks: 3 }, '2026-08-25'),
    ).toBe('weekdays-custom')
  })

  it('nomeia a escala na linha Frequência', () => {
    expect(recurrenceLabel({ kind: 'none' }, '2026-08-25')).toBe('Nenhuma')
    expect(recurrenceLabel(hourScale([12, 36]), '2026-08-25')).toBe('12×36')
    expect(recurrenceLabel(hourScale([18, 30]), '2026-08-25')).toBe('18×30')
    expect(recurrenceLabel(dayScale([4, 3]), '2026-08-25')).toBe('4×3 dias')
    expect(
      recurrenceLabel({ kind: 'weekdays', weekdays: [1, 2, 3, 4, 5], everyWeeks: 1 }, '2026-08-25'),
    ).toBe('Todas as semanas de segunda a sexta')
    expect(
      recurrenceLabel({ kind: 'weekdays', weekdays: [1, 6], everyWeeks: 3 }, '2026-08-25'),
    ).toBe('A cada 3 semanas · Seg, Sáb')
  })

  it('compara escalas sem se importar com a ordem dos dias', () => {
    expect(
      sameRecurrence(
        { kind: 'weekdays', weekdays: [4, 2], everyWeeks: 1 },
        { kind: 'weekdays', weekdays: [2, 4], everyWeeks: 1 },
      ),
    ).toBe(true)
    expect(sameRecurrence(hourScale([12, 36]), dayScale([12, 36]))).toBe(false)
    expect(sameRecurrence(hourScale([12, 36]), hourScale([12, 36], [12, 72]))).toBe(false)
  })

  it('duas posições no mês só são a mesma escala com o mesmo dia', () => {
    const firstSaturday: Recurrence = { kind: 'monthlyWeekday', nth: 1, weekday: 6 }
    expect(sameRecurrence(firstSaturday, { kind: 'monthlyWeekday', nth: 1, weekday: 6 })).toBe(true)
    expect(sameRecurrence(firstSaturday, { kind: 'monthlyWeekday', nth: 2, weekday: 6 })).toBe(false)
    expect(sameRecurrence(firstSaturday, { kind: 'monthlyWeekday', nth: 1, weekday: 0 })).toBe(false)
  })
})
