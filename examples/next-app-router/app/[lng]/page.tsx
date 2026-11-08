import { Suspense } from 'react'
import { DialogButton } from '../components/dialog-button'
import { Shell } from '../components/shell'
import { Streamed } from '../components/streamed'

export default function Page() {
  return (
    <main>
      {/* Shell: rendered before the first flush → its keys are in the inline store. */}
      <Shell />
      {/* Client-only UI: the server never renders the dialog body → loaded lazily on click. */}
      <DialogButton />
      {/* Streamed: resolves after the first flush → its key is NOT in the inline store. */}
      <Suspense fallback={<p>…</p>}>
        <SlowSection />
      </Suspense>
    </main>
  )
}

async function SlowSection() {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return <Streamed />
}
