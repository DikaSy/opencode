import { describe, expect, test } from "bun:test"
import {
  SandboxDate,
  SandboxMap,
  SandboxPromise,
  SandboxRegExp,
  SandboxSet,
  SandboxURL,
  SandboxURLSearchParams,
  isSandboxValue,
} from "../src/values.js"

describe("Code Smell Guard - Complex Binary Expression", () => {
  test("fails if implementation uses chained logical OR operators (||)", () => {
    const fnSource = isSandboxValue.toString()
    // The original un-refactored function contained 5 '||' operators.
    // The refactored version uses an array lookup (.some) and has 0 '||' operators.
    const orCount = (fnSource.match(/\|\|/g) || []).length
    expect(orCount).toBeLessThan(2)
  })

  test("fails if implementation uses repeated instanceof checks instead of array lookup", () => {
    const fnSource = isSandboxValue.toString()
    // The original un-refactored function had 6 repeated 'instanceof' expressions.
    // The refactored version delegates to .some(), using only a single 'instanceof' inside the callback.
    const instanceofCount = (fnSource.match(/instanceof/g) || []).length
    expect(instanceofCount).toBeLessThan(2)
  })
})

describe("Refactored Logic Verification", () => {
  test("evaluates all target sandbox classes previously in the logical OR chain", () => {
    const instances = [
      new SandboxDate(Date.now()),
      new SandboxRegExp("test", "i"),
      new SandboxMap(),
      new SandboxSet(),
      new SandboxURL(new URL("https://example.com")),
      new SandboxURLSearchParams(new URLSearchParams("a=1")),
    ]

    for (const instance of instances) {
      expect(isSandboxValue(instance)).toBe(true)
    }
  })

  test("correctly short-circuits and rejects types excluded from the array", () => {
    const excludedPromise = new SandboxPromise(undefined)
    expect(isSandboxValue(excludedPromise)).toBe(false)
  })
})

describe("SandboxPromise", () => {
  test("initializes with fiber and default interrupted status", () => {
    const promise = new SandboxPromise(undefined)
    expect(promise.fiber).toBeUndefined()
    expect(promise.immediate).toBeUndefined()
    expect(promise.interrupted).toBe(false)
  })

  test("allows mutating interrupted status", () => {
    const promise = new SandboxPromise(undefined)
    promise.interrupted = true
    expect(promise.interrupted).toBe(true)
  })
})

describe("SandboxDate", () => {
  test("stores numeric timestamp correctly", () => {
    const now = Date.now()
    const sandboxDate = new SandboxDate(now)
    expect(sandboxDate.time).toBe(now)
  })

  test("handles zero, negative, and NaN timestamps", () => {
    expect(new SandboxDate(0).time).toBe(0)
    expect(new SandboxDate(-1000).time).toBe(-1000)
    expect(Number.isNaN(new SandboxDate(NaN).time)).toBe(true)
  })
})

describe("SandboxRegExp", () => {
  test("compiles regular expression with pattern and flags", () => {
    const sandboxRegex = new SandboxRegExp("^[a-z]+$", "i")
    expect(sandboxRegex.regex).toBeInstanceOf(RegExp)
    expect(sandboxRegex.regex.test("Hello")).toBe(true)
    expect(sandboxRegex.regex.test("123")).toBe(false)
  })

  test("handles empty pattern and complex flags", () => {
    const regex = new SandboxRegExp("", "gim")
    expect(regex.regex.source).toBe("(?:)")
    expect(regex.regex.global).toBe(true)
    expect(regex.regex.ignoreCase).toBe(true)
    expect(regex.regex.multiline).toBe(true)
  })
})

describe("SandboxMap", () => {
  test("initializes an empty native Map", () => {
    const sandboxMap = new SandboxMap()
    expect(sandboxMap.map).toBeInstanceOf(Map)
    expect(sandboxMap.map.size).toBe(0)
  })

  test("supports standard Map operations", () => {
    const sandboxMap = new SandboxMap()
    sandboxMap.map.set("key", "value")
    expect(sandboxMap.map.get("key")).toBe("value")
    expect(sandboxMap.map.has("key")).toBe(true)
    expect(sandboxMap.map.size).toBe(1)
  })
})

describe("SandboxSet", () => {
  test("initializes an empty native Set", () => {
    const sandboxSet = new SandboxSet()
    expect(sandboxSet.set).toBeInstanceOf(Set)
    expect(sandboxSet.set.size).toBe(0)
  })

  test("supports standard Set operations", () => {
    const sandboxSet = new SandboxSet()
    sandboxSet.set.add(42)
    expect(sandboxSet.set.has(42)).toBe(true)
    expect(sandboxSet.set.size).toBe(1)
  })
})

describe("SandboxURLSearchParams", () => {
  test("wraps URLSearchParams correctly", () => {
    const params = new URLSearchParams("a=1&b=2")
    const sandboxParams = new SandboxURLSearchParams(params)
    expect(sandboxParams.params.get("a")).toBe("1")
    expect(sandboxParams.params.get("b")).toBe("2")
  })
})

describe("SandboxURL", () => {
  test("wraps URL and initializes nested searchParams", () => {
    const nativeUrl = new URL("https://example.com/path?foo=bar#hash")
    const sandboxUrl = new SandboxURL(nativeUrl)

    expect(sandboxUrl.url).toBe(nativeUrl)
    expect(sandboxUrl.searchParams).toBeInstanceOf(SandboxURLSearchParams)
    expect(sandboxUrl.searchParams.params.get("foo")).toBe("bar")
  })
})

describe("isSandboxValue - Positive Cases", () => {
  test("identifies SandboxDate", () => {
    expect(isSandboxValue(new SandboxDate(1000))).toBe(true)
  })

  test("identifies SandboxRegExp", () => {
    expect(isSandboxValue(new SandboxRegExp("abc", "g"))).toBe(true)
  })

  test("identifies SandboxMap", () => {
    expect(isSandboxValue(new SandboxMap())).toBe(true)
  })

  test("identifies SandboxSet", () => {
    expect(isSandboxValue(new SandboxSet())).toBe(true)
  })

  test("identifies SandboxURLSearchParams", () => {
    const params = new URLSearchParams()
    expect(isSandboxValue(new SandboxURLSearchParams(params))).toBe(true)
  })

  test("identifies SandboxURL", () => {
    const url = new URL("https://example.com")
    expect(isSandboxValue(new SandboxURL(url))).toBe(true)
  })

  test("identifies subclasses of sandbox classes", () => {
    class ExtendedSandboxDate extends SandboxDate {}
    expect(isSandboxValue(new ExtendedSandboxDate(100))).toBe(true)
  })

  test("identifies instances created with Object.create", () => {
    const obj = Object.create(SandboxMap.prototype)
    expect(isSandboxValue(obj)).toBe(true)
  })
})

describe("isSandboxValue - Negative Cases", () => {
  test("returns false for native JavaScript built-ins", () => {
    expect(isSandboxValue(new Date())).toBe(false)
    expect(isSandboxValue(/test/)).toBe(false)
    expect(isSandboxValue(new Map())).toBe(false)
    expect(isSandboxValue(new Set())).toBe(false)
    expect(isSandboxValue(new URL("https://example.com"))).toBe(false)
    expect(isSandboxValue(new URLSearchParams())).toBe(false)
    expect(isSandboxValue(Promise.resolve())).toBe(false)
  })

  test("returns false for duck-typed structural imitations", () => {
    const fakeMap = { map: new Map() }
    const fakeRegExp = { regex: /test/ }
    const fakeDate = { time: 123456789 }

    expect(isSandboxValue(fakeMap)).toBe(false)
    expect(isSandboxValue(fakeRegExp)).toBe(false)
    expect(isSandboxValue(fakeDate)).toBe(false)
  })

  test("returns false for primitive values", () => {
    expect(isSandboxValue(null)).toBe(false)
    expect(isSandboxValue(undefined)).toBe(false)
    expect(isSandboxValue(0)).toBe(false)
    expect(isSandboxValue(123)).toBe(false)
    expect(isSandboxValue(-1)).toBe(false)
    expect(isSandboxValue(NaN)).toBe(false)
    expect(isSandboxValue(Infinity)).toBe(false)
    expect(isSandboxValue("")).toBe(false)
    expect(isSandboxValue("SandboxDate")).toBe(false)
    expect(isSandboxValue(true)).toBe(false)
    expect(isSandboxValue(false)).toBe(false)
    expect(isSandboxValue(Symbol("sandbox"))).toBe(false)
    expect(isSandboxValue(BigInt(100))).toBe(false)
  })

  test("returns false for objects, functions, and arrays", () => {
    expect(isSandboxValue({})).toBe(false)
    expect(isSandboxValue([])).toBe(false)
    expect(isSandboxValue(() => {})).toBe(false)
    expect(isSandboxValue(async () => {})).toBe(false)
    expect(isSandboxValue(class Test {})).toBe(false)
    expect(isSandboxValue(new Error("err"))).toBe(false)
    expect(isSandboxValue(Object.create(null))).toBe(false)
  })
})