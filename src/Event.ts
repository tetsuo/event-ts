import { HKT } from 'fp-ts/lib/HKT'
import { Applicative1, Applicative } from 'fp-ts/lib/Applicative'
import { Alternative1 } from 'fp-ts/lib/Alternative'
import { Alt1 } from 'fp-ts/lib/Alt'
import { Functor1 } from 'fp-ts/lib/Functor'
import { Semigroup } from 'fp-ts/lib/Semigroup'
import { Monoid } from 'fp-ts/lib/Monoid'
import { MonadThrow1 } from 'fp-ts/lib/MonadThrow'
import { Monad1 } from 'fp-ts/lib/Monad'
import { Traversable1 } from 'fp-ts/lib/Traversable'
import { Filterable1 } from 'fp-ts/lib/Filterable'
import { Unfoldable1 } from 'fp-ts/lib/Unfoldable'
import { Predicate, identity } from 'fp-ts/lib/function'
import { pipeable } from 'fp-ts/lib/pipeable'
import { array } from 'fp-ts/lib/Array'
import { Option, fromEither as optionFromEither } from 'fp-ts/lib/Option'
import { swap, fromPredicate as eitherFromPredicate } from 'fp-ts/lib/Either'

declare module 'fp-ts/lib/HKT' {
  interface URItoKind<A> {
    Event: Event<A>
  }
}

export const URI = 'Event'

export type URI = typeof URI

export type Subscriber<A> = (a: A) => void

export interface Event<A> {
  (sub: Subscriber<A>): void
}

const EMPTY: Event<never> = () => undefined

export function of<A>(a: A): Event<A> {
  return sub => sub(a)
}

function toArray<A>(fa: Event<A>): Array<A> {
  return event.reduce<A, Array<A>>(fa, [], (b, a) => b.concat(a))
}

export const event: Applicative1<URI> &
  Functor1<URI> &
  Alt1<URI> &
  Alternative1<URI> &
  Monad1<URI> &
  MonadThrow1<URI> &
  Traversable1<URI> &
  Unfoldable1<URI> &
  Filterable1<URI> = {
  URI,
  map: (fa, f) => sub => fa(a => sub(f(a))),
  chain: (fa, f) => sub => fa(a => f(a)(sub)),
  of: a => sub => sub(a),
  ap: (fab, fa) => sub => {
    let ab_latest: any
    let a_latest: any
    let ab_fired = false
    let a_fired = false

    fab(ab => {
      ab_latest = ab
      ab_fired = true
      if (a_fired) {
        sub(ab_latest(a_latest))
      }
    })

    fa(a => {
      a_latest = a
      a_fired = true
      if (ab_fired) {
        sub(ab_latest(a_latest))
      }
    })
  },
  reduce: <A, B>(fa: Event<A>, b: B, f: (b: B, a: A) => B): B => {
    const as: Array<A> = []
    fa(a => as.push(a))
    const len = as.length
    let r: B = b
    for (let i = 0; i < len; i++) {
      r = f(r, as[i])
    }
    return r
  },
  reduceRight: <A, B>(fa: Event<A>, b: B, f: (a: A, b: B) => B): B => {
    const as = toArray(fa)
    const len = as.length
    let r: B = b
    for (let i = len - 1; i >= 0; i--) {
      r = f(as[i], r)
    }
    return r
  },
  traverse: <F>(F: Applicative<F>): (<A, B>(ta: Event<A>, f: (a: A) => HKT<F, B>) => HKT<F, Event<B>>) => {
    const traverseF = array.traverse(F)
    return (ta, f) => F.map(traverseF(toArray(ta), f), from)
  },
  sequence: <F>(F: Applicative<F>): (<A>(ta: Event<HKT<F, A>>) => HKT<F, Event<A>>) => {
    const traverseF = event.traverse(F)
    return ta => traverseF(ta, identity)
  },
  unfold: (b, f) => from(array.unfold(b, f)),
  foldMap: M => (fa, f) => event.reduce(fa, M.empty, (acc, a) => M.concat(acc, f(a))),
  filter: <A>(fa: Event<A>, predicate: Predicate<A>): Event<A> => {
    return sub =>
      fa(a => {
        if (predicate(a)) {
          sub(a)
        }
      })
  },
  partitionMap: (fa, f) => ({
    left: event.filterMap(fa, a => optionFromEither(swap(f(a)))),
    right: event.filterMap(fa, a => optionFromEither(f(a)))
  }),
  partition: <A>(fa: Event<A>, p: Predicate<A>) => event.partitionMap(fa, eitherFromPredicate(p, identity)),
  filterMap: <A, B>(fa: Event<A>, f: (a: A) => Option<B>): Event<B> => {
    const as = toArray(fa)
    const len = as.length
    const r: Array<B> = []
    let ob: Option<B>
    for (let i = 0; i < len; i++) {
      ob = f(as[i])
      if (ob._tag === 'Some') {
        r.push(ob.value)
      }
    }
    return from(r)
  },
  compact: fa => event.filterMap(fa, identity),
  separate: fa => event.partitionMap(fa, identity),
  alt: (fx, fy) => sub => {
    fx(sub)
    fy()(sub)
  },
  zero: () => EMPTY,
  throwError: er => {
    throw er instanceof Error ? er : new Error(String(er))
  }
}

export const {
  map,
  flatten,
  chain,
  chainFirst,
  filterOrElse,
  reduce,
  reduceRight,
  foldMap,
  filter,
  filterMap,
  partition,
  partitionMap,
  compact,
  separate,
  ap,
  alt,
  apFirst,
  apSecond,
  fromEither,
  fromOption,
  fromPredicate
} = pipeable(event)

export function getSemigroup<A>(S: Semigroup<A>): Semigroup<Event<A>> {
  return {
    concat: (x, y) => sub => x(rx => y(ry => sub(S.concat(rx, ry))))
  }
}

export function getMonoid<A>(M: Monoid<A>): Monoid<Event<A>> {
  return {
    concat: getSemigroup(M).concat,
    empty: event.of(M.empty)
  }
}

export function fold<A, B>(fa: Event<A>, b: B, f: (a: A, b: B) => B): Event<B> {
  return sub => {
    let result = b
    fa(a => (result = f(a, result)))
    sub(result)
  }
}

export function count<A>(fa: Event<A>): Event<number> {
  return fold(fa, 0, (_, n) => n + 1)
}

export function folded<A>(M: Monoid<A>): (fa: Event<A>) => Event<A> {
  return fa => fold(fa, M.empty, (acc, a) => M.concat(acc, a))
}

export function sampleOn<A, B>(fab: Event<(a: A) => B>): (fa: Event<A>) => Event<B> {
  return fa => sub => {
    let latest: A
    let fired = false

    fa(a => {
      latest = a
      fired = true
    })

    fab(f => {
      if (fired) {
        sub(f(latest))
      }
    })
  }
}

export function sampleOn_<A, B>(fb: Event<B>): (fa: Event<A>) => Event<A> {
  return sampleOn<A, A>(event.map(fb, () => identity))
}

export function from<A>(as: Array<A>): Event<A> {
  return sub => {
    for (let i = 0; i < as.length; ++i) {
      sub(as[i])
    }
  }
}
