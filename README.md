# event-ts

## Example

```typescript
import * as E from '@tetsuo/event-ts/lib/Event'

E.event.alt(E.from([1, 2]), () => E.of(3))(console.log)
```

outputs

```
1
2
3
```
