// 資料與計算：數字格式、獎項切點、球號對應、機率加總、各語言國名
import { describe, it, expect, afterEach } from 'vitest'
import { lang, L } from '../src/i18n.js'
import { fmtBig, fmtP, oneIn, tierOfHdi, TIERS, noHdi, BALLS, BALL_TOTAL, balls, isoOfBall, ISOS, C, nameOf, tierShort, pTier, mode } from '../src/lottery.js'

afterEach(() => { lang.value = 'zh'; mode.value = 'game' })

describe('L（四種語言）', () => {
  it('照目前語言回傳，日韓沒給就用英文', () => {
    lang.value = 'ja'; expect(L('en', 'zh', 'ja', 'ko')).toBe('ja')
    lang.value = 'ko'; expect(L('en', 'zh')).toBe('en')
    lang.value = 'en'; expect(L('en', 'zh', 'ja', 'ko')).toBe('en')
  })
})

describe('fmtBig（大數字）', () => {
  it('中文用萬、億', () => {
    lang.value = 'zh'
    expect(fmtBig(9999)).toBe('9,999')
    expect(fmtBig(23_400_000)).toBe('2,340 萬')
    expect(fmtBig(1_429_404_000)).toBe('14.3 億')
  })
  it('日文用万、韓文用만', () => {
    lang.value = 'ja'; expect(fmtBig(51_090_000)).toBe('5,109 万')
    lang.value = 'ko'; expect(fmtBig(51_090_000)).toBe('5,109 만')
  })
  it('英文用 million、billion', () => {
    lang.value = 'en'
    expect(fmtBig(9_200_000)).toBe('9.2 million')
    expect(fmtBig(8_232_000_000)).toBe('8.23 billion')
  })
  it('沒有資料顯示 —', () => expect(fmtBig(null)).toBe('—'))
})

describe('fmtP、oneIn', () => {
  it('百分比：大的一位小數、很小的兩位有效數字', () => {
    expect(fmtP(0.177)).toBe('17.7%')
    expect(fmtP(0.00012)).toBe('0.012%')
    expect(fmtP(0)).toBe('0.0%')
  })
  it('約 N 分之 1', () => { lang.value = 'en'; expect(oneIn(0.01)).toBe('100') })
})

describe('獎項', () => {
  it('HDI 越高獎越大，切點邊界正確', () => {
    for (let i = 0; i < TIERS.length - 1; i++) {
      const lo = Number(TIERS[i].range.match(/[\d.]+/)[0])
      expect(tierOfHdi(lo)).toBe(i)
    }
    expect(tierOfHdi(0)).toBe(TIERS.length - 1)
  })
  it('每一獎的機率加起來＝1（扣掉重抽）', () => {
    const sum = TIERS.reduce((s, t) => s + pTier(t), 0)
    expect(sum).toBeCloseTo(1, 9)
  })
  it('獎牌短名四種語言都有', () => {
    for (const l of ['zh', 'en', 'ja', 'ko']) { lang.value = l; for (let i = 0; i < TIERS.length; i++) expect(tierShort(i)).toBeTruthy() }
  })
  it('沒有 HDI 的國家另外算（重抽）', () => expect(noHdi.n).toBeGreaterThan(0))
})

describe('彩球', () => {
  it('總數＝每國球數加起來，每國至少 1 顆', () => {
    expect(Object.values(BALLS).reduce((a, b) => a + b, 0)).toBe(BALL_TOTAL)
    expect(Math.min(...Object.values(BALLS))).toBeGreaterThanOrEqual(1)
  })
  it('第 b 顆球是哪一國：跟每國的起點一致', () => {
    balls.isos.forEach((iso, k) => {
      expect(isoOfBall(balls.start[k])).toBe(iso)
      expect(isoOfBall(balls.start[k + 1] - 1)).toBe(iso)
    })
  })
})

describe('國名', () => {
  it('每一國四種語言都有名字', () => {
    for (const l of ['zh', 'en', 'ja', 'ko']) {
      lang.value = l
      for (const iso of ISOS) expect(nameOf(iso), `${l} ${iso}`).toBeTruthy()
    }
  })
  it('台灣用各國的常用說法', () => {
    lang.value = 'zh'; expect(nameOf('TWN')).toBe('臺灣')
    lang.value = 'ja'; expect(nameOf('TWN')).toBe('台湾')
    lang.value = 'ko'; expect(nameOf('TWN')).toBe('대만')
    lang.value = 'en'; expect(nameOf('TWN')).toBe(C.TWN.name_en)
  })
})
