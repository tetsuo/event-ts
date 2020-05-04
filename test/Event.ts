import * as E from '../src/Event'
import * as O from 'fp-ts/lib/Option'
import * as M from 'fp-ts/lib/Either'
import * as Eh from 'fp-ts/lib/Either'
import { pipe } from 'fp-ts/lib/pipeable'
import { monoidSum, monoidString } from 'fp-ts/lib/Monoid'
import { identity } from 'fp-ts/lib/function'
import tape from 'tape'

const assertEq = <A>(subscribe: E.Event<A>, expected: Array<A>) => (t: tape.Test) => {
  if (!expected.length) {
    t.plan(1)
    t.ok(true)
  } else {
    t.plan(expected.length)
  }
  let count = -1
  subscribe(a => t.equal(a, expected[++count]))
}

const test = <A>(name: string, event: E.Event<A>, expected: Array<A>) => tape(name, assertEq(event, expected))

const nonZero = (n: number): boolean => n > 0

const double = (n: number) => n * 2

const triple = (n: number) => n * 3

test('of', E.of(1), [1])

test('map', pipe(E.from([1, 2, 3]), E.map(double)), [2, 4, 6])

test('ap', pipe(E.from([double, triple]), E.ap(E.from([1, 2, 3]))), [3, 6, 9])

test(
  'alt',
  E.event.alt(E.of(1), () => E.of(2)),
  [1, 2]
)

test('zero', E.event.zero(), [])

test('getMonoid', E.getMonoid(monoidSum).concat(E.of(1), E.of(2)), [3])

test(
  'chain',
  pipe(
    E.from([1, 2, 3]),
    E.chain(a => E.from([a, a + 1]))
  ),
  [1, 2, 2, 3, 3, 4]
)

test('reduce', E.of(E.event.reduce(E.from(['b', 'c']), 'a', (b, a) => b + a)), ['abc'])

test('foldMap', E.of(E.event.foldMap(monoidString)(E.from(['a', 'b', 'c']), identity)), ['abc'])

test('reduceRight', E.of(E.event.reduceRight(E.from(['a', 'b', 'c']), '', (a, acc) => acc + a)), ['cba'])

test(
  'traverse not',
  O.getOrElse(() => E.event.of(3))(E.event.traverse(O.option)(E.from([1, 2]), n => (n % 2 === 0 ? O.none : O.some(n)))),
  [3]
)

test(
  'traverse',
  O.getOrElse(() => E.event.zero())(
    E.event.traverse(O.option)(E.from([1, 3]), n => (n % 2 === 0 ? O.none : O.some(n)))
  ),
  [1, 3]
)

test('sequence not', O.getOrElse(() => E.event.of(5))(E.event.sequence(O.option)(E.from([O.some(1), O.none]))), [5])

test('sequence', O.getOrElse(() => E.event.zero())(E.event.sequence(O.option)(E.from([O.some(1), O.some(3)]))), [1, 3])

test(
  'unfold',
  E.event.unfold(5, n => (n > 0 ? O.some([n, n - 1]) : O.none)),
  [5, 4, 3, 2, 1]
)

test(
  'fold',
  E.fold(E.from([1, 2]), 5, (b, a) => b + a),
  [8]
)

test('folded', E.folded(monoidSum)(E.from([1, 2, 3])), [6])

test('count', E.count(E.event.unfold(5, n => (n > 0 ? O.some([n, n - 1]) : O.none))), [5])

test('filter', E.filter(nonZero)(E.of(1)), [1])

test('filter not', E.filter(nonZero)(E.of(-1)), [])

test(
  'filterMap',
  E.event.filterMap(
    E.from([1, 2, 3]),
    O.fromPredicate(n => n > 1)
  ),
  [2, 3]
)

test(
  'compact',
  E.event.compact(
    E.event.map(
      E.from([1, 2, 3, 4]),
      O.fromPredicate(n => n > 2)
    )
  ),
  [3, 4]
)

test(
  'separate',
  pipe(
    E.event.separate(
      E.event.map(
        E.from([1, 2, 3]),
        Eh.fromPredicate(n => n > 1, identity)
      )
    ),
    ({ left, right }) => E.event.alt(right, () => left)
  ),
  [2, 3, 1]
)

test(
  'partitionMap',
  pipe(
    E.event.partitionMap(
      E.from([1, 2, 3]),
      Eh.fromPredicate(n => n > 1, identity)
    ),
    ({ left, right }) => E.event.alt(right, () => left)
  ),
  [2, 3, 1]
)

test(
  'partition',
  pipe(
    E.event.partition(E.from([1, 2, 3]), n => n > 1),
    ({ left, right }) => E.event.alt(right, () => left)
  ),
  [2, 3, 1]
)

tape('throwError', t => {
  t.plan(1)
  try {
    E.event.throwError('bla')
  } catch (e) {
    t.equal(e.message, 'bla')
  }
})

test('fromOption', E.fromOption(() => O.none)(O.some(1)), [1])

tape('fromOption not', t => {
  t.plan(1)
  try {
    E.fromOption(() => 'bla')(O.none)
  } catch (e) {
    t.equal(e.message, 'bla')
  }
})

test('fromEither', E.fromEither(M.right(5)), [5])

tape('fromEither not', t => {
  t.plan(1)
  try {
    E.fromEither(M.left('bla'))
  } catch (e) {
    t.equal(e.message, 'bla')
  }
})

test('fromPredicate', E.fromPredicate(nonZero, () => 1)(5), [5])

tape('fromPredicate not', t => {
  t.plan(1)
  try {
    E.fromPredicate(nonZero, () => 'bla')(-5)
  } catch (e) {
    t.equal(e.message, 'bla')
  }
})
