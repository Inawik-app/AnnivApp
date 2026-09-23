import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

/** Le secret ne s'affiche que tant que le doigt reste posé. */
export function SecretAuDoigt({ aide, children }: { aide: string; children: ComponentChildren }) {
  const [visible, setVisible] = useState(false);
  const cacher = () => setVisible(false);
  return (
    <button
      type="button"
      class={visible ? 'numero-secret visible' : 'numero-secret'}
      data-numero-secret="1"
      onPointerDown={(event) => {
        event.preventDefault();
        setVisible(true);
      }}
      onPointerUp={cacher}
      onPointerLeave={cacher}
      onPointerCancel={cacher}
      onContextMenu={(event) => event.preventDefault()}
    >
      {visible ? children : <span class="numero-secret-aide">{aide}</span>}
    </button>
  );
}
